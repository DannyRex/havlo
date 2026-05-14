-- ──────────────────────────────────────────────────────────────────
-- Follow-up to 0022. Two issues caught post-deploy:
--
-- 1. Cross-border global stores (AliExpress, DHgate, Shein, Temu,
--    Banggood, etc.) had `is_international = false` in the DB
--    because the original ingestion never set the flag explicitly
--    and the column defaults to false. 0022's RPC filter
--      `(store_country IS NULL AND is_international = true)`
--    silently dropped them. UK origin=intl returned 0 deals
--    instead of ~625 AliExpress + DHgate listings.
--
-- 2. The WHERE clause in browse_deals was MORE restrictive than
--    the JS-side filterDealsForCountry. JS allows untagged stores
--    through on a per-country cross-border allowlist; SQL was
--    blanket-dropping anything that wasn't either anchored-local
--    or null-country-international. Net: 912 untagged store
--    variants got silently filtered out for every market that
--    isn't theirs.
--
--    The country-priority ORDER BY (from 0022) is enough on its
--    own to solve the original starvation problem — NG-anchored
--    rows always sort first within the 6000-row cap, so they're
--    guaranteed to survive. Removing the strict WHERE filter
--    lets the rest of the pool fill the remaining capacity, then
--    JS filterDealsForCountry does the per-country gating with
--    its full allowlist context (which is too rich to express
--    cleanly in SQL).
--
-- IDEMPOTENCY
--   Both UPDATE + CREATE OR REPLACE FUNCTION are safe to re-run.
-- ──────────────────────────────────────────────────────────────────

-- ── Part 1: backfill is_international for known global stores ────
--
--   GLOBAL_INTL_STORES (src/lib/country.ts) is the single source
--   of truth — keep the list synchronised. Each entry is a
--   substring SerpAPI returns as either the storeId or storeName.
update stores
set is_international = true
where is_international = false
  and lower(id) ~ '(aliexpress|dhgate|shein|temu|banggood|wish\.com|alibaba|lightinthebox|geekbuying|trendyol)';

-- ── Part 2: relax browse_deals country filter ────────────────────
--
--   Drops the strict WHERE filter (anchored-local OR null-country-
--   international). Keeps only the ORDER BY priority pass —
--   anchored-local rows sort first, then everything else by the
--   user's chosen sort. JS handles the final per-country gating.
create or replace function browse_deals(
  p_category     text default null,
  p_min_discount integer default 0,
  p_sort         text default 'discount',
  p_search       text default null,
  p_origin       text default 'all',
  p_store_ids    text[] default null,
  p_max_rows     integer default 6000,
  p_zero_discount_only boolean default false,
  p_country      text default null
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
    /* No SQL-side country WHERE filter — see header comment.
       The country-priority ORDER BY below is enough to solve the
       starvation problem; per-country gating happens in JS where
       the cross-border allowlist + roster substring matching live. */
  order by
    /* Country-priority — anchored-local rows always sort first
       when p_country is set, so they survive the limit cap even
       when the global pool is dominated by AliExpress (~4600 rows)
       + UK retailers + DHgate. The downstream JS filter trims the
       remainder to the visitor's allowlist. */
    case when p_country is not null and store_country = upper(p_country) then 0 else 1 end,
    case when p_zero_discount_only then scraped_at end desc nulls last,
    case when p_sort = 'discount'   then discount_percent end desc nulls last,
    case when p_sort = 'newest'     then scraped_at       end desc nulls last,
    case when p_sort = 'price_asc'  then current_price    end asc  nulls last,
    case when p_sort = 'price_desc' then current_price    end desc nulls last,
    discount_percent desc nulls last,
    offer_id asc
  limit p_max_rows;
$$;

-- Sanity checks after applying:
--   -- AliExpress should pass for UK origin=intl
--   select count(*) from browse_deals(p_country=>'UK', p_origin=>'intl');
--
--   -- NG anchored stores all present
--   select store_id, count(*) from browse_deals(p_country=>'NG', p_max_rows=>5000)
--   where store_id in ('konga','healthplus','ajebomarket','supermart','threechub','medplus','bitmarte','slot')
--   group by store_id;
--
--   -- Global stores are now international
--   select id, is_international from stores
--   where lower(id) ~ '(aliexpress|dhgate|shein|temu)';
