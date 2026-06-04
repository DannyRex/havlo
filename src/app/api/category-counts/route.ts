import { NextRequest } from "next/server";
import { getCountry } from "@/lib/country";
import { getReachableCategoryCounts } from "@/lib/deals/reachable-counts";
import { categories } from "@/lib/data/categories";

/* /api/category-counts?country=cc
   ─────────────────────────────────────────────────────────────────
   Accurate, egress-frugal deal counts for every homepage category tile,
   in ONE request.

   Was (until June 2026): ~10 full 3-pass `provider.fetchDeals` calls
   (one per category, ~2.5k rows each → ~25k rows/country/render) just to
   read a `.length`. That was both the biggest single egress draw on the
   homepage AND inaccurate — the display pool caps cross-border at 1000,
   so fashion (~2.1-2.9k reachable) was truncated, UNEVENLY across markets
   (ZA read 249 of a real 2,157). The thing it was reading off the end of
   a heavy pool is, fundamentally, just a COUNT.

   Now: ONE shared slim projection of the in-stock view (~150 KB gzipped,
   cached + coalesced across all countries + the /deals pills) run through
   the real filterDealsForCountry. Exact counts at a fraction of the
   egress. See src/lib/deals/reachable-counts.ts. The /deals origin pills
   read the SAME helper, so a tile can never diverge from the All-tab.

   Read by CategoryGrid (server, once) AND CategoryCount (client, once
   per tile but all hitting this one edge-cached URL). */
export async function GET(req: NextRequest) {
  const cc = (req.nextUrl.searchParams.get("country") ?? "ng").toLowerCase();
  const country = getCountry(cc);

  const browsable = categories.filter((c) => c.slug !== "all" && !c.hidden);
  const empty = Object.fromEntries(browsable.map((c) => [c.slug, 0]));

  try {
    const reachable = await getReachableCategoryCounts(country);
    /* Project onto the browsable tile set (fill 0 for any category with
       no reachable inventory) so the response shape is stable. */
    const counts = Object.fromEntries(
      browsable.map((c) => [c.slug, reachable[c.slug] ?? 0]),
    );
    return json({ counts, country: cc },
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
