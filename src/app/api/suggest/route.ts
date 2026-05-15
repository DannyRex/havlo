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
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300" } },
  );
}
