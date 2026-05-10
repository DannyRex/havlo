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

interface OfferRow { product_id: string; store_id: string }
interface ProductRow { id: string; title: string }

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
  title:      string;
  storeCount: number;
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

  return qualified
    .map(([id, set]) => {
      const title = titleById.get(id);
      if (!title) return null;
      return { title, storeCount: set.size } satisfies MultiStoreChip;
    })
    .filter((c): c is MultiStoreChip => c !== null);
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
