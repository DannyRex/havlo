-- ──────────────────────────────────────────────────────────────────
-- Migration 0034: search_products_fts parity with search_deals_fts
--
-- Audit caught "/compare typo tolerance fails: iphn 15 pro max
-- returns empty". search_products_fts (migration 0002) was the
-- original FTS engine — built before search_deals_fts (0025) which
-- added the exact-phrase and token-coverage boosts.
--
-- This migration brings search_products_fts up to the same scoring
-- shape so the /compare path (which calls search_products_fts) and
-- the /deals search path (which calls search_deals_fts) behave
-- identically for typo / exact-phrase / token-coverage cases.
--
-- Changes vs 0002:
--   1. Exact-phrase boost: +2.0 when lower(title) contains
--      lower(q) verbatim. Catches "iphone 15 pro max" when q is
--      the full phrase — pushes those rows to the top.
--
--   2. Token-coverage boost: +0.8 when every q-token (len ≥ 2)
--      appears as a whole word in the title. Catches re-orderings
--      ("max pro iphone" still matches "iPhone Pro Max").
--
--   3. WHERE clause adds the substring fallback
--      (lower(title) LIKE '%lower(q)%') so a typo or rare term
--      can still surface via the boost path even when trigram
--      threshold is borderline.
--
-- Output shape unchanged (still returns the same TABLE columns)
-- so callers in /api/compare and /api/search/log-search don't
-- need adjustment.
--
-- Idempotent — CREATE OR REPLACE.
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_products_fts(
  q text,
  max_results int DEFAULT 24
)
RETURNS TABLE (
  product_id        uuid,
  title             text,
  category_slug     text,
  brand             text,
  image_url         text,
  offer_id          uuid,
  store_id          text,
  store_name        text,
  store_logo_url    text,
  is_international  boolean,
  url               text,
  current_price     numeric,
  original_price    numeric,
  discount_percent  integer,
  currency          text,
  rank              real
)
LANGUAGE sql STABLE AS $$
  WITH ranked AS (
    SELECT
      p.id,
      p.title,
      p.category_slug,
      p.brand,
      p.image_url,
      (
        ts_rank(p.search_doc, websearch_to_tsquery('english', q))
        + similarity(lower(p.title), lower(q)) * 0.5
        -- Exact-phrase boost: literal query string in title.
        + CASE
            WHEN lower(p.title) LIKE '%' || lower(q) || '%' THEN 2.0
            ELSE 0.0
          END
        -- Per-token whole-word boost: every q-token (len ≥ 2) is a
        -- standalone word in title. Catches re-orderings and partials.
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
    ORDER BY rank DESC
    LIMIT max_results
  )
  SELECT
    r.id              AS product_id,
    r.title,
    r.category_slug,
    r.brand,
    r.image_url,
    o.offer_id,
    o.store_id,
    o.store_name,
    o.store_logo_url,
    o.is_international,
    o.url,
    o.current_price,
    o.original_price,
    o.discount_percent,
    o.currency,
    r.rank
  FROM ranked r
  JOIN product_best_offers o ON o.product_id = r.id
  ORDER BY r.rank DESC;
$$;

-- ── Sanity checks (run after applying) ────────────────────────────
-- 1. Typo tolerance:
--    SELECT count(*) FROM search_products_fts('iphn 15 pro max');
--    → expect > 0 (was 0 before this migration)
--
-- 2. Token re-ordering:
--    SELECT count(*) FROM search_products_fts('pro max iphone 15');
--    → expect > 0
--
-- 3. Exact phrase:
--    SELECT rank FROM search_products_fts('iphone 15 pro max') LIMIT 5;
--    → expect first row rank > 2.0 (exact-phrase bonus)
