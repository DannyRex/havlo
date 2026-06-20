-- 0088-price-timeseries-carry-forward.sql
-- Make the PDP price-history line a TRUE cross-store cheapest over time, and
-- land it on the same scale as the chart's "now" dot.
--
-- TWO bugs in the current product_price_timeseries (last touched by 0082):
--
--   1. SPARSE-MIN SPIKE. It buckets offer_price_history by day and takes
--      min(price) over ONLY the stores that happened to be re-scraped that
--      day. offer_price_history is written on a price CHANGE (0081) plus a
--      WEEKLY snapshot (0082), so on a typical day only a subset of a
--      product's listings have a row. A day where only the pricier store was
--      recorded reports THAT as the "min", so the line spikes up even though a
--      cheaper listing was still live. Example product e5aeeff2: eBay held $87
--      the whole time, but the line jumped to Brown Thomas' $124.96 on the one
--      day only Brown Thomas was re-scraped, then flat-held there — while the
--      live cheapest dot sat far below at $87. Reads as a contradiction.
--
--   2. STALE FX. 0073 routed the price RPCs through fx_rate('USD','NGN') (the
--      live, cron-synced rate), but 0082 redefined THIS function and reverted
--      it to a hardcoded `* 1650`. The dot (anchorPriceNgn = usdToNgn(), which
--      reads the live ~1366 rate) and the line were therefore ~21% apart in
--      NGN for the very same USD price, so even a correct line wouldn't sit on
--      the dot.
--
-- THE FIX (all countries — the table is global):
--   • CARRY FORWARD each listing's last seen price across every day in the
--     window (coalesce(offer_id, store_id) is the carry key, since 0081 lets
--     offer_id go NULL on offer deletion), then take the min across listings
--     per day. So the line is the genuine cheapest-available each day, not the
--     min of whoever was re-scraped.
--   • EXPIRE a listing 21 days (3 weekly-snapshot cycles) after its last
--     sighting, so a delisted / out-of-stock offer ages out instead of pinning
--     a stale price on the line forever.
--   • Convert USD via fx_rate('USD','NGN') again, so the line and the dot are
--     one scale by construction.
--
-- Returns one row PER DAY (dense), so a flat hold reads as a flat line and the
-- right edge always reaches "today". Same signature + return shape, so the TS
-- reader (fetchProductPriceTimeseries) and the chart are unchanged.
--
-- IDEMPOTENT: create-or-replace, no data writes. Apply in the Supabase SQL
-- editor. ROLLBACK: restore 0082's form of product_price_timeseries.

create or replace function public.product_price_timeseries(
  p_product_id uuid,
  p_days_back  integer default 90
)
returns table(bucket_day date, min_price_ngn numeric, store_count integer)
language sql
stable
set search_path = public
as $function$
  with raw as (
    -- Every history point for this product, normalized to NGN at the LIVE fx
    -- rate. Pull an extra 21 days so a price last recorded just before the
    -- window can still carry into its first day.
    select
      coalesce(h.offer_id::text, h.store_id)                                  as carry_key,
      h.store_id,
      h.recorded_at,
      case when h.currency = 'USD' then h.price * fx_rate('USD','NGN') else h.price end as price_ngn
    from offer_price_history h
    where h.product_id = p_product_id
      and h.recorded_at > now() - ((p_days_back + 21) || ' days')::interval
  ),
  days as (
    select generate_series(
      (now() - (p_days_back || ' days')::interval)::date,
      now()::date,
      interval '1 day'
    )::date as day
  ),
  -- Each listing's latest price ON OR BEFORE each day (carried forward), kept
  -- only while it was seen within the last 21 days so delisted offers drop out.
  carried as (
    select distinct on (d.day, r.carry_key)
      d.day, r.store_id, r.price_ngn
    from days d
    join raw r
      on r.recorded_at::date <= d.day
     and r.recorded_at::date >  d.day - 21
    order by d.day, r.carry_key, r.recorded_at desc
  )
  select
    c.day                                as bucket_day,
    min(c.price_ngn)::numeric(12,2)      as min_price_ngn,   -- true cross-listing cheapest that day
    count(distinct c.store_id)::integer  as store_count      -- distinct stores live that day
  from carried c
  group by c.day
  order by c.day asc;
$function$;
