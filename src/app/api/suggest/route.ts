import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/search";
import { getServerCountry } from "@/lib/country-server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  /* Pass the visitor's country so the storeCount badge reflects
     stores actually relevant to their market. Without this, a NG-
     only retailer would inflate storeCount for a UK visitor and
     the click-through to /compare would return empty (filterByCountry
     drops all the unusable stores). */
  const country = getServerCountry();
  const items = await suggest(q, 8, country);
  /* Cache key varies by URL — country comes from the cookie/header
     so different markets DO get different caches via the route's
     dynamic mode. We don't bake country into the URL because
     /api/suggest is called many times per session and per-key
     caches multiply egress; the per-instance plain edge cache is
     sufficient here. */
  /* Cache bumped May 2026 v3 (60s → 600s + swr 5min → 1d) to
     relieve Vercel Fluid Active CPU. Autocomplete results don't
     need minute-level freshness — popular queries cached for 10
     minutes drop function executions ~10× per query. */
  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "private, s-maxage=600, stale-while-revalidate=86400",
        /* Vary on Accept-Encoding so the edge keeps a single
           brotli'd variant per query — without it, a brotli-
           capable client could be served the gzip variant or
           uncompressed bytes. Added May 2026 v3. */
        "Vary":          "Accept-Encoding",
      },
    },
  );
}
