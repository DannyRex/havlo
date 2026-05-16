/* PostgreSQL Full-Text Search provider.
   Replaces the hardcoded-brand heuristic engine — the data drives relevance.
   Active whenever Supabase is configured. */

import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";
import { getSupabaseAdmin } from "./db-client";

interface FtsRow {
  product_id:       string;
  title:            string;
  category_slug:    string | null;
  brand:            string | null;
  image_url:        string | null;
  offer_id:         string;
  store_id:         string;
  store_name:       string;
  store_logo_url:   string | null;
  is_international: boolean;
  url:              string;
  current_price:    number;
  original_price:   number | null;
  discount_percent: number | null;
  currency:         "NGN" | "USD";
  rank:             number;
}

function rowToDeal(r: FtsRow): Deal {
  const original = r.original_price ?? r.current_price;
  return {
    id:              r.offer_id,
    title:           r.title,
    description:     r.title,
    category:        r.category_slug ?? "general",
    categorySlug:    r.category_slug ?? "all",
    storeId:         r.store_id,
    storeName:       r.store_name,
    originalPrice:   original,
    salePrice:       r.current_price,
    discountPercent: r.discount_percent ?? 0,
    currency:        r.currency,
    imageUrl:        r.image_url ?? undefined,
    url:             r.url,
    expiresAt:       null,
    isHot:           (r.discount_percent ?? 0) >= 30,
    isFeatured:      false,
    tags:            [r.store_name, r.brand, r.is_international ? "intl" : "local"]
                       .filter(Boolean) as string[],
    saves:           0,
    clicks:          0,
    postedAt:        new Date().toISOString().slice(0, 10),
  };
}

export const pgFtsSearchProvider: SearchProvider = {
  id: "pg-fts",
  name: "Postgres Full-Text Search",

  isActive() {
    return getSupabaseAdmin() !== null;
  },

  async searchDeals(query: SearchQuery): Promise<Deal[]> {
    const supa = getSupabaseAdmin();
    if (!supa) return [];

    const q = query.q.trim();
    if (!q) return [];

    const { data, error } = await supa.rpc("search_products_fts", {
      q,
      max_results: query.limit ?? 24,
    });

    if (error) {
      // Function may not exist if migration 0002 hasn't been applied — fall through silently
      if (error.message?.includes("function") && error.message?.includes("does not exist")) {
        console.warn("[pg-fts] search_products_fts RPC not found - has 0002-fts-search.sql been applied?");
        return [];
      }
      throw new ProviderError(this.id, error.message);
    }

    return (data ?? []).map((r: FtsRow) => rowToDeal(r));
  },
};
