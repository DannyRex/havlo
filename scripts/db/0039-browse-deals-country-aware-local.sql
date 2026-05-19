-- ──────────────────────────────────────────────────────────────────
-- Migration 0039: browse_deals + search_deals_fts country-aware local filter
--
-- Context: re-audit caught /za/deals showing 4 items despite 159
-- ZA-anchored offers in the view. Root cause is architectural:
--
--   The RPC's p_origin='local' clause uses is_international=false
--   as the local-pool filter. is_international is currency-based at
--   ingest (true ↔ USD, false ↔ NGN), which works for NG (NGN-priced
--   = local) but breaks for every other market: ZA / UK / DE / AE
--   stores all have USD-stamped prices (SerpAPI normalises to USD
--   at ingest), so is_international=true on every non-NG row.
--
--   Result: Pass A in fetchDeals (p_origin='local' + p_country='ZA')
--   returns only ZA-tagged offers WHERE is_international=false —
--   which is ~11 of the 159 ZA-anchored offers (the few that happen
--   to be NGN-priced from cross-border ingest). The other 148
--   USD-priced ZA-anchored offers fall into Pass B (intl) and never
--   re-surface as local because the JS isLocalToUser also defaulted
--   to is_international as the local signal.
--
-- Fix: the local-pass filter is now country-aware:
--   - When p_country is set, "local" = store_country = upper(p_country),
--     regardless of is_international (the DB-tagged anchor wins).
--   - When p_country is NULL (no country context), fall back to the
--     legacy is_international = false (preserves NG-default behaviour
--     for /api/deals callers that don't pass country).
--
-- Same change to search_deals_fts so /compare's local filter
-- behaves identically to /deals'.
--
-- Idempotent — CREATE OR REPLACE on both RPCs.
-- ──────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS browse_deals(text, integer, text, text, text, text[], integer, boolean, text);
DROP FUNCTION IF EXISTS search_deals_fts(text, text, integer, text, text[], integer, text);

-- ── browse_deals: country-aware local-pass ────────────────────────
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
    AND (p_zero_discount_only = false OR pbo.discount_percent = 0)
    AND (p_zero_discount_only = true  OR COALESCE(p_min_discount, 0) = 0 OR pbo.discount_percent >= p_min_discount)
    AND (p_search IS NULL OR pbo.title ILIKE '%' || p_search || '%')
    /* Country-aware local-pass — see migration 0039 header. When
       p_country is set, "local" means store_country matches the
       visitor's market regardless of the is_international flag.
       The is_international fallback (for p_country=NULL callers)
       preserves NG-default behaviour. "intl" stays purely
       currency-based (is_international=true) since the cross-border
       intent is about price origin, not anchor market. */
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
    CASE WHEN p_sort = 'discount'   THEN pbo.discount_percent END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'     THEN pbo.scraped_at       END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc'  THEN pbo.current_price    END ASC  NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN pbo.current_price    END DESC NULLS LAST,
    pbo.discount_percent DESC NULLS LAST,
    pbo.offer_id ASC
  LIMIT p_max_rows;
$$;

-- ── search_deals_fts: same country-aware local-pass ──────────────
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
         OR (p_origin = 'local' AND (
              (p_country IS NOT NULL AND pbo.store_country = upper(p_country))
              OR (p_country IS NULL AND pbo.is_international = false)
            ))
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

-- ── Sanity checks (run after applying) ────────────────────────────
-- 1. ZA local count should now match the head count:
--    SELECT count(*) FROM browse_deals(p_country := 'ZA', p_origin := 'local', p_max_rows := 1000);
--    → expect ~150-160 (was ~11 before).
--
-- 2. NG local should be unchanged (the NG path uses is_international correctly):
--    SELECT count(*) FROM browse_deals(p_country := 'NG', p_origin := 'local', p_max_rows := 1000);
--    → expect same as previous figure (the new branch handles country-set
--      callers; NG had this working via NGN currency).
--
-- 3. p_country=NULL callers fall back to is_international:
--    SELECT count(*) FROM browse_deals(p_country := NULL, p_origin := 'local', p_max_rows := 1000);
--    → expect a non-zero count (legacy behaviour preserved).
