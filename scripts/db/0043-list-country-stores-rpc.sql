-- ──────────────────────────────────────────────────────────────────
-- Migration 0043: list_country_stores_with_counts() RPC
--
-- Why this exists: the /api/deals "Filter by store" dropdown was
-- previously derived from the items pool (broadByOrigin), which is
-- bounded by the 3-pass fan-out's per-pass row caps. For NG that
-- meant Jumia + Essenza were missing pre-fix; for UK / US / DE / AE /
-- IN / ZA the squeeze is much worse — most non-NG countries have
-- 90-130 stores in catalog but only 14-34 showing in the dropdown
-- (cross-country audit May 2026: UK 91 missing, US 267 missing, DE
-- 128, AE 46 with Amazon + noon missing, IN 157, ZA 84 with Takealot
-- missing).
--
-- This RPC sources the dropdown INDEPENDENTLY of the items pool.
-- Single GROUP BY aggregate against product_best_offers, returns
-- every visible-to-country store with its qualifying count at the
-- user's current filter. Cheap (one query, indexed scan), accurate
-- (full catalog, no caps), supports the "show 0-count stores" UX
-- because the LEFT JOIN keeps stores even when none of their rows
-- match the filter.
--
-- "Visible to country" = store_country = country OR is_international
-- (mirrors the union of browse_deals Pass A + Pass B + Pass C).
--
-- Idempotent — CREATE OR REPLACE.
-- ──────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS list_country_stores_with_counts(text, text, integer, text);

CREATE OR REPLACE FUNCTION list_country_stores_with_counts(
  p_country      text,
  p_category     text DEFAULT NULL,
  p_min_discount integer DEFAULT 0,
  p_search       text DEFAULT NULL
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
    /* Base set: every store with at least one row in pbo that's
       visible to this country. Visible = country-anchored OR
       cross-border. Aggregate to one row per store_id, preserving
       a representative name + logo via MAX (per-store these are
       constant). */
    SELECT
      pbo.store_id,
      MAX(pbo.store_name)     AS store_name,
      MAX(pbo.store_logo_url) AS store_logo_url
    FROM product_best_offers pbo
    WHERE (
      (pbo.store_country IS NOT NULL AND pbo.store_country = upper(p_country))
      OR pbo.is_international = true
    )
    GROUP BY pbo.store_id
  ),
  qualifying_counts AS (
    /* Filtered count per store: only rows that also pass the user's
       category/discount/search filter. Stores with zero matching
       rows simply don't appear here — the LEFT JOIN below recovers
       them with count=0. */
    SELECT
      pbo.store_id,
      COUNT(*)::integer AS qualifying_count
    FROM product_best_offers pbo
    WHERE (
      (pbo.store_country IS NOT NULL AND pbo.store_country = upper(p_country))
      OR pbo.is_international = true
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
-- NG: should now include jumia + essenza + every other NG store
-- with offers, regardless of pool caps:
--   SELECT store_id, qualifying_count
--     FROM list_country_stores_with_counts('NG')
--    ORDER BY qualifying_count DESC LIMIT 50;
--
-- AE: should include Amazon (103 offers) + noon.com (64 offers)
--   SELECT store_id, qualifying_count
--     FROM list_country_stores_with_counts('AE')
--    ORDER BY qualifying_count DESC LIMIT 20;
--
-- UK with a discount filter — stores with 0 matching rows still
-- appear (count=0) so the dropdown stays the same shape regardless
-- of filter state:
--   SELECT store_id, qualifying_count
--     FROM list_country_stores_with_counts('UK', NULL, 20, NULL)
--    ORDER BY qualifying_count DESC LIMIT 20;
