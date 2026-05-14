-- ──────────────────────────────────────────────────────────────────
-- browse_deals RPC — single-round-trip catalog read.
--
-- Replaces the 4-6 PostgREST .range() round trips fetchDeals() in
-- browse-db.ts has been doing per /api/deals call. PostgREST has a
-- hard 1000-row cap (db-max-rows) which forced the fan-out — one
-- RPC call has no such cap.
--
-- Returns up to `p_max_rows` rows (default 6000) of the same shape
-- product_best_offers exposes. The JS layer still does country +
-- origin filtering (because the country roster is a TS-side
-- substring matcher we can't easily push to SQL), but the
-- per-request DB cost drops from 4-6 round trips × 1000 rows to
-- 1 round trip × N rows.
--
-- Sort options match sortToOrder() in browse-db.ts:
--   discount   → discount_percent DESC
--   newest     → scraped_at DESC
--   price_asc  → current_price ASC
--   price_desc → current_price DESC
--   popular    → discount_percent DESC (popular pre-sort, ranker re-orders by clicks JS-side)
--   relevance  → discount_percent DESC (default for fan-out pre-sort)
--
-- Tiebreaker on offer_id is non-negotiable — without it tied rows
-- (same price / discount) bounce across page boundaries, causing
-- duplicate cards on /deals. The same tiebreaker the JS code uses.
--
-- Idempotency: function is replace-or-create. Safe to re-run.
-- ──────────────────────────────────────────────────────────────────

create or replace function browse_deals(
  p_category     text default null,
  p_min_discount integer default 0,
  p_sort         text default 'discount',
  p_search       text default null,
  p_origin       text default 'all',         -- 'all' | 'local' | 'intl'
  p_store_ids    text[] default null,        -- comma-list of allowed store_ids; null = all
  p_max_rows     integer default 6000,
  p_zero_discount_only boolean default false -- when true, only return discount=0 rows
)
returns setof product_best_offers
language sql
stable
as $$
  select * from product_best_offers
  where (p_category is null or p_category = 'all' or category_slug = p_category)
    and (p_zero_discount_only = false or discount_percent = 0)
    and (p_zero_discount_only = true  or coalesce(p_min_discount, 0) = 0 or discount_percent >= p_min_discount)
    and (p_search is null or title ilike '%' || p_search || '%')
    and (p_origin = 'all'
         or (p_origin = 'local' and is_international = false)
         or (p_origin = 'intl'  and is_international = true))
    and (p_store_ids is null or array_length(p_store_ids, 1) is null or store_id = any(p_store_ids))
  order by
    case when p_zero_discount_only then scraped_at end desc nulls last,
    case when p_sort = 'discount'   then discount_percent end desc nulls last,
    case when p_sort = 'newest'     then scraped_at       end desc nulls last,
    case when p_sort = 'price_asc'  then current_price    end asc  nulls last,
    case when p_sort = 'price_desc' then current_price    end desc nulls last,
    -- 'popular' / 'relevance' / null fall through to discount_percent DESC
    discount_percent desc nulls last,
    offer_id asc
  limit p_max_rows;
$$;

-- Sanity check after applying:
-- select count(*) from browse_deals(p_category=>'phones', p_min_discount=>20, p_max_rows=>10);
-- select store_id, current_price from browse_deals(p_origin=>'local', p_max_rows=>5);
-- select count(*) from browse_deals(p_zero_discount_only=>true, p_max_rows=>5000);
