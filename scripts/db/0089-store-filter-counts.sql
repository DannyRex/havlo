-- 0089: precomputed per-store filter counts for the /deals store dropdown
-- ---------------------------------------------------------------------------
-- WHY: the Stores dropdown on /deals needs each store's TRUE reachable count
-- per (country, category, tier) so the chip number matches what the grid
-- shows when you tick that store. Computing it live can't match cheaply: the
-- grid's browse_deals path de-duplicates variants (ASOS 2,648 in-stock
-- product_ids collapse to ~1,325 distinct), while a request-time GROUP BY on
-- product_best_offers either over- or under-counts depending on the basis, and
-- the broad capped pool gives only a tier-dependent slice (the "1 in All, 4 in
-- Deals" contradiction). So we precompute it OFFLINE on the same cadence as
-- category_reach_counts (0071) and read a tiny table at request time.
--
-- WHO WRITES IT: the compute-category-counts GitHub Action (service role),
-- once per ingest cycle, via scripts/compute-store-counts.ts. ONE gentle
-- sequential scan of product_best_offers, off the request path.
--
-- WHO READS IT: /api/deals builds the Stores dropdown from this table for the
-- default + per-category browse views. Search / 20%+ / 50% tiers keep using
-- the live pool slice. Safe-by-fallback: when a row is missing/stale the code
-- degrades to today's pool-derived counts, so this deploys safely BEFORE the
-- table is populated or this migration is applied.
--
-- category_slug = 'all' is the all-categories aggregate (default /deals view);
-- every other slug is a single category. all_count = the tier-0 (all products)
-- reachable count; deals_count = the is_real_deal subset (matching the "Deals"
-- tier + the homepage tiles). is_local marks the store as country-local vs
-- cross-border so the dropdown's Local/Cross-border tabs filter correctly.

CREATE TABLE IF NOT EXISTS store_filter_counts (
  country        text        NOT NULL,   -- lowercase ISO (ng, uk, us, in, za, ae)
  category_slug  text        NOT NULL,   -- category slug, or 'all' for the aggregate
  store_key      text        NOT NULL,   -- canonical store key = lower(displayStoreName)
  store_name     text        NOT NULL,   -- display name (one per canonical key)
  is_local       boolean     NOT NULL DEFAULT false,
  all_count      integer     NOT NULL DEFAULT 0,
  deals_count    integer     NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country, category_slug, store_key)
);

-- Per-(country, category) read is the hot path; index it for the dropdown.
CREATE INDEX IF NOT EXISTS idx_store_filter_counts_country_cat
  ON store_filter_counts (country, category_slug);

-- Mirror the RLS posture of the other precomputed tables (0085): RLS on, no
-- anon policy. The app reads it via the service role (getSupabaseAdmin) only.
ALTER TABLE store_filter_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON store_filter_counts FROM anon, authenticated;
