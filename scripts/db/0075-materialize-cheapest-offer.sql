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
-- VIEW with IDENTICAL output columns (same names / order / types as the
-- 0022 def), so the view's row type is preserved and browse_deals's
-- `returns setof product_best_offers` (and every other dependent RPC) keeps
-- working WITHOUT being dropped + recreated. The expensive LATERAL now runs
-- once per refresh (off-request cron) instead of on every query.
--
-- SAFE FAILURE MODE: if any column here doesn't match the existing view,
-- the CREATE OR REPLACE VIEW simply errors and the old view stays intact --
-- nothing breaks.
--
-- ROLLBACK: re-run the 0022 product_best_offers view def (the LATERAL
-- version), then `drop materialized view if exists mv_cheapest_offer;` and
-- `drop function if exists refresh_cheapest_offers();`.

-- 1) Precompute cheapest in-stock offer id per product (WITH DATA = populated
--    on create, so the view below has rows immediately).
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
--    0022 definition -> CREATE OR REPLACE succeeds without a drop, so all
--    dependent RPCs are untouched.
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
  o.scraped_at,
  o.source_country,
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
