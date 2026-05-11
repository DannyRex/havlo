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

export async function GET(): Promise<NextResponse> {
  try {
    const items = await getTrendingMultiStoreTitles();
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("[/api/trending-chips]", err);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
