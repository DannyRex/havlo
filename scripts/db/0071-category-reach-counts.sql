-- 0071: precomputed category reachability counts
-- ---------------------------------------------------------------------------
-- WHY: the homepage category tiles + the /deals origin pills need the TRUE
-- per-country reachable deal count. Computing that live means running
-- filterDealsForCountry over the whole in-stock catalogue, which at request
-- time meant scanning the entire product_best_offers LATERAL view on every
-- (cold) request — that overloaded Supabase's connection pool in production
-- (June 2026 incident). Counting is cheap to do OFFLINE but expensive to do
-- per-request, so we precompute it on a schedule and read a tiny table here.
--
-- WHO WRITES IT: the `compute-category-counts` GitHub Action (service role),
-- once per ingest cycle. It does ONE gentle sequential scan, off the request
-- path, and UPSERTs ~ (6 countries x ~11 rows) = ~66 rows.
--
-- WHO READS IT: /api/category-counts (tiles) and /api/deals browse pills.
-- Both fall back to the live pool-derived counts when a row is missing/stale,
-- so this is safe to deploy BEFORE the table is populated (or before this
-- migration is applied): the code degrades to today's behaviour.
--
-- `category_slug = 'all'` is the all-categories aggregate (the default /deals
-- view); every other slug is a single category (the tiles + filtered view).
-- Counts are for the tier-0 (no min-discount) view; *_deals are the
-- discount>0 subset. Tier-filtered / search views keep using live counts.

CREATE TABLE IF NOT EXISTS category_reach_counts (
  country        text        NOT NULL,   -- lowercase ISO (ng, uk, us, in, za, ae)
  category_slug  text        NOT NULL,   -- category slug, or 'all' for the aggregate
  all_count      integer     NOT NULL DEFAULT 0,
  local_count    integer     NOT NULL DEFAULT 0,
  intl_count     integer     NOT NULL DEFAULT 0,
  all_deals      integer     NOT NULL DEFAULT 0,
  local_deals    integer     NOT NULL DEFAULT 0,
  intl_deals     integer     NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country, category_slug)
);

-- The endpoints reject rows older than a staleness window in code (so a
-- stalled cron falls back to live counts rather than serving week-old
-- numbers); this index keeps the freshness check + the per-country read fast.
CREATE INDEX IF NOT EXISTS idx_category_reach_counts_country
  ON category_reach_counts (country);
