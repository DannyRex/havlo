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

/* The route still accepts a ?country= query param (the TrendingChipRail
   still passes it) so the CDN keys cache entries per country and the
   surface is forward-compatible with country-scoping. The underlying
   pool is currently global — see the TODO in trending-multi-store.ts —
   so all country variants return the same items today. Harmless. */
export async function GET(): Promise<NextResponse> {
  try {
    const items = await getTrendingMultiStoreTitles();
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
