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
import { waitUntil } from "@vercel/functions";
import { revalidateTag } from "next/cache";
import { getActiveSearchProviders, ProviderError } from "@/lib/providers";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry } from "@/lib/country";
import { detectFamily, alternativeFamilyMatches } from "@/lib/search/families";
import { priceLooksPlausibleForLiveDeal } from "@/lib/search/price-floor";
import { ingestDeals } from "@/lib/providers/ingestion";
import { withinBudget, recordSerpApiCall } from "@/lib/serpapi-budget";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { Deal } from "@/types";

/* Module-level in-flight guard for the persist path. The /compare
   fetchLive effect double-fires under React StrictMode and on rapid
   re-search; without a guard, two ingestDeals runs execute
   concurrently for the same query and race each other's
   (store_id, url) offer upserts, orphaning each other's freshly-
   inserted products. This Set lives at module scope so it survives
   across requests handled by the same warm Vercel function instance
   (the common case for the double-fire). Cross-instance concurrency
   is far rarer, and ingestDeals' Step 5b orphan reconciliation
   catches anything this misses. */
const persistInFlight = new Set<string>();

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

  /* tier=free → fast phase-1 teaser. Runs ONLY the free providers
     (AliExpress affiliate today), skips the paid SerpAPI lane, skips the
     DB write-back, and bypasses the SerpAPI budget + rate gates (it
     spends no credits). The compare client fires this ALONGSIDE the full
     request so the live section paints AliExpress results in ~0.5s while
     the ~1.5s Google Shopping call is still in flight, then swaps in the
     complete set when the full request lands. No extra SerpAPI cost: the
     paid call + persist still happen exactly once, in the full request. */
  const freeTierOnly = req.nextUrl.searchParams.get("tier") === "free";

  if (!q) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  /* Rate-limit the paid path. /api/live-search burns a SerpAPI
     credit on every cache-miss; without a per-IP cap a flood of
     unique queries drains the monthly budget. The 6h edge cache
     means this only ever counts genuine cache-miss (credit-
     spending) hits. In-memory + per-instance — see lib/rate-limit.ts;
     a shared store (Vercel KV / Upstash) is the robust upgrade. */
  if (!freeTierOnly && !rateLimit(`live-search:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json(
      { items: [], providers: [], error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
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
  /* Free teaser spends no SerpAPI credit, so it bypasses the budget
     gate entirely (null → the not-allowed branch is skipped, and the
     withinBudget DB round-trip is saved off the fast path). */
  const budget = freeTierOnly ? null : await withinBudget();
  if (budget && !budget.allowed) {
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

  /* Sequential provider call with early-exit (May 2026 v3).
     Previously fired all providers in parallel via Promise.allSettled,
     burning a SerpAPI credit per provider per call — even when the
     first provider's results were sufficient.

     New behaviour: walk providers in cost-priority order (cheapest
     first), stop as soon as we have ENOUGH_FOR_USER results. Typical
     case: first provider returns 10+ results → other providers never
     fire → 1 credit per query instead of 3-4.

     Provider cost order (cheapest first):
       1. aliexpress-affiliate (FREE — affiliate API, no SerpAPI)
       2. amazon-paapi          (separate credit pool, often free tier)
       3. serpapi-shopping      (paid, $0.005/call)
       4. serpapi-jumia         (paid, $0.005/call)

     Each successful provider counts toward the SerpAPI soft cap (only
     paid providers). Failures don't break the request; we just continue
     to the next provider. */
  const ENOUGH_FOR_USER = Math.max(8, Math.ceil(limit * 0.6));
  const COST_ORDER: Record<string, number> = {
    "aliexpress-affiliate": 0,
    "amazon-paapi":         1,
    "serpapi-shopping":     2,
    "serpapi-jumia":        3,
  };
  const sortedProviders = [...providers].sort((a, b) =>
    (COST_ORDER[a.id] ?? 99) - (COST_ORDER[b.id] ?? 99)
  );

  /* Fan-out split by cost tier. The leading run of FREE providers
     (AliExpress affiliate, Amazon PA-API when active) bills no SerpAPI
     credit, so there is no cost reason to serialise them — fire them
     CONCURRENTLY and the wall-time collapses from sum() to max(). The
     paid SerpAPI lane (plus any trailing free backfill like pg-fts at
     the end of the cost order) keeps the original SEQUENTIAL early-exit
     so we never bill serpapi-jumia when serpapi-shopping alone sufficed.
     Result composition + ordering match the old single walk; only the
     free leaders now overlap. */
  const firstPaidIdx = sortedProviders.findIndex((p) => p.id.includes("serpapi"));
  const splitAt = firstPaidIdx === -1 ? sortedProviders.length : firstPaidIdx;
  const leadingFree = sortedProviders.slice(0, splitAt);
  const rest = sortedProviders.slice(splitAt);

  const items: Deal[] = [];
  let paidProviderCallCount = 0;

  if (leadingFree.length > 0) {
    const settled = await Promise.allSettled(
      leadingFree.map((p) => p.searchDeals({ q, countryCode, limit })),
    );
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") {
        items.push(...res.value);
      } else {
        const reason = res.reason;
        const msg = reason instanceof Error ? reason.message : String(reason);
        console.warn(`[live-search] ${leadingFree[i].id} failed:`, msg);
      }
    });
  }

  /* Paid lane + trailing free backfill — SEQUENTIAL with early-exit.
     Skipped entirely for the phase-1 free teaser (freeTierOnly), which
     must stay credit-free; the full request that fires alongside runs
     this lane and persists once. */
  if (!freeTierOnly) {
    for (const provider of rest) {
      if (items.length >= ENOUGH_FOR_USER) {
        /* Have enough — skip remaining providers. Cost-saver: when the
           free leaders return ~10-15 results, the SerpAPI lane never
           fires. */
        break;
      }
      try {
        const providerResults = await provider.searchDeals({ q, countryCode, limit });
        items.push(...providerResults);
        if (provider.id.includes("serpapi")) paidProviderCallCount++;
      } catch (err) {
        if (err instanceof ProviderError) {
          console.warn(`[live-search] ${provider.id} failed:`, err.message);
        } else {
          console.warn(`[live-search] ${provider.id} threw:`, err);
        }
      }
    }
  }

  /* Record paid SerpAPI calls only (free providers don't count). */
  if (paidProviderCallCount > 0) {
    void recordSerpApiCall(paidProviderCallCount);
  }

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

  /* PERSIST SET — every token-relevant live result, country- and
     counterfeit-price filtered, but NOT narrowed by the accessory /
     family filters below. Founder direction May 2026: "save them
     all, whether they're direct siblings or not. No new product must
     go unsaved." The accessory + family filters are DISPLAY relevance
     only; a real product that isn't a direct sibling of the query is
     still worth having in the catalog so the next search resolves
     from the DB instead of burning another live-search credit.
     Counterfeit-priced rows stay excluded — those are junk, not
     catalog gaps. */
  const persistSet = filterDealsForCountry(tokenRelevant, cookieCountry)
    .filter((it) => priceLooksPlausibleForLiveDeal(it.salePrice, it.title));

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
  /* Persist the FULL token-relevant set (persistSet), not the
     family-narrowed display set — see persistSet above.

     Background-persist with waitUntil so Vercel keeps the function
     alive past the response. Was `void persistLiveResults(...)`
     (fire-and-forget) — the response would return immediately and
     the runtime would tear down the serverless context, killing the
     in-flight Supabase writes before they completed. waitUntil()
     guarantees the persist call completes before the function ends. */
  if (!freeTierOnly && persistSet.length > 0) {
    /* Bust the browse cache for THIS country so the offers we're about
       to persist surface on the next /deals load instead of waiting out
       the SSR fetch's 60/600s window. /[country]/deals tags its
       /api/deals SSR fetch with `deals:{country}`; revalidateTag purges
       every category variant for this country on demand.

       Why this is the "instant reflection" fix the user asked for:
       compare-page live search already writes fresh SerpAPI offers into
       the catalog (ingestDeals below). The data was always saved — it
       just sat behind a 10-minute browse cache. This invalidation makes
       a save reflect on the very next /deals visit, in every country
       (and category) where a live search ingested rows, at ZERO extra
       SerpAPI cost (pure cache bust over data already being written).

       Called here in request scope — NOT inside the waitUntil persist —
       so it runs within an active Next request context. The tag is
       marked stale now; the next /deals request re-queries the
       now-populated catalog. The persist commits within ~1s (waitUntil),
       well before a user navigates compare → deals, so the refetch sees
       the new rows. Targeted per-country: every other country keeps its
       egress-saving cache untouched. */
    revalidateTag(`deals:${countryCode.toLowerCase()}`);

    /* In-flight guard — collapse concurrent persists of the same
       {country}:{query} (the StrictMode / rapid-re-search double-
       fire) to a single ingestDeals run. Two concurrent runs race
       each other's (store_id, url) offer upserts and orphan each
       other's products. The slot is released in persistLiveResults'
       finally block once the run ends. */
    const persistKey = `${countryCode.toLowerCase()}:${q.toLowerCase()}`;
    if (!persistInFlight.has(persistKey)) {
      persistInFlight.add(persistKey);
      waitUntil(persistLiveResults(q, countryCode, persistSet, persistKey));
    }
  }

  /* Edge-cache aggressively. Cadence history:
       Initial: s-maxage=300 / swr=900    (5min / 15min)
       v2:      s-maxage=3600 / swr=86400 (1h / 1d)
       v3:      s-maxage=21600 / swr=604800 (6h / 7d, May 2026)

     v3 reasoning: live-search calls are the variable-cost lane (SerpAPI
     billed per request). Most live queries are flagship products whose
     prices don't move within a 6-hour window. The 7-day SWR keeps
     responses instant for an entire week even when the cached value is
     stale — the revalidation runs at most once per 6h per unique query
     per region. Per-query SerpAPI cost drops from ~24 calls/day to ~4
     calls/day for hot queries. */
  return NextResponse.json(
    {
      items: itemsForResponse,
      providers: providers.map((p) => p.id),
    },
    { headers: { "Cache-Control": "s-maxage=21600, stale-while-revalidate=604800" } },
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
  persistKey?: string,
): Promise<void> {
  try {
    await ingestDeals("live-search", `${countryCode}:${query}`, items);
  } catch (err) {
    /* Persist failure shouldn't block the user's response or surface
       as an error. Log + continue — the cache layer still helps
       for the immediate-repeat case. */
    console.warn("[live-search] persist failed:", (err as Error).message);
  } finally {
    /* Release the in-flight slot however the run ends, so a genuine
       re-search after the cache window can persist fresh data again. */
    if (persistKey) persistInFlight.delete(persistKey);
  }
}
