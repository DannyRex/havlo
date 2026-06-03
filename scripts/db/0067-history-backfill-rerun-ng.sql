-- ──────────────────────────────────────────────────────────────────
-- Migration 0067: re-run the price-history seed backfill (#24)
--
-- Symptom (QA, June 2026): "most NG product charts are flat."
--
-- Diagnosis (read-only sample, 120 products/market):
--   NG: 71% of products have ZERO offer_price_history rows, 28% have
--       exactly one (a flat single point), only ~1% would show real
--       movement. avg 0.36 history rows / product.
--   UK: 3% zero, 78% one, 19% with 2+ rows. avg 1.61.
--   Offer-id churn is NOT the cause (~1% of NG products).
--
-- Root cause: the seed backfill (0027, re-run by 0058) is ONE-TIME. The
-- per-row trigger `record_offer_price_change` seeds a starting point on
-- a normal INSERT, but:
--   • offers re-ingested AFTER the last backfill that didn't go through a
--     trigger-firing per-row INSERT (older bulk/COPY paths — see 0058),
--   • and any offer added since 0058 (May 28),
-- carry no starting row until the next backfill. NG is the freshest-
-- scraped market (88% of NG offers re-scraped in the last 24h), so it
-- accumulates by far the most uncovered offers → mostly-flat/empty charts.
--
-- This is the SAME idempotent `where not exists` seed as 0027 / 0058,
-- re-run to cover everything ingested since. Safe to re-run anytime; it
-- only inserts where an offer has no history row and a chartable price.
--
-- IMPORTANT — this seeds a "tracking starts now" baseline (one point at
-- the offer's current scraped_at price). It does NOT, and cannot,
-- manufacture months of PAST prices — that data isn't observable after
-- the fact. Real history accumulates going forward as prices move.
--
-- DURABILITY: to stop the gap reopening, run this same statement on a
-- schedule right AFTER each ingest cycle (e.g. as a final step in the
-- scrape cron / GitHub Action). It's cheap and idempotent, so a daily
-- run guarantees every newly-ingested offer gets its starting point
-- within a day regardless of which write path created it.
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

-- ── Durable seed RPC (#24) ───────────────────────────────────────────
-- Same idempotent seed wrapped in a callable function so the ingest cron
-- can run it after every scrape cycle (scrape-free-daily.yml dedup job →
-- `npm run seed:price-history`). Returns the number of starting points
-- seeded so the cron can log it. Keeps NG (and every market) at ~full
-- history coverage without waiting for a manual re-backfill.
create or replace function seed_missing_price_history()
returns integer
language plpgsql
as $$
declare seeded integer;
begin
  with ins as (
    insert into offer_price_history (offer_id, product_id, price, currency, discount_percent, recorded_at)
    select o.id, o.product_id, o.current_price, o.currency, o.discount_percent, coalesce(o.scraped_at, now())
    from offers o
    where o.current_price is not null and o.current_price > 0
      and not exists (select 1 from offer_price_history h where h.offer_id = o.id)
    returning 1
  )
  select count(*) into seeded from ins;
  return seeded;
end;
$$;

-- ── Sanity checks (run in the Supabase SQL editor after applying) ────
--   -- 1. Remaining chartable offers with no history should be ~0:
--   select count(*) from offers o
--   where o.current_price is not null and o.current_price > 0
--     and not exists (select 1 from offer_price_history h where h.offer_id = o.id);
--
--   -- 2. NG product coverage should jump from ~29% toward ~100%:
--   select count(distinct pbo.product_id) filter (
--            where exists (select 1 from offer_price_history h where h.product_id = pbo.product_id)
--          )::float
--          / nullif(count(distinct pbo.product_id), 0) as ng_products_with_history
--   from product_best_offers pbo
--   where pbo.store_country = 'NG';
