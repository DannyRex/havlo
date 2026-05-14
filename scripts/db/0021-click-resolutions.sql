-- /api/go click telemetry.
--
-- Every redirect through /api/go writes one row here so we can answer
-- "which fallback step fired? what storeId was passed? what URL did
-- the user end up at?" without re-running the request or guessing
-- from screenshots.
--
-- Fire-and-forget from the route handler — never blocks the redirect.
-- Auto-pruned after 30 days by a cron job below so the table stays
-- small (~50k rows steady-state at current click volume).

CREATE TABLE IF NOT EXISTS click_resolutions (
  id              BIGSERIAL PRIMARY KEY,

  -- Inputs (what the route received)
  offer_id        TEXT,                       -- nullable: not always passed
  store_id        TEXT,
  store_name      TEXT,
  title_hint      TEXT,
  original_url    TEXT        NOT NULL,
  country         TEXT,                       -- ISO 3166-1 alpha-2, lowercase

  -- Outputs (what the route decided)
  resolved_url    TEXT        NOT NULL,
  resolution_step TEXT        NOT NULL,
  -- 'passthrough'           direct merchant URL, no resolution needed
  -- 'cache_hit'             previously resolved Google relay served from cache
  -- 'serpapi_resolved'      Google relay resolved live via SerpAPI
  -- 'merchant_search'       fell back to curated merchant search URL
  -- 'smart_fallback'        fell back to guessed brand domain
  -- 'merchant_homepage'     fell back to curated homepage
  -- 'havlo_compare'         fell back to /compare with title
  -- 'havlo_deals'           absolute last resort
  -- 'missing_url'           url param was empty, redirected home

  -- Side-channel diagnostics
  serpapi_attempted BOOLEAN   NOT NULL DEFAULT FALSE,
  serpapi_resolved  BOOLEAN   NOT NULL DEFAULT FALSE,
  user_agent        TEXT,
  referer           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Useful access patterns
CREATE INDEX IF NOT EXISTS click_resolutions_created_at_idx
  ON click_resolutions (created_at DESC);
CREATE INDEX IF NOT EXISTS click_resolutions_store_id_idx
  ON click_resolutions (store_id)
  WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS click_resolutions_step_idx
  ON click_resolutions (resolution_step, created_at DESC);
CREATE INDEX IF NOT EXISTS click_resolutions_offer_id_idx
  ON click_resolutions (offer_id, created_at DESC)
  WHERE offer_id IS NOT NULL;

-- 30-day TTL. Run as a daily cron (pg_cron or external trigger).
-- Keeps the table small and the index fast.
CREATE OR REPLACE FUNCTION prune_click_resolutions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM click_resolutions
   WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Convenience view: most recent 100 clicks per store, with the step
-- that fired. Use this to spot stores where the resolver is misbehaving.
--   SELECT * FROM click_resolutions_recent_by_store WHERE store_id = 'currys';
CREATE OR REPLACE VIEW click_resolutions_recent_by_store AS
SELECT
  store_id,
  store_name,
  COUNT(*)                                       AS total_clicks,
  COUNT(*) FILTER (WHERE resolution_step = 'passthrough')        AS passthrough,
  COUNT(*) FILTER (WHERE resolution_step = 'cache_hit')          AS cache_hit,
  COUNT(*) FILTER (WHERE resolution_step = 'serpapi_resolved')   AS serpapi_resolved,
  COUNT(*) FILTER (WHERE resolution_step = 'merchant_search')    AS merchant_search,
  COUNT(*) FILTER (WHERE resolution_step = 'smart_fallback')     AS smart_fallback,
  COUNT(*) FILTER (WHERE resolution_step = 'merchant_homepage')  AS merchant_homepage,
  COUNT(*) FILTER (WHERE resolution_step = 'havlo_compare')      AS havlo_compare,
  COUNT(*) FILTER (WHERE resolution_step = 'havlo_deals')        AS havlo_deals,
  MAX(created_at)                                AS last_click_at
FROM click_resolutions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY store_id, store_name
ORDER BY total_clicks DESC;

COMMENT ON TABLE click_resolutions IS
  'Per-click telemetry from /api/go. Use to debug wrong outbound destinations. 30-day TTL.';
COMMENT ON COLUMN click_resolutions.resolution_step IS
  'Which fallback branch served the redirect. Lower-numbered branches are higher confidence.';
