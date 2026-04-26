/* ──────────────────────────────────────────────────────────────────
   Provider registry — single import point for the rest of the app.

   Browse-provider selection priority:
     1. DB-backed (db-products) — if Supabase is configured AND there
        are products to serve
     2. Static scraped (static-scraped) — always-available baseline

   The check is cached per-process for 5 minutes so we don't COUNT(*)
   on every request after a cold start.

   To add a new source:
   1. Implement the BrowseProvider or SearchProvider interface
      (see src/lib/providers/types.ts).
   2. Register it in the relevant array below.
   3. Done — the registry will pick it up based on isActive().
   ────────────────────────────────────────────────────────────────── */

import type { BrowseProvider, SearchProvider } from "./types";
import { staticBrowseProvider } from "./browse-static";
import { dbBrowseProvider, dbHasProducts } from "./browse-db";
import { serpapiSearchProvider } from "./search-serpapi";
import { pgFtsSearchProvider } from "./search-pgfts";

/* Order matters for parallel fan-out — pg-fts hits our own DB (free, fast),
   SerpAPI hits Google live ($, slower). Both run in parallel; results are
   URL-deduped at the route layer. */
const SEARCH_PROVIDERS: SearchProvider[] = [
  pgFtsSearchProvider,
  serpapiSearchProvider,
];

/* Per-process cache for the DB existence check */
let _dbProductsCache: { value: boolean; checkedAt: number } | null = null;
const DB_CHECK_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function dbHasProductsCached(): Promise<boolean> {
  const now = Date.now();
  if (_dbProductsCache && now - _dbProductsCache.checkedAt < DB_CHECK_TTL_MS) {
    return _dbProductsCache.value;
  }
  const value = await dbHasProducts();
  _dbProductsCache = { value, checkedAt: now };
  return value;
}

/**
 * Returns the highest-priority active browse provider.
 *
 * - Returns the DB provider when Supabase is configured AND products
 *   table has rows (cron has populated it at least once).
 * - Otherwise falls back to the always-available static provider.
 *
 * Async because the DB existence check is async. Cached for 5 min.
 */
export async function getActiveBrowseProvider(): Promise<BrowseProvider> {
  if (dbBrowseProvider.isActive()) {
    try {
      if (await dbHasProductsCached()) return dbBrowseProvider;
    } catch (err) {
      console.warn("[providers] DB existence check failed, falling back to static:", err);
    }
  }
  return staticBrowseProvider;
}

/**
 * Returns all currently active search providers, in registration order.
 * Empty array is valid (no live search keys configured).
 */
export function getActiveSearchProviders(): SearchProvider[] {
  return SEARCH_PROVIDERS.filter((p) => p.isActive());
}

export type { BrowseProvider, SearchProvider } from "./types";
export type { BrowseQuery, SearchQuery, OriginCounts } from "./types";
export { ProviderError } from "./types";
