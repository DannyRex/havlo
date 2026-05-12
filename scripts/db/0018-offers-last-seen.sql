-- ──────────────────────────────────────────────────────────────────
-- Offers freshness — `last_seen_at` + per-store staleness sweep.
--
-- Background: ingestion.ts has only ever done UPSERT (no deletion,
-- no out-of-stock flagging). That meant every offer ever scraped
-- stayed visible forever, even after the merchant delisted the SKU
-- or rotated URL slugs. product_best_offers filters in_stock=true,
-- but nothing flipped offers to false, so the filter did nothing in
-- practice. Symptom: phantom deals on /deals that 404 on click,
-- stale prices that never decay.
--
-- Fix: stamp every successfully-upserted offer with last_seen_at =
-- run-start. After a per-store full-catalog scrape, mark any offer
-- belonging to that store whose last_seen_at predates the run as
-- in_stock=false. The view drops it automatically. A separate cron
-- can hard-delete in_stock=false offers older than 30 days.
--
-- Safety: ingestDeals only triggers the sweep when the caller
-- passes sweepScope.store (i.e. asserts "I just walked this store's
-- entire catalog"). Per-category SerpAPI / per-SKU ingest leave the
-- sweep off, so they can't accidentally zero out the catalog.
-- ──────────────────────────────────────────────────────────────────

-- 1. Add the column. Default to now() so future inserts auto-stamp.
alter table offers
  add column if not exists last_seen_at timestamptz;

-- 2. Backfill existing rows from scraped_at so the first post-deploy
--    sweep doesn't nuke catalogs that haven't been re-scraped yet.
--    Idempotent: only fills NULL.
update offers
   set last_seen_at = scraped_at
 where last_seen_at is null;

-- 3. Apply the default ONLY after the backfill so any concurrent
--    writes during deploy don't get a stamp that predates them.
alter table offers
  alter column last_seen_at set default now();

-- 4. Indexes for the staleness sweep + the eventual hard-delete cron.
--    The composite (store_id, last_seen_at) is the workhorse for the
--    UPDATE … WHERE store_id = $1 AND last_seen_at < $run_start path.
create index if not exists offers_store_last_seen_idx
  on offers(store_id, last_seen_at);

-- For the hard-delete cron: in_stock=false AND last_seen_at < N days ago.
create index if not exists offers_in_stock_last_seen_idx
  on offers(in_stock, last_seen_at)
  where in_stock = false;

-- Sanity check after applying:
-- select store_id,
--        count(*) filter (where in_stock = true)  as in_stock_count,
--        count(*) filter (where in_stock = false) as out_of_stock_count,
--        min(last_seen_at)                        as oldest_last_seen,
--        max(last_seen_at)                        as newest_last_seen
--   from offers
--  group by store_id
--  order by in_stock_count desc;
