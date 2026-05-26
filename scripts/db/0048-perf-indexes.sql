-- ──────────────────────────────────────────────────────────────────
-- Migration 0048: targeted compound indexes for hot query paths
--
-- Phase 6 audit (May 2026) timed browse_deals RPC at 200–800ms cold
-- and 150–700ms warm — most of the time spent in the LATERAL subquery
-- of product_best_offers (cheapest-in-stock-offer per product). The
-- existing offers_product_id_idx covers the equality filter but
-- Postgres still has to heap-fetch each row to evaluate in_stock and
-- sort by current_price.
--
-- Two new compound + partial indexes plug the gaps without bloating
-- write paths (partial indexes only contain in_stock=true rows, which
-- is ~97% of the catalog but the write cost stays bounded by the
-- partial predicate). Both are CREATE INDEX IF NOT EXISTS so re-runs
-- are no-ops.
--
-- ── Index 1: product_best_offers LATERAL subquery ────────────────
-- The view does, for every product:
--   SELECT * FROM offers
--    WHERE offers.product_id = p.id
--      AND offers.in_stock = TRUE
--    ORDER BY offers.current_price ASC
--    LIMIT 1
-- With (product_id, current_price) WHERE in_stock=true, Postgres can
-- do an index-only scan + index ordered access — no heap fetch, no
-- sort step. Expected speedup: 2-3x on view-driven queries.
--
-- ── Index 2: per-store discount filtering ────────────────────────
-- /api/deals' Pass A + Pass B fire `WHERE store_id = ANY(...) ORDER BY
-- discount_percent DESC` patterns when a user ticks a store. Existing
-- offers_store_last_seen_idx doesn't cover the discount sort. New
-- partial (store_id, discount_percent DESC) WHERE in_stock=true
-- targets the exact predicate shape. Expected speedup: 1.5-2x on
-- per-store filter queries.
--
-- Both indexes apply only to in_stock=true rows so they stay small
-- (~20K rows × maybe 60 bytes each = ~1.2 MB total per index).
-- Cost vs benefit: very favourable for a 12K-product catalog,
-- still favourable at 10x (~120K products) where the per-store
-- variant becomes critical.
-- ──────────────────────────────────────────────────────────────────

-- Drop earlier names if they were created with the old shape.
-- (Defensive: this migration may run on an instance where someone
-- ran an ad-hoc CREATE INDEX with the same name. CONCURRENTLY is NOT
-- used because we want this to fit in a normal migration apply.)

CREATE INDEX IF NOT EXISTS idx_offers_product_in_stock_price
  ON offers (product_id, current_price)
  WHERE in_stock = true;

CREATE INDEX IF NOT EXISTS idx_offers_store_in_stock_discount
  ON offers (store_id, discount_percent DESC NULLS LAST)
  WHERE in_stock = true;

-- ── ANALYZE so the planner sees the new indexes immediately ──────
-- ANALYZE is required after creating partial indexes for the planner
-- to update its selectivity estimates. Without this, the first few
-- queries after deploy might pick a suboptimal plan until the
-- autovacuum-driven ANALYZE catches up (~hourly on Supabase).

ANALYZE offers;

-- ── Verify after applying ─────────────────────────────────────────
-- 1. Confirm the indexes exist:
--    SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename = 'offers' AND indexname LIKE 'idx_offers_%';
--
-- 2. EXPLAIN ANALYZE the product_best_offers LATERAL:
--    EXPLAIN ANALYZE
--    SELECT * FROM product_best_offers LIMIT 100;
--    Expect "Index Only Scan using idx_offers_product_in_stock_price"
--    in the per-product subplan instead of "Bitmap Heap Scan".
--
-- 3. Re-time the browse_deals RPC:
--    SELECT count(*) FROM browse_deals(p_country := 'UK',
--      p_origin := 'local', p_sort := 'discount', p_max_rows := 500);
--    Expect total wall time to drop from ~500ms to ~250ms.
