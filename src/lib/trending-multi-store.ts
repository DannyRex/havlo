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
interface ProductRow { id: string; title: string }

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
}

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
    .select("id, title")
    .in("id", ids);

  /* Join back with the store counts. Maintains the title-cleanliness
     check (drop products where the title is empty or whitespace-only,
     which sometimes happens for poorly-ingested SerpAPI rows). */
  const titleById = new Map<string, string>(
    ((products ?? []) as ProductRow[])
      .filter((p) => typeof p.title === "string" && p.title.trim().length > 0)
      .map((p) => [p.id, p.title]),
  );

  /* Friendlify titles for display + dedup on the friendlified form
     so we don't surface the same product under three slightly-
     different raw titles ("Samsung Galaxy A26", "SAMSUNG Galaxy
     A26 5g - 128gb Rom", "Samsung Galaxy A26 5G Dual Sim") when
     they all friendlify to "Samsung Galaxy A26 5G". Keep the
     highest-store-count entry per friendlified label. */
  const seenFriendly = new Map<string, MultiStoreChip>();
  for (const [id, set] of qualified) {
    const raw = titleById.get(id);
    if (!raw) continue;
    if (looksLikeChipJunk(raw)) continue;
    const friendly = friendlifyChipTitle(raw);
    if (!friendly || friendly.length < 4) continue;
    const existing = seenFriendly.get(friendly);
    if (existing && existing.storeCount >= set.size) continue;
    seenFriendly.set(friendly, {
      title:       friendly,
      searchQuery: raw,
      productId:   id,
      storeCount:  set.size,
    });
  }
  /* Re-sort by store count desc since the dedup map can change
     ordering. */
  return Array.from(seenFriendly.values()).sort(
    (a, b) => b.storeCount - a.storeCount,
  );
}

/* unstable_cache wraps the helper with Next's request-deduped + ISR
   cache. Multiple homepage renders within REVALIDATE_S share one DB
   round trip; after the window expires, the next render re-fetches
   in the background while serving the stale set. */
export const getTrendingMultiStoreTitles = unstable_cache(
  fetchMultiStoreTitlesUncached,
  ["trending-multi-store-v1"],
  { revalidate: REVALIDATE_S, tags: [CACHE_TAG] },
);
