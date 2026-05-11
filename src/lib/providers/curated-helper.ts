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

/* Classify a deal by storeId for monetization weighting + curation
   buckets. Match all Amazon marketplace variants (`amazon`,
   `amazon-co-uk-...-seller`, `amazon-de-...`, etc.) under one bucket. */
export function classifyDeal(d: Deal): "amazon" | "aliexpress" | "local" {
  const id = d.storeId.toLowerCase();
  if (id === "amazon" || id.startsWith("amazon-")) return "amazon";
  if (id === "aliexpress")                          return "aliexpress";
  return "local";
}

/* Relevance score = discount + recency decay + monetization nudge.

   Why additive (not multiplicative) on the monetization side: a
   purely multiplicative boost (× 1.4 for Amazon) would push a 20%-off
   Amazon item ahead of a 25%-off Konga item, which feels like
   paid promotion. A small additive nudge keeps the discount the
   primary signal while letting Amazon/AliExpress break ties in their
   favour — they earn us commission, so when the deals are similar,
   prefer the monetised one.

   Recency: linear decay from full-credit at 0 days to zero at 30 days,
   capped at 20 points so it never overwhelms a strong discount. Items
   older than 30 days score recency=0; their discount carries them. */
function relevanceScore(d: Deal): number {
  const discount = d.discountPercent ?? 0;

  const days = Math.max(0, (Date.now() - new Date(d.postedAt).getTime()) / 86_400_000);
  const recency = Math.max(0, (30 - days) / 30) * 20;

  const bucket = classifyDeal(d);
  const monetizationBoost = bucket === "amazon" ? 8
                          : bucket === "aliexpress" ? 5
                          : 0;

  return discount + recency + monetizationBoost;
}

/* Anti-clustering with configurable gap. For each position i, the
   item's storeId must differ from every storeId in the preceding
   `minGap` slots. When the constraint is violated, swap with the
   next item whose store satisfies the constraint.

   Why minGap matters for grid layouts: with CSS `columns-N` (or any
   masonry-style top-to-bottom column fill), consecutive array items
   land in the same column. If minGap=1 only spaces immediate pairs,
   a Konga-Amazon-Konga-Amazon pattern still puts two Kongas in the
   same column. Setting minGap=N (where N = column count) prevents
   that — col 0 (items 0..N-1) is guaranteed to have N distinct
   stores, breaking visible vertical clusters.

   Trade-off: higher minGap moves more items around, slightly
   diluting score-based ranking. minGap=4 (desktop col count) is
   the sweet spot — meaningful de-clustering without over-shuffling.
   QA audit (Bucket 2#2 / High 9) wanted this enforced in the column
   dimension. */
export function spaceByStore(deals: Deal[], minGap: number = 1): Deal[] {
  const result = [...deals];
  const gap = Math.max(1, minGap);

  for (let i = 1; i < result.length; i++) {
    /* Set of storeIds the item at position i must NOT match — namely,
       the storeIds at positions [i - gap, i - 1]. */
    const forbidden = new Set<string>();
    for (let g = 1; g <= gap && i - g >= 0; g++) {
      forbidden.add(result[i - g].storeId);
    }

    if (!forbidden.has(result[i].storeId)) continue;

    /* Find the next item whose storeId satisfies the constraint
       and swap it into position i. If none exists (rare: pool is
       so dominated by one store that no swap helps), leave as-is.
       The visible cluster is unavoidable in that case. */
    for (let j = i + 1; j < result.length; j++) {
      if (!forbidden.has(result[j].storeId)) {
        [result[i], result[j]] = [result[j], result[i]];
        break;
      }
    }
  }
  return result;
}

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
      return sorted;
    case "price_desc":
      sorted.sort((a, b) => b.salePrice - a.salePrice);
      return sorted;
    case "discount":
      sorted.sort((a, b) => b.discountPercent - a.discountPercent);
      return sorted;
    case "newest":
      sorted.sort(
        (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
      );
      return sorted;
    case "relevance":
    default:
      /* Score → sort desc → space-by-store. The store-spacing pass
         runs LAST so it sees the final ranked order and minimises
         disruption when re-arranging adjacent duplicates.

         minGap=6 (was 1): the previous default only prevented
         back-to-back same-store items, but with the masonry / 4-
         column layout users still saw vertical AliExpress / Amazon
         clusters in column 0 (top of viewport). 6 is wide enough
         to break vertical clusters in any column count up to 6, so
         the first viewport on /deals shows store variety not just
         the top 4 highest-discount stores. */
      sorted.sort((a, b) => relevanceScore(b) - relevanceScore(a));
      return spaceByStore(sorted, 6);
  }
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
