import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/data/compare";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const result = searchProducts(q);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
  });
}
