/* DB-backed browse provider.
   Reads from products + offers (populated by the ingestion cron).
   Activates only when the DB has rows, so it gracefully no-ops in dev. */

import type { BrowseProvider, BrowseQuery, OriginCounts, FetchDealsOptions } from "./types";
import type { Deal } from "@/types";
import { getSupabaseAdmin } from "./db-client";
import { getCuratedDeals, sortDeals } from "./curated-helper";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";
import { isUsableMerchantUrl } from "@/lib/url-helpers";
import { getPopularityRecord, type PopularityRecord } from "@/lib/popularity";
import { searchCandidates } from "@/lib/search/query-expand";
import { fetchOffersAt30dLow } from "@/lib/search/price-history";
import { withTimeout } from "@/lib/promise-timeout";
import { isCrossBorderStore } from "@/lib/country";
import { isUsedListing, looksCounterfeit } from "@/lib/search/price-floor";

interface BestOfferRow {
  product_id: string;
  title: string;
  category_slug: string | null;
  brand: string | null;
  image_url: string | null;
  offer_id: string;
  store_id: string;
  url: string;
  current_price: number;
  original_price: number | null;
  discount_percent: number | null;
  currency: "NGN" | "USD";
  scraped_at: string;
  store_name: string;
  is_international: boolean;
  store_logo_url: string | null;
  /** Restored on RPC return by migration 0038. Lets isLocalToUser
      use the DB-authoritative store_country instead of relying on
      the hardcoded JS roster — fixes /za/deals showing 4 cards
      despite 159 ZA-anchored offers in the view. */
  store_country: string | null;
}

function rowToDeal(r: BestOfferRow, popularity?: PopularityRecord): Deal {
  const original = r.original_price ?? r.current_price;
  return {
    id: r.offer_id,
    title: r.title,
    description: r.title,
    category: r.category_slug ?? "general",
    categorySlug: r.category_slug ?? "all",
    storeId: r.store_id,
    storeName: r.store_name,
    originalPrice: original,
    salePrice: r.current_price,
    discountPercent: r.discount_percent ?? 0,
    currency: r.currency,
    imageUrl: r.image_url ?? undefined,
    url: r.url,
    expiresAt: null,
    isHot: (r.discount_percent ?? 0) >= 30,
    isFeatured: false,
    tags: [r.store_name, r.category_slug ?? ""].filter(Boolean),
    saves: 0,
    /* Click count from the rolling 30-day popularity window. 0 when
       the product has no recorded clicks in that window OR when the
       popularity RPC is unavailable (migration not yet applied). The
       "Most popular" sort uses this field; other sorts ignore it.
       Defensive guard: confirm popularity is an object before
       indexing — a stale cache from a deploy mid-rollout could in
       theory return something unexpected. */
    clicks: (popularity && typeof popularity === "object" && popularity[r.product_id]) || 0,
    /* Keep full ISO timestamp so "newest" sort can break same-day
       ties by sub-second precision. Old slice(0, 10) collapsed
       every same-day deal to identical sort keys, which then
       sorted arbitrarily — surfacing a stale 03:00 ingest above a
       fresh 22:00 ingest. timeAgo() + Date parsers handle the
       full ISO form transparently. */
    postedAt: r.scraped_at,
    storeCountry: r.store_country ?? null,
    /* Flag used / refurbished / pre-owned listings so the card can
       label them instead of presenting them as a fresh "deal". Cheap
       pure string check (no extra DB read) over the title + store
       name the row already carries. */
    isUsed: isUsedListing(r.store_name, r.title),
  };
}

/* isUsableMerchantUrl moved to src/lib/url-helpers.ts so /compare
   (pg-fts.ts) can apply the same filter — without that, Google-relay
   URLs were leaking into the comparison results and bouncing users
   to /ng?deal_unavailable=1 when /api/go failed to resolve them. */

/* Sort + origin helpers REMOVED May 2026 — they were the PostgREST
   query-builder-based filtering used by the prior fan-out
   implementation. The browse_deals RPC (migration 0019) now applies
   sort + origin server-side via SQL CASE expressions, so these
   helpers have no remaining call sites. The RPC's CASE branches
   match the old sortToOrder mapping exactly: see browse_deals.sql. */

/* ── Search via FTS ────────────────────────────────────────────────
   Routes /deals search queries through search_deals_fts (migration
   0025) with multi-strategy candidate fallback + popularity-aware
   re-ranking. Used by fetchDeals when q.search is non-empty.

   Strategy:
     1. searchCandidates(rawQuery) produces an ordered candidate
        list: [original, expanded, stripped]. Each runs through
        search_deals_fts independently.
     2. The first candidate that returns ≥ MIN_USABLE rows wins.
        If all candidates underflow we union them so the user gets
        SOMETHING rather than an empty page.
     3. Popularity from outbound_clicks (last 30 days) re-ranks the
        top-N rows: relevance_score * (1 + log(1 + clicks) / 5). Caps
        the boost so a moderately-popular product doesn't beat a
        much-better text match — popularity is a tie-breaker, not a
        ranking primary.
     4. JS-side country filter still runs in /deals' route handler
        (same as the browse path), so anything search_deals_fts'
        country-priority sort leaks gets trimmed there.

   Limit: PostgREST caps RPC responses at 1000 rows. For search,
   1000 relevance-ranked rows is plenty — most queries return <100
   meaningful matches anyway. */
/* Bumped DOWN May 2026 v3 from 1000 → 500 for Supabase egress
   relief. Search-path queries rarely surface >50 meaningful
   results to a user; the extra 500 rows were egress-burning
   tail with near-zero render impact. */
const SEARCH_MAX_ROWS = 500;
const MIN_USABLE_ROWS = 6;
/* Popularity boost cap. Empirical: a product with 200 clicks in 30
   days gets ~1.06 multiplier, 2000 clicks → ~1.13. Higher caps let
   a popular-but-loosely-matching row outrank a precise text match,
   which we don't want — search ranking primary should be relevance,
   popularity is a soft secondary. */
const POPULARITY_BOOST_DIVISOR = 5;

async function searchDealsViaFts(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  q: BrowseQuery,
): Promise<Deal[]> {
  /* Expand the raw query into FTS candidates. searchCandidates
     handles synonyms (earbuds → earphones), brand aliases (rayban
     → ray-ban), split forms (play station → playstation), and
     trailing-modifier stripping (iphone 15 pro max → iphone 15). */
  const rawSearch = q.search!.trim().replace(/[(),]/g, " ");
  const candidates = searchCandidates(rawSearch);
  if (candidates.length === 0) return [];

  const rpcBase = {
    p_category:     q.categorySlug && q.categorySlug !== "all" ? q.categorySlug : null,
    p_min_discount: typeof q.minDiscount === "number" && q.minDiscount > 0 ? q.minDiscount : 0,
    p_origin:       "all" as const,
    p_store_ids:    q.stores && q.stores.length > 0 ? q.stores : null,
    p_max_rows:     SEARCH_MAX_ROWS,
    p_country:      q.country ? q.country.toUpperCase() : null,
  };

  /* Walk candidates in order. First candidate that yields enough
     usable rows wins. Otherwise union everything we collected. */
  const seenOfferIds = new Set<string>();
  const merged: BestOfferRow[] = [];

  for (let i = 0; i < candidates.length; i++) {
    /* Broader-candidate gate (May 29 2026 search-quality fix). Live
       user report: searching "iphone 15 pro" surfaced iPhone 13 Pro,
       Xiaomi Redmi Note 14 Pro, phone cases — all because the loop
       always walked candidate 2 = "iphone 15" (stripTrailingTokens
       result) and UNIONED its noisy results into merged.

       Now: only walk candidates beyond i=0 if the literal query
       didn't produce enough good rows. MIN_USABLE_ROWS (6) is the
       smallest first-scroll surface; with that many literal matches
       there's no reason to broaden, and broadening only adds noise. */
    if (i > 0 && merged.length >= MIN_USABLE_ROWS) break;

    const queryStr = candidates[i];
    const { data, error } = await supa.rpc("search_deals_fts", {
      q: queryStr,
      ...rpcBase,
    });
    if (error) {
      console.warn(`[browse-db] search_deals_fts error on candidate "${queryStr}":`, error.message);
      continue;
    }
    const rows = (data as unknown as BestOfferRow[] | null) ?? [];
    for (const row of rows) {
      if (seenOfferIds.has(row.offer_id)) continue;
      seenOfferIds.add(row.offer_id);
      merged.push(row);
    }
  }

  if (merged.length === 0) {
    /* Multi-strategy fallback exhausted. Caller's empty-state
       handler surfaces did-you-mean pills via suggest_titles.
       We don't degrade to browse_deals ILIKE — that path is
       strictly weaker than FTS + trigram + exact-phrase + token-
       coverage blend, so if FTS returned zero across every
       candidate, ILIKE would too. */
    return [];
  }

  /* Pull popularity once for the re-rank. unstable_cache keeps the
     RPC cost cheap even at high traffic. */
  const popularity = await getPopularityRecord().catch(() => ({} as PopularityRecord));

  /* Drop Google-relay URLs (legacy SerpAPI residue) — same gate
     the browse path applies. Also suppress counterfeit / trademark-
     mimicry listings (Finding #10) so a search for "gucci sneaker"
     can't surface a "GG Exclusive ... Interlocking G" fake. */
  const fromDb = merged
    .filter((r) => isUsableMerchantUrl(r.url))
    .filter((r) => !looksCounterfeit(r.title))
    .map((r) => rowToDeal(r, popularity));

  /* Popularity-aware re-rank. RPC already returned rows in relevance
     order (rank DESC). We multiply a position-derived relevance score
     by a log-scaled popularity factor to push well-clicked products
     up — but bounded so a much-better text match always wins. */
  const reranked = fromDb
    .map((deal, idx) => {
      const relevanceScore = 1 / (1 + idx);
      const clicks = deal.clicks ?? 0;
      const popFactor = 1 + Math.log(1 + clicks) / POPULARITY_BOOST_DIVISOR;
      return { deal, blended: relevanceScore * popFactor };
    })
    .sort((a, b) => b.blended - a.blended)
    .map((x) => x.deal);

  /* Merge curated Amazon catalog with the FTS results. Curated
     entries don't have FTS scores so they're appended after the
     re-ranked DB rows. sortDeals respects the user's sort field
     when it isn't "relevance" — for relevance it preserves order. */
  const curated = getCuratedDeals(q);
  const finalDeals = sortDeals([...reranked, ...curated], q.sort);

  /* Mark offers at their 30-day price floor — same single-RPC
     pattern as the browse path. Search results get the badge too
     because users querying for a product expect to see "this is
     the lowest it's been in 30 days" signals on the matches. */
  const lowSet = await fetchOffersAt30dLow(finalDeals.map((d) => d.id));
  return finalDeals.map((d) => lowSet.has(d.id) ? { ...d, at30DayLow: true } : d);
}

/* Browse-path cache for getOriginCounts — see the note inside the method.
   The browse path fires 4-6 exact-count scans per /deals request; the
   result only moves on ingest, so a short TTL spares Supabase that IO.
   The search path is excluded (unbounded keyspace, already shares the
   FTS pipeline). Size-capped with FIFO eviction so it can't grow without
   bound under arbitrary ?minDiscount= values. */
const ORIGIN_COUNTS_TTL_MS = 5 * 60 * 1000;
const ORIGIN_COUNTS_MAX_ENTRIES = 200;
const originCountsCache = new Map<string, { value: OriginCounts; expires: number }>();

/* ── Cross-border (Pass B) pool cache ──────────────────────────────
   Pass B (browse_deals origin='intl', country=null) is the heaviest of
   the three passes: it scans the whole is_international=true set (~6.7k
   rows) and runs ~1-3s with high variance, regularly blowing the 2.5s
   per-pass budget. When it times out, the merged pool loses EVERY
   cross-border row, so the /deals "International" tab collapses to 0
   (or to the few curated-Amazon rows) until the pool cache cycles —
   the "intl deals not displaying" bug (June 2026).

   Two properties make a dedicated cache the right fix:
     1. Pass B is COUNTRY-BLIND (p_country=null) — one result serves all
        six markets, so caching it once removes redundant slow RPCs.
     2. Serving the last-good result on a timeout means a single slow
        fetch can't empty the intl bucket.

   Keyed on the country-invariant inputs only (category/sort/search/
   discount/stores). Non-empty results cache for the standard pool TTL;
   on timeout we fall back to the last-good value even if expired, so
   intl only ever shows empty if Pass B has NEVER succeeded. */
const INTL_POOL_TTL_MS = 5 * 60 * 1000;
/* Generous vs the 2.5s per-pass budget: Pass B p95 is ~3s, it runs in
   PARALLEL with the fast Pass A/C, and the result is cached + shared
   across markets — so only a cold-cache fetch pays this, once per
   window. Still well under Vercel's 30s ceiling. */
const INTL_POOL_TIMEOUT_MS = 4000;
const intlPoolCache = new Map<string, { data: BestOfferRow[]; expires: number }>();

async function fetchCrossBorderPool(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  passBArgs: Record<string, unknown>,
): Promise<BestOfferRow[]> {
  const key = JSON.stringify({
    cat:  passBArgs.p_category ?? null,
    sort: passBArgs.p_sort ?? null,
    q:    passBArgs.p_search ?? null,
    min:  passBArgs.p_min_discount ?? 0,
    st:   passBArgs.p_store_ids ?? null,
  });
  const now = Date.now();
  const cached = intlPoolCache.get(key);
  if (cached && cached.expires > now) return cached.data;

  const res = await withTimeout(
    supa.rpc("browse_deals", passBArgs) as unknown as Promise<{ data: unknown; error: { message: string } | null }>,
    INTL_POOL_TIMEOUT_MS,
    { data: null, error: { message: "timeout" } },
    "browse_deals(intl)",
  );
  if (!res.error && Array.isArray(res.data)) {
    const rows = res.data as unknown as BestOfferRow[];
    /* Cache only NON-empty results — a transient empty/timeout must not
       pin the intl bucket to 0 for the full TTL. */
    if (rows.length > 0) {
      intlPoolCache.set(key, { data: rows, expires: now + INTL_POOL_TTL_MS });
      if (intlPoolCache.size > 16) {
        intlPoolCache.forEach((v, k) => { if (v.expires <= now) intlPoolCache.delete(k); });
      }
    }
    return rows;
  }
  /* Timeout/error: serve last-good (even if expired) so one slow fetch
     can't empty the International tab. */
  if (cached) return cached.data;
  console.warn("[browse-db] Pass B (intl) failed, no cached fallback:", res.error?.message ?? "unknown");
  return [];
}

export const dbBrowseProvider: BrowseProvider = {
  id: "db-products",
  name: "DB (live ingested products)",

  isActive() {
    // Active when Supabase is configured. We don't pre-check row count here —
    // empty DB just yields empty results, and the registry will fall through.
    const supa = getSupabaseAdmin();
    return supa !== null;
  },

  async fetchDeals(q: BrowseQuery, opts?: FetchDealsOptions): Promise<Deal[]> {
    const supa = getSupabaseAdmin();
    if (!supa) return [];

    /* ── SEARCH PATH ──────────────────────────────────────────────
       When the user has typed a query, route through search_deals_fts
       (migration 0025) instead of browse_deals. The two RPCs share a
       return shape but search_deals_fts adds:
         • ts_rank on the products.search_doc tsvector
         • trigram fuzzy match for typo tolerance
         • exact-phrase boost (+2.0 when query appears verbatim)
         • per-token coverage boost (+0.8 when every word present)

       Multi-strategy fallback: query-expand produces an ordered list
       of candidates [original, synonym-expanded, token-stripped] —
       try each until we get usable results. Most queries hit the
       first candidate; expansion + strip cover the long tail.

       Why we don't keep browse_deals' three-pass shape for search:
         Search results are RELEVANCE-ranked. The local/intl/zero-
         discount three-pass exists to guarantee browse-time pool
         diversity (cross-border + 0%-discount slots get reserved
         even when discount-desc would otherwise crowd them out).
         For search those guarantees actively hurt — they push
         lower-relevance rows above higher-relevance ones. One pass,
         relevance-sorted, with country-priority as the tie-breaker. */
    if (q.search?.trim()) {
      return await searchDealsViaFts(supa, q);
    }

    /* Single-RPC fetch (May 2026 perf refactor).

       Replaces the prior 4-6 PostgREST .range() round trips. The
       browse_deals RPC (migration 0019) bypasses PostgREST's
       1000-row cap entirely — one round trip can return up to 6000
       rows. Cuts /api/deals DB cost ~6x in round-trip count and
       eliminates the cross-request co-ordination bug class (tied
       rows bouncing across page boundaries → duplicate cards).

       Same dual-pass shape as before:
         · Pass A: discount-DESC up to 4000 rows (the "deals" set)
         · Pass B: 0%-discount freshest 2000 rows (pharmacy /
                   grocer / Shopify-no-compare-at-price tail)
       Now done as TWO RPC calls instead of TWO fan-outs of 6 trips
       each. JS still merges + dedupes for defence (the RPC's
       offer_id tiebreaker should make this unnecessary, but the
       Set check is O(1) safety).

       Pass B firing rules unchanged — only when sort is
       discount-biased AND user's tier floor allows 0%. Skips
       otherwise to save the round trip. */
    const sortIsDiscountBiased =
      !q.sort || q.sort === "relevance" || q.sort === "popular" || q.sort === "discount";
    const userFloorAllowsZero = !q.minDiscount || q.minDiscount === 0;
    const runPassB = sortIsDiscountBiased && userFloorAllowsZero;

    /* Sort key passed to the RPC. Maps SortOption → the names the
       RPC's CASE expression knows. Defaults to 'discount' to match
       the prior fan-out's pre-sort behaviour. */
    const rpcSort: string =
      q.sort === "newest"     ? "newest"     :
      q.sort === "price_asc"  ? "price_asc"  :
      q.sort === "price_desc" ? "price_desc" :
      "discount";

    /* PostgREST hard-caps RPC responses at db-max-rows=1000 on the
       Supabase project (verified May 2026 — .range(0, 5999) doesn't
       override). So requesting p_max_rows=4000 silently returns 1000.
       Knowing this, we split the fetch into THREE explicit passes,
       each capped at 1000 by PostgREST. Total ~3000 rows after merge
       + dedupe.

       Pass A — country-local pool (origin='local', country=X):
                Returns up to 1000 rows of stores anchored to the
                user's country. Top by discount-desc within local
                pool. Guarantees ASOS / Currys / John Lewis for UK,
                Konga / 3C Hub / Slot for NG, etc.

       Pass B — cross-border pool (origin='intl', no country):
                Returns up to 1000 rows of is_international=true
                stores (AliExpress 4683 / DHgate 358 / Shein /
                Banggood). NO country priority so cross-border is
                guaranteed inclusion regardless of how big the
                user's country pool is. THIS IS THE FIX for the
                May 2026 "UK intl=0" bug.

       Pass C — 0%-only freshness pool (zero_discount=true, country=X):
                Returns up to 1000 rows of 0%-discount local stores
                so HealthPlus / Ajebomarket / Supermart / Bitmarte
                still surface in NG dropdown even though their rows
                sort last in Pass A's discount-desc.

       Pass A is unconditional. Pass B is unconditional (cross-border
       is always relevant). Pass C only fires when the user's sort
       allows 0% rows (sortIsDiscountBiased && userFloorAllowsZero),
       same condition as the prior 0%-only Pass B. */
    /* Cache-bust marker — bump this any time the multi-pass shape
       changes so old function instances with stale POOL_CACHE
       entries get recycled by Vercel. */
    const PASS_VERSION = "v3-egress-halved";
    void PASS_VERSION;
    /* Halved May 2026 v3 (1000 → 500) for Supabase egress relief.
       The 3-pass fan-out previously pulled up to 3×1000 = 3000
       rows per /api/deals call (~2.25 MB). /deals page renders
       at most ~100 cards initially + lazy-loads on scroll; the
       extra 2900 rows were egress-burning tail. Halved each pass
       to ~1.1 MB per call total. Combined with the recent ISR +
       unstable_cache TTL bumps (commit 16a99f1), egress per
       unique URL drops ~75-90%. */
    const PASS_MAX = 500;

    /* Catalog-rotation seed (#17, migration 0066). A 6-hour time bucket:
       browse_deals keeps strong discounts on top (10-pt bands) but a
       seeded hash reshuffles WHICH in-band deals surface per seed, so a
       repeat visitor pages across more of the catalog over the day rather
       than seeing the same fixed top-N. Stable within each 6h block, so
       the cache TTL — not the seed — still drives fetch frequency (no
       extra egress); fresh across blocks. Requires migration 0066 (the
       p_rotate_seed param) — applied June 2026; without it the RPC call
       would error on the unknown arg, so don't ship this ahead of the
       migration. seed=0 is the legacy strict-discount order. Only affects
       the discount sort; newest/price are untouched by the rotation. */
    const ROTATE_WINDOW_MS = 6 * 60 * 60 * 1000;
    const rotateSeed = Math.floor(Date.now() / ROTATE_WINDOW_MS);

    const passABase = {
      p_category:       q.categorySlug && q.categorySlug !== "all" ? q.categorySlug : null,
      p_min_discount:   typeof q.minDiscount === "number" && q.minDiscount > 0 ? q.minDiscount : 0,
      p_sort:           rpcSort,
      p_search:         q.search?.trim().replace(/[(),]/g, " ") || null,
      p_store_ids:      q.stores && q.stores.length > 0 ? q.stores : null,
      p_max_rows:       PASS_MAX,
      p_zero_discount_only: false,
      p_rotate_seed:    rotateSeed,
    };

    /* Pass A — country-local. Filter rows to is_international=false
       so we only get anchored-local retailers. Country priority
       inside the RPC then puts the user's country first. */
    const passAArgs = {
      ...passABase,
      p_origin:  "local",
      p_country: q.country ? q.country.toUpperCase() : null,
    };

    /* Pass B — cross-border. is_international=true rows, no country
       filter, no country priority. AliExpress / DHgate / Shein /
       Banggood etc. Top 1000 by discount-desc. */
    const passBArgs = {
      ...passABase,
      p_origin:  "intl",
      p_country: null,
    };

    /* Pass C — 0%-only local fallback. Surfaces pharmacy / grocery
       feeds that ingest at retail price (discount_percent=0 or NULL)
       and would otherwise drop out of Pass A's discount-desc sort.
       Conditional on sort being discount-biased + user allowing 0%.

       Cap is 3x PASS_MAX because the NG-local catalog's zero/NULL-
       discount tail is genuinely larger than 500 rows (HealthPlus 555
       + Essenza 567 + Jumia 230 + MedPlus 200 = ~1550). At PASS_MAX,
       Jumia + Essenza were getting squeezed out by the two pharmacy
       chains' more-recent scraped_at timestamps (user report: "i see
       jumia now but only 3 products"). Egress impact: Pass C adds
       ~700KB more, total /api/deals call goes from ~1.5MB to ~2.2MB.
       Pass A + Pass B stay at PASS_MAX because their discount-tail
       isn't as long. */
    const PASS_C_MAX = PASS_MAX * 3;
    const passCArgs = {
      ...passABase,
      p_origin:  "local",
      p_country: q.country ? q.country.toUpperCase() : null,
      p_zero_discount_only: true,
      p_min_discount: 0,
      p_max_rows: PASS_C_MAX,
    };
    /* Pass C runs whenever the user's tier floor allows 0% rows.
       Previously gated behind `sortIsDiscountBiased` too, on the
       theory that sort=newest already surfaces 0% rows naturally
       (they're competing on freshness). But that gate meant
       sort=newest was capped at ~1000 unique local rows (Pass A
       alone) — user report: '/ng/deals?sort=newest shows exactly
       1000 local'. Lifting the gate gives sort=newest a second
       1000-row fan-out via Pass C; rows that fall below position
       1000 in Pass A's scraped_at order but are 0%-discount can
       still surface. ~500-1000 extra unique rows after dedup. */
    const runPassC = userFloorAllowsZero;

    /* All three RPC calls in parallel, plus the popularity record.

       withTimeout wrapper added May 2026 audit: during a Supabase
       incident (slow or unresponsive RPC), the prior code waited
       indefinitely until Vercel's 30s function timeout fired, then
       returned a 504. With the wrapper, a hung RPC short-circuits
       at 2.5s with an empty-result fallback, and the route degrades
       to whatever the surviving passes + curated catalog can
       provide. 2.5s budget is comfortably above the p95 healthy
       latency (~300ms) but well below the 30s ceiling. */
    type RpcResp = { data: unknown; error: { message: string } | null };
    /* Default 2.5s budget (comfortably above the ~300ms healthy p95,
       well below Vercel's 30s ceiling). Callers on a non-blocking
       background path — the homepage trending pool — pass a longer
       budget via opts so a cold serverless connection doesn't trip the
       bar and degrade to the curated-only fallback. See FetchDealsOptions. */
    const TIMEOUT_MS = opts?.timeoutMs ?? 2500;
    const TIMEOUT_FALLBACK: RpcResp = { data: null, error: { message: "timeout" } };
    const [passAResult, intlRows, passCResult, popularity] = await Promise.all([
      withTimeout(supa.rpc("browse_deals", passAArgs) as unknown as Promise<RpcResp>, TIMEOUT_MS, TIMEOUT_FALLBACK, "browse_deals(local)"),
      /* Pass B (cross-border) goes through its own shared, country-blind
         cache with stale-on-timeout — see fetchCrossBorderPool. Returns
         the rows directly (not an RpcResp). */
      fetchCrossBorderPool(supa, passBArgs),
      runPassC
        ? withTimeout(supa.rpc("browse_deals", passCArgs) as unknown as Promise<RpcResp>, TIMEOUT_MS, TIMEOUT_FALLBACK, "browse_deals(zero-disc)")
        : Promise.resolve(TIMEOUT_FALLBACK),
      /* Popularity already has its own .catch fallback path; just
         add the timeout so a slow query can't push the parallel
         wave past TIMEOUT_MS either. */
      withTimeout(
        getPopularityRecord().catch(() => ({} as Record<string, number>)),
        TIMEOUT_MS,
        {} as Record<string, number>,
        "getPopularityRecord",
      ),
    ]);

    /* Pass A error handling. Historically a Pass A error short-
       circuited the whole fetch and returned the curated-Amazon-only
       pool. That is wrong for local-origin views in non-US markets.
       Pass C (the 0%-discount local fallback, country-scoped, up to
       1500 rows) frequently SUCCEEDS even when Pass A times out, and
       it carries the bulk of a market's local inventory (NG pharmacy,
       grocery, and Jumia feeds). Dumping straight to curated discarded
       those rows, so the NG "Local" tab rendered an empty grid while
       the separate head-count pill still showed thousands (the pill
       comes from getOriginCounts, a different query). Now a Pass A
       error logs and falls through, letting the merge below keep
       whatever Pass B and Pass C returned. The curated catalog is
       already merged in at the end, so a TOTAL failure (every pass
       empty) still degrades to curated naturally. Only a PARTIAL
       failure now preserves the surviving local rows.

       Pass B/C errors were already non-fatal; this aligns Pass A with
       them for the /api/deals path. */
    if (passAResult.error) {
      console.warn("[browse-db] browse_deals Pass A RPC error (continuing with Pass B/C):", passAResult.error.message);
      /* noCuratedFallback (homepage trending pool): the caller is
         unstable_cache-wrapped, so persisting a degraded pool would
         render "Trending" as stale curated cards for the full TTL.
         Throw instead. Next does NOT cache a rejected cached fn, so
         the transient blip stays out of the cache and the next render
         retries cleanly. /api/deals leaves this unset and falls
         through to the graceful curated merge below. */
      if (opts?.noCuratedFallback) {
        throw new Error(`[browse-db] Pass A RPC failed (no curated fallback): ${passAResult.error.message}`);
      }
      /* Intentionally NO early return. Fall through so Pass B (intl)
         and Pass C (0%-local) rows survive a Pass A timeout. */
    }
    /* Pass B errors/timeouts are handled inside fetchCrossBorderPool
       (it serves the last-good cross-border rows), so there's no
       passBResult to inspect here. */
    if (runPassC && passCResult.error) {
      console.warn("[browse-db] browse_deals Pass C RPC error:", passCResult.error.message);
    }

    const allRows: BestOfferRow[] = [];
    const seenOfferIds = new Set<string>();
    const merge = (rows: BestOfferRow[] | null | undefined) => {
      if (!rows) return;
      for (const row of rows) {
        if (seenOfferIds.has(row.offer_id)) continue;
        seenOfferIds.add(row.offer_id);
        allRows.push(row);
      }
    };
    /* Interleaved merge — Pass A (discounted local) and Pass C
       (0%-only local) ROUND-ROBIN into the pool instead of
       concatenating in order. Without this, Pass A's 1000 rows
       always pre-empt Pass C entirely (Pass C only surfaces when
       Pass A is thin). Result: stores whose offers are mostly
       0%-discount (Jumia, pharmacy feeds) get drowned out — QA
       report May 2026 found 0 Jumia in /api/deals top 400 despite
       63 Jumia products in catalog.

       After interleave: take the first row from A, then from C, then
       A, then C... so every 2 rows in the final pool contains 1
       Pass-A and 1 Pass-C entry. Stores like Jumia get fair surfacing
       in the deal feed alongside discounted Konga/3C Hub inventory.

       Pass B (intl) stays separate — it serves a different bucket
       (cross-border) and the country-filter at the API layer keeps
       intl from polluting local-only views regardless. */
    const passARows = (passAResult.data as unknown as BestOfferRow[] | null) ?? [];
    const passCRows = (passCResult.data as unknown as BestOfferRow[] | null) ?? [];
    const interleaved: BestOfferRow[] = [];
    const maxLen = Math.max(passARows.length, passCRows.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < passARows.length) interleaved.push(passARows[i]);
      if (i < passCRows.length) interleaved.push(passCRows[i]);
    }
    merge(interleaved);
    merge(intlRows);

    /* Drop offers whose URL points at Google Shopping (legacy SerpAPI
       ingest residue). Without SerpAPI to resolve, those clicks land
       the user on a Google search page — broken UX. */
    const fromDb = allRows
      .filter((r) => isUsableMerchantUrl(r.url))
      .filter((r) => !looksCounterfeit(r.title))
      .map((r) => rowToDeal(r, popularity));
    /* Merge curated Amazon catalog with the ingested data, then
       re-apply the requested sort to the combined array. Lets
       curated entries compete on the same sort criteria as scraped
       data instead of always front-loading the feed. */
    const curated = getCuratedDeals(q);
    const finalDeals = sortDeals([...fromDb, ...curated], q.sort);

    /* Mark offers at their 30-day price floor. Single RPC for the
       whole rendered set so card rendering doesn't trigger N+1.
       Curated offers carry synthetic ids that the RPC filters out
       (UUID gate inside fetchOffersAt30dLow) so the cost scales
       only with the ingested-data subset. ~50-150ms typical. */
    const lowSet = await fetchOffersAt30dLow(finalDeals.map((d) => d.id));
    return finalDeals.map((d) => lowSet.has(d.id) ? { ...d, at30DayLow: true } : d);
  },

  async getCategoryCounts(): Promise<Record<string, number>> {
    const supa = getSupabaseAdmin();
    const counts: Record<string, number> = {};

    /* Always include curated in counts so the homepage tile reflects
       what actually surfaces in the feed below. */
    for (const d of curatedAmazonDeals) {
      if (!d.categorySlug) continue;
      counts[d.categorySlug] = (counts[d.categorySlug] ?? 0) + 1;
    }

    if (!supa) return counts;
    const { data, error } = await supa
      .from("products")
      .select("category_slug");
    if (error || !data) return counts;
    for (const r of data as Array<{ category_slug: string | null }>) {
      if (!r.category_slug) continue;
      counts[r.category_slug] = (counts[r.category_slug] ?? 0) + 1;
    }
    return counts;
  },

  async getOriginCounts(q): Promise<OriginCounts> {
    const supa = getSupabaseAdmin();
    if (!supa) return { all: 0, local: 0, intl: 0 };

    /* SEARCH PATH: when a query is present, the displayed list comes
       from search_deals_fts (relevance-ranked). To keep the origin
       counts in agreement with what the user sees, we run the SAME
       FTS pipeline (one call, origin=all) and bucket the rows by
       is_international. Three separate head-counts with the old
       title ILIKE would diverge from the displayed list because
       FTS / trigram / synonym expansion finds matches ILIKE can't. */
    if (q.search?.trim()) {
      const rawSearch = q.search.trim().replace(/[(),]/g, " ");
      const candidates = searchCandidates(rawSearch);
      if (candidates.length === 0) return { all: 0, local: 0, intl: 0 };
      /* One FTS call (the literal-query candidate, which is the
         primary). Counts based on the first non-empty result —
         secondary candidates would inflate the count vs the
         displayed list which also stops on the first match. */
      const { data, error } = await supa.rpc("search_deals_fts", {
        q:              candidates[0],
        p_category:     q.categorySlug && q.categorySlug !== "all" ? q.categorySlug : null,
        p_min_discount: typeof q.minDiscount === "number" && q.minDiscount > 0 ? q.minDiscount : 0,
        p_origin:       "all",
        p_store_ids:    q.stores && q.stores.length > 0 ? q.stores : null,
        p_max_rows:     SEARCH_MAX_ROWS,
        p_country:      q.country ? q.country.toUpperCase() : null,
      });
      if (error || !data) return { all: 0, local: 0, intl: 0 };
      const rows = (data as unknown as BestOfferRow[]) ?? [];
      let local = 0; let intl = 0;
      for (const r of rows) (r.is_international ? intl++ : local++);
      return { all: rows.length, local, intl };
    }

    /* Browse path is deterministic for a given filter and runs on every
       /deals request — memoise it (see originCountsCache note above) so
       Supabase doesn't re-scan for the 4-6 exact head-counts each time.
       The homepage and the deals dropdown share these filter keys, so one
       render warms the cache the other reuses. */
    const countsKey = [
      q.country?.toUpperCase() ?? "",
      (q.categorySlug && q.categorySlug !== "all") ? q.categorySlug : "",
      typeof q.minDiscount === "number" && q.minDiscount > 0 ? q.minDiscount : 0,
      (q.stores && q.stores.length > 0) ? [...q.stores].sort().join(",") : "",
    ].join("|");
    const countsNow = Date.now();
    const cachedCounts = originCountsCache.get(countsKey);
    if (cachedCounts && cachedCounts.expires > countsNow) return cachedCounts.value;
    const cacheCounts = (value: OriginCounts): OriginCounts => {
      if (originCountsCache.size >= ORIGIN_COUNTS_MAX_ENTRIES) {
        const oldest = originCountsCache.keys().next().value;
        if (oldest !== undefined) originCountsCache.delete(oldest);
      }
      originCountsCache.set(countsKey, { value, expires: countsNow + ORIGIN_COUNTS_TTL_MS });
      return value;
    };

    /* BROWSE PATH: no search query. Head-count queries — cheap,
       exact, no row payload, NOT subject to the db-max-rows=1000
       cap that affects ROW responses.

       Country-aware when q.country is set. The pill needs to
       reflect what the user can actually shop, not the entire
       catalog:
         local = store_country = USER_COUNTRY
                 (NG-anchored stores for NG visitor, UK-anchored
                 for UK visitor, etc.)
         intl  = is_international = true AND store_country IS NULL
                 (TRUE cross-border globals only — AliExpress,
                 Shein, Temu, DHgate, Banggood. Stores anchored
                 to ANOTHER country — UK retailers for NG
                 visitors, US retailers for UK visitors — are
                 excluded because they don't realistically ship
                 to the visitor's market.)

       Why this tightening matters: the previous version counted
       every is_international=true row as "intl", which for NG
       included 2,590 UK-anchored + 509 US-anchored + other
       foreign retailers (3,500+ rows the NG shopper can't
       actually use). User report: "ng is showing 11,915 deals
       total, 2,525 local. that cant be, can it?" — right, the
       11,915 included foreign-shoppable inventory. Now it shows
       only the genuinely cross-border-shoppable globals.

       Country-blind fallback (no q.country) still uses the broad
       is_international counts — primarily for tests / legacy
       callers. */
    const baseFilter = (qb: ReturnType<typeof supa.from>) => {
      let chain = qb.select("*", { count: "exact", head: true });
      if (q.categorySlug && q.categorySlug !== "all") chain = chain.eq("category_slug", q.categorySlug);
      if (typeof q.minDiscount === "number" && q.minDiscount > 0) chain = chain.gte("discount_percent", q.minDiscount);
      return chain;
    };

    const userCountry = q.country?.toUpperCase();
    if (userCountry) {
      const [localRes, intlRes, localDealsRes, intlDealsRes] = await Promise.all([
        baseFilter(supa.from("product_best_offers")).eq("store_country", userCountry),
        /* True cross-border globals only: is_international=true
           with no anchored country. Excludes foreign-country-
           anchored retailers that don't realistically ship to
           the visitor's market. */
        baseFilter(supa.from("product_best_offers")).eq("is_international", true).is("store_country", null),
        /* Sub-count: rows with a real positive discount.

           Was previously `.eq("is_deal", true)`, but the May 2026
           is_deal semantic relaxation (see ingestion.ts:344)
           re-defined that column as "valid in-stock catalog row"
           rather than "has a markdown". Counting is_deal=true and
           labelling it "on sale" produced (deals == total) for
           every browse — user-visible as "All 4,469 products are
           on sale right now" which is plainly false.

           discount_percent is the actual markdown signal. The
           ingest pipeline writes `discount_percent = NULL` when no
           MSRP was surfaced (Jumia rich snippets, pharmacy feeds,
           Shopify-no-compare-at-price), and a positive integer
           when there's a real reduction. Postgres `> 0` against
           NULL is NULL (not TRUE) so the NULL rows correctly
           drop out — only genuine markdowns are counted. */
        baseFilter(supa.from("product_best_offers")).eq("store_country", userCountry).gt("discount_percent", 0),
        baseFilter(supa.from("product_best_offers")).eq("is_international", true).is("store_country", null).gt("discount_percent", 0),
      ]);
      const local = localRes.count ?? 0;
      const intl  = intlRes.count  ?? 0;
      const localDeals = localDealsRes.error ? undefined : (localDealsRes.count ?? 0);
      const intlDeals  = intlDealsRes.error  ? undefined : (intlDealsRes.count  ?? 0);
      const allDeals   = (localDeals !== undefined && intlDeals !== undefined) ? localDeals + intlDeals : undefined;
      return cacheCounts({ all: local + intl, local, intl, allDeals, localDeals, intlDeals });
    }

    const [allRes, localRes, intlRes, allDealsRes, localDealsRes, intlDealsRes] = await Promise.all([
      baseFilter(supa.from("product_best_offers")),
      baseFilter(supa.from("product_best_offers")).eq("is_international", false),
      baseFilter(supa.from("product_best_offers")).eq("is_international", true),
      /* Discount sub-counts via `discount_percent > 0` rather than
         is_deal=true — see the country-aware branch above for the
         full rationale (May 2026 audit). */
      baseFilter(supa.from("product_best_offers")).gt("discount_percent", 0),
      baseFilter(supa.from("product_best_offers")).eq("is_international", false).gt("discount_percent", 0),
      baseFilter(supa.from("product_best_offers")).eq("is_international", true).gt("discount_percent", 0),
    ]);

    return cacheCounts({
      all:        allRes.count        ?? 0,
      local:      localRes.count      ?? 0,
      intl:       intlRes.count       ?? 0,
      allDeals:   allDealsRes.error   ? undefined : (allDealsRes.count   ?? 0),
      localDeals: localDealsRes.error ? undefined : (localDealsRes.count ?? 0),
      intlDeals:  intlDealsRes.error  ? undefined : (intlDealsRes.count  ?? 0),
    });
  },
};

/** Quick check whether the DB actually has product rows.
    Used by the registry to decide whether to prefer DB over static. */
export async function dbHasProducts(): Promise<boolean> {
  const supa = getSupabaseAdmin();
  if (!supa) return false;
  const { count, error } = await supa
    .from("products")
    .select("*", { count: "exact", head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}

/* ── Dropdown store list — cap-free aggregate ────────────────────────
   Returns every store in the country catalog (visible-to-country =
   country-anchored OR cross-border) with its count at the user's
   current filter. Sourced from list_country_stores_with_counts RPC
   (migration 0043) which runs a single GROUP BY over the FULL
   product_best_offers view — not bounded by the items-pool caps.

   Why this exists separately from the 3-pass fan-out: the items
   pool's per-pass row caps (PASS_MAX, PASS_C_MAX) were squeezing
   80-90% of stores out of the dropdown for UK/US/DE/AE/IN/ZA — the
   May 2026 cross-country audit found Amazon + noon missing from AE
   and Takealot missing from ZA. The dropdown is a small payload
   (~100 rows × ~80 bytes ≈ 8KB) so it can afford to be complete. */
export interface DropdownStoreRow {
  store_id:         string;
  store_name:       string;
  store_logo_url:   string | null;
  qualifying_count: number;
}

/* Canonical → real store_id resolution.

   The /api/deals URL exposes a CANONICAL key in the ?stores= filter
   ("amazon", "walmart", "a1 tech deals") for human-readable
   bookmarkable URLs. The real DB store_id can be different:
     - hyphenated where the canonical key is space-delimited:
         canonical "a1 tech deals" -> store_id "a1-tech-deals"
     - one canonical key collapses MULTIPLE variants:
         canonical "amazon"        -> ["amazon", "amazon-com",
                                       "amazon-marketplace", ...]

   browse_deals's p_store_ids accepts real store_ids only — passing
   the canonical key matches nothing and yields 0 items even when
   the dropdown count says >0. Phase 3 audit caught this on
   /uk/deals?stores=a1+tech+deals (dropdown count 1, items grid 0).

   Plain Map<> cache (NOT Next.js unstable_cache): the latter
   throws "incrementalCache missing" outside its narrow set of
   supported contexts in this codebase — same reason the
   fetchPoolCached above uses a plain Map. Per-instance cache with
   a 1-hour TTL. Vercel reuses function instances for ~5 min after
   each request so the lookup is effectively free on warm functions.

   Returned map is keyed by canonical-key (lowercased displayStoreName)
   -> array of real store_ids that collapse to that canonical form. */
import { displayStoreName } from "@/lib/store-display";

const STORE_CANONICAL_TTL_MS = 60 * 60 * 1000;
let storeCanonicalCache: { data: Record<string, string[]>; expires: number } | null = null;

export async function getStoreCanonicalMap(): Promise<Record<string, string[]>> {
  const now = Date.now();
  if (storeCanonicalCache && storeCanonicalCache.expires > now) {
    return storeCanonicalCache.data;
  }
  const supa = getSupabaseAdmin();
  if (!supa) return {};
  const rows: Array<{ id: string; name: string }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await supa
      .from("stores")
      .select("id, name")
      .range(from, from + 999);
    if (error || !data || data.length === 0) break;
    rows.push(...(data as Array<{ id: string; name: string }>));
    if (data.length < 1000) break;
    from += 1000;
  }
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    if (!r.name) continue;
    const canonical = displayStoreName(r.name).toLowerCase();
    if (!out[canonical]) out[canonical] = [];
    out[canonical].push(r.id);
  }
  storeCanonicalCache = { data: out, expires: now + STORE_CANONICAL_TTL_MS };
  return out;
}

/* Resolve a URL store filter list (canonical keys) to the real
   store_id list expected by browse_deals.p_store_ids. Unknown
   canonicals (typo, deleted store) pass through unchanged — they
   simply match zero rows in the RPC, which is the safe default.
   Real store_ids passed in (older clients / shared links pre-
   canonicalisation) are preserved as-is via the same fallback. */
export async function resolveCanonicalStoreFilter(
  canonicalKeys: string[] | null | undefined,
): Promise<string[] | null> {
  if (!canonicalKeys || canonicalKeys.length === 0) return null;
  const map = await getStoreCanonicalMap();
  const out: string[] = [];
  for (const k of canonicalKeys) {
    const real = map[k];
    if (real && real.length > 0) {
      out.push(...real);
    } else {
      /* Pass-through for unrecognised keys — safer than dropping
         silently. Two reasons to land here:
           1. Shared/old links from before canonicalisation that pass
              the real storeId directly ("?stores=amazon-com").
           2. A store that was removed after the URL was shared.
         In case 1 the RPC matches the real ID fine. In case 2 it
         matches nothing and the user sees an empty filtered grid,
         which is the correct UX. */
      out.push(k);
    }
  }
  return out;
}

/* Per-instance cache for the dropdown RPC.

   Why: this RPC runs on every /deals request, and Finding 3's
   country-correct union now issues it TWICE for the default origin=all
   tab (local ∪ cross-border). getShoppableStoreCount (homepage hero)
   calls it twice more. Supabase flagged the project for Disk IO budget
   depletion, so the browse path (no free-text search) is memoised here.

   The cache key intentionally omits search: search varies per
   keystroke-driven request, so caching it would grow the Map without
   bound for a near-zero hit rate — those requests bypass the cache.
   Everything else (country/category/minDiscount/origin) is a small,
   discrete keyspace shared across the homepage hero and the deals
   dropdown, so a homepage render warms the cache the deals page reuses
   and vice versa.

   5-min TTL: store rosters and qualifying counts only move on ingest
   (cron-driven, infrequent), so brief staleness in a store dropdown is
   imperceptible. Size-capped (FIFO eviction) so an adversarial
   ?minDiscount=<arbitrary> can't grow it without bound. */
const COUNTRY_STORES_TTL_MS = 5 * 60 * 1000;
const COUNTRY_STORES_MAX_ENTRIES = 300;
const countryStoresCache = new Map<string, { rows: DropdownStoreRow[]; expires: number }>();

export async function listCountryStoresWithCounts(opts: {
  country:     string;
  category?:   string | null;
  minDiscount?: number;
  search?:     string | null;
  /** "all" (default) returns country-anchored + cross-border. "local"
      returns only stores anchored in the user's country. "intl"
      returns only cross-border stores. Mirrors the origin tab on
      /[country]/deals so the dropdown shows a coherent slice of
      what the items grid is actually rendering. */
  origin?:     "all" | "local" | "intl";
}): Promise<DropdownStoreRow[]> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];

  const country     = opts.country.toUpperCase();
  const category    = (opts.category && opts.category !== "all") ? opts.category : null;
  const minDiscount = opts.minDiscount ?? 0;
  const origin      = opts.origin ?? "all";
  const search      = opts.search?.trim() || null;

  const cacheKey = search ? null : `${country}|${category ?? ""}|${minDiscount}|${origin}`;
  const now = Date.now();
  if (cacheKey) {
    const hit = countryStoresCache.get(cacheKey);
    if (hit && hit.expires > now) return hit.rows;
  }

  const { data, error } = await supa.rpc("list_country_stores_with_counts", {
    p_country:      country,
    p_category:     category,
    p_min_discount: minDiscount,
    p_search:       search,
    p_origin:       origin,
  });
  if (error) {
    console.warn("[browse-db] list_country_stores_with_counts RPC error:", error.message);
    return [];
  }
  const rows = (data ?? []) as DropdownStoreRow[];
  if (cacheKey && rows.length > 0) {
    if (countryStoresCache.size >= COUNTRY_STORES_MAX_ENTRIES) {
      const oldest = countryStoresCache.keys().next().value;
      if (oldest !== undefined) countryStoresCache.delete(oldest);
    }
    countryStoresCache.set(cacheKey, { rows, expires: now + COUNTRY_STORES_TTL_MS });
  }
  return rows;
}

/* ──────────────────────────────────────────────────────────────────
   Shoppable-store universe per country.

   "All stores you can shop with from {country}" = stores ANCHORED in
   the country ∪ the cross-border globals reachable from it that
   currently carry a live qualifying offer. Powers the homepage hero's
   "scanning prices across N stores" so the headline reflects the real
   per-market universe (NG ~75, IN ~132, ZA ~120, AE ~62, UK ~267,
   US ~319) instead of the old hand-curated roster estimate (~28-38),
   which read as inconsistent next to the per-country deals counts
   immediately below the hero.

   Built as the union of two RPC slices because
   list_country_stores_with_counts is country-scoped ONLY for
   origin="local"; for origin="all" it returns a GLOBAL roster (~900
   stores, blind to p_country — a SQL-function bug, and the DB is
   read-only so we correct it in app code):
     • local  → trust as-is (country-scoped, untruncated, ≤ ~310).
     • global → keep only rows on this country's cross-border allowlist
                (isCrossBorderStore reads store id + name only). These
                are high-volume so they survive the RPC's 1000-row cap.
   Deduped by canonical display name. Held in lock-step with the /deals
   "all" tab store count (countryCorrectDropdownRows in the deals route),
   which computes the identical union, so the two surfaces agree on the
   default view.

   Plain Map cache (NOT unstable_cache — that throws "incrementalCache
   missing" outside its narrow supported contexts here, same reason
   getStoreCanonicalMap / fetchPoolCached use a Map). 15-min TTL ≈ the
   homepage ISR window. A zero result (transient RPC failure) is NOT
   cached, so the next render retries and the caller can fall back to
   the static roster estimate. */
const SHOPPABLE_COUNT_TTL_MS = 15 * 60 * 1000;
const shoppableCountCache = new Map<string, { value: number; expires: number }>();

export async function getShoppableStoreCount(countryCode: string): Promise<number> {
  const key = countryCode.toLowerCase();
  const now = Date.now();
  const hit = shoppableCountCache.get(key);
  if (hit && hit.expires > now) return hit.value;

  const [localRows, globalRows] = await Promise.all([
    listCountryStoresWithCounts({ country: countryCode, origin: "local" }),
    listCountryStoresWithCounts({ country: countryCode, origin: "all" }),
  ]);

  const names = new Set<string>();
  for (const r of localRows) {
    if (r.store_name) names.add(displayStoreName(r.store_name).toLowerCase());
  }
  for (const r of globalRows) {
    if (!r.store_name) continue;
    if (isCrossBorderStore(
      { storeId: r.store_id, storeName: r.store_name, currency: "", tags: [] },
      countryCode,
    )) {
      names.add(displayStoreName(r.store_name).toLowerCase());
    }
  }

  const value = names.size;
  /* Don't cache a transient 0 — let the next render retry and the caller
     fall back to the static roster estimate in the meantime. */
  if (value > 0) shoppableCountCache.set(key, { value, expires: now + SHOPPABLE_COUNT_TTL_MS });
  return value;
}
