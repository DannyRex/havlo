/* Source of titles for the homepage "What people are searching for"
   chip rail. Only emits titles for products that have ≥2 distinct
   in-stock offers in the DB — those are the products where /compare
   actually has something useful to compare across stores.

   Why this exists: the previous chip pool was a hardcoded list of
   60+ aspirational queries. Most of them returned "Nothing in our
   local index" or a 1-store anchor, which made the chips feel like
   a teaser rather than a real shortcut into the product. QA round 3
   flagged this as homepage clutter that doesn't earn its space.

   Replace with the actual cross-store overlap surface. If we have
   8 stores carrying iPhone 17 Pro Max, that chip is genuinely
   useful — clicking it yields a real comparison. If we have only
   1 store carrying "Drunk Elephant Bronzing Drops", we don't show
   it (yet — once we have 2+, it qualifies).

   Implementation:
     1. Fan-out paginated query over offers table to compute the
        per-product distinct-store-count map (~7 fetches, parallel).
     2. Filter products with stores_count >= 2.
     3. Resolve those product_ids to titles.
     4. Cache for 5 min (matches the chip rotation cadence) so the
        cost is amortised across all homepage renders in that window.

   Falls back to an empty array if the DB is unreachable; the chip
   component then hides the section rather than showing stale data. */

import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { inferCategoryFromTitle } from "@/lib/categorize";
import { friendlifyChipTitle } from "@/lib/chip-titles";

interface OfferRow { product_id: string; store_id: string }
interface ProductRow { id: string; title: string; category_slug: string | null }

/* QA round-4 caught: the chip pool surfaced "Universal Headphone
   Headband Head beam Silicone Cover for Sony WH-1000XM5 Headset
   Headband Protectors with Zipper Cover3" (a counterfeit accessory)
   as the lead chip. Two filters needed at the chip-promotion level:

   1. Length cap. Real flagship product titles fit in ~70 chars.
      AliExpress SEO-stuffed accessory titles run 100+. Anything
      past the cap is almost certainly keyword junk.
   2. Accessory exclusion. If inferCategoryFromTitle says the title
      is a phone/audio accessory (case, cover, sleeve, headband,
      bracket, etc.), it might still have multi-store coverage but
      it's not what users want when clicking a homepage chip
      promising "real comparisons". They want the actual product. */
const MAX_CHIP_TITLE_LENGTH = 70;
function looksLikeChipJunk(title: string): boolean {
  if (title.length > MAX_CHIP_TITLE_LENGTH) return true;
  /* Strong accessory/junk signals — same matchers used in
     categorize.ts but applied as a NEGATIVE filter here. */
  if (/\b(case|cover|protector|sleeve|cradle|holder|mount|bracket|tripod|gimbal|adapter|connector|organizer|silicone|headband\s*head\s*beam|head\s*band\s*protector|dust\s*plug|screen\s*film)\b/i.test(title)) return true;
  /* Spam-stuffed keyword titles (AliExpress wholesale signals). */
  if (/\b(wholesale|\/lot|pcs\/|10pcs|20pcs|50pcs|100pcs|drop\s*shipping)\b/i.test(title)) return true;
  /* Multi-pack / multi-piece titles that start with a quantity.
     Round-4 user-reported case: "10 Pcs Stainless Steel Colored
     Handi Set" friendlified to "10 Pcs Stainless Steel Colored" —
     ugly chip label, single-store product, and the search itself
     matched too loosely. Drop quantity-led titles from the chip
     pool entirely. Catches "10 Pcs", "5 Pack", "20 Count", "12 Ct",
     "3 in 1 Pack", "Set of 4", etc. */
  if (/^\s*\d+\s*(pcs?|pack|piece|count|ct|in\s*1\s*pack|x)\b/i.test(title)) return true;
  if (/\bset\s+of\s+\d+\b/i.test(title)) return true;
  /* Titles that include a product spec like "Size: 7.23 oz" — these
     are imported listings with junk metadata in the title field. */
  if (/\b(size|weight|color):\s*[0-9]/i.test(title)) return true;
  /* Inferred-category sanity check: the chip is meant to surface
     the product, not its accessories. If the classifier says the
     title is "electronics" but it contains a clear phone/audio
     keyword, it's likely an accessory and we drop it.
     (Real phones / audio classify as "phones" / "audio".) */
  const cat = inferCategoryFromTitle(title);
  if (cat === "electronics" && /\b(phone|smartphone|airpods|headphone|earbud|earphone)\b/i.test(title)) {
    return true;
  }
  return false;
}

const CACHE_TAG    = "trending-multi-store";
const REVALIDATE_S = 300; // 5 min — matches the chip-rotation bucket

/* Min stores per product to qualify for the chip pool. 2 is the
   minimum that makes the comparison meaningful (1 store = no
   comparison). Could bump to 3 for higher signal once the catalog
   gets denser. */
const MIN_STORES_FOR_CHIP = 2;

/* Per-product offer-count cap. Keeps the JS-side aggregation cheap
   and prevents one viral SKU from monopolising the result. */
const MAX_PRODUCTS_RETURNED = 200;

export interface MultiStoreChip {
  /** Friendlified consumer label ("iPhone 17 Pro", "AirPods 4"). */
  title:        string;
  /** Raw DB title — used as the search query when the chip is
      clicked, since FTS hits all token forms. The friendlified
      label is for display, the raw is for the URL. */
  searchQuery:  string;
  /** Product ID for direct DB lookup when FTS misses. Round-4 QA:
      user clicked a chip and got "Nothing in our local index" —
      root cause was stale chip data (FTS couldn't anchor after the
      catalog shifted). Passing productId as a backstop lets the
      compare API do a direct lookup when FTS returns empty. */
  productId:    string;
  storeCount:   number;
  /** Category slug — used by callers (TrendingChipRail) for
      per-category balancing on display. Optional because
      database-side categorisation isn't always present. */
  categorySlug?: string | null;
}

/* Per-category cap so phones don't dominate the rail. Without it,
   60% of the pool was tech (phones/computing/audio) because that's
   where the catalog has the most cross-store overlap. User
   feedback: "Popular comparisons shows only gadgets, can you
   include products from other categories... Add more and randomise". */
const PER_CATEGORY_CAP = 12;

/* Thin-coverage categories that rarely hit ≥2 stores. We relax to
   ≥1 store for these so the rail can show beauty / fashion / home
   / appliances at all. Honest framing: the chip badge still shows
   the real store count, so users know up-front whether it's a real
   "compare across N stores" or a "1 store, popular item". */
const THIN_COVERAGE_CATEGORIES = new Set([
  "beauty", "fashion", "home", "appliances", "sports", "books",
  "groceries", "garden", "pets", "music", "automotive", "tv",
]);
const MIN_DISCOUNT_FOR_THIN_CAT = 25;  // %, only show meaningfully-discounted single-store items

async function fetchMultiStoreTitlesUncached(): Promise<MultiStoreChip[]> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];

  /* PostgREST caps single responses at db-max-rows (default 1000).
     Same fan-out pattern as browse-db.ts — pull up to 8000 in-stock
     offers in one parallel round trip. Enough sample to find the
     multi-store products without paying for a full table scan. */
  const PAGE  = 1000;
  const PAGES = 8;
  const pageRequests = Array.from({ length: PAGES }, (_, i) =>
    supa
      .from("offers")
      .select("product_id, store_id")
      .eq("in_stock", true)
      .order("scraped_at", { ascending: false })
      .range(i * PAGE, (i + 1) * PAGE - 1),
  );
  const results = await Promise.all(pageRequests);

  /* Aggregate: product_id → set of distinct store_ids. */
  const productStores = new Map<string, Set<string>>();
  for (const r of results) {
    if (!r.data) continue;
    for (const o of r.data as OfferRow[]) {
      const set = productStores.get(o.product_id) ?? new Set<string>();
      set.add(o.store_id);
      productStores.set(o.product_id, set);
    }
  }

  /* Filter to products with the qualifying store count. Sort by
     store-count descending so the most-compared products lead the
     pool — the chip rotation then picks 14 at random per bucket so
     less-compared products still get a turn. */
  const qualified = Array.from(productStores.entries())
    .filter(([, set]) => set.size >= MIN_STORES_FOR_CHIP)
    .sort(([, a], [, b]) => b.size - a.size)
    .slice(0, MAX_PRODUCTS_RETURNED);

  if (qualified.length === 0) return [];

  const ids = qualified.map(([id]) => id);
  const { data: products } = await supa
    .from("products")
    .select("id, title, category_slug")
    .in("id", ids);

  const productById = new Map<string, ProductRow>(
    ((products ?? []) as ProductRow[])
      .filter((p) => typeof p.title === "string" && p.title.trim().length > 0)
      .map((p) => [p.id, p]),
  );

  /* Build multi-store chip entries grouped by category for per-
     category capping. Dedup on the friendlified form so the same
     product under three raw titles ("Samsung Galaxy A26",
     "SAMSUNG Galaxy A26 5g - 128gb Rom", "Samsung Galaxy A26 5G
     Dual Sim") collapses to one chip. */
  const seenFriendly = new Map<string, MultiStoreChip>();
  for (const [id, set] of qualified) {
    const product = productById.get(id);
    if (!product) continue;
    if (looksLikeChipJunk(product.title)) continue;
    const friendly = friendlifyChipTitle(product.title);
    if (!friendly || friendly.length < 4) continue;
    const existing = seenFriendly.get(friendly);
    if (existing && existing.storeCount >= set.size) continue;
    seenFriendly.set(friendly, {
      title:        friendly,
      searchQuery:  product.title,
      productId:    id,
      storeCount:   set.size,
      categorySlug: product.category_slug,
    });
  }
  const multiStoreChips = Array.from(seenFriendly.values());

  /* Top up the pool with single-store products from thin-coverage
     categories (beauty / fashion / home / appliances / sports / etc.)
     that have a meaningful discount. Without this the rail is 60%
     phones because that's where the catalog overlaps. Honest framing:
     the badge still shows the real store count, so a "1" tells users
     it's a single-store popular item rather than a multi-store
     comparison. */
  const topUp: MultiStoreChip[] = [];
  /* For each thin-coverage category, pull a small top-discount slice. */
  for (const cat of Array.from(THIN_COVERAGE_CATEGORIES)) {
    const { data: catRows } = await supa
      .from("product_best_offers")
      .select("product_id, title, category_slug, discount_percent")
      .eq("category_slug", cat)
      .gte("discount_percent", MIN_DISCOUNT_FOR_THIN_CAT)
      .order("discount_percent", { ascending: false })
      .limit(20);
    if (!catRows) continue;
    for (const r of catRows as Array<{ product_id: string; title: string; category_slug: string | null }>) {
      if (!r.title || looksLikeChipJunk(r.title)) continue;
      const friendly = friendlifyChipTitle(r.title);
      if (!friendly || friendly.length < 4) continue;
      /* Don't double-count products already in the multi-store pool. */
      if (seenFriendly.has(friendly)) continue;
      const stores = productStores.get(r.product_id)?.size ?? 1;
      topUp.push({
        title:        friendly,
        searchQuery:  r.title,
        productId:    r.product_id,
        storeCount:   stores,
        categorySlug: r.category_slug,
      });
      seenFriendly.set(friendly, topUp[topUp.length - 1]);
    }
  }

  /* Group by category, cap each, then merge. Round-robin across
     categories so the final pool order is interleaved (phones,
     beauty, computing, fashion, audio, home, gaming, appliances,
     phones, ...) — TrendingChipRail picks 10 random from this
     pre-mixed pool so the visible chips look diverse even before
     the rotation kicks in. */
  const combined = [...multiStoreChips, ...topUp];
  const byCategory = new Map<string, MultiStoreChip[]>();
  for (const c of combined) {
    const cat = c.categorySlug ?? "other";
    const arr = byCategory.get(cat) ?? [];
    arr.push(c);
    byCategory.set(cat, arr);
  }
  /* Sort each category bucket by store count desc, then take top N. */
  const capped = new Map<string, MultiStoreChip[]>();
  for (const [cat, items] of Array.from(byCategory.entries())) {
    const sorted = items
      .sort((a: MultiStoreChip, b: MultiStoreChip) => b.storeCount - a.storeCount)
      .slice(0, PER_CATEGORY_CAP);
    capped.set(cat, sorted);
  }
  /* Round-robin interleave categories. */
  const result: MultiStoreChip[] = [];
  const buckets = Array.from(capped.values());
  let added = true;
  while (added) {
    added = false;
    for (const items of buckets) {
      const next = items.shift();
      if (next) { result.push(next); added = true; }
    }
  }
  return result;
}

/* unstable_cache wraps the helper with Next's request-deduped + ISR
   cache. Multiple homepage renders within REVALIDATE_S share one DB
   round trip; after the window expires, the next render re-fetches
   in the background while serving the stale set. */
export const getTrendingMultiStoreTitles = unstable_cache(
  fetchMultiStoreTitlesUncached,
  /* v2 cache key bumped when the pool composition logic changed
     (per-category cap + thin-category top-up). Old v1 cache entries
     get bypassed automatically. */
  ["trending-multi-store-v2"],
  { revalidate: REVALIDATE_S, tags: [CACHE_TAG] },
);
