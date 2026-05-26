-- ──────────────────────────────────────────────────────────────────
-- Migration 0042: browse_deals + search_deals_fts treat NULL discount
--                 as 0 for filtering and ordering.
--
-- Bug: /ng/deals doesn't show Jumia (230 products) or most Essenza
-- rows (545 of 567 products) even though both are in the catalog
-- and the stores.country tags are correct (jumia = 'NG').
--
-- Root cause: their offers carry discount_percent = NULL (the Jumia
-- SerpAPI engine doesn't return an original/MSRP, so the provider
-- intentionally writes NULL rather than fake a markdown).
--
-- The current RPC has two NULL-hostile clauses:
--
--   1. Pass C filter: `discount_percent = 0` — NULL is NOT equal to
--      0 in SQL, so all NULL-discount rows get filtered out of the
--      zero-discount fallback pool.
--
--   2. Pass A sort:   `discount_percent DESC NULLS LAST` — NULL rows
--      pile up after every numeric discount. With Pass A capped at
--      ~500 rows and ~1500+ NG-anchored rows in the pool, the NULL
--      tail never enters the response window.
--
-- Fix: COALESCE(discount_percent, 0) inside both clauses. NULL is
-- treated as "no markdown" (semantically what we mean anyway), Pass
-- C catches the rows, Pass A sorts them alongside 0% rows rather
-- than after them.
--
-- The display side already treats NULL as 0 (no "X% off" badge
-- rendered when discount is null/0), so this matches downstream
-- semantics. No app-code change required — server-side coalesce
-- and the row payload still ships with discount_percent untouched.
--
-- Idempotent — CREATE OR REPLACE on both RPCs.
-- ──────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS browse_deals(text, integer, text, text, text, text[], integer, boolean, text);
DROP FUNCTION IF EXISTS search_deals_fts(text, text, integer, text, text[], integer, text);

-- ── browse_deals: NULL-tolerant discount handling ────────────────
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
  store_logo_url    text,
  store_country     text
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
    pbo.store_logo_url,
    pbo.store_country
  FROM product_best_offers pbo
  WHERE (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
    /* NULL-tolerant zero-discount filter (was `discount_percent = 0`,
       which silently dropped Jumia + most Essenza rows). */
    AND (p_zero_discount_only = false OR COALESCE(pbo.discount_percent, 0) = 0)
    AND (p_zero_discount_only = true  OR COALESCE(p_min_discount, 0) = 0 OR COALESCE(pbo.discount_percent, 0) >= p_min_discount)
    AND (p_search IS NULL OR pbo.title ILIKE '%' || p_search || '%')
    AND (p_origin = 'all'
         OR (p_origin = 'local' AND (
              (p_country IS NOT NULL AND pbo.store_country = upper(p_country))
              OR (p_country IS NULL AND pbo.is_international = false)
            ))
         OR (p_origin = 'intl'  AND pbo.is_international = true))
    AND (p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL OR pbo.store_id = ANY(p_store_ids))
    AND (p_country IS NULL
         OR pbo.store_country = upper(p_country)
         OR (pbo.store_country IS NULL AND pbo.is_international = true))
  ORDER BY
    CASE WHEN p_country IS NOT NULL AND pbo.store_country = upper(p_country) THEN 0 ELSE 1 END,
    CASE WHEN p_zero_discount_only THEN pbo.scraped_at END DESC NULLS LAST,
    /* NULL-tolerant discount sort (NULLs sort alongside 0% rows,
       not pinned to the bottom after every numeric discount). */
    CASE WHEN p_sort = 'discount'   THEN COALESCE(pbo.discount_percent, 0) END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'     THEN pbo.scraped_at       END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc'  THEN pbo.current_price    END ASC  NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN pbo.current_price    END DESC NULLS LAST,
    COALESCE(pbo.discount_percent, 0) DESC NULLS LAST,
    pbo.offer_id ASC
  LIMIT p_max_rows;
$$;

-- ── search_deals_fts: same NULL-tolerant treatment for /compare ──
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
  store_logo_url    text,
  store_country     text
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
    pbo.store_logo_url,
    pbo.store_country
  FROM ranked_products r
  JOIN product_best_offers pbo ON pbo.product_id = r.id
  WHERE (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
    AND (COALESCE(p_min_discount, 0) = 0 OR COALESCE(pbo.discount_percent, 0) >= p_min_discount)
    AND (p_origin = 'all'
         OR (p_origin = 'local' AND (
              (p_country IS NOT NULL AND pbo.store_country = upper(p_country))
              OR (p_country IS NULL AND pbo.is_international = false)
            ))
         OR (p_origin = 'intl'  AND pbo.is_international = true))
    AND (p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL OR pbo.store_id = ANY(p_store_ids))
  ORDER BY
    CASE WHEN p_country IS NOT NULL AND pbo.store_country = upper(p_country) THEN 0 ELSE 1 END,
    r.rank DESC NULLS LAST,
    COALESCE(pbo.discount_percent, 0) DESC NULLS LAST,
    pbo.scraped_at DESC NULLS LAST,
    pbo.offer_id ASC
  LIMIT p_max_rows;
$$;

-- ── Verify after applying ─────────────────────────────────────────
-- NG local count should jump significantly (was ~1000-capped, now
-- includes all jumia/essenza NULL-discount rows):
--   SELECT count(*) FROM browse_deals(p_country := 'NG', p_origin := 'local', p_max_rows := 5000);
--
-- Jumia row count under default sort:
--   SELECT count(*) FROM browse_deals(p_country := 'NG', p_origin := 'local', p_max_rows := 5000)
--     WHERE store_id = 'jumia';
--   → expect 230 (was 0).
--
-- Zero-discount Pass C catches NULL rows:
--   SELECT store_id, count(*) FROM browse_deals(p_country := 'NG', p_origin := 'local',
--     p_zero_discount_only := true, p_max_rows := 5000) GROUP BY store_id ORDER BY 2 DESC;
--   → expect jumia 230 + konga ~30 + essenza ~545 in the list.
