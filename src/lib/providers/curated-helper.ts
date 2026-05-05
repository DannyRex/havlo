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
import type { Deal, OriginFilter, SortOption } from "@/types";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";

/* Sort a Deal[] by the BrowseQuery's sort option. Used to apply the
   user's requested order across the COMBINED set of native + curated
   deals so curated entries don't artificially float to the top.

   Why this matters: if we just concatenated `[...curated, ...native]`,
   the homepage and /deals pages would always show Amazon products
   first regardless of sort choice — feels like paid promotion and
   undermines trust. Re-sorting the combined array lets curated
   entries rank naturally (a 25%-off MacBook ranks ahead of a 5%-off
   scraped item under the discount sort, but behind a 60%-off
   scraped one — same rules for everyone). */
export function sortDeals(deals: Deal[], sort: SortOption | undefined): Deal[] {
  const sorted = [...deals];
  switch (sort) {
    case "price_asc":
      sorted.sort((a, b) => a.salePrice - b.salePrice);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.salePrice - a.salePrice);
      break;
    case "discount":
      sorted.sort((a, b) => b.discountPercent - a.discountPercent);
      break;
    case "popular":
      sorted.sort((a, b) => b.clicks - a.clicks);
      break;
    case "newest":
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
      );
  }
  return sorted;
}

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
