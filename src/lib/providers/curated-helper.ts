/* Curated-deals helper — applied identically by both browse providers
   (static + db) so the curated catalog surfaces regardless of which
   data source is currently active.

   Why merge at the provider layer rather than the route layer: every
   surface that calls fetchDeals (homepage CategoryGrid, /api/deals,
   TrendingDeals, search routes) needs the curated rows. Merging once
   at the provider keeps the contract uniform.

   Filter parity: re-applies the same BrowseQuery filters that each
   provider's native data goes through (categorySlug, minDiscount,
   search, origin). filterDealsForCountry runs downstream of this
   so country gating still works correctly. */

import type { BrowseQuery } from "./types";
import type { Deal, OriginFilter } from "@/types";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";

export function getCuratedDeals(q: BrowseQuery): Deal[] {
  let result: Deal[] = [...curatedAmazonDeals];

  if (q.categorySlug && q.categorySlug !== "all") {
    result = result.filter((d) => d.categorySlug === q.categorySlug);
  }
  if (typeof q.minDiscount === "number" && q.minDiscount > 0) {
    result = result.filter((d) => d.discountPercent >= q.minDiscount!);
  }
  if (q.search?.trim()) {
    const s = q.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.description.toLowerCase().includes(s) ||
        d.tags.some((t) => t.toLowerCase().includes(s)),
    );
  }
  /* All curated entries are international (USD currency, Amazon
     marketplaces). When the request asks for local-only origin,
     return nothing. */
  const origin: OriginFilter = q.origin ?? "all";
  if (origin === "local") return [];

  return result;
}
