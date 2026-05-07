-- ──────────────────────────────────────────────────────────────────
-- Returns product titles that have offers from AT LEAST 2 distinct
-- stores. Used by /api/popular-suggestions to power the chip pool
-- under the search bar — every chip is guaranteed to lead to a
-- multi-store comparison rather than a single-listing page.
--
-- Sort key: distinct store count desc, then total offer count desc.
-- Ties broken by most-recently-scraped offer so the list rotates
-- naturally with the catalog.
-- ──────────────────────────────────────────────────────────────────

create or replace function suggest_multistore_products(
  max_results int default 30
)
returns table (
  product_id  uuid,
  title       text,
  store_count int,
  total_offers int
)
language sql stable as $$
  select
    p.id   as product_id,
    p.title,
    count(distinct o.store_id)::int as store_count,
    count(o.id)::int                 as total_offers
  from products p
  join offers o on o.product_id = p.id
  where length(p.title) between 6 and 80   -- readable chip length
  group by p.id, p.title
  having count(distinct o.store_id) >= 2
  order by store_count desc, total_offers desc, max(o.scraped_at) desc nulls last
  limit max_results;
$$;
