import { NextRequest, NextResponse } from "next/server";
import { searchByKey } from "@/lib/search";
import { pgFtsFindSimilar, pgFtsFindByProductId } from "@/lib/search/pg-fts";
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
  /* Round-4 QA: chip clicks pass `?pid=<product_id>` as a backstop
     so FTS-flakiness or catalog shift can't surface "Nothing in our
     local index" for a product the chip pool just promised was
     comparable across 2+ stores. If the FTS query path returns
     empty AND we have a pid, fall through to direct DB lookup. */
  const pid = req.nextUrl.searchParams.get("pid") ?? "";

  // Key-based direct lookup (legacy /compare?key= URLs)
  if (key) {
    return NextResponse.json(searchByKey(key), { headers });
  }

  if (!q.trim() && !pid) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const country = getServerCountry();
    let result: SearchOutput;
    /* Resolution priority — pid first when present.

       When pid is in the URL the user has explicitly clicked a
       specific product (PDP "Compare prices" CTA, chip click, etc.).
       That's an EXPLICIT signal — much stronger than FTS-on-title
       which is a guess. Use the pid to anchor the comparison
       directly; only fall through to FTS when pid lookup misses
       (catalog shift between chip generation and click).

       Why this ordering matters: FTS scoring on noisy/short titles
       can pick the wrong anchor by latching onto a single shared
       token. User report May 2026: searching "Hank Luxury -
       Bluetooth Key & Item Finder For Smartp" with the correct pid
       in the URL returned "Burgundy Luxury Shoe For Men" as anchor
       (FTS matched on the "luxury" token + the actual Hank Luxury
       product was lower-ranked in FTS results, so the pid backstop
       never fired because FTS was non-empty). Pid-first eliminates
       this whole class of bug.

       FTS still runs as the fallback for queries that arrive
       WITHOUT a pid (homepage search, paste-a-link results, manual
       /compare?q= URL entry). */
    if (pid) {
      result = await pgFtsFindByProductId(pid);
    }
    if ((!pid || result!.mode === "empty") && q.trim()) {
      result = await pgFtsFindSimilar(q);
    }
    if (!result! || result!.mode === "empty" && !q.trim() && !pid) {
      result = { mode: "empty", query: "", suggestions: [] };
    }

    /* Auto-pivot (May 2026): when FTS returned empty AND a
       suggestion looks like a clean fused / split variant of the
       query (e.g. "lawn mower" → "Mac Allister Lawnmower"), retry
       the search with the suggested title automatically. User sees
       real results instead of a "Did you mean..." pill they have
       to click. Original query preserved in `pivotedFromQuery` so
       the UI can render a "Showing results for X · Search for
       {original} instead" notice.

       Why substring-of-stripped, not score threshold:
       Trigram scores for short queries against long titles are
       naturally low (0.20-0.30 typical, even for clear matches).
       Setting a high score threshold (0.45+) misses obvious
       fuse/split cases. Setting a low threshold (0.20) false-
       positives on weak typo-like overlaps ("lawn mower" → "moto
       g57 power" scored 0.238 in the suggest_titles probe).

       Substring containment is the right signal: if the stripped
       title contains the stripped query verbatim, the suggestion
       is the same word(s) the user typed, just with or without
       spaces. Examples:
         - "lawn mower"   → "macallister1800wcordedpushlawnmower" ✓ contains "lawnmower"
         - "play station" → "playstation5console"                  ✓ contains "playstation"
         - "lawn mower"   → "motog57power"                          ✗ doesn't contain "lawnmower"
         - "iphn"         → "iphone15promax"                        ✗ doesn't contain "iphn"
           (correct: leaves user with the Did You Mean pill so they
            confirm the typo correction consciously). */
    if (q.trim() && result.mode === "empty" && result.suggestions.length > 0) {
      const stripped = q.replace(/\s+/g, "").toLowerCase();
      const queryLc = q.toLowerCase().trim();
      const pivot = result.suggestions.find((s) => {
        const titleStripped = s.title.replace(/\s+/g, "").toLowerCase();
        return s.title.toLowerCase().trim() !== queryLc
            && titleStripped.includes(stripped);
      });
      if (pivot) {
        const pivoted = await pgFtsFindSimilar(pivot.title);
        if (pivoted.mode !== "empty") {
          result = { ...pivoted, query: pivot.title, pivotedFromQuery: q } as SearchOutput & { pivotedFromQuery?: string };
        }
      }
    }

    /* (Pid resolution moved ABOVE the FTS path — see comment near
       the top of this try block. The pid-as-fallback pattern that
       used to live here is now pid-as-primary.) */
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
