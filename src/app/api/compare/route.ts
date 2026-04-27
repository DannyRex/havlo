import { NextRequest, NextResponse } from "next/server";
import { searchByKey } from "@/lib/search";
import { pgFtsFindSimilar } from "@/lib/search/pg-fts";
import { getServerCountry } from "@/lib/country-server";
import { isOfferAllowedForCountry } from "@/lib/country";
import type { SearchOutput, ProductGroup, DupeResult } from "@/lib/search";

/* Phase 6e — pg-fts is the only engine for /compare's text search.
   The old heuristic engine (BRANDS list, PRODUCT_TYPES regex, etc.)
   has been deleted. URLs that hit this route directly without prior
   sniffing fall through to pg-fts (which won't FTS-match them) → the
   UI's live SerpAPI section takes over. */

const headers = { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" };

/* For non-NG users, drop NG-anchored offers from anchor + dupes.
   Returns mode:"empty" if filtering wipes the anchor (UI then falls
   back to live-search results which are also country-filtered). */
function filterByCountry(
  out: SearchOutput,
  country: ReturnType<typeof getServerCountry>,
): SearchOutput {
  if (out.mode === "empty") return out;

  function pruneOffers<T extends ProductGroup | DupeResult>(g: T): T | null {
    const offers = g.offers.filter((o) => isOfferAllowedForCountry(o, country));
    if (offers.length === 0) return null;
    return { ...g, offers, storeCount: offers.length };
  }

  if (out.mode === "single") {
    const g = pruneOffers(out.group);
    if (!g) return { mode: "empty", query: out.query, suggestions: [] };
    const alternatives = out.alternatives
      .map(pruneOffers)
      .filter((a): a is ProductGroup => a !== null);
    return { mode: "single", query: out.query, group: g, alternatives };
  }

  if (out.mode === "similar") {
    const anchor = pruneOffers(out.anchor);
    if (!anchor) return { mode: "empty", query: out.query, suggestions: [] };
    const dupes = out.dupes
      .map(pruneOffers)
      .filter((d): d is DupeResult => d !== null);
    return { mode: "similar", query: out.query, anchor, dupes };
  }

  return out;
}

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
    const country = getServerCountry();
    const filtered = country.code === "ng" ? result : filterByCountry(result, country);
    return NextResponse.json(filtered, { headers });
  } catch (err) {
    console.error("[/api/compare]", err);
    return NextResponse.json(
      { mode: "empty", query: q, suggestions: [] },
      { headers },
    );
  }
}
