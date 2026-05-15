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
import { detectFamily, alternativeFamilyMatches } from "@/lib/search/families";
import { priceLooksPlausibleForLiveDeal } from "@/lib/search/price-floor";
import { ingestDeals } from "@/lib/providers/ingestion";
import { withinBudget, recordSerpApiCall } from "@/lib/serpapi-budget";
import type { Deal } from "@/types";

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
    /* No live providers active. Return empty cleanly — internal
       /api/compare (pgFts on our scraped catalog) is the primary
       search path and is unaffected. UI should fall back to that. */
    return NextResponse.json({
      items: [],
      providers: [],
      note: "Live search providers inactive. Internal search remains available via /api/compare.",
    });
  }

  /* Monthly budget gate. When SerpAPI usage crosses 80% of the
     monthly cap, this route stops making paid calls for the rest of
     the month and returns an empty live-results set with a note.
     The UI's existing fall-through (DB matches from /api/compare)
     keeps the search surface functional. Background ingest jobs
     consume the remaining 20% headroom for scheduled scrapes.

     Failsafe: withinBudget returns `allowed: true` on Supabase
     unreachability — never silently kill live search because of a
     DB outage. */
  const budget = await withinBudget();
  if (!budget.allowed) {
    console.warn(
      `[live-search] monthly budget threshold hit: ${budget.calls}/${budget.cap} for ${budget.monthKey}`,
    );
    return NextResponse.json(
      {
        items: [],
        providers: [],
        note: "Live search paused for the rest of this month - monthly budget reached. Returning catalog-only results via /api/compare and /api/deals.",
        budget: { calls: budget.calls, cap: budget.cap, monthKey: budget.monthKey },
      },
      /* Short cache so we re-check budget within minutes if a
         human edits the cap row in Supabase to raise the limit. */
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=600" } },
    );
  }

  // Run all providers in parallel; per-provider failures don't break the request
  const results = await Promise.allSettled(
    providers.map((p) => p.searchDeals({ q, countryCode, limit })),
  );

  /* Record one credit per provider that succeeded (each provider
     call hits its own upstream API). Fire-and-forget — the counter
     is a soft cap; missing a write isn't a correctness issue. */
  const successfulProviderCount = results.filter((r) => r.status === "fulfilled").length;
  if (successfulProviderCount > 0) {
    void recordSerpApiCall(successfulProviderCount);
  }

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

  /* Cross-family exclusion. Round-4 QA caught: query "Yeezy Boost
     350" surfaced "Boat Stone 350" (Bluetooth speaker, substring
     match on '350') as a live deal. The previous family check
     allowed any candidate where titleFam is null OR matches —
     'Boat Stone' has no recognised family so it slipped through.

     Now uses alternativeFamilyMatches: when the query has a
     recognised family (footwear for Yeezy, audio for AirPods, etc.)
     the candidate MUST share that family. Null-family candidates
     get dropped. Identical semantics to the /compare alternatives
     filter so the two surfaces stay in sync. */
  const relevant = accessoryFiltered.filter((it) => alternativeFamilyMatches(q, it.title));

  /* Country store filter — same pure helper used elsewhere. Drops
     NG-anchored stores (Konga/Jumia/3C Hub) for non-NG users; keeps
     country-tagged matches + cross-border globals (Shein, Temu,
     AliExpress, Wish, DHgate). */
  const countryFiltered = filterDealsForCountry(relevant, cookieCountry);

  /* Counterfeit price floor. Round-4 QA flagged: DHgate iPhone 17
     Pro $27.55, AliExpress Yeezy fakes $89, AliExpress AirPods Pro
     $4.06 all surfaced in the live-deals section. The floor was
     applied to /compare anchor + alternatives but never to live
     deals — same surface to a user, but a different code path
     served unfiltered. Plug the gap.

     priceLooksPlausibleForLiveDeal converts USD → NGN before
     applying the FLAGSHIP_PRICE_FLOOR_NGN. Real flagship listings
     pass easily; counterfeits don't. */
  const priceFiltered = countryFiltered.filter(
    (it) => priceLooksPlausibleForLiveDeal(it.salePrice, it.title),
  );

  const itemsForResponse = priceFiltered.slice(0, limit);

  /* Write-back to DB — RE-ENABLED May 2026 after user report
     surfaced the core gap: /compare's "Live results" section was
     finding similar products at different prices (e.g. multiple
     Bestier desks across listings) but the PDP's price-spectrum
     bar said "1 store · watching for more" because none of those
     live rows were in the offers table.

     Persist turns each successful live SerpAPI response into a
     row in products + offers via ingestDeals. Next PDP visit
     pools those into the spectrum via pgFtsAnchorOffersByProductId
     + variant matching. Effectively: one paid SerpAPI call
     enriches the catalog for every future visitor.

     Egress concern from the original pause: at the time, hot
     queries were re-running every minute. Now the edge cache
     below sits at 1h s-maxage + 24h SWR, so repeat-same-query
     traffic doesn't multiply the write-back. ingestDeals'
     onConflict=(store_id,url) upsert further collapses duplicates.

     Fire-and-forget: not awaited. Failures log but don't block
     the user response — the live-results UI still renders. */
  if (priceFiltered.length > 0) {
    void persistLiveResults(q, countryCode, priceFiltered);
  }

  /* Edge-cache aggressively. Was s-maxage=300 / swr=900 (5min / 15min).
     Bumped to 1h / 1d because:
       - SerpAPI calls cost real $$ per request
       - Most product prices don't move enough in 1h to matter
       - stale-while-revalidate keeps responses instant; the
         background revalidation runs at most once per hour per
         unique query per region
     User-visible UX is faster (warm cache); revenue-side $$ drops. */
  return NextResponse.json(
    {
      items: itemsForResponse,
      providers: providers.map((p) => p.id),
    },
    { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" } },
  );
}

/* Persist live-search results to the offers table so future
   searches for the same product hit our DB index instead of
   triggering another paid SerpAPI call.

   Source-tagged "live-search" + the user's "{country}:{query}" so
   we can distinguish demand-ingested rows from scheduled-scrape
   rows when auditing the catalog. ingestDeals handles the rest:
   upsert stores, find-or-create products by signature, upsert
   offers by (store_id, url). */
async function persistLiveResults(
  query: string,
  countryCode: string,
  items: Deal[],
): Promise<void> {
  try {
    await ingestDeals("live-search", `${countryCode}:${query}`, items);
  } catch (err) {
    /* Persist failure shouldn't block the user's response or surface
       as an error. Log + continue — the cache layer still helps
       for the immediate-repeat case. */
    console.warn("[live-search] persist failed:", (err as Error).message);
  }
}
