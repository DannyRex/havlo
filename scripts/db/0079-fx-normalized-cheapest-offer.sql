-- 0079-fx-normalized-cheapest-offer.sql
-- The cheapest-offer matview (0075) picked the lowest offer per product by
-- RAW current_price, ignoring currency. A Fouani offer at NGN 189,000
-- (= $139) lost to a Sharaf DG offer at $217 because 189000 > 217 as bare
-- numbers, so the NG offer was never the product's anchor row and the
-- product vanished from /ng/deals. Same class of bug suppressed other
-- NG-local and DE-local offers wherever a numerically-smaller foreign-
-- currency price existed.
--
-- Measured blast radius (June 2026, live data): of 121 products that carry
-- offers in >1 currency across >=2 stores, 44 flip their anchor once the
-- price is normalized to USD before the ORDER BY. ALL 44 flips recover a
-- local NGN anchor that the raw comparison was hiding; ZERO move away from
-- an NGN anchor, so there is no regression, the fix only ever corrects
-- unfair suppression.
--
-- Fix: rank by current_price / fx_rate('USD', currency) (USD-equivalent)
-- instead of raw current_price. fx_rate() (0072) already returns "quote
-- units per 1 USD" with a safe fallback of 1, so dividing converts any
-- offer to USD. This runs ONLY at REFRESH time (off-request), so the tiny
-- per-row fx_rate lookup on the 6-row fx_rates table is free in practice.
--
-- Dependency-safe rollout (NO drop of product_best_offers, so the plpgsql
-- RPCs that read FROM it are never invalidated):
--   1. build a NEW matview mv_cheapest_offer_usd with the FX-aware pick,
--   2. CREATE OR REPLACE the product_best_offers VIEW to read from it
--      (identical output columns -> replace succeeds without a drop),
--   3. repoint refresh_cheapest_offers() at the new matview,
--   4. drop the old mv_cheapest_offer (now unreferenced).
--
-- The cheapest-anchor DISPLAY is unchanged: the view still returns the
-- chosen offer's own current_price + currency, and the app converts to the
-- visitor's display currency as before. Only the RANKING that selects WHICH
-- offer is the anchor now uses the USD-equivalent.
--
-- ROLLBACK: CREATE OR REPLACE the 0075 view to read from mv_cheapest_offer
-- (rebuild it from 0075 first if already dropped), repoint
-- refresh_cheapest_offers() back, then drop mv_cheapest_offer_usd.
--
-- Apply in the Supabase SQL editor.

-- 1) FX-normalized cheapest in-stock offer per product. WITH DATA so the
--    repointed view has rows immediately. Same selection rule as 0075 but
--    ranked on the USD-equivalent price.
--
--    NB: we inline a schema-qualified lookup against public.fx_rates rather
--    than calling fx_rate('USD', currency). fx_rate() (0072) has no
--    `set search_path`, so the planner INLINES it into this CREATE
--    MATERIALIZED VIEW, and at build time an unqualified `fx_rates` failed
--    to resolve in the SQL editor's search_path ("relation fx_rates does
--    not exist"), even though products/offers resolved fine. Qualifying the
--    table as public.fx_rates removes that dependency. Semantics are
--    identical to fx_rate(): rate = quote-units per 1 USD, NGN fallback
--    1650, everything else 1, so current_price / rate = USD-equivalent.
create materialized view if not exists mv_cheapest_offer_usd as
select
  p.id as product_id,
  o.id as offer_id
from products p
join lateral (
  select id
  from offers
  where offers.product_id = p.id
    and offers.in_stock = true
  order by offers.current_price / coalesce(
    (select fr.rate
       from public.fx_rates fr
      where fr.base = 'USD'
        and fr.quote = coalesce(offers.currency, 'USD')),
    case when coalesce(offers.currency, 'USD') = 'NGN' then 1650 else 1 end
  ) asc
  limit 1
) o on true;

-- Unique index: required for any future REFRESH ... CONCURRENTLY and makes
-- the view's join an index lookup.
create unique index if not exists mv_cheapest_offer_usd_product_id_idx
  on mv_cheapest_offer_usd (product_id);

-- 2) Repoint the view at the new matview. IDENTICAL columns/order/types to
--    the 0075 definition, so CREATE OR REPLACE succeeds without dropping the
--    view and every dependent plpgsql RPC keeps working untouched.
create or replace view product_best_offers as
select
  p.id                   as product_id,
  p.title,
  p.category_slug,
  p.brand,
  p.image_url,
  o.id                   as offer_id,
  o.store_id,
  o.url,
  o.current_price,
  o.original_price,
  o.discount_percent,
  o.currency,
  o.is_deal,
  o.scraped_at,
  s.name                 as store_name,
  s.is_international,
  s.logo_url             as store_logo_url,
  s.country              as store_country
from mv_cheapest_offer_usd m
join products p on p.id = m.product_id
join offers   o on o.id = m.offer_id
join stores   s on s.id = o.store_id;

-- 3) Repoint the refresh function the crons call (post-dedup ingest).
create or replace function refresh_cheapest_offers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view mv_cheapest_offer_usd;
end;
$$;

-- 4) Drop the old raw-price matview (now unreferenced). The new one is
--    already populated and wired in above.
drop materialized view if exists mv_cheapest_offer;
