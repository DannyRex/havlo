import { NextRequest, NextResponse } from "next/server";
import { search, searchByKey, findSimilar, findSimilarByUrl, isUrl } from "@/lib/search";
import { vectorSearch, vectorFindSimilar, vectorFindSimilarByUrl } from "@/lib/search/vector";

// Feature flag: "1" / "true" → use Phase 2 vector engine.
// Defaults OFF so heuristic stays the safe path until vector is validated.
const USE_VECTOR_SEARCH = /^(1|true|yes)$/i.test(process.env.USE_VECTOR_SEARCH ?? "");

export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get("q")    ?? "";
  const key  = req.nextUrl.searchParams.get("key")  ?? "";
  const mode = req.nextUrl.searchParams.get("mode") ?? "";

  // `key` lookup never benefits from vectors — skip straight to the cache lookup.
  if (key) {
    const result = searchByKey(key);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
    });
  }

  if (!q.trim()) return NextResponse.json({ error: "Query required" }, { status: 400 });

  try {
    // URL → Smart Switch
    if (isUrl(q)) {
      const result = USE_VECTOR_SEARCH
        ? await vectorFindSimilarByUrl(q)
        : findSimilarByUrl(q);
      return NextResponse.json(result, {
        headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
      });
    }

    if (mode === "similar") {
      const result = USE_VECTOR_SEARCH
        ? await vectorFindSimilar(q)
        : findSimilar(q);
      return NextResponse.json(result, {
        headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
      });
    }

    const result = USE_VECTOR_SEARCH ? await vectorSearch(q) : search(q);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
    });
  } catch (err) {
    // Vector path can fail (Supabase down, OpenAI quota). Fall back to heuristic
    // so the site never returns a 5xx for a search.
    console.error("[/api/compare] vector path failed, falling back to heuristic:", err);
    if (isUrl(q))             return NextResponse.json(findSimilarByUrl(q));
    if (mode === "similar")   return NextResponse.json(findSimilar(q));
    return NextResponse.json(search(q));
  }
}
