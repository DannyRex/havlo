-- ──────────────────────────────────────────────────────────────────
-- product_price_timeseries — daily-aggregated price points across
-- stores, for the PDP's line-chart visualisation.
--
-- Why a new RPC and not reuse product_price_history (migration 0027)?
--   • 0027 returns ONE row per store, with lowest_seen + latest
--     aggregates over the entire window. That shape feeds the
--     PriceComparisonBar's "lowest in 90 days" badge — single
--     reduced number per store.
--   • The chart needs a TIME-SERIES instead: for each day in the
--     window, the lowest price seen across all stores carrying this
--     product. Drawing the per-store rollup wouldn't show the
--     timeline of price changes.
--
-- Day-bucketing strategy:
--   • Group offer_price_history rows by date_trunc('day', recorded_at)
--   • For each bucket, take the MIN price across all stores (in NGN,
--     converting USD via a hard-coded rate baked into the query).
--   • Also expose the bucket's store count so the chart can grey
--     out single-store-only days (less reliable signals).
--
-- Currency conversion:
--   The RPC returns NGN values directly. The conversion rate is
--   baked in (1 USD ≈ 1650 NGN — same as `usdToNgn` in lib/utils.ts).
--   When the rate drifts materially we can either:
--     a) update the constant here + rerun
--     b) move conversion JS-side (one extra hop per row, but
--        always-fresh rate)
--   Going with (a) for now since the historical conversion was
--   never meant to be real-time anyway — a 30-day old USD price
--   should arguably use a 30-day old conversion rate, but we
--   don't track historical FX. Approximation is fine for charting.
--
-- Cost: index on (product_id, recorded_at) from migration 0027
-- handles the where-clause. Daily aggregation is cheap (<100ms
-- for a 90-day window on a typical product with ~200 history rows).
--
-- IDEMPOTENT — function drop-and-create.
-- ──────────────────────────────────────────────────────────────────

create or replace function product_price_timeseries(
  p_product_id uuid,
  p_days_back  integer default 90
)
returns table (
  bucket_day    date,
  min_price_ngn numeric(12,2),
  store_count   integer
)
language sql
stable
as $$
  with windowed as (
    select
      date_trunc('day', h.recorded_at)::date as bucket_day,
      case
        when h.currency = 'USD' then h.price * 1650
        else h.price
      end                                    as price_ngn,
      o.store_id
    from offer_price_history h
    join offers o on o.id = h.offer_id
    where h.product_id = p_product_id
      and h.recorded_at > now() - (p_days_back || ' days')::interval
  )
  select
    bucket_day,
    min(price_ngn)::numeric(12,2)            as min_price_ngn,
    count(distinct store_id)::integer        as store_count
  from windowed
  group by bucket_day
  order by bucket_day asc;
$$;

-- ── Sanity checks ───────────────────────────────────────────────────
--   -- Pick a product with multiple stores + history
--   select * from product_price_timeseries(
--     p_product_id => (select id from products limit 1),
--     p_days_back  => 90
--   );
--
--   -- Expect: one row per day in the window where price activity
--   -- occurred. Days with no price changes simply aren't returned;
--   -- the chart interpolates / step-fills between known points.
