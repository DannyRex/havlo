import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const items = await suggest(q, 8);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
