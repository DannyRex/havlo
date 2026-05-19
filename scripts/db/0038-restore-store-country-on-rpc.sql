-- ──────────────────────────────────────────────────────────────────
-- Migration 0038: restore store_country on browse_deals + search_deals_fts
--
-- Context: migration 0032 trimmed store_country from the RPC return
-- types as a Supabase egress optimization (store_country was used
-- only for filter pushdown, never read from row payloads in JS).
-- That was correct AT THAT TIME because the JS layer's local/intl
-- bucketing relied on a hardcoded JS roster (COUNTRY_STORES) for
-- store-to-country resolution.
--
-- May 2026 launch-readiness re-audit caught the downstream consequence:
-- after migration 0037 backfilled 94 stores with country=ZA (most
-- NOT in the JS COUNTRY_STORES.za roster — they came from SerpAPI's
-- country-specific ingest), isLocalToUser in /api/deals couldn't see
-- them. The DB knew they were ZA-anchored, the JS code didn't.
-- Result: /za/deals?origin=local showed 4 items even though the
-- localDeals head count was 159.
--
-- This migration adds store_country back to both RPC return shapes
-- so the JS isLocalToUser can use it as a primary signal (with the
-- JS roster as a fallback for older rows where store_country is NULL).
--
-- Egress impact: ~6 bytes/row × 500 rows × ~150 hot API calls/day
-- ≈ 13.5 MB/day, ~400 MB/month — well under the freed headroom from
-- migration 0032's other column trims.
--
-- Idempotent — CREATE OR REPLACE.
-- ──────────────────────────────────────────────────────────────────

-- ── Drop existing RPCs so the RETURNS TABLE signature can change ──
DROP FUNCTION IF EXISTS browse_deals(text, integer, text, text, text, text[], integer, boolean, text);
DROP FUNCTION IF EXISTS search_deals_fts(text, text, integer, text, text[], integer, text);

-- ── browse_deals with store_country re-added ──────────────────────
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
  store_country     text     -- ← RE-ADDED for client-side local-tab bucketing
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

-- ── search_deals_fts with store_country re-added ──────────────────
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

-- ── Sanity check ──────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'browse_deals'
--  ORDER BY ordinal_position;
-- → expect 17 columns ending with store_country.
