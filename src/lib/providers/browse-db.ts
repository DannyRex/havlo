/* DB-backed browse provider.
   Reads from products + offers (populated by the ingestion cron).
   Activates only when the DB has rows, so it gracefully no-ops in dev. */

import type { BrowseProvider, BrowseQuery, OriginCounts } from "./types";
import type { Deal, OriginFilter, SortOption } from "@/types";
import { getSupabaseAdmin } from "./db-client";
import { getCuratedDeals, sortDeals } from "./curated-helper";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";

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

function rowToDeal(r: BestOfferRow): Deal {
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
    clicks: 0,
    postedAt: r.scraped_at.slice(0, 10),
  };
}

/* True if the deal's stored URL is a usable merchant URL.

   Why this check exists: SerpAPI ingest stored some offers with URLs
   like "/api/go?url=https://www.google.com/search?...&prds=..." where
   the underlying URL is Google Shopping. /api/go was supposed to
   resolve those to the actual merchant URL via SerpAPI's product
   endpoint at click time. With SerpAPI disabled (SERPAPI_DISABLED=true),
   the resolver returns null and /api/go's fallback redirects the user
   to the Google page itself — useless. Filter these offers from the
   feed entirely until SerpAPI is re-enabled or the rows are cleaned up
   in a follow-up migration. */
function isUsableMerchantUrl(url: string): boolean {
  /* Internal /api/go redirect — peek at the underlying URL and reject
     when it points at Google. */
  if (url.startsWith("/api/go?url=")) {
    try {
      const encoded = url.slice("/api/go?url=".length).split("&")[0];
      const inner   = decodeURIComponent(encoded);
      const host    = new URL(inner).hostname.toLowerCase();
      return host !== "google.com" && !host.endsWith(".google.com");
    } catch {
      return true; // malformed → keep, /api/go can still handle it
    }
  }
  /* Direct Google URL (shouldn't appear in the DB but defend anyway). */
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host !== "google.com" && !host.endsWith(".google.com");
  } catch {
    return true;
  }
}

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
    case "popular":    return { col: "scraped_at",       asc: false };  // placeholder until popularity tracked
    case "newest":     return { col: "scraped_at",       asc: false };
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
    /* Bumped from 500 → 2000. With the 500 cap, different sorts
       returned different post-filter totals (897 origin-count vs
       182 deals on Relevance vs 310 deals on Latest in the QA
       audit, Bucket 3#5) because each sort selected a different
       top-500 subset, then filterDealsForCountry pruned each
       differently. At Havlo's current scale (a few thousand offers
       across the whole DB) 2000 brings effectively every row that
       could pass downstream filters into memory once, eliminating
       the sort-dependent count variance. Re-evaluate when total
       offers crosses 5000 — at that point a separate count query
       + cursor-based pagination is the right shape. */
    query = query.order(col, { ascending: asc }).limit(2000);

    const { data, error } = await query;
    if (error) {
      console.warn("[browse-db] query error:", error.message);
      /* Even on a DB query failure, surface the curated catalog so
         the homepage isn't completely empty. Better than a blank
         page when Supabase is briefly unavailable. */
      return getCuratedDeals(q);
    }
    /* Drop offers whose URL points at Google Shopping (legacy SerpAPI
       ingest residue). Without SerpAPI to resolve, those clicks land
       the user on a Google search page — broken UX. */
    const fromDb = (data as BestOfferRow[])
      .filter((r) => isUsableMerchantUrl(r.url))
      .map(rowToDeal);
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
