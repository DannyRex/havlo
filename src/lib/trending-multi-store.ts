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

/* Helper: pull (product_id, store_id) pairs for offers a shopper in
   countryCode can actually buy. Uses two parallel .eq()-based queries
   against product_best_offers — the same patterns browse-db.ts already
   uses successfully for getOriginCounts. An earlier attempt that used
   a single .or() with a nested and() against the same view returned
   empty in production (commit bedabc5), so this splits the OR into
   two clean queries instead. Each query fans out 8 pages of 1000 rows
   for sample depth.

   Includes:
     · store_country = countryCode      → country-anchored retailers
     · is_international = true AND store_country IS NULL
                                        → true cross-border globals
                                          (AliExpress, SHEIN, Temu, …) */
async function aggregateOfferPairsCountryScoped(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  countryCode: string,
): Promise<Map<string, Set<string>>> {
  const cc = countryCode.toUpperCase();
  const PAGE  = 1000;
  const PAGES = 8;
  const localPages = Array.from({ length: PAGES }, (_, i) =>
    supa
      .from("product_best_offers")
      .select("product_id, store_id")
      .eq("store_country", cc)
      .order("scraped_at", { ascending: false })
      .range(i * PAGE, (i + 1) * PAGE - 1),
  );
  const intlPages = Array.from({ length: PAGES }, (_, i) =>
    supa
      .from("product_best_offers")
      .select("product_id, store_id")
      .eq("is_international", true)
      .is("store_country", null)
      .order("scraped_at", { ascending: false })
      .range(i * PAGE, (i + 1) * PAGE - 1),
  );
  const results = await Promise.all([...localPages, ...intlPages]);
  const map = new Map<string, Set<string>>();
  for (const r of results) {
    if (!r.data) continue;
    for (const o of r.data as OfferRow[]) {
      const set = map.get(o.product_id) ?? new Set<string>();
      set.add(o.store_id);
      map.set(o.product_id, set);
    }
  }
  return map;
}

/* Helper: country-agnostic fallback used when the scoped fetch comes
   back thin. Pulls from the raw `offers` table (in-stock only) — the
   pre-country-scoping query that we know returns a real pool. Counts
   in this branch are GLOBAL (not country-aware), but it guarantees
   the chip rail keeps showing pills if anything in the scoped path
   drifts (view columns rename, transient upstream blip, unsupported
   country, …). */
async function aggregateOfferPairsGlobal(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): Promise<Map<string, Set<string>>> {
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
  const map = new Map<string, Set<string>>();
  for (const r of results) {
    if (!r.data) continue;
    for (const o of r.data as OfferRow[]) {
      const set = map.get(o.product_id) ?? new Set<string>();
      set.add(o.store_id);
      map.set(o.product_id, set);
    }
  }
  return map;
}

async function fetchMultiStoreTitlesForCountry(countryCode: string): Promise<MultiStoreChip[]> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];

  /* Country-scoped first: count distinct stores per product that a
     shopper in this country can actually buy from. Same shoppable
     definition browse-db.getOriginCounts uses, so a chip's store
     count tracks what /compare actually surfaces for the visitor. */
  let productStores = await aggregateOfferPairsCountryScoped(supa, countryCode);

  /* Snapshot of country-permissible product IDs. A product appears
     in the scoped result iff it has at least one country-allowed
     offer in product_best_offers; use that as the safety gate for
     the global fallback below so a chip pool from the global path
     can never include a product with ZERO country-allowed offers.
     User-reported bug (May 2026): "some pills return nothing found
     on compare". Root cause: the global fallback was unfiltered,
     so chips from it pointed at products whose offers all failed
     isOfferAllowedForCountry once /api/compare ran, returning
     mode:"empty" -> empty state. */
  const countryProductIds = new Set(productStores.keys());

  /* Defensive fallback: if the country-scoped fetch yields too few
     qualifying products (an unsupported country, view-column drift, a
     transient upstream issue, …), fall back to the broader `offers`
     query so the rail keeps showing pills with global counts rather
     than going empty. The bedabc5 regression — empty chips on every
     country — is exactly why this exists. A "thin" scoped pool is
     fewer than MIN_SCOPED_QUALIFYING products with >= 2 stores; well
     below what a healthy country pool returns. Logged so we notice
     it in deploy traces. */
  const MIN_SCOPED_QUALIFYING = 10;
  const qualifiedCountScoped = Array.from(productStores.values())
    .filter((s) => s.size >= MIN_STORES_FOR_CHIP).length;
  if (qualifiedCountScoped < MIN_SCOPED_QUALIFYING) {
    console.warn(
      `[trending-multi-store] country=${countryCode} country-scoped pool only ${qualifiedCountScoped} qualifying products - falling back to global`,
    );
    const global = await aggregateOfferPairsGlobal(supa);
    /* Intersect: products with >=2 stores GLOBALLY (broader pool for
       chip variety) AND >=1 country-allowed offer (so every chip
       click resolves to at least an anchor card, never an empty
       state). Display storeCount comes from the global map — the
       chip's claim is "this product is compared across N stores
       worldwide", which is honest even if the visitor can only
       shop a subset from their country. */
    const intersected = new Map<string, Set<string>>();
    for (const [pid, set] of Array.from(global.entries())) {
      if (countryProductIds.has(pid)) intersected.set(pid, set);
    }
    productStores = intersected;
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

  /* multiStoreChips is the entire chip pool. Every entry has at least
     MIN_STORES_FOR_CHIP distinct stores, so every chip clicks into a
     genuine cross-store comparison. An earlier single-store "top-up"
     that padded thin categories (beauty / fashion / home) was removed:
     a one-store product has nothing to compare and does not belong in
     a "Popular comparisons" rail (founder direction May 2026). The
     per-category cap below is the diversity lever; the rail leans
     toward categories where the catalog has real cross-store overlap,
     and broadening that is a catalog-coverage task, not a display one. */

  /* Group by category, cap each, then merge. Round-robin across
     categories so the final pool order is interleaved (phones,
     beauty, computing, fashion, audio, home, gaming, appliances,
     phones, ...) — TrendingChipRail picks 10 random from this
     pre-mixed pool so the visible chips look diverse even before
     the rotation kicks in. */
  const byCategory = new Map<string, MultiStoreChip[]>();
  for (const c of multiStoreChips) {
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
   in the background while serving the stale set.

   Country-scoped: call as getTrendingMultiStoreTitles(countryCode).
   The countryCode argument is part of the unstable_cache key, so each
   market gets its own cached pool. */
export const getTrendingMultiStoreTitles = unstable_cache(
  fetchMultiStoreTitlesForCountry,
  /* v6 cache key — bumped because the global-fallback path now
     intersects with country-permissible product IDs so chips never
     promise a comparison that resolves to "Nothing found." Old v5
     entries served chips with un-permissible products; bypass them
     so users see the corrected pool immediately on deploy. */
  ["trending-multi-store-v6-country-permissible-fallback"],
  { revalidate: REVALIDATE_S, tags: [CACHE_TAG] },
);
