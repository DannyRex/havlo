-- ──────────────────────────────────────────────────────────────────
-- Migration 0041: add store_country to search_products_fts return
--
-- Root cause traced from the persistent "/compare empty for DE/IN/ZA"
-- re-audit findings:
--
--   /api/compare → pgFtsFindSimilar → search_products_fts (RPC)
--     returns FtsRow without store_country (the only return column
--     that survived from the pre-0038 era).
--
--   isOfferAllowedForCountry (the country gate that decides whether
--   an FTS row's offers belong to the visitor's market) preferred
--   Deal.storeCountry first (per the May 2026 fix in 9b60a35) but
--   for FTS rows storeCountry was always undefined — so it fell
--   back to the JS COUNTRY_STORES roster check. For stores not in
--   the hardcoded roster (handysparkauf / refurbed-de / fonezone /
--   bigbasket / istore-south-africa / istore-pre-owned / etc. — all
--   of which DO have DB-tagged country=DE / IN / ZA via migration
--   0037's backfill), the JS roster check returns null and the
--   offer drops.
--
--   Result: 43 iPhone 15 offers exist across 6 markets, but
--   /api/compare?q=iphone+15&country=de returns mode:empty because
--   the FTS candidates with DE-anchored offers were dropping at the
--   country gate.
--
-- Fix mirrors 0038's browse_deals + search_deals_fts addition: add
-- store_country to the search_products_fts RETURNS TABLE shape.
--
-- Idempotent — CREATE OR REPLACE.
-- ──────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS search_products_fts(text, integer);

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
  rank              real,
  /* Added May 2026 launch-readiness re-audit. Lets the JS-side
     country gate (isOfferAllowedForCountry) use the DB-authoritative
     store_country instead of relying on the hardcoded JS
     COUNTRY_STORES roster — same fix that 0038 applied to
     browse_deals and search_deals_fts. */
  store_country     text
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
        -- Exact-phrase boost (matches 0034 parity).
        + CASE
            WHEN lower(p.title) LIKE '%' || lower(q) || '%' THEN 2.0
            ELSE 0.0
          END
        -- Per-token whole-word boost.
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
    r.rank,
    o.store_country
  FROM ranked r
  JOIN product_best_offers o ON o.product_id = r.id
  ORDER BY r.rank DESC;
$$;

-- ── Sanity check (run after applying) ─────────────────────────────
-- SELECT title, store_id, store_country, rank
--   FROM search_products_fts('iphone 15', 10);
-- → expect store_country column populated (UK/US/DE/IN/etc.) for
--   rows where the store has a country tag.
