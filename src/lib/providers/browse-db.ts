/* DB-backed browse provider.
   Reads from products + offers (populated by the ingestion cron).
   Activates only when the DB has rows, so it gracefully no-ops in dev. */

import type { BrowseProvider, BrowseQuery, OriginCounts } from "./types";
import type { Deal, OriginFilter, SortOption } from "@/types";
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

/* Map our SortOption → SQL order column + direction.

   `relevance` is a composite ranker computed in JS after fetch
   (curated-helper.ts → sortDeals). For the SQL pre-fetch, order by
   discount_percent DESC so the in-memory ranker gets the highest-
   quality candidates first within the 500-row LIMIT — keeps
   relevance-sorted views biased toward strong deals even when the
   underlying table grows past the cap. */
function sortToOrder(s: SortOption | undefined): { col: string; asc: boolean } {
  switch (s) {
    case "discount":   return { col: "discount_percent", asc: false };
    case "price_asc":  return { col: "current_price",    asc: true };
    case "price_desc": return { col: "current_price",    asc: false };
    case "newest":     return { col: "scraped_at",       asc: false };
    /* `popular` can't be expressed as a single column on
       product_best_offers — clicks live in outbound_clicks and get
       aggregated by popularity.ts. We pre-fetch the same discount-
       desc top-N here so the JS-side popularity sort gets a high-
       quality candidate pool, then re-rank by clicks (desc) with
       discount as the tiebreaker (curated-helper.ts → sortDeals). */
    case "popular":    return { col: "discount_percent", asc: false };
    case "relevance":
    default:           return { col: "discount_percent", asc: false };
  }
}

function applyOriginFilter<T>(query: T, origin: OriginFilter): T {
  // We store this on the offers join via the view. Filter via the joined column.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const q = query as any;
  if (origin === "local") return q.eq("is_international", false);
  if (origin === "intl")  return q.eq("is_international", true);
  return q;
  /* eslint-enable @typescript-eslint/no-explicit-any */
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

    const { col, asc } = sortToOrder(q.sort);

    /* Build a query factory so we can re-apply the same filters
       across paginated requests without duplication. */
    const buildQuery = () => {
      let query = supa.from("product_best_offers").select("*");
      if (q.categorySlug && q.categorySlug !== "all") {
        query = query.eq("category_slug", q.categorySlug);
      }
      if (typeof q.minDiscount === "number" && q.minDiscount > 0) {
        query = query.gte("discount_percent", q.minDiscount);
      }
      if (q.search?.trim()) {
        query = query.ilike("title", `%${q.search.trim()}%`);
      }
      if (q.origin && q.origin !== "all") {
        query = applyOriginFilter(query, q.origin);
      }
      /* Tiebreaker on offer_id is non-negotiable for the paginated
         fan-out below to be safe. Without it, PostgreSQL may return
         tied rows (same price / discount / scraped_at) in different
         orders across different .range() requests, so a row at
         position 999 in page 1 can re-appear at position 1000 in
         page 2 of the SAME logical sort. The QA agent caught this:
         /ng/deals?category=phones&sort=price_asc surfaced the same
         AliExpress accessory 11 times because its ₦62K price tied
         with many sibling listings and PostgreSQL bounced the row
         across page boundaries on every fetch. */
      return query.order(col, { ascending: asc }).order("offer_id", { ascending: true });
    };

    /* PostgREST caps single responses at db-max-rows (default 1000)
       even when .limit() requests more — verified May 2026 against
       the live Supabase instance. With 7k+ in-stock offers post-NG-
       expansion, the cap was silently hiding entire stores: the
       new Shopify pharmacies + grocers (HealthPlus, Supermart,
       MedPlus, Essenza — ~1,700 offers, all 0% discount) sat past
       row 1000 in the discount-DESC pre-sort and never made it
       into /api/deals.

       Fix: fan out 8 parallel range() requests to pull up to 8000
       rows in one round trip's wall time. The ~5MB total payload
       is fine for serverless; the parallel requests amortize
       latency. Revisit when total in-stock offers crosses 20000
       and switch to cursor-based pagination. */
    const PAGE = 1000;
    const PAGES = 8; // 8000-row ceiling
    /* Fetch the popularity record (product_id → 30d click count) in
       parallel with the offers fan-out. Cached for 5 min on the JS
       side so this is a single DB call per cache window. Empty
       record returned on RPC errors so "Most popular" gracefully
       falls back to discount-desc ordering when migration 0015
       isn't applied. Record (not Map) because unstable_cache
       serialises via JSON — a Map round-trips to {}. */
    const pageRequests = Array.from({ length: PAGES }, (_, i) =>
      buildQuery().range(i * PAGE, (i + 1) * PAGE - 1),
    );
    const [results, popularity] = await Promise.all([
      Promise.all(pageRequests),
      getPopularityRecord(),
    ]);

    /* Stop on first error, surface curated as fallback so the page
       isn't blank if Supabase had a transient hiccup mid-fan-out. */
    const erroredResult = results.find((r) => r.error);
    if (erroredResult?.error) {
      console.warn("[browse-db] paginated query error:", erroredResult.error.message);
      return getCuratedDeals(q);
    }

    const allRows: BestOfferRow[] = [];
    const seenOfferIds = new Set<string>();
    for (const r of results) {
      if (!r.data) continue;
      for (const row of r.data as BestOfferRow[]) {
        /* Defensive dedup. The .order(col, asc).order(offer_id, true)
           tiebreaker above SHOULD make this unnecessary, but if the
           underlying view ever changes its identity column name, or
           if a future schema migration breaks the stable sort, we
           still don't want to surface the same listing 11 times like
           the QA agent caught. Set membership check is O(1) so the
           cost is negligible vs the safety it gives. */
        if (seenOfferIds.has(row.offer_id)) continue;
        seenOfferIds.add(row.offer_id);
        allRows.push(row);
      }
      /* Short page = end of dataset; no need to merge anything past
         this point (subsequent ranges will all have come back empty
         too). Could break early but Promise.all already fired them. */
    }

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
      if (q.search?.trim()) chain = chain.ilike("title", `%${q.search.trim()}%`);
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
