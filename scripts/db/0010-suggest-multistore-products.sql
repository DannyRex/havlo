-- ──────────────────────────────────────────────────────────────────
-- Returns product titles for the search-bar chip pool. The point of
-- Havlo is local-vs-cross-border price comparison; the chip rule
-- enforces that explicitly.
--
-- A product qualifies when:
--   1. AT LEAST ONE store carrying it is in the user's country
--      (the LOCAL leg of the comparison)
--   2. AT LEAST ONE store carrying it is NOT in the user's country
--      (the CROSS-BORDER leg — could be Amazon, AliExpress, ASOS,
--      or another country's local retailer)
--
-- Why not just '>=2 distinct stores total': that allowed Konga +
-- Konga-as-NG (same retailer, different SKUs) to qualify and
-- excluded Konga + Amazon (one local + one cross-border) — the
-- exact pair that demonstrates Havlo's value prop. The new rule
-- requires both legs of the comparison to exist.
--
-- Sort: more stores wins, more offers wins, then most-recently-
-- scraped offer to keep the list rotating with the catalog.
-- ──────────────────────────────────────────────────────────────────

create or replace function suggest_multistore_products(
  user_country text default 'ng',
  max_results  int  default 30
)
returns table (
  product_id   uuid,
  title        text,
  store_count  int,
  total_offers int
)
language sql stable as $$
  with
    /* Products carried by at least one store local to the user. */
    local_products as (
      select distinct o.product_id
      from offers o
      join stores s on s.id = o.store_id
      where lower(s.country) = lower(user_country)
    ),
    /* Products carried by at least one store NOT local to the user.
       Includes truly cross-border (s.country IS NULL — AliExpress,
       DHGate, Shein, Temu) AND stores tagged for a different
       country (Amazon UK on /ng, ASOS on /us, etc.). */
    nonlocal_products as (
      select distinct o.product_id
      from offers o
      join stores s on s.id = o.store_id
      where s.country is null
         or lower(s.country) <> lower(user_country)
    )
  select
    p.id as product_id,
    p.title,
    (select count(distinct store_id)::int from offers where product_id = p.id)
      as store_count,
    (select count(*)::int from offers where product_id = p.id)
      as total_offers
  from products p
  where length(p.title) between 6 and 80
    and p.id in (select product_id from local_products)
    and p.id in (select product_id from nonlocal_products)
  order by store_count desc, total_offers desc
  limit max_results;
$$;
