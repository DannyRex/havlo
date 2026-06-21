/* ──────────────────────────────────────────────────────────────────
   Dupes-only endpoint, used by the URL-paste flow.

   The compare page builds the anchor itself from /api/sniff data
   (so the user's pasted product is the literal anchor), then asks
   this endpoint for cheaper alternatives. Keeps the sniff flow
   faithful — the user sees their actual pasted product, not a
   "similar" one we dug out of the DB.
   ────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { pgFtsFindDupes } from "@/lib/search/pg-fts";
import { recomputeGroupStats } from "@/lib/search";
import { getServerCountry } from "@/lib/country-server";
import { isOfferAllowedForCountry, getCountry, COUNTRIES } from "@/lib/country";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const maxPriceNgn = parseInt(
    req.nextUrl.searchParams.get("maxPriceNgn") ?? "0",
    10,
  );

  if (!q) {
    return NextResponse.json({ dupes: [] });
  }
  /* maxPriceNgn = 0 is now a valid "no ceiling" mode, used when the
     sniffed product had a title but no extractable price. The dupes
     engine returns top-similar matches without a price filter. */

  try {
    const dupes = await pgFtsFindDupes(q, maxPriceNgn);
    /* For non-NG users, drop dupe-offers from NG-anchored stores.
       If a dupe loses all its offers we drop the dupe entirely. */
    /* Country resolution order: explicit ?country query param (validated against
       COUNTRIES) > cookie/geo. The compare page lives at /<cc>/compare and MUST
       pass ?country=<cc>; the old code relied on getServerCountry()'s cookie
       alone, so a UK shopper whose cookie still read NG hit the ng branch below
       and saw Jumia + naira leak into "more to compare". Mirrors /api/compare. */
    const ccParam = req.nextUrl.searchParams.get("country")?.toLowerCase().trim();
    const country = ccParam && COUNTRIES.some((c) => c.code === ccParam)
      ? getCountry(ccParam)
      : getServerCountry();
    const filteredDupes = country.code === "ng"
      ? dupes
      : dupes
          .map((d) => recomputeGroupStats({
            ...d,
            offers: d.offers.filter((o) => isOfferAllowedForCountry(o, country)),
          }))
          .filter((d) => d.offers.length > 0);
    return NextResponse.json(
      { dupes: filteredDupes },
      {
        headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
      },
    );
  } catch (err) {
    console.error("[/api/compare/dupes]", err);
    return NextResponse.json({ dupes: [] });
  }
}
