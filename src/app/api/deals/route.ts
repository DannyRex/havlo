import { NextRequest, NextResponse } from "next/server";
import { getActiveBrowseProvider } from "@/lib/providers";
import { spaceByStore } from "@/lib/providers/curated-helper";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry, getCountry, inferStoreCountry, isGlobalIntlStore, isCrossBorderStore } from "@/lib/country";
import { getPrecomputedOriginCounts } from "@/lib/deals/precomputed-counts";
import { isStoreSearchUrl } from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
import { fetchSearchSuggestions } from "@/lib/search/suggestions";
import { listCountryStoresWithCounts, resolveCanonicalStoreFilter, type DropdownStoreRow } from "@/lib/providers/browse-db";
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
const POOL_CACHE_VERSION = "v5-real-deal";

async function fetchPoolCached(params: {
  categorySlug?: string;
  sort:          SortOption;
  search?:       string;
  country?:      string;
  /* User's discount tier (10/20/50%). Pushed into the SQL fetch so the
     pool row-cap lands AFTER the discount filter, not before. With the
     old broad-pool-then-JS-filter, a sort like "newest" capped the pool
     to recent (mostly full-price) rows BEFORE the tier filter, so "Best
     deals" collapsed to 49 of its real 511 under Latest. Omitted / 0
     keeps the broad default-browse pool and its shared cache key. */
  minDiscount?:  number;
  /* REAL store_ids (already resolved from URL canonical via
     resolveCanonicalStoreFilter). When set, the underlying RPC
     filters to these stores so even niche stores with only one
     product still surface — fixes the May 2026 case where
     /uk/deals?stores=a1+tech+deals showed 0 results because
     A1 Tech Deals' single offer was below the 500-row global
     pool cap. Cache key includes this so per-store-filter views
     get their own warm pool. */
  stores?:       string[] | null;
  /* "Deals" tier sentinel: push is_real_deal into the RPC (p_deals_only)
     so the real-deal filter lands BEFORE the row-cap. Fixes the Deals
     count swinging with sort (977 Relevance / 551 Latest) and unhides the
     ~400 real deals the broad-pool cap dropped on Latest. Part of the
     cache key (distinct from the broad tier-0 pool). */
  dealsOnly?:    boolean;
}): Promise<Deal[]> {
  /* Stable key — JSON.stringify omits undefined fields so absent
     category/search produces the same key as explicitly-undefined.
     Sort is always defined (server defaults to "relevance"). The
     POOL_CACHE_VERSION prefix invalidates pre-refactor entries.
     Stores sorted for stable key regardless of URL order. */
  const stableStores = params.stores ? [...params.stores].sort() : undefined;
  const keyParams = { ...params, stores: stableStores };
  const key = `${POOL_CACHE_VERSION}:${JSON.stringify(keyParams)}`;
  const now = Date.now();

  const cached = POOL_CACHE.get(key);
  if (cached && cached.expires > now) return cached.data;

  const provider = await getActiveBrowseProvider();
  const data = await provider.fetchDeals({
    categorySlug: params.categorySlug,
    /* Tier pushed into SQL so the row-cap lands AFTER the discount
       filter, keeping qualifying counts stable across sorts. */
    minDiscount:  params.minDiscount ?? 0,
    sort:         params.sort,
    search:       params.search,
    origin:       "all",
    country:      params.country,
    stores:       params.stores ?? undefined,
    dealsOnly:    params.dealsOnly ?? false,
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

/* Country-correct dropdown rows for the /deals store filter.

   list_country_stores_with_counts is country-scoped ONLY for
   origin="local"; for "all"/"intl" it returns a GLOBAL roster blind to
   p_country (SQL-function bug; DB is read-only so we correct it here).
   Left unfixed, a UK visitor's store filter lists Jumia / Flipkart /
   Konga — NG/IN-anchored stores the country-filtered items grid never
   shows — and the "N stores" pill reads ~900 for every market,
   contradicting the homepage hero's per-country "scanning prices
   across N stores".

   We rebuild the country-correct slice app-side:
     • local → the RPC as-is (already country-scoped, untruncated).
     • intl  → the global roster narrowed to this country's cross-border
               allowlist (isCrossBorderStore needs store id + name only).
     • all   → local ∪ intl, deduped by store_id so a store surfacing in
               both isn't summed twice by the canonical-name aggregator
               downstream.
   The "all" union matches getShoppableStoreCount (homepage hero), so the
   two surfaces agree on the default (unfiltered) view. */
async function countryCorrectDropdownRows(opts: {
  countryCode: string;
  category:    string | null | undefined;
  minDiscount: number;
  search:      string | null;
  origin:      OriginFilter;
}): Promise<DropdownStoreRow[]> {
  const { countryCode, category, minDiscount, search, origin } = opts;
  const base = { country: countryCode, category, minDiscount, search };
  const onlyCrossBorder = (rows: DropdownStoreRow[]) =>
    rows.filter((r) =>
      isCrossBorderStore(
        { storeId: r.store_id, storeName: r.store_name, currency: "", tags: [] },
        countryCode,
      ),
    );

  if (origin === "local") {
    return listCountryStoresWithCounts({ ...base, origin: "local" });
  }

  if (origin === "intl") {
    // The RPC's intl slice is the country-blind global roster; narrow it.
    return onlyCrossBorder(await listCountryStoresWithCounts({ ...base, origin: "all" }));
  }

  // origin === "all": local ∪ cross-border, deduped by store_id. Both RPC
  // slices fire in parallel (the global slice is country-blind, the local
  // slice is country-scoped + untruncated).
  const [global, local] = await Promise.all([
    listCountryStoresWithCounts({ ...base, origin: "all" }),
    listCountryStoresWithCounts({ ...base, origin: "local" }),
  ]);
  const seen = new Set<string>();
  const out: DropdownStoreRow[] = [];
  for (const r of [...local, ...onlyCrossBorder(global)]) {
    if (seen.has(r.store_id)) continue;
    seen.add(r.store_id);
    out.push(r);
  }
  return out;
}

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
    /* Clamp limit/offset (June 2026 QA): limit=-1 hit
       slice(offset, offset - 1), whose negative end index made it return
       the ENTIRE pool minus one row (1,893 items, megabytes per hit) — a
       free heaviest-possible-query button for any caller; limit=9999
       returned the full pool. Clamp to [1, 100] (UI pages request <=48)
       and offset to >=0; NaN falls back to the defaults. */
    const rawLimit    = searchParams.get("limit")  ? parseInt(searchParams.get("limit")!,  10) : 24;
    const rawOffset   = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;
    const limit       = Number.isFinite(rawLimit)  ? Math.min(Math.max(rawLimit, 1), 100) : 24;
    const offset      = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

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
    /* June 2026: the discount tier is now pushed INTO the pool fetch
       (fetchPoolCached minDiscount), so the row-cap lands after the
       filter and qualifying counts stay stable across sorts. The notes
       below describe the prior broad-pool-then-JS-filter design; the
       Stores dropdown they reference is now a separate cap-free RPC
       (countryCorrectDropdownRows), so 0%-discount stores still list at
       higher tiers without needing an unfiltered pool here:

       (historical) The user's tier choice (20%+, 50%+) is applied
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
    /* "Deals" tier sentinel: minDiscount===1 means the richer is_real_deal view
       (0083: a markdown OR cross-store-cheapest OR below-30d-high), NOT a literal
       >=1% threshold (DealFeed already labels "1" as "Deals"). In that mode we
       fetch the BROAD pool (poolMinDiscount=0) so discount=0 cross-store-cheapest
       products aren't filtered out by the RPC, then gate items + the "deals" pill
       on isRealDeal app-side — so the Deals tab, the homepage tiles (precomputed
       all_deals = is_real_deal), and the live pill all show the same set. The
       20%+/50%+ tiers stay literal discount thresholds. */
    const isDealsMode     = userMinDiscount === 1;
    const poolMinDiscount = isDealsMode ? 0 : userMinDiscount;
    /* Pool fetch goes through fetchPoolCached (defined at module top)
       so all paginations of the same query share one warm RPC result.
       Pre-cache: each load-more was 5-8s (full RPC pipeline per offset).
       Post-cache: page 2+ is ~50ms (memory hit). The country filter +
       origin bucketing + storesAggregate below run per request because
       those are visitor-specific concerns. */
    /* Items pool + dropdown source fire in parallel. The dropdown
       RPC (list_country_stores_with_counts, migration 0043) reads
       all visible-to-country stores from product_best_offers in a
       single GROUP BY — NOT bounded by the 3-pass per-pass row caps
       that constrain the items pool. Without this parallel call the
       dropdown was missing 90% of stores in non-NG countries (the
       May 2026 cross-country audit found Amazon + noon absent from
       AE and Takealot absent from ZA). */
    /* Translate the URL's CANONICAL store filter ("amazon", "walmart",
       "a1 tech deals") into the REAL store_ids the RPC's p_store_ids
       parameter expects ("amazon-com", "walmart-marketplace",
       "a1-tech-deals"). One canonical key can expand to multiple
       real ids (Amazon's seller variants). Without this translation,
       the pool RPC matches nothing and the items grid returns zero
       even when the dropdown count shows >0. Resolution is cached
       via unstable_cache (1-hour TTL) so this is effectively free
       on warm functions. */
    const realStoreIds = await resolveCanonicalStoreFilter(stores);

    /* Three independent fetches fire in parallel:
         1. items pool (capped 3-pass fan-out, drives the grid)
         2. dropdown store list (cap-free RPC, drives the filter panel)
       (Origin tab counts are derived below from the SAME pool the grid
       paginates, so they are not fetched here — that keeps the pill equal
       to the displayed deal count.) Resolving the two in one Promise.all
       keeps total latency = max(individual), not sum. */
    const [broadPool, dropdownStoresRaw] = await Promise.all([
      fetchPoolCached({
        categorySlug: category,
        sort,
        search,
        country: country.code,
        /* Items pool is the BROAD pool (no store filter pushed into the
           RPC), EVEN when the user has ticked stores. Each store's dropdown
           count is that store's slice of THIS pool, so deriving the filtered
           grid from the SAME pool makes "Shein (319)" deliver exactly 319 on
           click. The previous per-store re-fetch pushed the filter into the
           RPC, where the row-cap landed AFTER it and surfaced the store's
           FULL inventory (835) — which then exceeded the dropdown's pool-
           slice count (user report: "the dropdown number doesn't match;
           there's usually more when the store is clicked"). Restores the
           documented invariant (count never exceeds the grid). A niche store
           ranked below the pool cap is handled by the fallback below. */
        stores: undefined,
        /* Push the tier into the fetch so the qualifying count is
           sort-stable. `|| undefined` for tier=all keeps the broad
           pool's shared cache key (no cold-bust, no per-default egress). */
        minDiscount: poolMinDiscount || undefined,
        /* Deals tier rides p_deals_only instead of p_min_discount (which
           stays 0 here so discount=0 cross-store-cheapest rows survive).
           This is what makes the Deals count sort-stable. */
        dealsOnly: isDealsMode,
      }),
      countryCorrectDropdownRows({
        countryCode: country.code,
        category:    category,
        minDiscount: poolMinDiscount,
        search:      search ?? null,
        /* Origin-scoped dropdown: "Local" tab shows only country-
           anchored stores, "Cross-border" shows only intl, "All"
           shows the union. Avoids dead-end UX where the user picks
           AliExpress from the Local tab and the items grid returns
           zero results because the local filter excludes intl rows.

           Wrapped in countryCorrectDropdownRows (above) because the
           RPC is country-BLIND for origin all/intl — it would
           otherwise list ~900 global stores (Jumia/Flipkart for a UK
           visitor) and make the "N stores" pill disagree with the
           homepage hero. The wrapper narrows all/intl to this
           country's local roster ∪ cross-border allowlist. */
        origin:      origin,
      }),
    ]);

    /* Niche-store fallback. The items pool above is the broad pool so each
       store's dropdown count equals what ticking it shows. But a store ranked
       BELOW the broad pool's row-cap (e.g. a single-offer retailer reached via
       a shared ?stores=<x> link) won't appear in that pool at all. When the
       user explicitly requests stores and NONE of them made the broad pool,
       refetch their own pool so the link still resolves — such stores were
       never in the broad-pool dropdown, so surfacing them contradicts no
       on-screen count. */
    let allRawAcrossOrigins = broadPool;
    if (realStoreIds && realStoreIds.length > 0) {
      const wanted = new Set(realStoreIds.map((s) => s.toLowerCase()));
      const coveredByBroadPool = broadPool.some((d) => wanted.has(d.storeId.toLowerCase()));
      if (!coveredByBroadPool) {
        allRawAcrossOrigins = await fetchPoolCached({
          categorySlug: category,
          sort,
          search,
          country: country.code,
          stores: realStoreIds,
          minDiscount: poolMinDiscount || undefined,
          dealsOnly: isDealsMode,
        });
      }
    }

    /* Country store filter — pure-function, runs over Deal[].
       The third arg is the user's EXPLICITLY-selected store set
       (resolved earlier into realStoreIds). When present, those
       stores bypass the country reachability check — the visitor
       declared intent by ticking them in the dropdown, so silently
       dropping their results because the store isn't in NG/UK/etc's
       cross-border allowlist was wrong UX. Default discovery view
       (no store filter ticked → realStoreIds is null) still gets
       the full guard. */
    const explicitlyFilteredStores = realStoreIds && realStoreIds.length > 0
      ? new Set(realStoreIds)
      : undefined;
    const broadCountryFiltered = filterDealsForCountry(allRawAcrossOrigins, country, explicitlyFilteredStores);

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
    const qualifyingCountryFiltered =
      isDealsMode
        /* "Deals" = is_real_deal. Fallback to discount>0 for non-matview Deals
           (curated / live-search) whose isRealDeal is undefined. */
        ? broadCountryFiltered.filter((d) => d.isRealDeal ?? (d.discountPercent > 0))
        : userMinDiscount > 0
          ? broadCountryFiltered.filter((d) => d.discountPercent >= userMinDiscount)
          : broadCountryFiltered;
    const qualifyingLocal = qualifyingCountryFiltered.filter(isLocalToUser);
    const qualifyingIntl  = qualifyingCountryFiltered.filter((d) => !isLocalToUser(d));

    /* Pool-derived origin counts — the SAME list that produces items +
       `total` below, so each pill equals the cards the grid paginates.
       Used directly for SEARCH (must reflect results + gate live-search at
       originCounts.all < LIVE_SEARCH_THRESHOLD) and tier-filtered views, and
       as the FALLBACK when the precomputed table is unavailable. */
    const poolOriginCounts = {
      all:   qualifyingCountryFiltered.length,
      local: qualifyingLocal.length,
      intl:  qualifyingIntl.length,
      /* "deals" = is_real_deal (0083), matching the precomputed all_deals +
         browse-db getOriginCounts, so the pill == the homepage tile. Fallback
         to discount>0 for non-matview Deals whose isRealDeal is undefined. */
      allDeals:   qualifyingCountryFiltered.filter((d) => d.isRealDeal ?? (d.discountPercent > 0)).length,
      localDeals: qualifyingLocal.filter((d) => d.isRealDeal ?? (d.discountPercent > 0)).length,
      intlDeals:  qualifyingIntl.filter((d) => d.isRealDeal ?? (d.discountPercent > 0)).length,
    };

    /* Default BROWSE view (no search, no tier): prefer the accurate
       precomputed counts (category_reach_counts, cron-maintained) so the
       pill == the homepage tile and isn't truncated by the 3-pass display
       cap (fashion read 249 for ZA vs 2,157 real). A single cheap indexed
       read; returns null → falls back to the pool counts when the table is
       missing/stale. The grid still paginates the shallow pool, so for a few
       mega categories the count exceeds the rendered cards — DealFeed
       discloses "showing the top N" (no contradiction). */
    const isPlainBrowse = !(search && search.trim()) && userMinDiscount === 0;
    const precomputedCounts = isPlainBrowse
      ? await getPrecomputedOriginCounts(country, category)
      : null;
    const originCounts = precomputedCounts ?? poolOriginCounts;

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
      const ROTATION_BUCKET_MS = 60 * 1000;            // wall-clock fallback bucket
      /* Rotation seed: a STABLE per-session value the client threads
         through every page request (?seed=) so the relevance order stays
         FIXED for the whole scroll session and offsets never overlap.

         Recycling bug (Jun 2026): the seed used to be a LIVE wall-clock
         60s bucket evaluated per request. A scroll session that crossed a
         minute boundary got a re-shuffled order, so deeper offsets
         re-served products already shown on earlier pages (the feed
         "recycled"). The bumped JITTER (320 -> 2600) made it worse, not
         better -- bigger jitter = more cross-page movement = more repeats.
         Now DealFeed captures ONE seed at page load and reuses it for
         every load-more, so a session pages through the pool exactly once.
         Seed-less callers (direct API hits) fall back to the wall-clock
         bucket, where rotation-over-time is still the right behaviour. */
      const seedParam = searchParams.get("seed");
      const bucket = seedParam && /^\d{1,15}$/.test(seedParam)
        ? Number(seedParam)
        : Math.floor(Date.now() / ROTATION_BUCKET_MS);
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

         Bumped 320 -> 1500 -> 2600 after repeat "I keep seeing the
         same things" feedback (#17). With JITTER=320 the visible first
         ~60 was effectively sampled from only the top ~220 deals; 1500
         widened it to ~1,560; 2600 reaches ~top-2,660, which now covers
         the FULL fetched pool even in deep markets like NG (PASS_C_MAX
         pulls ~1.5k local rows there) so a repeat visitor pages across
         far more of the catalog. Top-relevance items still surface
         often (a deal at idx 0 has rank in [-1300, 1300] so it's still
         likely to land in the visible window), so the strongest deals
         aren't buried. NOTE: this only reshuffles within the rows the
         RPC already returned (PASS_MAX/PASS_C_MAX). Reaching deals
         BEYOND that fetch window needs either a larger p_max_rows (more
         egress) or a rotating offset/seed in browse_deals (a DB change).
         Larger jitter trades "best matches always first" for "more
         reveal of less-seen items". */
      const JITTER = 2600;
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

    /* Dropdown store counts come from the SAME origin-filtered pool the grid
       paginates (qualifyingByOrigin), so each store's number EQUALS what the
       user actually sees when they tick it — the founder's no-number-
       contradiction rule. (Jun 2026 fix: the prior cap-free RPC count used a
       LOOSER deal/in-stock basis than the items pool, so e.g. Kara read "81" in
       the dropdown yet the Deals grid showed 6 — Kara's stock carries no nominal
       discount, so only its is_real_deal rows qualify, and the RPC wasn't
       counting on that basis.) Grouped by canonical display name, which is also
       the key the store filter matches on, so count('kara') == total when Kara
       is ticked. The cap-free RPC list is still consulted only for the canonical
       display NAME. Stores with nothing in the current view are omitted — listing
       a store that yields 0 cards on selection would itself be a contradiction.

       Trade-off vs the old cap-free count: in a market large enough to truncate
       the 3-pass pool, a store can carry more inventory than the pool holds. We
       deliberately show the pool figure (what's actually browsable) so the count
       never exceeds the grid; whole-catalogue store discovery is a tier-clear
       away, not a dropdown promise we can't keep. */
    const storesAggregate = (() => {
      const poolCount = new Map<string, number>();
      const poolName  = new Map<string, string>();
      for (const d of qualifyingByOrigin) {
        const key = canonicalKey(d.storeName);
        poolCount.set(key, (poolCount.get(key) ?? 0) + 1);
        if (!poolName.has(key)) poolName.set(key, displayStoreName(d.storeName));
      }
      /* Prefer the RPC's canonical display name where it has one. */
      for (const row of dropdownStoresRaw) {
        const key = canonicalKey(row.store_name);
        if (poolCount.has(key)) poolName.set(key, displayStoreName(row.store_name));
      }
      return Array.from(poolCount.entries())
        .map(([key, count]) => ({ id: key, name: poolName.get(key) ?? key, count }))
        .sort((a, b) => b.count - a.count);
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
      /* Deal/trust signals the cards badge on. Three booleans (~60 bytes/
         item), but without them the /deals feed could ONLY render the
         price-derived discount badge: richer real-deals (cross-store
         cheapest / below-30d-high, no markdown to strike), 30-day lows, and
         used items all showed with NO badge at all (user report: "products
         with no deal badge show up in deals"). isRealDeal drives the "Good
         price" chip; at30DayLow + isUsed let it correctly defer to the
         "Lowest in 30 days" badge and "Used / Refurbished" tag. Surgical
         un-slim — still ~70% smaller than the pre-slim payload. */
      isRealDeal:      d.isRealDeal ?? false,
      at30DayLow:      d.at30DayLow ?? false,
      isUsed:          d.isUsed ?? false,
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
        /* True when the browse_deals RPC fell through to the curated
           Amazon-only catalogue (a transient pool failure). The SSR
           prefetch passes this to DealFeed so a degraded first paint
           triggers a client refetch instead of sticking on a bogus
           empty/Amazon-only view (the "Local is empty until I toggle"
           bug, June 2026). */
        degraded: looksLikeCuratedFallback,
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
          /* Phase-3 store-filter debug header. When the URL carries
             a stores filter, surface the resolved real-store-id list
             so we can grep for canonical-vs-real mismatches in prod
             without spelunking Vercel logs. Drop this header after
             the audit run lands. */
          "X-Havlo-Resolved-Stores": stores && stores.length > 0
            ? JSON.stringify({ canonical: stores, real: realStoreIds, pool: allRawAcrossOrigins.length })
            : "none",
        },
      },
    );
  } catch (err) {
    console.error("[/api/deals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
