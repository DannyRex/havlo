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
}

export interface SearchQuery {
  /** Free-text query — product name, model, or category */
  q: string;
  /** ISO 3166-1 alpha-2 lower-case, e.g. "ng", "us". Provider-dependent. */
  countryCode?: string;
  /** Cap on how many results to return */
  limit?: number;
}

export interface OriginCounts {
  all: number;
  local: number;
  intl: number;
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
  fetchDeals(q: BrowseQuery): Promise<Deal[]>;
  /** Counts per origin bucket — cheap O(n) over filtered set */
  getOriginCounts(q: Omit<BrowseQuery, "origin" | "limit" | "offset">): Promise<OriginCounts>;
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
