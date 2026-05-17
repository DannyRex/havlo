-- ──────────────────────────────────────────────────────────────────
-- RESTORE browse_deals RPC + add is_deal column
--
-- Why this exists: migration 0028-offers-is-deal.sql ran
--   DROP VIEW IF EXISTS product_best_offers CASCADE;
-- which dropped the browse_deals RPC that depended on the view.
-- The view was recreated (with is_deal added) but the RPC wasn't —
-- so /api/deals returned 0 items from the merged pool even though
-- the head-count queries (which read the view directly) kept working.
--
-- User report May 2026 v3: "/deals page is showing No deals match
-- those filters for local and intl". originCounts showed real
-- numbers but the items array was empty.
--
-- This migration:
--   1. Confirms is_deal column exists on offers (idempotent)
--   2. Recreates product_best_offers WITH is_deal exposed
--   3. Recreates browse_deals RPC (latest country-aware variant)
--   4. Re-adds the index on (store_id, is_deal)
--
-- Safe to re-run. All steps use CREATE OR REPLACE / IF NOT EXISTS.
-- ──────────────────────────────────────────────────────────────────

-- ── Part 1: ensure is_deal column exists ──────────────────────────
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS is_deal BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill any rows missed (idempotent — rows already set to FALSE
-- stay FALSE; rows with discount_percent > 0 stay TRUE).
UPDATE offers
   SET is_deal = FALSE
 WHERE is_deal = TRUE
   AND COALESCE(discount_percent, 0) <= 0;

-- Index for pill-count queries (idempotent).
CREATE INDEX IF NOT EXISTS idx_offers_store_is_deal
  ON offers (store_id, is_deal)
  WHERE in_stock = TRUE;

-- ── Part 2: recreate product_best_offers with is_deal ─────────────
-- Uses lateral join shape from migration 0022 (cheaper price per
-- product) + adds is_deal alongside store_country.
DROP VIEW IF EXISTS product_best_offers CASCADE;
CREATE VIEW product_best_offers AS
SELECT
  p.id                   AS product_id,
  p.title,
  p.category_slug,
  p.brand,
  p.image_url,
  o.id                   AS offer_id,
  o.store_id,
  o.url,
  o.current_price,
  o.original_price,
  o.discount_percent,
  o.currency,
  o.is_deal,
  o.scraped_at,
  o.source_country,
  s.name                 AS store_name,
  s.is_international,
  s.logo_url             AS store_logo_url,
  s.country              AS store_country
FROM products p
JOIN LATERAL (
  SELECT * FROM offers
   WHERE offers.product_id = p.id
     AND offers.in_stock = TRUE
   ORDER BY offers.current_price ASC
   LIMIT 1
) o ON TRUE
JOIN stores s ON s.id = o.store_id;

-- ── Part 3: recreate browse_deals RPC ─────────────────────────────
-- Same shape as migration 0022 (country-aware). The CASCADE in
-- migration 0028 dropped this; restoring identical signature so
-- the JS-side rpc() calls in browse-db.ts don't need a change.
CREATE OR REPLACE FUNCTION browse_deals(
  p_category     text DEFAULT NULL,
  p_min_discount integer DEFAULT 0,
  p_sort         text DEFAULT 'discount',
  p_search       text DEFAULT NULL,
  p_origin       text DEFAULT 'all',
  p_store_ids    text[] DEFAULT NULL,
  p_max_rows     integer DEFAULT 6000,
  p_zero_discount_only boolean DEFAULT false,
  p_country      text DEFAULT NULL
)
RETURNS SETOF product_best_offers
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM product_best_offers
  WHERE (p_category IS NULL OR p_category = 'all' OR category_slug = p_category)
    AND (p_zero_discount_only = false OR discount_percent = 0)
    AND (p_zero_discount_only = true  OR COALESCE(p_min_discount, 0) = 0 OR discount_percent >= p_min_discount)
    AND (p_search IS NULL OR title ILIKE '%' || p_search || '%')
    AND (p_origin = 'all'
         OR (p_origin = 'local' AND is_international = false)
         OR (p_origin = 'intl'  AND is_international = true))
    AND (p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL OR store_id = ANY(p_store_ids))
    AND (p_country IS NULL
         OR store_country = upper(p_country)
         OR (store_country IS NULL AND is_international = true))
  ORDER BY
    /* Country prioritisation — anchored-local rows first when
       p_country is set so they always survive the limit cap. */
    CASE WHEN p_country IS NOT NULL AND store_country = upper(p_country) THEN 0 ELSE 1 END,
    CASE WHEN p_zero_discount_only THEN scraped_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'discount'   THEN discount_percent END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'     THEN scraped_at       END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc'  THEN current_price    END ASC  NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN current_price    END DESC NULLS LAST,
    discount_percent DESC NULLS LAST,
    offer_id ASC
  LIMIT p_max_rows;
$$;

-- ── Sanity checks (run after applying) ────────────────────────────
-- SELECT count(*) FROM browse_deals(p_country := 'NG', p_max_rows := 10);
--   → expect > 0 (NG anchored + globals)
-- SELECT count(*) FROM browse_deals(p_country := 'UK', p_max_rows := 10);
--   → expect > 0 (UK anchored + globals)
-- SELECT is_deal, count(*) FROM offers WHERE in_stock = TRUE GROUP BY is_deal;
--   → expect both TRUE and FALSE rows
