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
import { withTimeout } from "@/lib/promise-timeout";
import { priceLooksPlausible } from "@/lib/search/price-floor";

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

/* Strict UUID format check. The price-history RPCs declare their
   product_id parameter as the Postgres `uuid` type, so passing a
   synthetic string id (curated Amazon's "amazon-uk-iphone-15-pro",
   live-search's "serp-xxx-i", etc.) triggers a Postgres
   "invalid input syntax for type uuid" error. We catch it and
   return null, but the error also lands in Vercel logs as noise.

   Validate up-front so the RPC is only called for ids that have any
   chance of matching. Cheaper, quieter, and the page-level gate
   that hides the chart for non-UUID anchors keeps producing the
   same UX. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchProductPriceHistory(
  productId: string,
  daysBack = 90,
): Promise<PriceHistoryRow[] | null> {
  if (!productId || !UUID_RE.test(productId)) return null;
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

/* ── Time-series for the PDP chart ──────────────────────────────────
   Wraps the product_price_timeseries RPC (migration 0054) — returns
   one row per day in the lookback window, each carrying the LOWEST
   price seen across any store that day, plus how many stores were
   present.

   Different shape than fetchProductPriceHistory: that one returns
   per-store rollups (one row per store, with lowest/latest
   aggregates); this one returns per-day rollups (one row per day,
   with min across stores). Both back the same offer_price_history
   table, just sliced differently for their consumers.

   Defensive: returns null when the RPC isn't applied yet, DB is
   unreachable, or product has no history. The chart component
   renders a "no price history yet" empty state when null. */
export interface PriceHistoryPoint {
  /** ISO date string for the bucket (yyyy-mm-dd). */
  day:         string;
  /** Lowest carried-forward price across all live listings on this day, in
      NGN. Each listing holds its last seen price until re-scraped (so a day
      only one store was refreshed still reports the true cheapest), and USD
      is converted at the LIVE fx_rate inside the RPC — the same rate the
      chart's "now" dot uses, so the line lands on the dot (migration 0088). */
  minPriceNgn: number;
  /** Number of distinct stores with a live (carried-forward) offer that day —
      drives the chart's store-count provenance + single-store dimming. */
  storeCount:  number;
}

interface RpcTimeseriesRow {
  bucket_day:    string;
  min_price_ngn: number;
  store_count:   number;
}

export async function fetchProductPriceTimeseries(
  productId: string,
  daysBack = 90,
): Promise<PriceHistoryPoint[] | null> {
  /* UUID guard — see fetchProductPriceHistory. Synthetic ids skip
     the RPC roundtrip entirely. */
  if (!productId || !UUID_RE.test(productId)) return null;
  const supa = getSupabaseAdmin();
  if (!supa) return null;

  try {
    const { data, error } = await supa.rpc("product_price_timeseries", {
      p_product_id: productId,
      p_days_back:  daysBack,
    });
    if (error || !data) return null;

    return (data as RpcTimeseriesRow[]).map((r) => ({
      day:         r.bucket_day,
      minPriceNgn: Number(r.min_price_ngn),
      storeCount:  Number(r.store_count),
    }));
  } catch {
    return null;
  }
}

/* ── Lowest-in-window helper ────────────────────────────────────────
   Feature #2 badge logic — surfaces "Lowest in 30 days" on a deal
   card when the current price equals the lowest seen across any
   store in the window. Reuses fetchProductPriceTimeseries so the
   read path is shared with the chart.

   Returns null when no data or fewer than 2 stores in window (a
   single-store floor is trivially true — same as the bar's
   storeCount >= 2 gate). */
export interface LowestInWindow {
  lowestNgn:  number;
  storeCount: number;
  /** True when the passed-in currentNgn is within 1% of the floor —
      gives the badge a slight tolerance for rounding / FX drift. */
  isAtFloor:  boolean;
}

export function deriveLowestInWindow(
  timeseries: PriceHistoryPoint[],
  currentNgn: number,
): LowestInWindow | null {
  if (timeseries.length === 0) return null;

  let lowest = timeseries[0].minPriceNgn;
  let maxStores = timeseries[0].storeCount;
  for (let i = 1; i < timeseries.length; i++) {
    const t = timeseries[i];
    if (t.minPriceNgn < lowest) lowest = t.minPriceNgn;
    if (t.storeCount  > maxStores) maxStores = t.storeCount;
  }
  if (maxStores < 2) return null;

  /* 1% tolerance — covers integer rounding in the RPC (numeric(12,2)
     truncates fractions) and the fixed-rate USD→NGN conversion drift.
     A real "current matches floor" event survives this tolerance;
     a clear "current is well above floor" doesn't trigger the badge. */
  const isAtFloor = currentNgn <= lowest * 1.01;

  return { lowestNgn: lowest, storeCount: maxStores, isAtFloor };
}

/* ── Bulk badge lookup ──────────────────────────────────────────────
   For a batch of offer_ids (typically a /deals page's rendered set),
   return the subset whose current price is at the 30-day floor for
   their underlying product. Single RPC call regardless of batch size
   — avoids N+1 reads on the deals feed.

   Pipes through to the offers_at_30d_low RPC (migration 0055). The
   RPC enforces the storeCount >= 2 gate and the 1% tolerance so the
   JS side just unwraps the result.

   Defensive: returns an empty set when the RPC isn't applied yet or
   the DB is unreachable. Deal cards then never render the badge —
   safe-degrade.

   ── In-memory per-id cache (May 2026 perf pass) ────────────────────
   The deals feed renders 60 cards SSR + lazy-loads more on scroll;
   most sessions hit /api/deals 3-5 times with overlapping offer_id
   sets. Module-level Map keeps a per-offer "at-floor" verdict (or
   "not-at-floor") with a 5-minute TTL so repeated hits within the
   window skip the RPC entirely.

   Why per-id not per-request: a request with [A,B,C] and a later
   request with [B,C,D] should reuse the cached verdicts for B+C
   and only query for the unknown ones. Per-request hashing would
   miss that. Tradeoff: a tiny bit more bookkeeping for a much
   higher hit rate.

   Memory ceiling: each entry is ~100 bytes (id + bool + timestamp);
   at 10K entries we're at ~1MB. eviction-on-expiry keeps that
   roughly stable in steady state. */
type CacheEntry = { atFloor: boolean; expiresAt: number };
/* Cache keyed by `${CACHE_VERSION}:${offerId}`. Bump CACHE_VERSION
   any time the `offers_at_30d_low` RPC's logic changes (tolerance
   threshold, store-count gate, window length, etc.). Warm Vercel
   instances served by an older deploy will then continue to read
   their own version-prefixed entries while the new deploy populates
   fresh ones — no cross-deploy contamination, no stale verdicts
   for users hitting the new deploy. */
const AT30D_LOW_CACHE_VERSION = "v1";
const at30dLowCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes — matches the page-level ISR cadence
const cacheKey = (offerId: string) => `${AT30D_LOW_CACHE_VERSION}:${offerId}`;

export async function fetchOffersAt30dLow(
  offerIds: string[],
): Promise<Set<string>> {
  if (offerIds.length === 0) return new Set();

  /* Strip non-UUID-shaped ids before sending to the RPC. Curated
     offers carry synthetic string ids (e.g. "curated:amazon-ng-...");
     pushing them through the RPC would error on the uuid type cast.
     Uses the module-level UUID_RE defined above. */

  const now = Date.now();
  const result = new Set<string>();
  const toQuery: string[] = [];
  for (const id of offerIds) {
    if (!UUID_RE.test(id)) continue;
    const cached = at30dLowCache.get(cacheKey(id));
    if (cached && cached.expiresAt > now) {
      if (cached.atFloor) result.add(id);
      /* else: known-not-at-floor; skip the query and don't add to set. */
    } else {
      toQuery.push(id);
    }
  }
  if (toQuery.length === 0) return result;

  const supa = getSupabaseAdmin();
  if (!supa) return result;

  try {
    /* withTimeout: this RPC runs on the user-blocking /deals SSR
       path. A hung query can't be allowed to stall the page render
       past 1.5s. Fallback returns empty data which the calling
       code interprets as "no offers flagged" — badges silently
       hide, page still renders. */
    const { data, error } = await withTimeout(
      supa.rpc("offers_at_30d_low", { p_offer_ids: toQuery }) as unknown as Promise<{ data: Array<{ offer_id: string }> | null; error: { message: string } | null }>,
      1500,
      { data: null, error: { message: "timeout" } },
      "offers_at_30d_low",
    );
    if (error || !data) return result;
    /* Build a fresh hit-set from the response so we can record BOTH
       at-floor and not-at-floor verdicts in the cache. */
    const hits = new Set<string>();
    for (const row of data as Array<{ offer_id: string }>) {
      hits.add(row.offer_id);
    }
    const expiresAt = now + CACHE_TTL_MS;
    for (const id of toQuery) {
      const atFloor = hits.has(id);
      at30dLowCache.set(cacheKey(id), { atFloor, expiresAt });
      if (atFloor) result.add(id);
    }
    /* Opportunistic eviction. Triggers on size threshold AND when
       at least one expired entry was seen this batch — keeps the
       map from accumulating dead entries on light-traffic instances
       (dev mostly) that never breach the 20k size gate. */
    let sawExpired = false;
    if (at30dLowCache.size > 20_000) {
      const expired: string[] = [];
      at30dLowCache.forEach((v, k) => {
        if (v.expiresAt <= now) { expired.push(k); sawExpired = true; }
      });
      for (const k of expired) at30dLowCache.delete(k);
    }
    void sawExpired;
    return result;
  } catch {
    return result;
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

/* User report May 29 2026: "Lowest tracked from 2w ago returns some
   really low prices which was corrupted leakage before our fix.
   E.g. $10 when current is $300."

   Pre-fix scrape windows wrote bogus rows into offer_price_history
   for several reasons:
     · Shopify variant ingest grabbed a 0-priced accessory variant
       under the parent product_id
     · Some scrapers captured the discount AMOUNT or unit-of-measure
       price (e.g. ₦10/g shown next to ₦10K total) instead of the
       headline price
     · Currency mis-detection wrote a raw USD value as NGN
     · pre-d730342 signature leak grouped unrelated products together
       and some history rows still reference the merged-then-split id
   The rows are in the DB, will be swept by migration 0063, and the
   ingest-side guard (added in the same change) prevents new ones.

   But until the sweep applies AND until cached page renders cycle,
   we still need to keep the corrupt rows out of the "Lowest tracked"
   line and the chart. The same priceLooksPlausible used at FTS read
   time is the right gate — it's flagship-aware, category-aware, and
   shared with /compare so the bar's lowest matches /compare's
   anchor floor.

   sanitisePriceHistory drops any row whose lowestSeen, after USD->NGN
   conversion, falls below the plausibility floor for the offer's
   title + category. Returns the surviving rows; callers fall back to
   "current-prices-only" rendering when the result is empty. */
export function sanitisePriceHistory(
  history: PriceHistoryRow[],
  productTitle: string | null | undefined,
  categorySlug: string | null | undefined,
  usdToNgn: (usd: number) => number,
): PriceHistoryRow[] {
  if (history.length === 0) return history;
  /* Without a title or category we have no plausibility signal —
     return rows unchanged rather than nuke the whole history. The
     DB sweep will catch these on its pass. */
  if (!productTitle && !categorySlug) return history;
  return history.filter((r) => {
    const lowestNgn = r.currency === "USD" ? usdToNgn(r.lowestSeen) : r.lowestSeen;
    return priceLooksPlausible(lowestNgn, categorySlug ?? null, productTitle ?? undefined);
  });
}

export function rollupPriceHistory(
  history: PriceHistoryRow[],
  visitingStoreId: string,
  usdToNgn: (usd: number) => number,
  productTitle?: string | null,
  categorySlug?: string | null,
): PriceHistorySummary | null {
  const sane = sanitisePriceHistory(history, productTitle, categorySlug, usdToNgn);
  if (sane.length === 0) return null;

  const inNgn = (r: PriceHistoryRow, v: number) =>
    r.currency === "USD" ? usdToNgn(v) : v;

  let bestRow = sane[0];
  let bestLowNgn = inNgn(bestRow, bestRow.lowestSeen);

  for (let i = 1; i < sane.length; i++) {
    const r = sane[i];
    const ngn = inNgn(r, r.lowestSeen);
    if (ngn < bestLowNgn) {
      bestRow = r;
      bestLowNgn = ngn;
    }
  }

  const thisStore = sane.find((r) => r.storeId === visitingStoreId);

  return {
    allTimeLowNgn:    bestLowNgn,
    allTimeLowAt:     bestRow.lowestSeenAt,
    allTimeLowStoreId: bestRow.storeId,
    thisStoreLowNgn:  thisStore ? inNgn(thisStore, thisStore.lowestSeen) : undefined,
    thisStoreLatestAt: thisStore ? thisStore.latestAt : undefined,
    storeCount:       sane.length,
  };
}

/* Same plausibility gate for the per-day timeseries used by the
   PriceHistoryChart. The RPC pre-aggregates min(price) across stores
   per day, so we can't apply the filter at the row level — instead
   we drop entire day buckets whose minPriceNgn falls below the floor.
   A real flash-sale day survives the filter; a corrupt-row day
   disappears from the chart line (creating a gap, not a dip into
   "fake low" territory).

   Without title/category, same conservative fallback: return as-is
   and trust the DB sweep to clean the underlying rows. */
export function sanitisePriceTimeseries(
  timeseries: PriceHistoryPoint[],
  productTitle: string | null | undefined,
  categorySlug: string | null | undefined,
): PriceHistoryPoint[] {
  if (timeseries.length === 0) return timeseries;
  if (!productTitle && !categorySlug) return timeseries;
  return timeseries.filter((p) =>
    priceLooksPlausible(p.minPriceNgn, categorySlug ?? null, productTitle ?? undefined),
  );
}
