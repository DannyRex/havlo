-- Phase 6 follow-up — exact-phrase boost on the FTS search RPC.
--
-- Run after 0002-fts-search.sql in the Supabase SQL Editor.
-- Replaces the existing `search_products_fts` function in place
-- (CREATE OR REPLACE) with a stronger ranking blend.
--
-- Why this exists:
--   The original ts_rank + trigram-similarity blend was getting beaten
--   by recency / store-count signals when the user typed a very specific
--   model query. Bug repro: `iphone 15 pro max` was anchoring on the
--   newer "iPhone 17 Pro" listing instead of the literal model in the DB.
--
-- Fix:
--   Add a +2.0 boost when the user's query string appears verbatim in
--   the title (case-insensitive). Also boost when EVERY query token is
--   present as a whole word in the title (covers reorderings).

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
        -- Exact-phrase boost: query string appears verbatim in title
        + CASE
            WHEN lower(p.title) LIKE '%' || lower(q) || '%' THEN 2.0
            ELSE 0.0
          END
        -- Per-token whole-word boost: every word in q appears in title
        + CASE
            WHEN array_length(
              array(
                SELECT 1
                FROM unnest(string_to_array(lower(q), ' ')) AS w
                WHERE length(w) >= 2
                  AND position(' ' || w || ' ' in ' ' || lower(p.title) || ' ') > 0
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

-- Verify with:
--   SELECT title, rank FROM search_products_fts('iphone 15 pro max', 5);
-- The exact-model match should now rank highest, not "iPhone 17 Pro".
