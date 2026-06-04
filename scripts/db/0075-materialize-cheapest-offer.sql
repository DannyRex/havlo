-- 0075-materialize-cheapest-offer.sql
-- product_best_offers recomputed a LATERAL (cheapest in-stock offer per
-- product) on EVERY query that reads it -- browse_deals (/deals), PDP
-- fetch, the category-count cron. That LATERAL scan is the dominant
-- recurring CPU/IO cost on the Micro instance (the "unhealthy at low
-- traffic" symptom).
--
-- Fix: precompute the cheapest-offer-id per product into a small
-- materialized view, then redefine the product_best_offers VIEW to JOIN it
-- instead of re-running the LATERAL. Crucially this uses CREATE OR REPLACE
-- VIEW with IDENTICAL output columns to the CURRENT live definition (the
-- 0032 def: 18 columns, is_deal at position 13, scraped_at at 14, and NO
-- source_country -- 0032 dropped it for egress). Same names / order / types
-- means the view's row type is preserved, so browse_deals's
-- `returns table(...)` reading FROM product_best_offers (and every other
-- dependent RPC) keeps working WITHOUT the view being dropped + recreated.
-- The expensive LATERAL now runs once per refresh (off-request cron)
-- instead of on every query.
--
-- SAFE FAILURE MODE: if any column here doesn't match the existing view by
-- name/order/type, the CREATE OR REPLACE VIEW simply errors and the old
-- view stays intact -- nothing breaks. (This is how the first attempt was
-- caught: it was built off the stale 0022 column order and PostgreSQL
-- rejected it cleanly with "cannot change name of view column".)
--
-- ROLLBACK: re-run the 0032 product_best_offers view def (the LATERAL
-- version), then `drop materialized view if exists mv_cheapest_offer;` and
-- `drop function if exists refresh_cheapest_offers();`.

-- 1) Precompute cheapest in-stock offer id per product (WITH DATA = populated
--    on create, so the view below has rows immediately). Same selection rule
--    as the live view's LATERAL: in-stock only, lowest current_price wins.
create materialized view if not exists mv_cheapest_offer as
select
  p.id as product_id,
  o.id as offer_id
from products p
join lateral (
  select id
  from offers
  where offers.product_id = p.id
    and offers.in_stock = true
  order by offers.current_price asc
  limit 1
) o on true;

-- Unique index: required for a future REFRESH ... CONCURRENTLY, and makes
-- the view's join below an index lookup.
create unique index if not exists mv_cheapest_offer_product_id_idx
  on mv_cheapest_offer (product_id);

-- 2) Redefine the view to join the matview. SAME columns/order/types as the
--    0032 definition (is_deal present, source_country absent) -> CREATE OR
--    REPLACE succeeds without a drop, so all dependent RPCs are untouched.
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
from mv_cheapest_offer m
join products p on p.id = m.product_id
join offers   o on o.id = m.offer_id
join stores   s on s.id = o.store_id;

-- 3) Refresh function the crons call after offers change (post-dedup). Plain
--    (non-CONCURRENT) refresh so it can run inside the PostgREST request
--    transaction -- CONCURRENTLY cannot. It takes a brief AccessExclusive
--    lock on the matview while it rebuilds; the refresh is invoked from the
--    05:00-UTC ingest crons (off-peak), so the read-block is a few seconds
--    at a low-traffic moment. SECURITY DEFINER so the service role can
--    invoke it via RPC. (If the brief lock ever matters, switch to a
--    direct-connection REFRESH ... CONCURRENTLY -- the unique index above
--    already supports it.)
create or replace function refresh_cheapest_offers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view mv_cheapest_offer;
end;
$$;
