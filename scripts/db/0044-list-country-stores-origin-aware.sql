-- ──────────────────────────────────────────────────────────────────
-- Migration 0044: list_country_stores_with_counts — origin-aware filter
--
-- Background: migration 0043 introduced the RPC but it always returned
-- the union of country-anchored + cross-border stores. That meant the
-- "Local stores" tab on /[country]/deals showed every cross-border
-- store too (AliExpress, ASOS, DHgate, etc.) — and picking one of
-- those from the dropdown produced zero results because the items
-- grid's local filter excludes is_international=true rows. Dead-end
-- UX.
--
-- Fix: accept p_origin = 'all' | 'local' | 'intl' and apply it to
-- BOTH the visible_stores base set AND the qualifying_counts filter.
--
--   p_origin = 'all'   → country-anchored OR cross-border (current)
--   p_origin = 'local' → country-anchored only (store_country = country)
--   p_origin = 'intl'  → cross-border only (is_international = true)
--
-- Idempotent — CREATE OR REPLACE. p_origin defaults to 'all' so
-- pre-update callers still work.
-- ──────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS list_country_stores_with_counts(text, text, integer, text);
DROP FUNCTION IF EXISTS list_country_stores_with_counts(text, text, integer, text, text);

CREATE OR REPLACE FUNCTION list_country_stores_with_counts(
  p_country      text,
  p_category     text DEFAULT NULL,
  p_min_discount integer DEFAULT 0,
  p_search       text DEFAULT NULL,
  p_origin       text DEFAULT 'all'
)
RETURNS TABLE (
  store_id          text,
  store_name        text,
  store_logo_url    text,
  qualifying_count  integer
)
LANGUAGE sql
STABLE
AS $$
  WITH visible_stores AS (
    /* Origin-aware base set:
         'all'   → country-anchored OR cross-border
         'local' → country-anchored only
         'intl'  → cross-border only
       The dropdown becomes a coherent slice of the current tab. */
    SELECT
      pbo.store_id,
      MAX(pbo.store_name)     AS store_name,
      MAX(pbo.store_logo_url) AS store_logo_url
    FROM product_best_offers pbo
    WHERE (
      (p_origin = 'all' AND (
        (pbo.store_country IS NOT NULL AND pbo.store_country = upper(p_country))
        OR pbo.is_international = true
      ))
      OR (p_origin = 'local' AND
        pbo.store_country IS NOT NULL AND pbo.store_country = upper(p_country)
      )
      OR (p_origin = 'intl' AND
        pbo.is_international = true
      )
    )
    GROUP BY pbo.store_id
  ),
  qualifying_counts AS (
    /* Same origin gate applied to the qualifying-count filter so the
       counts reflect what the items grid would show for that store
       in the user's current tab + filters. */
    SELECT
      pbo.store_id,
      COUNT(*)::integer AS qualifying_count
    FROM product_best_offers pbo
    WHERE (
      (p_origin = 'all' AND (
        (pbo.store_country IS NOT NULL AND pbo.store_country = upper(p_country))
        OR pbo.is_international = true
      ))
      OR (p_origin = 'local' AND
        pbo.store_country IS NOT NULL AND pbo.store_country = upper(p_country)
      )
      OR (p_origin = 'intl' AND
        pbo.is_international = true
      )
    )
      AND (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
      AND (COALESCE(p_min_discount, 0) = 0 OR COALESCE(pbo.discount_percent, 0) >= p_min_discount)
      AND (p_search IS NULL OR pbo.title ILIKE '%' || p_search || '%')
    GROUP BY pbo.store_id
  )
  SELECT
    v.store_id,
    v.store_name,
    v.store_logo_url,
    COALESCE(q.qualifying_count, 0) AS qualifying_count
  FROM visible_stores v
  LEFT JOIN qualifying_counts q ON q.store_id = v.store_id
  ORDER BY
    COALESCE(q.qualifying_count, 0) DESC,
    v.store_name ASC;
$$;

-- ── Verify after applying ─────────────────────────────────────────
-- NG Local should only return country-anchored NG stores (Konga,
-- Jumia, Essenza, etc.) and NOT cross-border (AliExpress, ASOS):
--   SELECT store_id FROM list_country_stores_with_counts('NG', NULL, 0, NULL, 'local')
--    ORDER BY qualifying_count DESC LIMIT 20;
--
-- NG Cross-border should EXCLUDE NG-anchored stores:
--   SELECT store_id FROM list_country_stores_with_counts('NG', NULL, 0, NULL, 'intl')
--    ORDER BY qualifying_count DESC LIMIT 20;
--
-- NG All keeps current union behaviour:
--   SELECT count(*) FROM list_country_stores_with_counts('NG', NULL, 0, NULL, 'all');
