-- ──────────────────────────────────────────────────────────────────
-- Migration 0032: slim RPC return types for Supabase egress relief.
--
-- Context (May 2026): Supabase egress alert at 13.81 GB / 5.5 GB
-- (251% of free-tier cap) with a 3-day deadline before read-only
-- restriction. Migration 0030+0031 normalised storeIds. Migration
-- 0032 trims the RPC response payload.
--
-- What this changes:
--   1. product_best_offers view DROPS the `source_country` column.
--      It was projected from offers.source_country (only written
--      during ingestion) but never read by any JS consumer — pure
--      egress waste of ~22 bytes/row.
--
--   2. browse_deals + search_deals_fts RPCs switch from
--      `RETURNS SETOF product_best_offers` (whole view shape) to
--      `RETURNS TABLE(...)` with an EXPLICIT slim column list. The
--      view keeps `store_country` and `is_deal` for filter pushdown
--      (`.eq("store_country", X)`, `.eq("is_deal", true)`) but those
--      columns no longer ride along in row payloads — JS layer never
--      reads them from rows, only filters by them.
--
-- Egress math (per /api/deals call, ~1500 rows across 3 passes):
--   - source_country drop:   1500 × 22 bytes  ≈ 33 KB saved
--   - store_country drop:    1500 × 21 bytes  ≈ 31 KB saved
--   - is_deal drop:          1500 × 14 bytes  ≈ 21 KB saved
--   ─────────────────────────────────────────────────────────────
--   ~85 KB saved per /api/deals response. At ~150 cold-cache calls
--   per region per day × 7 regions ≈ ~90 MB / day. Over a billing
--   month: ~2.7 GB savings — roughly half the free-tier cap.
--
-- Why RETURNS TABLE instead of dropping from view:
--   `.eq("store_country", X)` and `.eq("is_deal", true)` in
--   browse-db.ts are PostgREST .from(view).eq(col, val) — those need
--   the column to exist on the view. Dropping from view would break
--   countOriginCounts(). Keeping on view + projecting out via RPC
--   gives us the egress saving on the hot row-returning path while
--   leaving the cheap head-count filter path intact.
--
-- Safe to re-run: all DDL is CREATE OR REPLACE.
-- Order matters: drop dependent RPCs FIRST (or rely on CASCADE), then
-- recreate view, then recreate RPCs.
-- ──────────────────────────────────────────────────────────────────

-- ── Part 1: drop the RPCs so the view can be recreated ────────────
-- (CASCADE on view drop would do this too, but explicit DROP makes
-- the migration auditable and avoids accidentally killing other
-- view-dependents we don't know about.)
DROP FUNCTION IF EXISTS browse_deals(text, integer, text, text, text, text[], integer, boolean, text);
DROP FUNCTION IF EXISTS search_deals_fts(text, text, integer, text, text[], integer, text);

-- ── Part 2: recreate product_best_offers without source_country ──
-- All other columns kept identical to 0029 — only the offers-side
-- source_country projection is removed.
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

-- ── Part 3: recreate browse_deals with explicit slim return type ──
-- Excludes from row payload: is_deal, store_country, source_country.
-- Internal WHERE still uses store_country (and the view still has
-- is_deal so the filter-pushdown call sites work unchanged).
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
RETURNS TABLE (
  product_id        uuid,
  title             text,
  category_slug     text,
  brand             text,
  image_url         text,
  offer_id          uuid,
  store_id          text,
  url               text,
  current_price     numeric(12,2),
  original_price    numeric(12,2),
  discount_percent  integer,
  currency          text,
  scraped_at        timestamptz,
  store_name        text,
  is_international  boolean,
  store_logo_url    text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pbo.product_id,
    pbo.title,
    pbo.category_slug,
    pbo.brand,
    pbo.image_url,
    pbo.offer_id,
    pbo.store_id,
    pbo.url,
    pbo.current_price,
    pbo.original_price,
    pbo.discount_percent,
    pbo.currency,
    pbo.scraped_at,
    pbo.store_name,
    pbo.is_international,
    pbo.store_logo_url
  FROM product_best_offers pbo
  WHERE (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
    AND (p_zero_discount_only = false OR pbo.discount_percent = 0)
    AND (p_zero_discount_only = true  OR COALESCE(p_min_discount, 0) = 0 OR pbo.discount_percent >= p_min_discount)
    AND (p_search IS NULL OR pbo.title ILIKE '%' || p_search || '%')
    AND (p_origin = 'all'
         OR (p_origin = 'local' AND pbo.is_international = false)
         OR (p_origin = 'intl'  AND pbo.is_international = true))
    AND (p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL OR pbo.store_id = ANY(p_store_ids))
    AND (p_country IS NULL
         OR pbo.store_country = upper(p_country)
         OR (pbo.store_country IS NULL AND pbo.is_international = true))
  ORDER BY
    CASE WHEN p_country IS NOT NULL AND pbo.store_country = upper(p_country) THEN 0 ELSE 1 END,
    CASE WHEN p_zero_discount_only THEN pbo.scraped_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'discount'   THEN pbo.discount_percent END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'     THEN pbo.scraped_at       END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc'  THEN pbo.current_price    END ASC  NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN pbo.current_price    END DESC NULLS LAST,
    pbo.discount_percent DESC NULLS LAST,
    pbo.offer_id ASC
  LIMIT p_max_rows;
$$;

-- ── Part 4: recreate search_deals_fts with the same slim return ──
-- Same WHERE / ORDER BY shape as 0025; only the RETURNS clause is
-- narrowed. The internal ranked_products CTE still uses ts_rank +
-- similarity + exact-phrase + token-coverage exactly as before.
CREATE OR REPLACE FUNCTION search_deals_fts(
  q              text,
  p_category     text DEFAULT NULL,
  p_min_discount integer DEFAULT 0,
  p_origin       text DEFAULT 'all',
  p_store_ids    text[] DEFAULT NULL,
  p_max_rows     integer DEFAULT 1000,
  p_country      text DEFAULT NULL
)
RETURNS TABLE (
  product_id        uuid,
  title             text,
  category_slug     text,
  brand             text,
  image_url         text,
  offer_id          uuid,
  store_id          text,
  url               text,
  current_price     numeric(12,2),
  original_price    numeric(12,2),
  discount_percent  integer,
  currency          text,
  scraped_at        timestamptz,
  store_name        text,
  is_international  boolean,
  store_logo_url    text
)
LANGUAGE sql
STABLE
AS $$
  WITH ranked_products AS (
    SELECT
      p.id,
      (
        ts_rank(p.search_doc, websearch_to_tsquery('english', q))
        + similarity(lower(p.title), lower(q)) * 0.5
        + CASE
            WHEN lower(p.title) LIKE '%' || lower(q) || '%' THEN 2.0
            ELSE 0.0
          END
        + CASE
            WHEN array_length(
              array(
                SELECT 1
                FROM unnest(string_to_array(lower(q), ' ')) AS w
                WHERE length(w) >= 2
                  AND position(' ' || w || ' ' IN ' ' || lower(p.title) || ' ') > 0
              ),
              1
            ) = array_length(
              array(SELECT 1 FROM unnest(string_to_array(lower(q), ' ')) AS w WHERE length(w) >= 2),
              1
            )
            THEN 0.8
            ELSE 0.0
          END
      ) AS rank
    FROM products p
    WHERE
      p.search_doc @@ websearch_to_tsquery('english', q)
      OR similarity(lower(p.title), lower(q)) > 0.18
      OR lower(p.title) LIKE '%' || lower(q) || '%'
  )
  SELECT
    pbo.product_id,
    pbo.title,
    pbo.category_slug,
    pbo.brand,
    pbo.image_url,
    pbo.offer_id,
    pbo.store_id,
    pbo.url,
    pbo.current_price,
    pbo.original_price,
    pbo.discount_percent,
    pbo.currency,
    pbo.scraped_at,
    pbo.store_name,
    pbo.is_international,
    pbo.store_logo_url
  FROM ranked_products r
  JOIN product_best_offers pbo ON pbo.product_id = r.id
  WHERE (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
    AND (COALESCE(p_min_discount, 0) = 0 OR pbo.discount_percent >= p_min_discount)
    AND (p_origin = 'all'
         OR (p_origin = 'local' AND pbo.is_international = false)
         OR (p_origin = 'intl'  AND pbo.is_international = true))
    AND (p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL OR pbo.store_id = ANY(p_store_ids))
  ORDER BY
    CASE WHEN p_country IS NOT NULL AND pbo.store_country = upper(p_country) THEN 0 ELSE 1 END,
    r.rank DESC NULLS LAST,
    pbo.discount_percent DESC NULLS LAST,
    pbo.scraped_at DESC NULLS LAST,
    pbo.offer_id ASC
  LIMIT p_max_rows;
$$;

-- ── Part 5: re-create the index 0029 added (lost in CASCADE) ─────
CREATE INDEX IF NOT EXISTS idx_offers_store_is_deal
  ON offers (store_id, is_deal)
  WHERE in_stock = TRUE;

-- ── Sanity checks (run after applying) ────────────────────────────
-- 1. View still has filter columns:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'product_best_offers'
--     ORDER BY ordinal_position;
--    → expect is_deal, store_country present; source_country absent.
--
-- 2. RPC returns slim shape:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'browse_deals' AND table_schema = 'public';
--    → expect 16 columns, no is_deal / store_country / source_country.
--
-- 3. Smoke-test pages still work:
--    SELECT count(*) FROM browse_deals(p_country := 'NG', p_max_rows := 10);
--    SELECT count(*) FROM search_deals_fts('iphone', p_country := 'UK', p_max_rows := 5);
--
-- 4. Filter pushdown still works:
--    SELECT count(*) FROM product_best_offers WHERE is_deal = true;
--    SELECT count(*) FROM product_best_offers WHERE store_country = 'NG';
