/* ──────────────────────────────────────────────────────────────────
   Data-provider contracts.

   The app reads deals through providers, never directly from the
   static `deals.ts` file. This lets us swap sources (scraped CSV →
   SerpAPI live → Konga affiliate feed → Amazon PAAPI) without
   touching API routes or UI components.
   ────────────────────────────────────────────────────────────────── */

import type { Deal, OriginFilter, SortOption } from "@/types";

/* ── Common query shape ───────────────────────────────────────────── */

export interface BrowseQuery {
  categorySlug?: string;
  minDiscount?: number;
  sort?: SortOption;
  search?: string;
  origin?: OriginFilter;
  limit?: number;
  offset?: number;
  /** Restrict the result set to offers from these store IDs.
      Multi-select; ANY match qualifies. Undefined / empty = no
      store filter applied. Drives the "Stores" filter UI on
      /deals (multi-store checkbox panel). */
  stores?: string[];
  /** ISO 3166-1 alpha-2 lowercase (e.g. "ng", "uk"). When set, the
      provider scopes its fetch to that country's pool — anchored-
      local stores plus truly global cross-border shippers. Defends
      against pool starvation: when null, the 6000-row global RPC
      cap leaves 0%-only NG retailers below the cut because they
      compete with the entire international catalog. Per-country
      fetches give every market 6000 rows of its own headroom. */
  country?: string;
}

/* ── Per-call execution options ───────────────────────────────────── */

export interface FetchDealsOptions {
  /** Override the per-RPC timeout budget (ms). Defaults to 2500.

      The homepage "Trending" pool fetch passes a longer budget. That
      fetch is a NON-BLOCKING ISR background job (the route is
      stale-while-revalidate, so no visitor waits on it), and on a cold
      serverless instance the first Supabase RPC can take >2.5s just to
      establish the connection. At the tight default it trips the
      timeout, falls back to the curated-Amazon-only pool, and the
      homepage renders 5 cards instead of 16. User-facing /api/deals
      keeps the tight default because there a real visitor IS waiting. */
  timeoutMs?: number;

  /** When true, a Pass A RPC failure THROWS instead of returning the
      curated-Amazon-only fallback.

      The trending pool fetch is wrapped in unstable_cache. Returning a
      thin curated-only pool on a transient DB blip would get persisted
      for the full 30-min TTL — amplifying one unlucky cold render into
      30 minutes of a 5-card homepage. Throwing keeps the bad result
      OUT of the cache (Next does not persist a rejected cached fn), so
      the next render retries cleanly. The latency-sensitive /api/deals
      path leaves this unset and keeps the graceful curated fallback. */
  noCuratedFallback?: boolean;
}

export interface SearchQuery {
  /** Free-text query — product name, model, or category */
  q: string;
  /** ISO 3166-1 alpha-2 lower-case, e.g. "ng", "us". Provider-dependent. */
  countryCode?: string;
  /** Cap on how many results to return */
  limit?: number;
  /** Ingest mode toggle:
        - "deals" (default): appends 'deals' suffix to generic queries
          to bias Google Shopping toward sale-tagged results. Used by
          the Mon+Thu deal cron.
        - "market": drops the suffix to return a broader catalogue mix
          (deals + full-price + sponsored). Used by the monthly market
          cron to populate the spectrum + 'cheaper alternatives' rail
          with honest market data, not just promo data. */
  mode?: "deals" | "market";
}

export interface OriginCounts {
  all: number;
  local: number;
  intl: number;
  /* Deal-only counts — added May 2026 with offers.is_deal column.
     Lets the /deals UI show 'Local 2,526 (1,800 on sale)' pills
     without a second round-trip. Zero when the underlying DB
     migration (0028-offers-is-deal.sql) hasn't been applied yet —
     UI gracefully renders without the deal-count parenthetical
     in that case. */
  allDeals?:   number;
  localDeals?: number;
  intlDeals?:  number;
}

/* ── Provider interfaces ──────────────────────────────────────────── */

/**
 * Browse provider — backs the /deals feed.
 * Static today, eventually a DB-backed feed populated by ingestion crons.
 */
export interface BrowseProvider {
  readonly id: string;
  readonly name: string;
  /** Should this provider be used? Typically checks env config. */
  isActive(): boolean;
  /** Filtered + sorted deals (NOT yet paginated — caller slices) */
  fetchDeals(q: BrowseQuery, opts?: FetchDealsOptions): Promise<Deal[]>;
  /** Counts per origin bucket — cheap O(n) over filtered set */
  getOriginCounts(q: Omit<BrowseQuery, "origin" | "limit" | "offset">): Promise<OriginCounts>;
  /** Map of category slug → count of products in that category. Used for
      live counts on the homepage Shop-by-category tiles instead of the
      hardcoded numbers in src/lib/data/categories.ts. */
  getCategoryCounts(): Promise<Record<string, number>>;
}

/**
 * Search provider — backs live shopping search (SerpAPI today,
 * Amazon PAAPI / Rainforest later).
 * Returns canonical Deal[]; merging/dedup is the caller's job.
 */
export interface SearchProvider {
  readonly id: string;
  readonly name: string;
  isActive(): boolean;
  searchDeals(q: SearchQuery): Promise<Deal[]>;
}

/* ── Provider error type ──────────────────────────────────────────── */
export class ProviderError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${providerId}] ${message}`);
    this.name = "ProviderError";
  }
}
