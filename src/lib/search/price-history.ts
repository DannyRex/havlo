/* Price-history reader.

   Wraps the product_price_history RPC (migration 0027) so the
   PriceComparisonBar can surface "lowest seen at this store" and
   "all-time low" badges.

   Returned shape is per-store rows: each carries the lowest +
   latest price seen for that store within the lookback window,
   plus the timestamps. The bar derives:
     • allTimeLow         — min(lowest_seen) across stores
     • allTimeLowStoreId  — which store hit the floor
     • allTimeLowDate     — when
     • thisStoreLowest    — for the visited offer's store
     • dropFromLowest     — current vs lowest in absolute / %

   Defensive: returns null when the RPC isn't available (migration
   not yet applied), DB is unreachable, or the product has no
   history (curated synthetic-id PDPs). Callers fall back to the
   current-prices-only spectrum in that case. */

import { getSupabaseAdmin } from "@/lib/providers/db-client";

export interface PriceHistoryRow {
  storeId:      string;
  lowestSeen:   number;
  lowestSeenAt: string;
  latest:       number;
  latestAt:     string;
  currency:     "NGN" | "USD";
}

interface RpcRow {
  store_id:        string;
  lowest_seen:     number;
  lowest_seen_at:  string;
  latest:          number;
  latest_at:       string;
  currency:        string;
}

export async function fetchProductPriceHistory(
  productId: string,
  daysBack = 90,
): Promise<PriceHistoryRow[] | null> {
  if (!productId) return null;
  const supa = getSupabaseAdmin();
  if (!supa) return null;

  try {
    const { data, error } = await supa.rpc("product_price_history", {
      p_product_id: productId,
      p_days_back:  daysBack,
    });
    if (error || !data) return null;

    return (data as RpcRow[]).map((r) => ({
      storeId:      r.store_id,
      lowestSeen:   Number(r.lowest_seen),
      lowestSeenAt: r.lowest_seen_at,
      latest:       Number(r.latest),
      latestAt:     r.latest_at,
      currency:     r.currency === "USD" ? "USD" : "NGN",
    }));
  } catch {
    return null;
  }
}

/* Roll up the per-store rows into a single product-level summary. */
export interface PriceHistorySummary {
  /** Lowest price seen for this product within the lookback window
      (default 90d), across any store. NGN — USD rows converted via
      usdToNgn before comparison. NB: NOT a true all-time low —
      capped to the window. The bar's verdict copy says "Lowest in
      90 days" to be honest about that. */
  allTimeLowNgn:        number;
  /** When that lowest was first recorded. */
  allTimeLowAt:         string;
  /** Which store hit the lowest in the window. The visited offer
      may or may not be from this store. */
  allTimeLowStoreId:    string;
  /** Lowest price seen at the SAME store as the currently-visited
      offer. Undefined when the visited store has no history rows. */
  thisStoreLowNgn?:     number;
  /** When THIS store last set its current price. Useful for "Same
      price as <timestamp>" framing. */
  thisStoreLatestAt?:   string;
  /** Number of distinct stores with history rows in the window.
      Used by the bar's verdict logic as a confidence signal — the
      "Lowest in 90 days" badge requires storeCount >= 2 so we
      don't trumpet "lowest" for a product that only one store has
      ever listed (where the floor IS that store's price by
      definition — trivially true, no real signal). */
  storeCount:           number;
}

export function rollupPriceHistory(
  history: PriceHistoryRow[],
  visitingStoreId: string,
  usdToNgn: (usd: number) => number,
): PriceHistorySummary | null {
  if (history.length === 0) return null;

  const inNgn = (r: PriceHistoryRow, v: number) =>
    r.currency === "USD" ? usdToNgn(v) : v;

  let bestRow = history[0];
  let bestLowNgn = inNgn(bestRow, bestRow.lowestSeen);

  for (let i = 1; i < history.length; i++) {
    const r = history[i];
    const ngn = inNgn(r, r.lowestSeen);
    if (ngn < bestLowNgn) {
      bestRow = r;
      bestLowNgn = ngn;
    }
  }

  const thisStore = history.find((r) => r.storeId === visitingStoreId);

  return {
    allTimeLowNgn:    bestLowNgn,
    allTimeLowAt:     bestRow.lowestSeenAt,
    allTimeLowStoreId: bestRow.storeId,
    thisStoreLowNgn:  thisStore ? inNgn(thisStore, thisStore.lowestSeen) : undefined,
    thisStoreLatestAt: thisStore ? thisStore.latestAt : undefined,
    storeCount:       history.length,
  };
}
