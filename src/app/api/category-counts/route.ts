import { NextRequest } from "next/server";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getCountry, filterDealsForCountry } from "@/lib/country";
import { getPrecomputedCategoryCounts } from "@/lib/deals/precomputed-counts";
import { categories } from "@/lib/data/categories";

/* /api/category-counts?country=cc
   ─────────────────────────────────────────────────────────────────
   Batched, pool-derived deal counts for every homepage category tile,
   in ONE request.

   Why this exists: the homepage CategoryGrid used to fire ~10 server
   self-fetches to the FULL /api/deals handler (one per category), and
   each tile then re-fetched /api/deals AGAIN client-side — so a single
   homepage render triggered ~10 round-trips x the whole deals handler,
   including its ~1.1s list_country_stores_with_counts store-dropdown RPC
   up to 2x each. That RPC is irrelevant to a count badge.

   This endpoint computes the SAME number the /deals All-tab pill shows —
   `originCounts.all` = filterDealsForCountry(pool).length for each
   category — but skips the dropdown RPC and collapses 10 HTTP hops into
   one in-process Promise.all. Counts stay aligned with /deals because
   they use the identical provider.fetchDeals + filterDealsForCountry
   pipeline (origin='all', minDiscount=0, sort='relevance' -> the same
   discount-ranked pool the All-tab builds).

   Read by CategoryGrid (server, once) AND CategoryCount (client, once
   per tile but all hitting this one edge-cached URL). */
export async function GET(req: NextRequest) {
  const cc = (req.nextUrl.searchParams.get("country") ?? "ng").toLowerCase();
  const country = getCountry(cc);

  const browsable = categories.filter((c) => c.slug !== "all" && !c.hidden);
  const empty = Object.fromEntries(browsable.map((c) => [c.slug, 0]));

  try {
    /* Prefer the precomputed `category_reach_counts` table — accurate +
       a single cheap indexed read. Returns null (→ falls through to the
       live per-category loop below) when the table is missing/empty/stale,
       so this is safe before migration 0071 + the cron exist. */
    const pre = await getPrecomputedCategoryCounts(country);
    if (pre) {
      const counts = Object.fromEntries(browsable.map((c) => [c.slug, pre[c.slug] ?? 0]));
      return json({ counts, country: cc }, "s-maxage=120, stale-while-revalidate=600");
    }

    const provider = await getActiveBrowseProvider();
    if (!provider) {
      return json({ counts: empty, country: cc }, "no-store");
    }

    const entries = await Promise.all(
      browsable.map(async (c): Promise<[string, number]> => {
        try {
          /* Counts the DEALS subset (discount > 0, minDiscount=1 since
             discount_percent is an integer), origin='all', matching the
             precomputed all_deals column and the deals page's default
             "Deals" view, so the tile number equals what a click lands on.
             minDiscount=1 == discount>0 because the provider filters with
             >= (route.ts/browse-db). */
          const pool = await provider.fetchDeals({
            categorySlug: c.slug,
            minDiscount:  1,
            sort:         "relevance",
            origin:       "all",
            country:      cc,
          });
          return [c.slug, filterDealsForCountry(pool, country, undefined).length];
        } catch {
          return [c.slug, 0];
        }
      }),
    );

    return json({ counts: Object.fromEntries(entries), country: cc },
      /* Counts move on the Mon/Wed/Fri + daily ingest cadence, not minute to
         minute, so a 2-min edge window is plenty and keeps recompute
         cheap; swr serves instantly while a fresh one warms. */
      "s-maxage=120, stale-while-revalidate=600");
  } catch {
    return json({ counts: empty, country: cc }, "no-store");
  }
}

function json(body: unknown, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type":  "application/json",
      "Cache-Control": cacheControl,
      "Vary":          "Accept-Encoding",
    },
  });
}
