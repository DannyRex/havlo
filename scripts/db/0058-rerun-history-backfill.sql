-- ──────────────────────────────────────────────────────────────────
-- Re-run of the migration 0027 history-backfill clause.
--
-- Diagnostic context (scripts/diagnose-no-history-products.ts ran
-- May 28, 2026 against prod):
--
--   17,650 tracked products
--    ↳ 11,887 have history (67.3%)
--    ↳ 2,838  have offers BUT no history rows (16.1%) ← this migration
--    ↳ 2,940  have no offers at all          (16.7%) ← cannot help
--    ↳ 102    have partial history per offer (0.6%)  ← also covered
--
-- Why bucket B exists at all:
--   - Some offers were inserted via raw-SQL bulk paths that bypassed
--     the `record_offer_price_change` trigger (a few of the older
--     scrapers used a direct COPY instead of the per-row INSERT
--     that the trigger watches).
--   - Some products were re-ingested with new offers between
--     0027's backfill clause running and this date.
--
-- This migration is the SAME `where not exists` insert from 0027.
-- It's idempotent: rerun safely, only inserts where no history
-- row exists for the offer. Will not duplicate existing rows.
--
-- Expected effect: ~2,800 + ~250 = ~3,050 new seed rows. After this
-- runs, chart coverage should jump from 67.3% → ~83.5% of tracked
-- products carrying at least one history point.
-- ──────────────────────────────────────────────────────────────────

insert into offer_price_history (offer_id, product_id, price, currency, discount_percent, recorded_at)
select
  o.id,
  o.product_id,
  o.current_price,
  o.currency,
  o.discount_percent,
  coalesce(o.scraped_at, now())
from offers o
where o.current_price is not null
  and o.current_price > 0
  and not exists (
    select 1 from offer_price_history h where h.offer_id = o.id
  );


-- ── Sanity check after applying ────────────────────────────────────
--   -- Should report < 100 — the remaining no-history offers are
--   -- ones where current_price is null/zero (not chartable anyway).
--   select count(*)
--   from offers o
--   where o.current_price is not null
--     and o.current_price > 0
--     and not exists (select 1 from offer_price_history h where h.offer_id = o.id);
--
--   -- Re-run scripts/stats-price-history-coverage.ts to confirm
--   -- the products-with-any-history percentage jumped to ~83%.
