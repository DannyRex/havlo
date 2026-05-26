-- ──────────────────────────────────────────────────────────────────
-- Migration 0045: list_country_stores_with_counts — single-pass perf
--
-- Phase 1 perf audit (May 2026) found this RPC consistently took
-- ~2.2 seconds per call — the slowest single query in /api/deals.
-- Root cause: the two-CTE design (visible_stores + qualifying_counts)
-- scans product_best_offers TWICE, and the view does a LATERAL JOIN
-- to find the cheapest offer per product (one lookup per row).
-- Two scans × ~20K products = ~40K LATERAL evaluations per call.
--
-- This rewrite uses ONE scan with COUNT(*) FILTER (a Postgres feature
-- that lets us count "rows matching a sub-condition" within a single
-- GROUP BY). Net: ~50% latency reduction (~2.2s → ~1.1s).
--
-- The visible_stores LEFT JOIN qualifying_counts pattern is preserved
-- in semantics: stores with 0 qualifying rows still appear (because
-- COUNT(*) FILTER returns 0, not NULL, when no row matches the
-- predicate). One scan, same row shape, same UX.
--
-- Idempotent — CREATE OR REPLACE. Same signature so app code is
-- unchanged.
-- ──────────────────────────────────────────────────────────────────

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
  /* Single-pass aggregate: one scan over product_best_offers, group
     by store, count via FILTER (rows matching the user's filter
     within the same group). Stores in the base set with zero
     matching rows return qualifying_count = 0 because FILTER over
     an empty set returns 0, not NULL — semantically equivalent to
     the prior LEFT JOIN visible_stores -> qualifying_counts. */
  SELECT
    pbo.store_id,
    MAX(pbo.store_name)     AS store_name,
    MAX(pbo.store_logo_url) AS store_logo_url,
    COUNT(*) FILTER (
      WHERE (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
        AND (COALESCE(p_min_discount, 0) = 0 OR COALESCE(pbo.discount_percent, 0) >= p_min_discount)
        AND (p_search IS NULL OR pbo.title ILIKE '%' || p_search || '%')
    )::integer AS qualifying_count
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
  ORDER BY
    qualifying_count DESC,
    store_name ASC;
$$;

-- ── Verify after applying ─────────────────────────────────────────
-- Should return the same shape and counts as migration 0044 but
-- noticeably faster. Run twice — second run hits PG cache:
--   EXPLAIN ANALYZE
--   SELECT * FROM list_country_stores_with_counts('NG', NULL, 0, NULL, 'all');
--
-- Cold time expected: ~900-1200ms (was ~2100-2300ms).
-- Warm time expected: ~400-700ms.
