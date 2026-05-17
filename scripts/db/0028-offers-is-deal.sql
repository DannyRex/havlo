-- ──────────────────────────────────────────────────────────────────
-- Add offers.is_deal so the deals page can distinguish promo from
-- market data cleanly. Until now we've inferred is_deal from
-- discount_percent > 0, but that conflates two semantically different
-- things:
--   (a) "discount_percent = 0 because we couldn't extract MSRP"
--       (Jumia rich-snippets, pharmacy ingest, market-mode ingest
--       where Google Shopping returned a non-deal-tagged result)
--   (b) "discount_percent = 0 because the seller is selling at MSRP"
--       (brand DTC like Apple direct, full-price marketplace listings)
--
-- The explicit boolean lets us:
--   - Show "X deals · Y full price" pill counters on /deals
--   - Add an "On sale only" toggle without surprising the user
--   - Run market-mode ingest writes that flag rows is_deal=false
--     without losing the deal classification on existing deal rows
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS is_deal BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: existing rows with discount_percent > 0 stay is_deal=true
-- (default). Rows that came in at 0%-discount get is_deal=false
-- because they're either pharmacy/grocery (legit market price) or
-- Jumia rich-snippet ingest (MSRP wasn't surfaced). Either way, they
-- shouldn't be counted as "on sale" for the new pill counters.
--
-- NB: we keep the DEFAULT TRUE so future deal-lane ingests don't need
-- to explicitly set the column. Market-lane ingest (ingestion.ts)
-- writes is_deal=false explicitly.
UPDATE offers
   SET is_deal = FALSE
 WHERE COALESCE(discount_percent, 0) <= 0;

-- Index for /api/deals pill queries — filter by store + is_deal
-- together is the hot path (Local 2,526 · 1,800 on sale style counters).
CREATE INDEX IF NOT EXISTS idx_offers_store_is_deal
  ON offers (store_id, is_deal)
  WHERE in_stock = TRUE;

-- Also surface is_deal in the product_best_offers view so the API
-- layer can read it without a join. The view is intentionally a
-- thin projection; this column is part of the view's "first-class
-- offer attributes" alongside price / currency / discount_percent.
DROP VIEW IF EXISTS product_best_offers CASCADE;
CREATE VIEW product_best_offers AS
SELECT DISTINCT ON (p.id)
       p.id              AS product_id,
       p.title,
       p.category_slug,
       p.brand,
       p.image_url,
       o.id              AS offer_id,
       o.store_id,
       o.url,
       o.current_price,
       o.original_price,
       o.discount_percent,
       o.currency,
       o.is_deal,
       o.scraped_at,
       o.source_country,
       s.name            AS store_name,
       s.is_international,
       s.logo_url        AS store_logo_url,
       s.country         AS store_country
  FROM products p
  JOIN offers o
    ON o.product_id = p.id
   AND o.in_stock = TRUE
  JOIN stores s
    ON s.id = o.store_id
 ORDER BY p.id, o.current_price ASC;
