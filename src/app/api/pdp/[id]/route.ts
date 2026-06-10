import { NextRequest, NextResponse } from "next/server";
import { loadPdpData } from "@/lib/offers/pdp-data";

/* On-demand PDP data endpoint. Serves the SAME pipeline output the
   /[country]/p/[id] server render uses (loadPdpData), so a client that
   wants to refresh / lazy-load the PDP's data wave reads the identical
   shape the page was built from — the two surfaces can never drift.

   force-dynamic because this is an on-demand data endpoint: the CDN
   cache headers below (s-maxage / stale-while-revalidate) own the
   freshness window, not Next's static/ISR machinery. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const cc = req.nextUrl.searchParams.get("cc") ?? "ng";
  const data = await loadPdpData(params.id, cc);
  if (!data) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
