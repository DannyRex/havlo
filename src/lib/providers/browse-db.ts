/* DB-backed browse provider.
   Reads from products + offers (populated by the ingestion cron).
   Activates only when the DB has rows, so it gracefully no-ops in dev. */

import type { BrowseProvider, BrowseQuery, OriginCounts } from "./types";
import type { Deal, OriginFilter, SortOption } from "@/types";
import { getSupabaseAdmin } from "./db-client";

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

/* Map our SortOption → SQL order column + direction */
function sortToOrder(s: SortOption | undefined): { col: string; asc: boolean } {
  switch (s) {
    case "discount":   return { col: "discount_percent", asc: false };
    case "price_asc":  return { col: "current_price",    asc: true };
    case "price_desc": return { col: "current_price",    asc: false };
    case "popular":    return { col: "scraped_at",       asc: false };  // placeholder until popularity tracked
    case "newest":
    default:           return { col: "scraped_at",       asc: false };
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
    query = query.order(col, { ascending: asc }).limit(500);

    const { data, error } = await query;
    if (error) {
      console.warn("[browse-db] query error:", error.message);
      return [];
    }
    return (data as BestOfferRow[]).map(rowToDeal);
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
