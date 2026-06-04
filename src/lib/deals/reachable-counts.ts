import { getSupabaseAdmin } from "@/lib/providers/db-client";
import {
  filterDealsForCountry,
  isDealLocalToCountry,
  type Country,
} from "@/lib/country";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";

/* ── Reachable counts (egress-frugal, accurate) ───────────────────────
   Why this exists (June 2026 count audit): the homepage category tiles +
   the /deals origin pills were derived from the capped 3-pass display
   pool, which TRUNCATES cross-border-heavy categories — fashion is
   ~2.1-2.9k reachable per market but the pool's cross-border slice caps
   at 1000, so ZA showed 249 fashion vs 2,157 real, US 689 vs 2,371,
   UNEVENLY (NG/UK fashion arrives via the local passes so they looked
   "full"). The old /api/category-counts also paid for this by running
   the FULL 3-pass fetchDeals ONCE PER CATEGORY (~25k rows/country/render)
   just to read a number off the end.

   This computes the TRUE reachable count from ONE slim projection of the
   in-stock view (store + category + discount only — no titles/images/
   urls), cached module-level and shared across every country + both
   endpoints. ~9.7k rows × ~7 tiny cols ≈ 150 KB gzipped per 5-min window
   per instance, vs the per-category pool loop it replaces — a large NET
   egress REDUCTION while making the number exact. Counting is cheap;
   only RENDERING cards needs the heavy pool, and that stays capped.

   Per-instance cache (same caveat as POOL_CACHE / intlPoolCache); the
   KV/Upstash upgrade (tech-debt #4) makes it cross-instance. */

interface SlimOffer {
  store_id:         string;
  store_name:       string;
  store_country:    string | null;
  currency:         string;
  category_slug:    string | null;
  discount_percent: number | null;
  is_international:  boolean;
}

const SLIM_COLS =
  "store_id,store_name,store_country,currency,category_slug,discount_percent,is_international";
const SLIM_TTL_MS = 5 * 60 * 1000;
const SLIM_PAGE = 1000;
const SLIM_MAX_PAGES = 16; // hard ceiling (~16k rows) so a runaway never loops forever

let slimCache: { rows: SlimOffer[]; expires: number } | null = null;
let slimInFlight: Promise<SlimOffer[]> | null = null;

type Supa = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function loadSlimOffers(supa: Supa): Promise<SlimOffer[]> {
  const now = Date.now();
  if (slimCache && slimCache.expires > now) return slimCache.rows;
  /* Coalesce concurrent callers (homepage render + /deals + per-tile
     client fetches all land at once) onto ONE fetch wave. */
  if (slimInFlight) return slimInFlight;
  slimInFlight = (async () => {
    try {
      /* One cheap head count to size the fan-out, then fetch every page
         in PARALLEL — keeps the cold-cache wave at ~2 round-trips instead
         of ~10 sequential. The count is rows-free (head: true). */
      const { count } = await supa
        .from("product_best_offers")
        .select("*", { count: "exact", head: true });
      const pages = Math.min(
        Math.max(1, Math.ceil((count ?? 0) / SLIM_PAGE)),
        SLIM_MAX_PAGES,
      );
      const results = await Promise.all(
        Array.from({ length: pages }, (_, i) =>
          supa
            .from("product_best_offers")
            .select(SLIM_COLS)
            .range(i * SLIM_PAGE, (i + 1) * SLIM_PAGE - 1),
        ),
      );
      const rows: SlimOffer[] = [];
      for (const r of results) {
        if (!r.error && Array.isArray(r.data)) rows.push(...(r.data as unknown as SlimOffer[]));
      }
      if (rows.length > 0) {
        slimCache = { rows, expires: Date.now() + SLIM_TTL_MS };
        return rows;
      }
      /* Fetch failed/empty — serve last-good if we have it rather than
         zeroing every count (mirrors the pool caches' stale-on-error). */
      return slimCache?.rows ?? [];
    } finally {
      slimInFlight = null;
    }
  })();
  return slimInFlight;
}

/* Map the slim row to the DealLike shape filterDealsForCountry expects,
   carrying category + discount through for the bucketing/counting below.
   tags mirror what ingest writes ([store, intl|local]) so the function's
   tag-path behaves identically to the live pool. */
function toDeal(r: SlimOffer) {
  return {
    storeId:         r.store_id,
    storeName:       r.store_name,
    storeCountry:    r.store_country,
    currency:        r.currency,
    tags:            [r.store_name, r.is_international ? "intl" : "local"],
    categorySlug:    r.category_slug ?? "all",
    discountPercent: r.discount_percent ?? 0,
  };
}

/* Curated Amazon entries are SYNTHETIC (not in product_best_offers) but
   the /deals grid merges them in (getCuratedDeals + the route's
   filterDealsForCountry), so the count must include them too or the pill
   would read a few under the grid for Amazon-touched categories. Projected
   once to the same countable shape. */
const CURATED_COUNTABLE = curatedAmazonDeals.map((d) => ({
  storeId:         d.storeId,
  storeName:       d.storeName,
  storeCountry:    d.storeCountry ?? null,
  currency:        d.currency,
  tags:            d.tags ?? [],
  categorySlug:    d.categorySlug ?? "all",
  discountPercent: d.discountPercent ?? 0,
}));

async function reachableDeals(country: Country): Promise<ReturnType<typeof toDeal>[]> {
  const supa = getSupabaseAdmin();
  const live = supa ? (await loadSlimOffers(supa)).map(toDeal) : [];
  return filterDealsForCountry([...live, ...CURATED_COUNTABLE], country);
}

/* Accurate per-category reachable count for the homepage tiles. */
export async function getReachableCategoryCounts(
  country: Country,
): Promise<Record<string, number>> {
  const reachable = await reachableDeals(country);
  const counts: Record<string, number> = {};
  for (const d of reachable) {
    const k = d.categorySlug;
    if (!k || k === "all") continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export interface ReachableOriginCounts {
  all: number;        local: number;        intl: number;
  allDeals: number;   localDeals: number;   intlDeals: number;
}

/* Accurate {all, local, intl} (+ discounted-only variants) for the
   /deals origin pills, optionally scoped to one category and a minimum
   discount tier (mirrors the route's qualifyingCountryFiltered). Uses the
   SAME isDealLocalToCountry the /deals grid buckets with, so pill == tile
   and neither can contradict the other. */
export async function getReachableOriginCounts(
  country: Country,
  categorySlug?: string,
  minDiscount = 0,
): Promise<ReachableOriginCounts> {
  let deals = await reachableDeals(country);
  if (categorySlug && categorySlug !== "all") {
    deals = deals.filter((d) => d.categorySlug === categorySlug);
  }
  /* Tier floor: the pills count the qualifying pool, exactly like the
     route narrows broadCountryFiltered by userMinDiscount. */
  if (minDiscount > 0) {
    deals = deals.filter((d) => d.discountPercent >= minDiscount);
  }
  const local = deals.filter((d) => isDealLocalToCountry(d, country));
  const intl  = deals.filter((d) => !isDealLocalToCountry(d, country));
  const disc  = (a: ReturnType<typeof toDeal>[]) => a.filter((d) => d.discountPercent > 0).length;
  return {
    all:        deals.length,
    local:      local.length,
    intl:       intl.length,
    allDeals:   disc(deals),
    localDeals: disc(local),
    intlDeals:  disc(intl),
  };
}
