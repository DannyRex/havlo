/* /api/trending-chips — returns the multi-store chip pool with
   friendlified consumer labels.

   Powers the chip rail on /compare. Decoupled from the (server-
   rendered) homepage TrendingSearches component because /compare
   is client-side and needs an API to load this data without a
   full page re-render.

   Cached at the helper level (5 min via unstable_cache) AND at the
   route level (60s s-maxage with stale-while-revalidate) so the
   first user in each window pays the DB round trip and everyone
   else gets a CDN edge response. */

import { NextResponse } from "next/server";
import { getTrendingMultiStoreTitles } from "@/lib/trending-multi-store";

/* Markets Havlo supports — guards the ?country= param. */
const SUPPORTED_COUNTRIES = new Set(["ng", "us", "uk", "ae", "de", "in", "za"]);

export async function GET(req: Request): Promise<NextResponse> {
  try {
    /* Country-scoped: the chip pool and each chip's store count are
       computed for THIS market so they match the country-scoped
       /compare the chip links into. Defaults to ng for a missing or
       unsupported value. The CDN keys on the full URL, so ?country=uk
       and ?country=ng are cached as separate edge entries. */
    const requested = new URL(req.url).searchParams.get("country")?.toLowerCase();
    const country = requested && SUPPORTED_COUNTRIES.has(requested) ? requested : "ng";
    const items = await getTrendingMultiStoreTitles(country);
    /* Cache bumped May 2026 v3 (60s → 1h + swr 5min → 1d) to
       relieve Vercel Fluid Active CPU. Trending chips are based
       on a rolling 30-day popularity window — change slowly. */
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
          /* CDN keeps one gzipped + one brotli'd variant. Without
             this, the edge can serve uncompressed bytes to a client
             that negotiated brotli. Added May 2026 v3. */
          "Vary":          "Accept-Encoding",
        },
      },
    );
  } catch (err) {
    console.error("[/api/trending-chips]", err);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
