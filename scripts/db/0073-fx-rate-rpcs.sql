-- 0073-fx-rate-rpcs.sql
-- Route the three price RPCs through fx_rate('USD','NGN') (migration 0072)
-- instead of the hardcoded literal 1650. Behaviour is IDENTICAL today
-- (fx_rate returns the seeded 1650), but the rate is now a single,
-- live-updatable source of truth shared with the TS layer rather than a
-- literal baked into each function. fx_rate() is STABLE, so the planner
-- evaluates it once per query (no per-row table lookup).
--
-- These three function bodies are reproduced verbatim from migrations
-- 0054 / 0055 / 0056 with ONLY the `* 1650` -> `* fx_rate('USD','NGN')`
-- swap. Apply AFTER 0072 in the Supabase SQL editor.
-- IDEMPOTENT — all drop-and-create.
-- ──────────────────────────────────────────────────────────────────

-- ── product_price_timeseries (was 0054) ────────────────────────────
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
        when h.currency = 'USD' then h.price * fx_rate('USD', 'NGN')
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

-- ── offers_at_30d_low (was 0055) ───────────────────────────────────
create or replace function offers_at_30d_low(
  p_offer_ids text[]
)
returns table (
  offer_id text
)
language sql
stable
as $$
  with input_offers as (
    select
      o.id::text                                              as offer_id,
      o.product_id,
      case
        when o.currency = 'USD' then o.current_price * fx_rate('USD', 'NGN')
        else o.current_price
      end                                                     as current_ngn
    from offers o
    where o.id::text = any(p_offer_ids)
  ),
  product_30d_lows as (
    select
      h.product_id,
      min(case
        when h.currency = 'USD' then h.price * fx_rate('USD', 'NGN')
        else h.price
      end)                                                    as lowest_ngn,
      count(distinct ho.store_id)                             as store_count
    from offer_price_history h
    join offers ho on ho.id = h.offer_id
    where h.product_id in (select product_id from input_offers)
      and h.recorded_at > now() - interval '30 days'
    group by h.product_id
  )
  select io.offer_id
  from input_offers io
  join product_30d_lows pl on pl.product_id = io.product_id
  where pl.store_count >= 2
    and io.current_ngn <= pl.lowest_ngn * 1.01;
$$;

-- ── pending_price_alerts (was 0056) ────────────────────────────────
create or replace function pending_price_alerts()
returns table (
  alert_id      uuid,
  email         text,
  product_id    uuid,
  query         text,
  target_ngn    numeric(12,2),
  country       text,
  token         uuid,
  cheapest_ngn  numeric(12,2),
  cheapest_offer_id uuid,
  cheapest_store_name text
)
language sql
stable
as $$
  with cheapest as (
    select
      a.id           as alert_id,
      a.email,
      a.product_id,
      a.query,
      a.target_ngn,
      a.country,
      a.token,
      (
        select min(case
          when o.currency = 'USD' then o.current_price * fx_rate('USD', 'NGN')
          else o.current_price
        end)
        from offers o
        join stores s on s.id = o.store_id
        where o.product_id = a.product_id
          and o.in_stock = true
          and (s.country = a.country or s.country is null or s.country = 'INTL')
      ) as cheapest_ngn,
      (
        select o.id
        from offers o
        join stores s on s.id = o.store_id
        where o.product_id = a.product_id
          and o.in_stock = true
          and (s.country = a.country or s.country is null or s.country = 'INTL')
        order by case
          when o.currency = 'USD' then o.current_price * fx_rate('USD', 'NGN')
          else o.current_price
        end asc
        limit 1
      ) as cheapest_offer_id,
      (
        select s.name
        from offers o
        join stores s on s.id = o.store_id
        where o.product_id = a.product_id
          and o.in_stock = true
          and (s.country = a.country or s.country is null or s.country = 'INTL')
        order by case
          when o.currency = 'USD' then o.current_price * fx_rate('USD', 'NGN')
          else o.current_price
        end asc
        limit 1
      ) as cheapest_store_name
    from price_alerts a
    where a.notified_at is null
      and a.product_id is not null
  )
  select
    alert_id, email, product_id, query, target_ngn, country, token,
    cheapest_ngn, cheapest_offer_id, cheapest_store_name
  from cheapest
  where cheapest_ngn is not null
    and cheapest_ngn <= target_ngn;
$$;
