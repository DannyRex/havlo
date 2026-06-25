import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { type Country } from "@/lib/country";

/* Reads the precomputed `category_reach_counts` table (migration 0071,
   refreshed by the compute-category-counts cron). This is the request-time
   half of the June-2026 counts fix: a CHEAP indexed SELECT of ~11 tiny rows
   per country — NOT a scan of the product_best_offers view (that scan, run
   per request, caused the connection-pool incident).

   Safe-by-fallback: every accessor returns null when the table is missing
   (pre-migration), empty (cron hasn't run yet), or STALE (cron stalled), so
   callers fall back to the live pool-derived counts. That means this can ship
   before the migration + cron exist, with zero behaviour change until they do. */

const STALE_MS = 48 * 60 * 60 * 1000;  // older than this → treat as unavailable, fall back to live
                                       // (cron runs daily; 48h tolerates one missed run)
const CACHE_TTL_MS = 5 * 60 * 1000;    // the table changes once per ingest cycle; don't re-read it every request

interface CountRow {
  category_slug: string;
  all_count: number;
  local_count: number;
  intl_count: number;
  all_deals: number;
  local_deals: number;
  intl_deals: number;
  updated_at: string;
}

const cache = new Map<string, { rows: CountRow[]; expires: number }>();

async function loadCountryRows(country: Country): Promise<CountRow[] | null> {
  const cc = country.code;
  const now = Date.now();
  const cached = cache.get(cc);
  if (cached && cached.expires > now) return cached.rows;

  const supa = getSupabaseAdmin();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from("category_reach_counts")
      .select("category_slug,all_count,local_count,intl_count,all_deals,local_deals,intl_deals,updated_at")
      .eq("country", cc);
    /* error = table doesn't exist yet (pre-migration) → fall back. */
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const rows = data as unknown as CountRow[];
    const newest = Math.max(...rows.map((r) => Date.parse(r.updated_at)));
    if (!Number.isFinite(newest) || now - newest > STALE_MS) return null;  // stalled cron → fall back
    cache.set(cc, { rows, expires: now + CACHE_TTL_MS });
    return rows;
  } catch {
    return null;
  }
}

/* Per-category tile counts (all-origins). null → caller uses live counts. */
export async function getPrecomputedCategoryCounts(
  country: Country,
): Promise<Record<string, number> | null> {
  const rows = await loadCountryRows(country);
  if (!rows) return null;
  const out: Record<string, number> = {};
  for (const r of rows) {
    /* all_DEALS (discount > 0), not all_count: the homepage "Deals by
       category" tile must show the number you actually see when you click
       it, and the deals page now leads with deals (DEFAULT_TIER "1" =
       discount > 0). all_count would over-promise the full catalogue. */
    if (r.category_slug !== "all") out[r.category_slug] = r.all_deals;
  }
  return out;
}

export interface PrecomputedOriginCounts {
  all: number;        local: number;        intl: number;
  allDeals: number;   localDeals: number;   intlDeals: number;
}

/* Origin pills for the /deals tab, scoped to a category (or the 'all'
   aggregate). null → caller uses live counts. */
export async function getPrecomputedOriginCounts(
  country: Country,
  categorySlug?: string,
): Promise<PrecomputedOriginCounts | null> {
  const rows = await loadCountryRows(country);
  if (!rows) return null;
  const slug = categorySlug && categorySlug !== "all" ? categorySlug : "all";
  const r = rows.find((x) => x.category_slug === slug);
  if (!r) return null;
  return {
    all: r.all_count,   local: r.local_count,   intl: r.intl_count,
    allDeals: r.all_deals, localDeals: r.local_deals, intlDeals: r.intl_deals,
  };
}

/* ── Per-store dropdown counts (migration 0089) ──────────────────────────
   The /deals "Stores" filter reads these so each chip equals the store's true
   reachable catalogue count (the SAME basis as the category tiles above),
   instead of the broad-pool slice that drifted from the click result (and the
   tier-dependent slice that produced "1 in All, 4 in Deals" for tiny stores).
   Keyed (country, category_slug, store_key); the route picks all_count or
   deals_count by the active tier. Same safe-by-fallback contract: null → the
   caller keeps its live pool aggregate. */
export interface PrecomputedStoreCount {
  store_key:   string;
  store_name:  string;
  is_local:    boolean;
  all_count:   number;
  deals_count: number;
}

interface StoreRow extends PrecomputedStoreCount {
  category_slug: string;
  updated_at:    string;
}

const storeCache = new Map<string, { rows: StoreRow[]; expires: number }>();

async function loadStoreRows(country: Country): Promise<StoreRow[] | null> {
  const cc = country.code;
  const now = Date.now();
  const cached = storeCache.get(cc);
  if (cached && cached.expires > now) return cached.rows;
  const supa = getSupabaseAdmin();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from("store_filter_counts")
      .select("category_slug,store_key,store_name,is_local,all_count,deals_count,updated_at")
      .eq("country", cc);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const rows = data as unknown as StoreRow[];
    const newest = Math.max(...rows.map((r) => Date.parse(r.updated_at)));
    if (!Number.isFinite(newest) || now - newest > STALE_MS) return null;
    storeCache.set(cc, { rows, expires: now + CACHE_TTL_MS });
    return rows;
  } catch {
    return null;
  }
}

/* Precomputed dropdown store rows for a (country, category) view. null → the
   caller falls back to its live pool aggregate (search / unsupported tier /
   table missing / cron stalled). */
export async function getPrecomputedStoreCounts(
  country: Country,
  categorySlug?: string,
): Promise<PrecomputedStoreCount[] | null> {
  const rows = await loadStoreRows(country);
  if (!rows) return null;
  const slug = categorySlug && categorySlug !== "all" ? categorySlug : "all";
  const out = rows.filter((r) => r.category_slug === slug);
  return out.length ? out : null;
}
