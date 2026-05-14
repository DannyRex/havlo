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

    const PASS_A_MAX = 4000;
    const PASS_B_MAX = 2000;

    const passAArgs = {
      p_category:       q.categorySlug && q.categorySlug !== "all" ? q.categorySlug : null,
      p_min_discount:   typeof q.minDiscount === "number" && q.minDiscount > 0 ? q.minDiscount : 0,
      p_sort:           rpcSort,
      p_search:         q.search?.trim().replace(/[(),]/g, " ") || null,
      p_origin:         q.origin && q.origin !== "all" ? q.origin : "all",
      p_store_ids:      q.stores && q.stores.length > 0 ? q.stores : null,
      p_max_rows:       PASS_A_MAX,
      p_zero_discount_only: false,
    };
    const passBArgs = {
      ...passAArgs,
      p_max_rows:           PASS_B_MAX,
      p_zero_discount_only: true,
      p_min_discount:       0, // override — Pass B ignores user floor
    };

    /* Both RPC calls in parallel, plus the popularity record. */
    const [passAResult, passBResult, popularity] = await Promise.all([
      supa.rpc("browse_deals", passAArgs),
      runPassB ? supa.rpc("browse_deals", passBArgs) : Promise.resolve({ data: null, error: null }),
      getPopularityRecord().catch(() => ({} as Record<string, number>)),
    ]);

    /* Stop on first error, surface curated as fallback so the page
       isn't blank if Supabase had a transient hiccup. Same recovery
       posture as the previous fan-out. */
    if (passAResult.error) {
      console.warn("[browse-db] browse_deals RPC error:", passAResult.error.message);
      return getCuratedDeals(q);
    }
    if (runPassB && passBResult.error) {
      console.warn("[browse-db] browse_deals (pass B) RPC error:", passBResult.error.message);
      // Pass B failure is non-fatal — Pass A's data is still useful.
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

    const baseFilter = (qb: ReturnType<typeof supa.from>) => {
      let chain = qb.select("*", { count: "exact", head: true });
      if (q.categorySlug && q.categorySlug !== "all") chain = chain.eq("category_slug", q.categorySlug);
      if (typeof q.minDiscount === "number") chain = chain.gte("discount_percent", q.minDiscount);
      if (q.search?.trim()) {
        /* Same dual title/store_name filter as fetchDeals so origin
           counts agree with the displayed list. */
        const escaped = q.search.trim().replace(/[(),]/g, " ");
        chain = chain.or(`title.ilike.%${escaped}%,store_name.ilike.%${escaped}%`);
      }
      return chain;
    };

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
