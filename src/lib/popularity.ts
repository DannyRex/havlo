/* Click-based popularity signal for the "Most popular" sort on /deals.
   Calls the popular_products(days_back) RPC defined in migration 0015,
   pulls the (product_id, clicks) result set into an in-memory record,
   and caches via Next's request-deduped + ISR cache.

   Why a plain Record<string, number> (and not a Map):
     unstable_cache serialises return values via JSON. JSON.stringify
     turns Map into {} — so the very first cached read returned an
     empty plain object instead of a Map, and consumers calling
     `.get()` on it threw TypeError: popularity.get is not a function.
     A plain object round-trips cleanly through JSON and lookups are
     identical (O(1) hash, `record[id]` vs `map.get(id)`).

   Why fail-safe with an empty record on RPC errors:
     Popularity is a nice-to-have ranking signal, not a correctness
     requirement. If the RPC fails (migration not applied yet, DB
     transient hiccup, etc.) we want fetchDeals to still return
     results — sorted by relevance/discount/whatever fallback the
     active sort defaults to. "Most popular" silently falls back to
     the discount-desc DB pre-sort. */

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

/** product_id → 30d click count. Plain object so it survives the
    unstable_cache JSON round-trip. */
export type PopularityRecord = Record<string, number>;

async function fetchPopularityRecordUncached(): Promise<PopularityRecord> {
  try {
    const supa = getSupabaseAdmin();
    if (!supa) return {};
    const { data, error } = await supa.rpc("popular_products", {
      days_back: POPULARITY_WINDOW_DAYS,
    });
    if (error) {
      /* Don't crash callers if migration 0015 hasn't been applied yet
         OR the function permissions are off. Logged once at warn level
         so it shows in Vercel logs without paging anyone. */
      console.warn("[popularity] popular_products RPC failed:", error.message);
      return {};
    }
    const record: PopularityRecord = {};
    for (const r of (data ?? []) as PopularityRow[]) {
      if (r.product_id) record[r.product_id] = r.clicks ?? 0;
    }
    return record;
  } catch (err) {
    /* Belt + braces: any unexpected throw (network drop, auth hiccup
       during cold start, etc.) must NOT take down /deals or the
       homepage. Return an empty record and let the sort degrade
       gracefully to discount-desc. */
    console.warn("[popularity] unexpected error:", (err as Error).message);
    return {};
  }
}

export const getPopularityRecord = unstable_cache(
  fetchPopularityRecordUncached,
  /* v2 cache key bumped after the Map → Record migration. Old v1
     cache entries (serialised as {}) get bypassed automatically. */
  ["popularity-30d-v2"],
  { revalidate: REVALIDATE_S, tags: [CACHE_TAG] },
);
