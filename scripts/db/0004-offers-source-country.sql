-- Phase 10a follow-up — per-country offer tagging.
--
-- Run in the Supabase SQL Editor after 0003-fts-exact-phrase-boost.sql.
--
-- Why this exists:
--   The country selector shipped in 10a needs real per-country
--   filtering — "show only UK retailers + cross-border stores when a
--   UK user lands on the homepage". Until now country was only in the
--   in-memory Deal.tags array, lost on ingest. We promote it to a
--   first-class column on `offers` so browse queries can filter on it.
--
-- Behaviour after migration:
--   • New ingests: ingestion.ts parses `source_query` (e.g. "phones:uk")
--     and writes `source_country = 'uk'` on every offer.
--   • Backfill below derives country from existing source_query rows
--     (matches `:[a-z]{2}$`). NGN-currency offers default to 'ng'.
--   • Rows with no inferable country stay NULL → treated as global by
--     the filter (cross-border stores like Shein/Temu/AliExpress).

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS source_country text;

-- Backfill: parse trailing :xx off source_query for SerpAPI-ingested rows
UPDATE offers
SET source_country = LOWER(SUBSTRING(source_query FROM ':([a-z]{2})$'))
WHERE source_country IS NULL
  AND source_query IS NOT NULL
  AND source_query ~ ':[a-z]{2}$';

-- NGN-priced rows are scraper-sourced from NG retailers
UPDATE offers
SET source_country = 'ng'
WHERE source_country IS NULL
  AND currency = 'NGN';

CREATE INDEX IF NOT EXISTS offers_source_country_idx
  ON offers (source_country);

-- Recreate the best-offers view to expose source_country to browse-db.
-- Postgres' CREATE OR REPLACE VIEW can only ADD trailing columns (and
-- can't change their order), so we DROP first to add source_country in
-- the same logical position as the other offer columns.
DROP VIEW IF EXISTS product_best_offers;
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
  o.scraped_at,
  o.source_country,
  s.name                 AS store_name,
  s.is_international,
  s.logo_url             AS store_logo_url
FROM products p
JOIN LATERAL (
  SELECT * FROM offers
  WHERE product_id = p.id AND in_stock = true
  ORDER BY current_price ASC
  LIMIT 1
) o ON true
JOIN stores s ON s.id = o.store_id;
