-- 0082-weekly-price-snapshot.sql
-- Give price history DEPTH so the PDP chart has a real timeline, not a
-- lonely dot.
--
-- THE GAP: offer_price_history is only written by a trigger that fires on
-- a price CHANGE (0081 record_offer_price_change). A product whose price
-- holds steady for weeks therefore has a single history row, and the chart
-- renders one point — it can't show "the price held flat at X for a month,
-- then dropped." The honest, useful timeline needs regular points even
-- when nothing changed.
--
-- THE FIX (two parts, all countries — the table is global):
--
--   1. snapshot_offer_prices(): inserts ONE row per active offer that
--      DOESN'T already have a history row in the last 6 days, capturing
--      its current price + store snapshot. Bounded to <=1 row/offer/week:
--      an offer that changed price this week already has a trigger row, so
--      it's skipped. Worst case ~1 row per active offer per week
--      (~15.5k/wk at today's catalog ~= a few MB/wk). The maintenance
--      workflow calls this WEEKLY (not daily) to keep the table
--      Micro-storage friendly while still giving a weekly cadence of
--      points — enough to read a flat hold as a flat step.
--
--   2. product_price_timeseries(): repointed at the snapshotted store_id
--      column (added in 0081) instead of JOINing offers. Post-0081 an
--      offer_price_history row can have offer_id = NULL (its offer was
--      deleted; the FK is ON DELETE SET NULL). The old INNER JOIN dropped
--      exactly those rows — i.e. it threw away the history 0081 worked to
--      preserve. Reading h.store_id keeps snapshot/history points on the
--      chart for the full window regardless of whether the offer still
--      exists.
--
-- IDEMPOTENT: both are create-or-replace; the snapshot's 6-day guard makes
-- repeat runs within a week no-ops. Apply in the Supabase SQL editor.
-- ROLLBACK: drop snapshot_offer_prices; restore 0054's JOIN form of
-- product_price_timeseries.

-- ── 1) the weekly snapshot ──────────────────────────────────────────
-- p_dry_run = true returns the count that WOULD be inserted, writes
-- nothing (used by `npm run snapshot:dry-run`).
create or replace function snapshot_offer_prices(p_dry_run boolean default false)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  if p_dry_run then
    select count(*) into v_count
    from offers o
    where o.in_stock = true
      and o.current_price is not null
      and not exists (
        select 1 from offer_price_history h
        where h.offer_id = o.id
          and h.recorded_at > now() - interval '6 days'
      );
    return v_count;
  end if;

  insert into offer_price_history
    (offer_id, product_id, store_id, store_name, price, currency, discount_percent, recorded_at)
  select
    o.id,
    o.product_id,
    o.store_id,
    (select s.name from stores s where s.id = o.store_id),
    o.current_price,
    o.currency,
    o.discount_percent,
    now()
  from offers o
  where o.in_stock = true
    and o.current_price is not null
    and not exists (
      select 1 from offer_price_history h
      where h.offer_id = o.id
        and h.recorded_at > now() - interval '6 days'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── 2) timeseries reads the self-contained store_id (survives deletes) ──
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
      h.store_id
    from offer_price_history h
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
--   select snapshot_offer_prices(true);   -- how many WOULD snapshot now
--   select snapshot_offer_prices();        -- do it; returns rows inserted
--   select * from product_price_timeseries(
--     (select product_id from offer_price_history limit 1), 90);
