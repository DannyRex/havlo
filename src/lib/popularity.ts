/* Click-based popularity signal for the "Most popular" sort on /deals.
   Calls the popular_products(days_back) RPC defined in migration 0015,
   pulls the (product_id, clicks) result set into an in-memory Map, and
   caches via Next's request-deduped + ISR cache.

   Why a Map and not an SQL join into product_best_offers:
     Joining the view would force the popularity calc to run on every
     product_best_offers read, and Supabase views can't take parameters
     like days_back. A separate RPC + JS-side Map lookup keeps the
     popularity window configurable, lets us cache the whole map for
     5 min, and stays O(1) per row when populating clicks in rowToDeal.

   Why fail-safe with an empty Map on RPC errors:
     Popularity is a nice-to-have ranking signal, not a correctness
     requirement. If the RPC fails (migration not applied yet, DB
     transient hiccup, etc.) we want fetchDeals to still return
     results — sorted by relevance/discount/whatever fallback the
     active sort defaults to. The "Most popular" sort will silently
     fall back to the discount-desc DB pre-sort. */

import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

/* 30-day rolling window. Tunable: too short (e.g. 7d) is noisy in
   low-traffic periods; too long (e.g. 90d) lets stale viral picks
   dominate after they go out of stock. 30d is the same window Amazon
   uses for "best sellers". */
const POPULARITY_WINDOW_DAYS = 30;

/* 5 min cache — matches the homepage rotation bucket and the
   product_best_offers fetch path, so a /deals render does one DB
   round trip for products + one for popularity, then memoises. */
const CACHE_TAG = "popularity-30d";
const REVALIDATE_S = 300;

interface PopularityRow {
  product_id: string;
  clicks:     number;
}

async function fetchPopularityMapUncached(): Promise<Map<string, number>> {
  const supa = getSupabaseAdmin();
  if (!supa) return new Map();
  const { data, error } = await supa.rpc("popular_products", {
    days_back: POPULARITY_WINDOW_DAYS,
  });
  if (error) {
    /* Don't crash callers if migration 0015 hasn't been applied yet
       OR the function permissions are off. Logged once at warn level
       so it shows in Vercel logs without paging anyone. */
    console.warn("[popularity] popular_products RPC failed:", error.message);
    return new Map();
  }
  const map = new Map<string, number>();
  for (const r of (data ?? []) as PopularityRow[]) {
    if (r.product_id) map.set(r.product_id, r.clicks ?? 0);
  }
  return map;
}

export const getPopularityMap = unstable_cache(
  fetchPopularityMapUncached,
  ["popularity-30d-v1"],
  { revalidate: REVALIDATE_S, tags: [CACHE_TAG] },
);
