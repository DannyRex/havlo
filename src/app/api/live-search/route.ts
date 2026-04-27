/* ──────────────────────────────────────────────────────────────────
   Live shopping search — fans out the user query to all active
   SearchProviders (SerpAPI today; Amazon PAAPI / Rainforest later)
   and returns merged Deal[] results.

   This endpoint is intentionally separate from /api/compare:
     • /api/compare uses the existing vector + heuristic engine over
       our own data corpus (good for grouping + dupes)
     • /api/live-search hits external live shopping APIs (good for
       freshness + breadth, no grouping)

   The UI can render both side-by-side or merge as needed.
   ────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { getActiveSearchProviders, ProviderError } from "@/lib/providers";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry } from "@/lib/country";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  /* Default countryCode from the user's cookie (set by CountryProvider).
     Explicit ?country= still wins so the API can be called by tools that
     want to override (e.g. server-to-server). */
  const cookieCountry = getServerCountry();
  const countryCode = req.nextUrl.searchParams.get("country") ?? cookieCountry.code;
  const limit = req.nextUrl.searchParams.get("limit")
    ? parseInt(req.nextUrl.searchParams.get("limit")!, 10)
    : 24;

  if (!q) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const providers = getActiveSearchProviders();
  if (providers.length === 0) {
    // No live search configured — return empty, not an error.
    // Caller can fall back to internal search.
    return NextResponse.json({
      items: [],
      providers: [],
      note: "No live search providers configured. Set SERPAPI_KEY to activate.",
    });
  }

  // Run all providers in parallel; per-provider failures don't break the request
  const results = await Promise.allSettled(
    providers.map((p) => p.searchDeals({ q, countryCode, limit })),
  );

  const items = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const provider = providers[i];
    if (r.reason instanceof ProviderError) {
      console.warn(`[live-search] ${provider.id} failed:`, r.reason.message);
    } else {
      console.warn(`[live-search] ${provider.id} threw:`, r.reason);
    }
    return [];
  });

  // Lightweight URL-based dedupe across providers
  const seen = new Set<string>();
  const deduped = items.filter((it) => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });

  /* Sanity-check: at least one query token (≥3 chars, non-stopword) must
     appear in the result title. Without this, gibberish like "xyzxyz"
     surfaces unrelated SerpAPI top-N (Walmart Zyrtec, Yeezy Boost, etc.)
     because Google's relevance score never returns "no results", just
     "least-bad results". */
  const STOP = new Set([
    "the", "and", "for", "with", "of", "on", "in", "at", "to", "from",
    "by", "or", "an", "a", "is", "be", "new",
  ]);
  const queryTokens = q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));

  const tokenRelevant = queryTokens.length === 0
    ? deduped  // can't filter without tokens
    : deduped.filter((it) => {
        const title = it.title.toLowerCase();
        return queryTokens.some((t) => title.includes(t));
      });

  /* Accessory exclusion — when the query itself is a product name (e.g.
     "iphone 15 pro max"), drop results whose titles are accessories /
     parts (case, cover, screen protector, replacement LCD, etc.). The
     "iPhone 15 Pro Max Ronaldo Football Phone Case" should not be the
     top live result for a phone search. Skip when the query already
     names the accessory class so a "phone case" search still works. */
  const ACCESSORY_KW = [
    "case", "cover", "skin", "holder", "stand", "tripod", "selfie stick",
    "screen protector", "tempered glass", "replacement", "repair",
    "lcd screen", "battery replacement", "lens kit", "gimbal",
  ];
  const lowerQ = q.toLowerCase();
  const queryIsAccessory = ACCESSORY_KW.some((kw) => lowerQ.includes(kw));

  const accessoryFiltered = queryIsAccessory
    ? tokenRelevant
    : tokenRelevant.filter((it) => {
        const t = it.title.toLowerCase();
        return !ACCESSORY_KW.some((kw) => {
          const re = new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
          return re.test(t);
        });
      });

  /* Cross-family exclusion. Token-relevance is too lax for queries like
     "iphone 15 pro max" — the bare token "pro" matches "iPad Pro 13inch
     M4 WiFi" because both contain "pro". Detect the query's family and
     drop candidates from incompatible families. Mirrors the same gate
     pgFtsFindSimilar uses on the DB-backed path so live + DB results are
     consistent. */
  const FAMILY_TOKENS: Record<string, RegExp> = {
    phone:      /\b(iphone|galaxy|pixel|tecno|infinix|redmi|oneplus|smartphone|phone)\b/,
    tablet:     /\b(ipad|tablet|matepad|mediapad)\b/,
    laptop:     /\b(macbook|thinkpad|laptop|notebook|chromebook)\b/,
    headphones: /\b(headphones?|headset|airpods\s+max|wh-1000)\b/,
    earbuds:    /\b(airpods|earbuds|earpods|tws)\b/,
    tv:         /\b(smart\s*tv|qled|oled|led\s*tv|uhd\s*tv|4k\s*tv)\b/,
  };
  function detectQueryFamily(s: string): string | null {
    for (const [fam, re] of Object.entries(FAMILY_TOKENS)) {
      if (re.test(s)) return fam;
    }
    return null;
  }
  const qFam = detectQueryFamily(lowerQ);
  const relevant = !qFam
    ? accessoryFiltered
    : accessoryFiltered.filter((it) => {
        const t = it.title.toLowerCase();
        const titleFam = detectQueryFamily(t);
        // Allow when title family unknown OR matches query family
        return !titleFam || titleFam === qFam;
      });

  /* Country store filter — same pure helper used elsewhere. Drops
     NG-anchored stores (Konga/Jumia/3C Hub) for non-NG users; keeps
     country-tagged matches + cross-border globals (Shein, Temu,
     AliExpress, Wish, DHgate). */
  const countryFiltered = filterDealsForCountry(relevant, cookieCountry);

  return NextResponse.json(
    {
      items: countryFiltered.slice(0, limit),
      providers: providers.map((p) => p.id),
    },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" } },
  );
}
