import { NextRequest, NextResponse } from "next/server";
import { searchByKey } from "@/lib/search";
import { pgFtsFindSimilar } from "@/lib/search/pg-fts";

/* Phase 6e — pg-fts is the only engine for /compare's text search.
   The old heuristic engine (BRANDS list, PRODUCT_TYPES regex, etc.)
   has been deleted. URLs that hit this route directly without prior
   sniffing fall through to pg-fts (which won't FTS-match them) → the
   UI's live SerpAPI section takes over. */

const headers = { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" };

export async function GET(req: NextRequest) {
  const q   = req.nextUrl.searchParams.get("q")   ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";

  // Key-based direct lookup (legacy /compare?key= URLs)
  if (key) {
    return NextResponse.json(searchByKey(key), { headers });
  }

  if (!q.trim()) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const result = await pgFtsFindSimilar(q);
    return NextResponse.json(result, { headers });
  } catch (err) {
    console.error("[/api/compare]", err);
    return NextResponse.json(
      { mode: "empty", query: q, suggestions: [] },
      { headers },
    );
  }
}
