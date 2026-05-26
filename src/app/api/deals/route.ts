import { NextRequest, NextResponse } from "next/server";
import { getActiveBrowseProvider } from "@/lib/providers";
import { spaceByStore } from "@/lib/providers/curated-helper";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry, getCountry, inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import { isStoreSearchUrl } from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
import { fetchSearchSuggestions } from "@/lib/search/suggestions";
import type { Deal, OriginFilter, SortOption } from "@/types";

/* Cached pool fetch — the heaviest part of /api/deals.
 *
 * Why: load-more was 5–8s per page (and slowing on each subsequent
 * page) because every offset request re-ran the full provider.fetchDeals
 * pipeline: 2x browse_deals RPC calls pulling up to 6000 rows, JS
 * filter + dedupe, sort. The slice(offset, offset + limit) at the
 * end is the only thing that varies per page — the underlying pool
 * is identical for offset=0, 24, 48, 72, … of the same query.
 *
 * Plain in-memory Map cache (NOT Next.js unstable_cache): I tried
 * unstable_cache first but it didn't help in production — likely
 * because the route is auto-detected as dynamic (searchParams +
 * cookies reads) which interacts oddly with Next 14's data-cache
 * registration for module-level wrapped functions. A plain Map is
 * dumb-simple and provably effective: same Vercel function instance
 * = cache hit, period.
 *
 * Per-instance trade-off: Vercel auto-scales, so different instances
 * have separate caches. But Vercel also reuses instances for ~5 min
 * after each request, so a user paginating through 20 pages of /uk/
 * deals almost always hits the same warm instance for pages 2-N.
 * Cross-user cache hits depend on instance reuse; worst case each
 * cold instance does one heavy fetch then caches.
 *
 * Cache key includes country (per-market pools, May 2026): with the
 * country-aware browse_deals RPC (migration 0022) the underlying
 * data set differs per market, so each country gets its own cache
 * slot. Cross-market cache sharing was a nice egress trick but
 * caused the NG-store-starvation problem in production — a globally
 * sorted top 6000 left NG 0%-only retailers below the cut. Sharded
 * pools are slightly more memory but actually correct.
 *
 * Cache key intentionally OMITS origin and offset:
 *   - origin: filtered downstream (one cached pool serves all/local/intl)
 *   - offset: the slice happens AFTER the cache (different page = same pool)
 *
 * 5-minute TTL aligns with browse_deals' freshness window (scrapers
 * re-run every 30 min, so 5 min of staleness is invisible to users).
 */
interface PoolCacheEntry {
  data:     Deal[];
  expires:  number;
}
const POOL_CACHE = new Map<string, PoolCacheEntry>();
const POOL_TTL_MS = 5 * 60 * 1000;

/* When a text search returns fewer than this many catalog rows,
   DealFeed (src/components/deals/DealFeed.tsx) fans out to the live
   shopping providers via /api/live-search, which persists the fresh
   results back into the catalog. This route mirrors that threshold:
   a search at or below it is "about to be backfilled," so its
   response and pool are deliberately left uncached (see isSparseSearch
   in the handler and SEARCH_POOL_MIN_CACHEABLE below) — otherwise the
   pre-backfill thin result is pinned and the user's very next search
   for the same term keeps seeing the gap instead of the just-persisted
   deals. Keep in sync with DealFeed's LIVE_SEARCH_THRESHOLD. */
const LIVE_SEARCH_THRESHOLD = 5;

/* A search pool smaller than one page (24 rows) can't be paginated, so
   POOL_CACHE — whose whole job is making load-more fast — gains nothing
   by holding it. It is also the size range that trips the live-search
   backfill above, and caching it would hide the just-persisted deals
   from the next identical search for the full 5-min TTL. Thin search
   pools are therefore never cached; browse pools and healthy,
   paginable search pools are unaffected. */
const SEARCH_POOL_MIN_CACHEABLE = 24;

/* Cache key version prefix — bump whenever the merged-pool shape
   changes (e.g., 3-pass refactor) so any stale entries from old
   function instances become unreachable. Old instances may still
   be serving traffic after a deploy until Vercel drains them, and
   while they're alive they refresh their own caches on TTL expiry
   using their old code. Versioning the key sidesteps that:
   {country:"ng",sort:"relevance"} from the old code can never
   match {country:"ng",sort:"relevance"} from the new code because
   the new code prefixes its key with this version. May 2026
   user report: "NG intl back to 15 (Amazon-only) hours after the
   3-pass deploy" — caused by an old instance that kept refreshing
   the default-sort NG cache entry. */
const POOL_CACHE_VERSION = "v4-may2026-is-deal-backfill";

async function fetchPoolCached(params: {
  categorySlug?: string;
  sort:          SortOption;
  search?:       string;
  country?:      string;
}): Promise<Deal[]> {
  /* Stable key — JSON.stringify omits undefined fields so absent
     category/search produces the same key as explicitly-undefined.
     Sort is always defined (server defaults to "relevance"). The
     POOL_CACHE_VERSION prefix invalidates pre-refactor entries. */
  const key = `${POOL_CACHE_VERSION}:${JSON.stringify(params)}`;
  const now = Date.now();

  const cached = POOL_CACHE.get(key);
  if (cached && cached.expires > now) return cached.data;

  const provider = await getActiveBrowseProvider();
  const data = await provider.fetchDeals({
    categorySlug: params.categorySlug,
    /* Intentionally NOT passing the user's minDiscount — see route
       body for the broad/qualifying split rationale. */
    minDiscount:  0,
    sort:         params.sort,
    search:       params.search,
    origin:       "all",
    country:      params.country,
  });

  /* Health-aware caching — don't lock users into a degraded view.

     1. Empty pool → don't cache at all. Most NG/UK/US/etc requests
        return thousands of rows; an empty response almost always
        means a transient DB failure (browse_deals RPC blip, schema
        change mid-ingest, Supabase pool exhaustion). Caching empty
        means every visitor in the next 5 minutes sees "0 deals"
        even after the DB recovers. User report May 2026:
        "sometimes the count is zero until the country is changed"
        — the country switch hits a different cache key that's
        still warm with good data, and changing back hits the
        recovered (or now-evicted) entry. Skipping the cache on
        empty results means the very next request retries and
        recovers as soon as the upstream comes back.

     2. Curated-fallback (Amazon-only, ~80 rows) → cache for 30s,
        not 5 min. This pool shape signals that browse_deals RPC
        failed and we served from the curated static catalogue. We
        want the cache to clear fast so we retry the RPC on the
        next visit, but a tiny TTL still amortises the per-request
        compute cost for the visitor wave that lands during a real
        outage.

     3. Healthy pool → cache for the full POOL_TTL_MS as before. */
  const looksLikeCuratedFallback = data.length > 0 && data.length <= 80 &&
    data.every((d) => d.storeId.startsWith("amazon-") || d.storeId === "amazon");

  /* Thin search pool — see SEARCH_POOL_MIN_CACHEABLE. A search that
     comes back below one page is about to trigger the live-search
     backfill; caching it here would pin the pre-backfill (thin) pool
     for the full TTL and hide the freshly-persisted deals from the
     user's next identical search. */
  const isThinSearchPool = !!params.search?.trim() &&
    data.length > 0 && data.length < SEARCH_POOL_MIN_CACHEABLE;

  if (data.length === 0) {
    /* Skip cache entirely. Next request to the same key retries the
       DB. Caller already returned `return data` below so flow
       proceeds normally. */
  } else if (isThinSearchPool) {
    /* Skip cache — the next search for this term must see the rows
       the live-search backfill is about to persist. */
  } else if (looksLikeCuratedFallback) {
    POOL_CACHE.set(key, { data, expires: now + 30_000 });
  } else {
    POOL_CACHE.set(key, { data, expires: now + POOL_TTL_MS });
  }

  /* Opportunistic eviction — every Nth set, drop expired entries to
     keep the Map from growing unbounded under freeform-search load.
     N=20 keeps amortized cost low without leaking. forEach avoids
     the for-of iterator that needs downlevelIteration in this
     project's tsconfig (target=es2017). */
  if (POOL_CACHE.size > 20) {
    POOL_CACHE.forEach((v, k) => {
      if (v.expires <= now) POOL_CACHE.delete(k);
    });
  }

  return data;
}

/* No `export const dynamic = "force-dynamic"` here.

   The route's use of `req.nextUrl.searchParams` automatically marks
   it dynamic in Next 14, so `force-dynamic` was redundant — but it
   ALSO caused Next.js to set
   `Cache-Control: public, max-age=0, must-revalidate` on the response,
   which silently overrode the explicit
   `Cache-Control: s-maxage=600, stale-while-revalidate=3600`
   set in the NextResponse below. QA caught this May 2026: Vercel
   edge was still HITting on warm cache somehow, but the shipped
   header didn't match spec and downstream CDN / browser caching was
   far weaker than intended. Removing the directive lets the
   explicit header flow through to clients.

   Route still behaves dynamically because of the searchParams read
   — no caching regression, just a header reconciliation. */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const category    = searchParams.get("category")    ?? undefined;
    /* No discount floor by default. Earlier we required >= 5% off,
       which hid the entire curated SerpAPI catalog (those rows ingest
       at retail price with discount_percent=0 because the upstream
       feed doesn't return a 'was' price). The user-facing contract
       for /deals: show all the deals we know about. The user can
       narrow with the tier filter (0% / 20%+ / 50%+) on the UI. */
    const minDiscount = searchParams.get("minDiscount") ?? "0";
    const sort        = (searchParams.get("sort") as SortOption) ?? "relevance";
    const search      = searchParams.get("search")      ?? undefined;
    const originParam = searchParams.get("origin") as OriginFilter | null;
    const origin      = originParam === "local" || originParam === "intl" ? originParam : "all";
    const limit       = searchParams.get("limit")  ? parseInt(searchParams.get("limit")!,  10) : 24;
    const offset      = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    /* Multi-store filter: comma-separated list of store IDs the user
       has ticked in the Stores filter panel (e.g. ?stores=argos,currys).
       Empty / absent = no filter applied. Trimmed + de-duped + cap at
       50 entries to prevent abusive queries from blowing up the SQL
       IN clause. */
    const storesParam = searchParams.get("stores")?.trim();
    const stores: string[] | undefined = storesParam
      ? Array.from(
          new Set(
            storesParam
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 50)
      : undefined;

    /* Country priority: URL param (when set) > cookie. The URL form
       is what the client sends so the CDN cache key varies per country;
       cookie fallback covers direct API consumers / curl. */
    const countryParam = searchParams.get("country");
    const country = countryParam ? getCountry(countryParam) : getServerCountry();
    const provider = await getActiveBrowseProvider();

    /* Pass through the user's origin choice for every country.

       The previous override forced non-NG users to "intl" regardless
       of what they clicked. Reasoning was "Konga / Jumia / 3C Hub
       aren't shoppable from UK / US", but filterDealsForCountry +
       the inferStoreCountry-based bucket below already handle that.
       The override added nothing and silently broke the UK "Local
       stores" tab: clicking it counted UK retailers in the badge
       (932) but the displayed items were still the cross-border
       intl bucket because effectiveOrigin was being clamped to
       "intl". Retest May 2026 caught the UK default view showing
       a wall of AliExpress with no UK retailers.

       After this change:
         - UK default "All deals"  → returns UK retailers + cross-border
         - UK "Local stores" tab    → returns UK retailers only
         - UK "International" tab   → returns cross-border only
         NG paths unchanged — user choice was already passed through. */
    const effectiveOrigin: OriginFilter = origin;

    /* Bucket 3#5 fix from QA audit — origin counts and result counts
       were both derived but from different pipelines:
         • Result count came from filterDealsForCountry on the
           sort-limited fetch (changed with sort)
         • Origin counts came from a SQL count(*) that ignored
           filterDealsForCountry, the curated catalog merge, and the
           in-memory plausibility filters
       So 'All 897 / Local 202 / Intl 665' (SQL) coexisted with
       '182 deals' (Relevance) and '310 deals' (Latest), and the
       appliances+50% case showed '1' in the toggle but '0' in the
       result. Reconcile by deriving everything from one fetch:
       pull origin='all', country-filter, bucket by currency in-
       memory, then apply the user's chosen origin to the items
       returned. Counts and items are now guaranteed consistent. */
    /* Fetch the BROAD pool — no minDiscount filter passed to the
       provider. The user's tier choice (20%+, 50%+) is applied
       below in JS so we can keep TWO pools:

         broadPool      — un-discount-filtered. Powers the Stores
                          dropdown so 0%-only stores (pharmacies,
                          grocers, Shopify-no-compare-at-price feeds)
                          still appear when the user picks a stricter
                          tier. User report May 2026: "stores without
                          deals should be included as well" — without
                          this split, HealthPlus / MedPlus / Bitmarte /
                          Essenza / Supermart / Ajebomarket vanish
                          from the dropdown whenever tier > 0.

         qualifying     — broadPool ∩ discount tier. Powers the
                          items list + originCounts. These need to
                          match what the user clicks: "Local 50"
                          better mean clicking "Local stores" shows
                          50 items, not 200.

       Egress unchanged: PAGES caps fan-out at 4000 rows regardless
       of whether minDiscount is SQL-filtered or JS-filtered. The
       dual-pass Pass B already pulled 2000 zero-discount rows for
       the default tier; this change just makes that data visible
       in the dropdown for higher tiers too. */
    const userMinDiscount = minDiscount ? parseInt(minDiscount, 10) : 0;
    /* Pool fetch goes through fetchPoolCached (defined at module top)
       so all paginations of the same query share one warm RPC result.
       Pre-cache: each load-more was 5-8s (full RPC pipeline per offset).
       Post-cache: page 2+ is ~50ms (memory hit). The country filter +
       origin bucketing + storesAggregate below run per request because
       those are visitor-specific concerns. */
    const allRawAcrossOrigins = await fetchPoolCached({
      categorySlug: category,
      sort,
      search,
      country: country.code,
    });

    /* Country store filter — pure-function, runs over Deal[] */
    const broadCountryFiltered = filterDealsForCountry(allRawAcrossOrigins, country);

    /* Bucket by store COUNTRY (not currency). Round-4 QA caught
       /uk/deals showing "Local stores: 0" even though John Lewis,
       Argos, Currys cards were visible. Root cause: SerpAPI
       normalises all UK retailer prices to USD before storing, so
       the old `currency === "NGN"` heuristic counted every UK
       retailer as INTL.

       Now: a deal is "local" if its store is anchored in the user's
       country. Argos / Currys / John Lewis → "UK" → local for UK
       shoppers. Konga / 3C Hub / Slot → "NG" → local for NG
       shoppers. AliExpress / Shein / Temu / DHgate → no anchor
       → INTL for everyone. Falls back to the currency check when
       the store can't be inferred (rare, niche scrapers). */
    const isLocalToUser = (d: typeof broadCountryFiltered[0]): boolean => {
      /* Primary signal: DB-tagged store_country (Deal.storeCountry).
         Restored on the RPC return in migration 0038 + threaded
         through rowToDeal. Authoritative because it covers stores
         the hardcoded JS COUNTRY_STORES roster doesn't enumerate
         (the ~600 stores backfilled by migration 0037 from
         offer.source_query). Before this, /za/deals?origin=local
         showed 4 items even though the head count was 159 ZA-
         tagged offers — the JS roster only knew 2 of the 94
         ZA-anchored stores in the DB. */
      if (d.storeCountry) {
        return d.storeCountry.toLowerCase() === country.code.toLowerCase();
      }
      /* Fallback 1: JS roster check (covers the curated/AliExpress
         paths where storeCountry is undefined). */
      const storeCountry = inferStoreCountry(d.storeId, d.storeName);
      if (storeCountry !== null) {
        return storeCountry.toLowerCase() === country.code.toLowerCase();
      }
      /* Fallback 2: explicit global cross-border stores (AliExpress /
         Shein / Temu / DHgate) are NEVER local. */
      if (isGlobalIntlStore(d.storeId, d.storeName)) return false;
      /* Fallback 3: currency match for fully-untagged rows. */
      return d.currency === country.currency;
    };

    /* Apply user's origin choice to the BROAD pool — this is the
       pool that drives the Stores dropdown. Country + origin are
       hard intent signals (a UK user on "Local stores" should never
       see Konga in the dropdown); discount tier is a soft preference
       that shouldn't shrink the dropdown. */
    const broadByOrigin =
      effectiveOrigin === "local" ? broadCountryFiltered.filter(isLocalToUser) :
      effectiveOrigin === "intl"  ? broadCountryFiltered.filter((d) => !isLocalToUser(d)) :
      broadCountryFiltered;

    /* Apply the user's discount tier to derive the qualifying pool
       (items list narrowed by tier). When tier=0 this is identical
       to broadCountryFiltered, so no extra work for default views. */
    const qualifyingCountryFiltered = userMinDiscount > 0
      ? broadCountryFiltered.filter((d) => d.discountPercent >= userMinDiscount)
      : broadCountryFiltered;
    const qualifyingLocal = qualifyingCountryFiltered.filter(isLocalToUser);
    const qualifyingIntl  = qualifyingCountryFiltered.filter((d) => !isLocalToUser(d));

    /* Origin pill counts come from a parallel head-count call —
       NOT from .length on the in-memory pool. Reason: the in-memory
       pool is capped at the PostgREST db-max-rows=1000 per pass
       (Pass A + B + C = up to ~3000 unique rows). For a market
       with more than 3000 rows in the catalog, the pill showed
       "exactly 1000" or "1959", which read as a UI bug — user
       report May 2026: "/ng/deals sort=newest shows exactly
       1000 local — is that a limit?".

       Head counts use count:'exact'+head:true → returns the true
       count via Postgres COUNT(*), no row payload, no 1000 cap.
       The DISPLAYED list still caps at the 3-pass pool; the pill
       reflects catalog truth so the user knows the inventory is
       bigger than what's paginatable today.

       Country-aware when present — see browse-db.ts getOriginCounts
       for the local/intl partition. */
    const headOriginCounts = await provider.getOriginCounts({
      categorySlug: category,
      minDiscount:  userMinDiscount,
      search:       search,
      stores:       stores,
      country:      country.code,
    }).catch(() => null);

    /* When a search query is present, ALWAYS derive originCounts from
       the in-memory filtered pool rather than the head-count RPC.
       Reason: head count uses search_deals_fts with candidates[0]
       only, while the items pool walks all FTS candidates AND applies
       additional JS-side filters (isUsableMerchantUrl, country
       roster, dedup). The two paths can disagree by 1-2 rows for
       narrow result sets, producing the "4 in tab, 3 displayed"
       UX bug from the re-audit (UK lawn-mower search).

       For browse-mode (no search), keep the head-count behaviour —
       it intentionally surfaces the true catalog count beyond the
       3-pass pool cap so the pill reads "5,453" not "1,000". The
       discrepancy only matters when the in-memory pool IS the full
       result set (i.e. for narrow searches where rows < cap). */
    const originCounts = (search && search.trim())
      ? {
          all:   qualifyingCountryFiltered.length,
          local: qualifyingLocal.length,
          intl:  qualifyingIntl.length,
          allDeals:   qualifyingCountryFiltered.filter((d) => d.discountPercent > 0).length,
          localDeals: qualifyingLocal.filter((d) => d.discountPercent > 0).length,
          intlDeals:  qualifyingIntl.filter((d) => d.discountPercent > 0).length,
        }
      : (headOriginCounts ?? {
          all:   qualifyingCountryFiltered.length,
          local: qualifyingLocal.length,
          intl:  qualifyingIntl.length,
        });

    /* Items pool: qualifying pool, narrowed to the user's origin choice. */
    let qualifyingByOrigin =
      effectiveOrigin === "local" ? qualifyingLocal :
      effectiveOrigin === "intl"  ? qualifyingIntl  :
      qualifyingCountryFiltered;

    /* Relevance-rotation pass — gentle randomness so a user who hits
       /deals more than once doesn't see the exact same top-of-list
       every time. Only kicks in for sort=relevance (the default);
       newest / discount / price sorts stay strictly deterministic
       because their ordering carries explicit semantic meaning.

       Approach: jitter every deal's relevance rank by a seeded random
       amount, then re-sort. The strongest deals still tend to lead
       (their starting rank is low) but the visible first page rotates
       through a deep slice of the catalog, not a fixed top band.

       Rotation cadence: 60 seconds. Paired with a matching
       s-maxage=60 edge cache for sort=relevance responses (see
       header logic at the bottom of this handler), so a fresh
       shuffle lands at the edge about once per minute. The
       in-memory POOL_CACHE (5 min TTL) absorbs the DB cost — the
       cache miss every minute just rebuilds the response from the
       same hot pool, no extra Supabase RPCs.

       User report May 2026: "adjust the algorithm of sort by
       relevance so it's somewhat random or the user at least
       sees new items from time to time." Initial ship was a
       10-min bucket (matched then-current cache TTL). Follow-up:
       "cant relevance rotate on every call or more frequently?"
       Tightened to 60s. */
    if (sort === "relevance" && qualifyingByOrigin.length > 12) {
      const ROTATION_BUCKET_MS = 60 * 1000;            // new shuffle every 60 seconds
      const bucket = Math.floor(Date.now() / ROTATION_BUCKET_MS);
      /* Per-country seed component so /uk and /ng don't share a
         shuffle (two markets, two separate orderings — preserves
         the perception that each market has its own editorial
         curation). */
      const seedStr = `${bucket}:${country.code}`;
      let h = 2166136261;
      for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      let seed = h >>> 0;
      const rng = () => {
        seed = (seed + 0x6D2B79F5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      /* Rank jitter. Each deal's relevance rank (its index) is nudged
         by a seeded random amount, up to JITTER/2 positions in either
         direction, then the pool is re-sorted by the jittered rank.

         Bumped 320 -> 1500 after follow-up feedback ("doesn't seem
         like the pool has increased"). With JITTER=320 the visible
         first ~60 was effectively sampled from only the top ~220
         deals — so the same familiar items kept dominating. JITTER
         =1500 widens that draw to roughly the top ~1,560: deals well
         past idx 500 now get a real chance to appear. Top-relevance
         items still surface frequently (a deal at idx 0 has rank
         in [-750, 750] so it's still very likely to land in the
         visible window), so the strongest deals don't get buried.
         Larger is the one knob: it trades "best matches always
         first" for "more reveal of less-seen items". */
      const JITTER = 1500;
      const jittered = qualifyingByOrigin
        .map((deal, idx) => ({ deal, rank: idx + (rng() - 0.5) * JITTER }))
        .sort((a, b) => a.rank - b.rank)
        .map((x) => x.deal);
      /* The jitter can place same-store items next to each other;
         re-run spaceByStore (gap 6) so the rotated feed keeps the
         no-clustering property the relevance sort gives it. */
      qualifyingByOrigin = spaceByStore(jittered, 6);
    }

    /* Degraded-response detector — fires when browse_deals RPC failed
       upstream and getCuratedDeals() served the response instead. In
       that case every item has a storeId like amazon-uk-* / amazon-us-*
       / amazon-de-* (the curated catalog is Amazon-only). Production
       data is never Amazon-only; even sparse markets surface a few
       cross-border stores. We use this as the cache-poisoning safeguard:
       when degraded, the response gets `Cache-Control: no-store` so
       Vercel + Next.js + browser caches all refuse to retain it.

       Why this matters: the SSR fetch in /[country]/deals/page.tsx now
       uses cache: "no-store" (May 2026 fix). But this header is a
       second layer of defence — any future re-enabling of fetch cache,
       any CDN downstream, any client-side cache, all see no-store and
       refuse to retain the bad response. */
    const looksLikeCuratedFallback =
      allRawAcrossOrigins.length > 0 &&
      allRawAcrossOrigins.length <= 80 &&
      allRawAcrossOrigins.every((d) => d.storeId.startsWith("amazon-") || d.storeId === "amazon");

    /* Build the stores aggregate as a HYBRID:

       • Store LIST comes from the broad pool — every store in the
         country/category/origin context appears, including 0%-only
         pharmacies / grocers that have no qualifying inventory at
         the current tier. So users at tier=20%+ still see HealthPlus
         in the dropdown.

       • Store COUNT comes from the qualifying pool — the number next
         to each store matches the items that will appear in the feed
         after that store is ticked. So if a user reads "HealthPlus
         (12)" and clicks, they see 12 items — not 554.

       Before this hybrid, the count was sourced from the broad pool
       and didn't match post-click reality. User report May 2026:
       "some stores show a wrong number in the dropdown and it
       changes when the store is selected." The number actually
       changed because tier-filtered items came back with a smaller
       total — fixed by reconciling the two upfront. */
    /* Consolidate the dropdown by DISPLAY name (not raw storeId).
       SerpAPI's ingest creates one row per seller variant — Walmart
       alone produces "walmart", "walmart-carote-official",
       "walmart-turtle-beach", … (8+ variants). The previous
       per-storeId aggregate showed each as a separate entry, and
       ticking the bare "Walmart" matched only 2 of the 15 actual
       Walmart deals. User report May 2026: "/us/deals?stores=walmart
       shows '15' in header but '0 deals' in body."

       Now every variant whose displayStoreName collapses to the
       same canonical name (Walmart, Amazon UK, Currys, etc.) gets
       merged into ONE dropdown entry. The entry's `id` becomes the
       canonical display name (lowercased), and `count` sums all
       variants' qualifying counts. The filter pass below matches
       items by displayStoreName too, so ticking one entry catches
       every underlying variant. */
    const canonicalKey = (storeName: string) => displayStoreName(storeName).toLowerCase();

    const storesAggregate = (() => {
      /* First pass: qualifying-pool counts grouped by canonical
         display name. */
      const qualifyingCounts = new Map<string, number>();
      for (const d of qualifyingByOrigin) {
        if (!d.storeId) continue;
        const key = canonicalKey(d.storeName);
        qualifyingCounts.set(key, (qualifyingCounts.get(key) ?? 0) + 1);
      }
      /* Second pass: walk the broad pool to collect the store list
         (so 0%-only stores still appear) and stamp each with its
         qualifying count (0 when the store has no items at the
         user's current tier). Keyed on canonical name; the entry's
         `id` IS that canonical key so the URL stays human-readable
         ("?stores=walmart" rather than a UUID). */
      const map = new Map<string, { id: string; name: string; count: number }>();
      for (const d of broadByOrigin) {
        if (!d.storeId) continue;
        const key  = canonicalKey(d.storeName);
        if (map.has(key)) continue;
        const name = displayStoreName(d.storeName);
        map.set(key, { id: key, name, count: qualifyingCounts.get(key) ?? 0 });
      }
      /* Sort by qualifying count DESC so the stores with the most
         actionable inventory at the current tier float to the top
         of the dropdown. Stores with count=0 (visible but empty)
         settle at the bottom. */
      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    })();

    /* Multi-store filter — match by canonical display name now that
       the dropdown's `id` is the display key. Falls back to storeId
       match too (defensive — older clients may pass a raw storeId
       from a shared link). */
    const all = stores && stores.length > 0
      ? qualifyingByOrigin.filter((d) => {
          if (stores.includes(d.storeId.toLowerCase())) return true;
          return stores.includes(canonicalKey(d.storeName));
        })
      : qualifyingByOrigin;

    const total = all.length;
    const sliced = all.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    /* Trim per-item payload before serialising. The full Deal shape
       carries 21 fields totalling ~1.9KB per row — but the cards only
       read 14, and the single biggest field is `url` (Google Shopping
       URLs run 1000+ chars per row, ~55% of the per-item payload).

       Cards link to the PDP first (`/p/{id}`), not directly to the
       merchant, so the URL itself is never read on the deals surface.
       The only consumer of `url` was `isStoreSearchUrl(deal.url)` to
       decide whether to show a "from $X" prefix — pre-compute that
       boolean server-side and ship just the bit.

       Net per-item: ~1.9KB → ~500 bytes (75% reduction). 24-item
       page: 57KB → ~14KB on the wire. Big win on poor networks +
       Vercel egress. */
    const items = sliced.map((d) => ({
      id:              d.id,
      title:           d.title,
      /* `description` shipped as empty string — duplicates `title`
         in 99%+ of rows and isn't read by any card surface. Keeps
         the Deal type satisfied without bloating the wire. */
      description:     "",
      category:        d.category,
      categorySlug:    d.categorySlug,
      storeId:         d.storeId,
      storeName:       d.storeName,
      originalPrice:   d.originalPrice,
      salePrice:       d.salePrice,
      discountPercent: d.discountPercent,
      currency:        d.currency,
      imageUrl:        d.imageUrl,
      /* `url` intentionally empty — Google Shopping URLs are 1KB+
         each and the cards link to PDP first (`/p/{id}`), not
         directly to the merchant. The full URL lives on the
         offer record fetched by the PDP itself. */
      url:             "",
      expiresAt:       null,
      isHot:           false,
      isFeatured:      false,
      tags:            [],
      saves:           0,
      clicks:          0,
      postedAt:        d.postedAt,
      /* Pre-computed boolean — cards read this instead of running
         isStoreSearchUrl(deal.url) themselves (which can't work
         anyway now that url is empty). */
      isPriceFromOnly: isStoreSearchUrl(d.url),
    }));

    /* Cache window bumped May 2026 from s-maxage=60/swr=300 to
       s-maxage=600/swr=3600 — Supabase egress crossed the free-tier
       cap. 10 minutes of staleness is invisible to browsers (prices
       on the deals feed move on hour-scale, not minute-scale) and
       the SWR window means a stale page renders instantly while a
       fresh one warms in the background.

       Manual Response (not NextResponse.json) — bypasses the Next 14
       quirk where dynamic routes silently strip user-set
       Cache-Control headers in favour of `private, no-cache,
       no-store`. The QA verified post-deploy that NextResponse.json's
       header didn't reach the wire. Returning a plain Response with
       headers explicitly set bypasses Next's response-wrapper.

       Cache key varies by full URL (every filter combo gets its own
       slot), so this won't accidentally serve UK results to NG users. */
    /* Cache window varies by sort:

         relevance → s-maxage=60, swr=120
           Matches the 60-second rotation bucket in the shuffle
           pass above. The edge holds each shuffled snapshot for
           ~1 minute, then a fresh shuffle gets baked into the next
           cache fill. Returning visitors see meaningfully different
           top-of-list ~once per minute.

         everything else → s-maxage=600, swr=3600
           newest / discount / price sorts have stable, intentional
           orderings — no value in re-cooking the response every
           minute. The 10-min window keeps Supabase egress in budget
           (was the original tuning post-May-2026 cache bump).

         degraded → no-store
           browse_deals RPC fall-through served the curated catalog.
           Don't cache the degraded shape — next request retries. */
    /* Sparse-search guard — a text search that resolves below the
       live-search threshold is about to be backfilled: DealFeed fires
       /api/live-search, which persists fresh rows into the catalog.
       Caching this pre-backfill response — even for the 60s relevance
       window — pins the thin result so the user's very next search for
       the same term keeps seeing the gap instead of the deals the live
       search just persisted. Serve it no-store so the re-search
       re-queries the now-populated catalog. originCounts.all is the
       all-origins catalog count — the exact figure DealFeed gates its
       live fallback on. */
    const isSparseSearch = !!(search && search.trim()) &&
      originCounts.all < LIVE_SEARCH_THRESHOLD;

    const cacheControlHeader =
      looksLikeCuratedFallback ? "private, no-store, no-cache, max-age=0, must-revalidate" :
      isSparseSearch           ? "private, no-store, no-cache, max-age=0, must-revalidate" :
      sort === "relevance"     ? "s-maxage=60, stale-while-revalidate=120"                 :
                                 "s-maxage=600, stale-while-revalidate=3600";

    /* Did-you-mean suggestions for empty-result searches.
       Surfaced in the empty state when the user has typed something
       and we found no matches. /compare has done this via the API
       since round-4 QA; /deals was missing it (May 2026 audit). One
       suggest_titles RPC call, cheap, only fires when the displayed
       list is genuinely zero AND a search query is present —
       browse-mode empty (filter combo with no matches) doesn't need
       this since filters can be relaxed. */
    let suggestions: Array<{ title: string; key: string }> = [];
    if (items.length === 0 && search && search.trim().length >= 2) {
      const fetched = await fetchSearchSuggestions(search, 3);
      suggestions = fetched.map((s) => ({ title: s.title, key: s.key }));
    }

    return new Response(
      JSON.stringify({
        items,
        total,
        hasMore,
        originCounts,
        stores: storesAggregate,
        provider: provider.id,
        suggestions,
        /* displayCurrency — the currency every item SHOULD be presented
           in to the requesting visitor. Added May 2026 v3 to harden
           the latent risk for downstream API consumers. Items still
           carry their raw `currency` field (USD / NGN as stored at
           ingest) — that's the source-of-truth from the ingest path.
           displayCurrency tells consumers what the FRONTEND
           converts to before render via formatPriceForUser /
           formatLocal helpers. Without this, an external consumer
           reading the API would see currency="USD" for a UK
           retailer row and incorrectly display $ instead of £. */
        displayCurrency: country.currency,
        displayCountry:  country.code,
      }),
      {
        status: 200,
        headers: {
          "Content-Type":  "application/json",
          "Cache-Control": cacheControlHeader,
          /* Vary on Accept-Encoding so the CDN keeps a single
             compressed variant per encoding (gzip / br). Without
             this, Vercel can serve an uncompressed body to a client
             whose Accept-Encoding negotiated brotli — Vary tells the
             edge cache that the response varies by encoding. Added
             May 2026 v3 along with the egress-relief push. */
          "Vary":            "Accept-Encoding",
          /* Diagnostic header so we can grep nginx / Vercel logs for
             fallback hits and know when to investigate the RPC. */
          "X-Havlo-Degraded": looksLikeCuratedFallback ? "curated-fallback" : "ok",
        },
      },
    );
  } catch (err) {
    console.error("[/api/deals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
