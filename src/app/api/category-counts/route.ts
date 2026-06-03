import { NextRequest } from "next/server";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getCountry, filterDealsForCountry } from "@/lib/country";
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
    const provider = await getActiveBrowseProvider();
    if (!provider) {
      return json({ counts: empty, country: cc }, "no-store");
    }

    const entries = await Promise.all(
      browsable.map(async (c): Promise<[string, number]> => {
        try {
          /* Mirrors fetchPoolCached's provider call in /api/deals exactly:
             origin='all', no min-discount, relevance sort. The pill +
             displayed total both derive from filterDealsForCountry over
             this pool, so the tile cannot diverge from the All-tab. */
          const pool = await provider.fetchDeals({
            categorySlug: c.slug,
            minDiscount:  0,
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
      /* Counts move on the Mon/Thu + daily ingest cadence, not minute to
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
