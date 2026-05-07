-- ──────────────────────────────────────────────────────────────────
-- Returns product titles for the search-bar chip pool. A product
-- qualifies when:
--   1. AT LEAST ONE store carrying it is in the user's country
--      (so the comparison includes a local-shopper option)
--   2. AT LEAST 2 distinct stores total carry it (so the comparison
--      actually compares — single-store chip is pointless)
--
-- Why both rules: rule 1 alone could match a product carried only
-- locally with no comparison value. Rule 2 alone (the v1 of this
-- function) matched products carried by 2 international stores
-- with no local presence — chip leads to a Marshall Stanmore page
-- showing only Amazon US + ASOS, no Konga/Jumia, when the user is
-- on /ng. The user reported that as a bug.
--
-- The 'local' definition uses the stores.country column (set by
-- the ingestion pipeline: 'NG' for konga / jumia / 3c-hub / slot,
-- null for international Amazon / ASOS / AliExpress).
--
-- Sort key: distinct store count desc, then total offer count desc,
-- then most-recently scraped offer to keep the list rotating with
-- the catalog.
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
  with products_with_local_store as (
    -- Products that have at least one offer from a store tagged
    -- with the user's country. Distinct so a product with multiple
    -- local-store offers only appears once.
    select distinct p.id as product_id, p.title
    from products p
    join offers o on o.product_id = p.id
    join stores s on s.id = o.store_id
    where length(p.title) between 6 and 80
      and lower(s.country) = lower(user_country)
  )
  select
    pwl.product_id,
    pwl.title,
    count(distinct o.store_id)::int as store_count,
    count(o.id)::int                 as total_offers
  from products_with_local_store pwl
  join offers o on o.product_id = pwl.product_id
  group by pwl.product_id, pwl.title
  having count(distinct o.store_id) >= 2
  order by
    count(distinct o.store_id) desc,
    count(o.id) desc,
    max(o.scraped_at) desc nulls last
  limit max_results;
$$;
