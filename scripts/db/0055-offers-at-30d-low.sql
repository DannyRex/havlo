-- ──────────────────────────────────────────────────────────────────
-- offers_at_30d_low — for a batch of offer_ids, return those whose
-- CURRENT price equals (within tolerance) the LOWEST price seen for
-- their underlying product in the last 30 days, across any store.
--
-- Powers the "Lowest in 30 days" badge on deal cards (/deals,
-- homepage trending rail, category rails). One RPC call per
-- fetchDeals invocation regardless of how many cards are rendered,
-- so the N+1 query risk is bounded.
--
-- Definition of "at 30d low":
--   • Pull the offer's product_id.
--   • Across offer_price_history rows for THAT product in the last
--     30 days, find the minimum price (in NGN; USD converted at the
--     fixed rate 1650 used everywhere else).
--   • Compare against the offer's current_price (also normalised
--     to NGN).
--   • Match when current is within 1% of the floor — tolerates RPC
--     rounding + FX drift, same threshold as the chart's
--     deriveLowestInWindow helper.
--
-- Gate: only flag when the product has been seen at ≥ 2 distinct
-- stores in the 30d window. A single-store floor is trivially the
-- store's own price ("lowest at this store" is true by definition
-- if no other store has ever listed it). Two-store minimum makes
-- the badge a real signal.
--
-- Cost: one query, joins capped by the input array size. With
-- typical deal-page payloads of ~500 offer_ids the query finishes
-- in <100ms on the indexes from migration 0027 + the
-- products.id PK.
--
-- IDEMPOTENT — drop-and-create.
-- ──────────────────────────────────────────────────────────────────

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
        when o.currency = 'USD' then o.current_price * 1650
        else o.current_price
      end                                                     as current_ngn
    from offers o
    where o.id::text = any(p_offer_ids)
  ),
  product_30d_lows as (
    select
      h.product_id,
      min(case
        when h.currency = 'USD' then h.price * 1650
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

-- ── Sanity checks ───────────────────────────────────────────────────
--   -- Pass in some offer ids — expect a subset back
--   select * from offers_at_30d_low(
--     (select array_agg(id::text) from offers limit 100)
--   );
--
--   -- Should be a small fraction of the input (only offers actually at
--   -- their 30d-low across stores). 0-15% is healthy; >50% suggests
--   -- the tolerance or store-count gate is too loose.
