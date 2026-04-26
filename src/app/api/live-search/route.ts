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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const countryCode = req.nextUrl.searchParams.get("country") ?? "ng";
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

  const relevant = queryIsAccessory
    ? tokenRelevant
    : tokenRelevant.filter((it) => {
        const t = it.title.toLowerCase();
        return !ACCESSORY_KW.some((kw) => {
          const re = new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
          return re.test(t);
        });
      });

  return NextResponse.json(
    {
      items: relevant.slice(0, limit),
      providers: providers.map((p) => p.id),
    },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" } },
  );
}
