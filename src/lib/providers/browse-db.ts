/* DB-backed browse provider.
   Reads from products + offers (populated by the ingestion cron).
   Activates only when the DB has rows, so it gracefully no-ops in dev. */

import type { BrowseProvider, BrowseQuery, OriginCounts } from "./types";
import type { Deal } from "@/types";
import { getSupabaseAdmin } from "./db-client";
import { getCuratedDeals, sortDeals } from "./curated-helper";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";
import { isUsableMerchantUrl } from "@/lib/url-helpers";
import { getPopularityRecord, type PopularityRecord } from "@/lib/popularity";
import { searchCandidates } from "@/lib/search/query-expand";

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
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    imageEmoji: "🛍️",
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
    postedAt: r.scraped_at.slice(0, 10),
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
const SEARCH_MAX_ROWS = 1000;
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
    // Stop early when the literal query gave us plenty of matches.
    if (i === 0 && rows.length >= MIN_USABLE_ROWS * 4) break;
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
     the browse path applies. */
  const fromDb = merged
    .filter((r) => isUsableMerchantUrl(r.url))
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
  return sortDeals([...reranked, ...curated], q.sort);
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

  async fetchDeals(q: BrowseQuery): Promise<Deal[]> {
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
    const PASS_VERSION = "v2-cross-border-guaranteed";
    void PASS_VERSION;
    const PASS_MAX = 1000;

    const passABase = {
      p_category:       q.categorySlug && q.categorySlug !== "all" ? q.categorySlug : null,
      p_min_discount:   typeof q.minDiscount === "number" && q.minDiscount > 0 ? q.minDiscount : 0,
      p_sort:           rpcSort,
      p_search:         q.search?.trim().replace(/[(),]/g, " ") || null,
      p_store_ids:      q.stores && q.stores.length > 0 ? q.stores : null,
      p_max_rows:       PASS_MAX,
      p_zero_discount_only: false,
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
       feeds that ingest at retail price (discount_percent=0) and
       would otherwise drop out of Pass A's discount-desc sort.
       Conditional on sort being discount-biased + user allowing 0%. */
    const passCArgs = {
      ...passABase,
      p_origin:  "local",
      p_country: q.country ? q.country.toUpperCase() : null,
      p_zero_discount_only: true,
      p_min_discount: 0,
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

    /* All three RPC calls in parallel, plus the popularity record. */
    const [passAResult, passBResult, passCResult, popularity] = await Promise.all([
      supa.rpc("browse_deals", passAArgs),
      supa.rpc("browse_deals", passBArgs),
      runPassC ? supa.rpc("browse_deals", passCArgs) : Promise.resolve({ data: null, error: null }),
      getPopularityRecord().catch(() => ({} as Record<string, number>)),
    ]);

    /* Stop on Pass A error (most critical). Pass B/C errors are
       non-fatal — degraded pool is better than no pool. */
    if (passAResult.error) {
      console.warn("[browse-db] browse_deals Pass A RPC error:", passAResult.error.message);
      return getCuratedDeals(q);
    }
    if (passBResult.error) {
      console.warn("[browse-db] browse_deals Pass B RPC error:", passBResult.error.message);
    }
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
    merge(passAResult.data as unknown as BestOfferRow[] | null);
    merge(passBResult.data as unknown as BestOfferRow[] | null);
    merge(passCResult.data as unknown as BestOfferRow[] | null);

    /* Drop offers whose URL points at Google Shopping (legacy SerpAPI
       ingest residue). Without SerpAPI to resolve, those clicks land
       the user on a Google search page — broken UX. */
    const fromDb = allRows
      .filter((r) => isUsableMerchantUrl(r.url))
      .map((r) => rowToDeal(r, popularity));
    /* Merge curated Amazon catalog with the ingested data, then
       re-apply the requested sort to the combined array. Lets
       curated entries compete on the same sort criteria as scraped
       data instead of always front-loading the feed. */
    const curated = getCuratedDeals(q);
    return sortDeals([...fromDb, ...curated], q.sort);
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
      const [localRes, intlRes] = await Promise.all([
        baseFilter(supa.from("product_best_offers")).eq("store_country", userCountry),
        /* True cross-border globals only: is_international=true
           with no anchored country. Excludes foreign-country-
           anchored retailers that don't realistically ship to
           the visitor's market. */
        baseFilter(supa.from("product_best_offers")).eq("is_international", true).is("store_country", null),
      ]);
      const local = localRes.count ?? 0;
      const intl  = intlRes.count  ?? 0;
      return { all: local + intl, local, intl };
    }

    const [allRes, localRes, intlRes] = await Promise.all([
      baseFilter(supa.from("product_best_offers")),
      baseFilter(supa.from("product_best_offers")).eq("is_international", false),
      baseFilter(supa.from("product_best_offers")).eq("is_international", true),
    ]);

    return {
      all:   allRes.count   ?? 0,
      local: localRes.count ?? 0,
      intl:  intlRes.count  ?? 0,
    };
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
