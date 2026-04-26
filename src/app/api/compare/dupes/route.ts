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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const maxPriceNgn = parseInt(
    req.nextUrl.searchParams.get("maxPriceNgn") ?? "0",
    10,
  );

  if (!q || !maxPriceNgn || maxPriceNgn <= 0) {
    return NextResponse.json({ dupes: [] });
  }

  try {
    const dupes = await pgFtsFindDupes(q, maxPriceNgn);
    return NextResponse.json(
      { dupes },
      {
        headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
      },
    );
  } catch (err) {
    console.error("[/api/compare/dupes]", err);
    return NextResponse.json({ dupes: [] });
  }
}
