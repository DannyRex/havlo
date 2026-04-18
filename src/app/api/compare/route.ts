import { NextRequest, NextResponse } from "next/server";
import { search, searchByKey } from "@/lib/search";

export async function GET(req: NextRequest) {
  const q   = req.nextUrl.searchParams.get("q")   ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";

  // If the client passes a `key` (drilling into a specific product group from the
  // list view), look up that exact group — don't re-run fuzzy matching.
  if (key) {
    const result = searchByKey(key);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
    });
  }

  if (!q.trim()) return NextResponse.json({ error: "Query required" }, { status: 400 });
  const result = search(q);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
  });
}
