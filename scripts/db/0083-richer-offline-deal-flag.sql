-- 0083-richer-offline-deal-flag.sql
-- Richer, OFFLINE "deal" definition so a product can qualify as a deal beyond
-- just discount_percent>0. Computed once per matview refresh (NOT per request),
-- so the precomputed category counts can be gated on the SAME predicate the
-- live path uses (closing the precompute-vs-live fidelity gap).
--
-- is_real_deal = discount_percent>0
--             OR cross_store_cheapest   (this product's cheapest in-stock offer
--                                         beats the cheapest offer at a DIFFERENT
--                                         store by >1% — a real multi-store saving)
--             OR below_30d_high         (current price is >1% below its own
--                                         30-day high, from offer_price_history)
--
-- ── Corrections vs the first draft (adversarial review) ──────────────────────
--   • cross_store_cheapest now requires a runner-up from a DIFFERENT store_id.
--     Offers are unique by (store_id, url), so one store routinely carries
--     several offers for a product; ranking by row_number() and taking rn=2 as
--     the "runner-up store" fires on SINGLE-store products (the "trivially true"
--     bug). The runner CTE below joins on r.store_id <> anchor.store_id, which
--     also guarantees >=2 distinct stores (mirrors the count(distinct store_id)
--     gate in 0055/0082).
--   • hist filters product_id IS NOT NULL — 0081 made offer_price_history.
--     product_id nullable (ON DELETE SET NULL), so a 30-day window can contain
--     orphan rows; skip that bucket.
--   • Wrapped in a transaction. Changing the matview's COLUMNS means DROP+CREATE
--     (no CREATE OR REPLACE for matviews), and the CASCADE drops product_best_offers
--     + the RPCs that depend on it. 0079 deliberately avoided that. BEGIN/COMMIT
--     makes the swap atomic: any error rolls back to the working 0079 view rather
--     than leaving the deals/browse/search path headless.
--
-- ── Honest caveats ───────────────────────────────────────────────────────────
--   • below_30d_high is THIN at launch: offer_price_history only gains depth once
--     the weekly snapshot (0082) accumulates points, and a steady price has
--     max(30d)==current so the signal is false. It grows over time; harmless
--     meanwhile.
--   • Currency model is binary today: offers.currency is CHECK('NGN','USD') and
--     foreign prices are USD-normalized at ingest, so the fx_rates lookup only
--     ever resolves NGN/USD. The USD normalization still matters for the
--     NGN-vs-USD anchor/runner comparison and matches 0079.
--
-- Diagnostic columns below_30d_high + cross_store_cheapest are materialized too,
-- so they can later drive user-facing badges without another migration.
--
-- Apply in the Supabase SQL editor (it is one transaction). product_best_offers
-- keeps its existing 18 columns in identical order with 3 appended, so
-- SELECT-shape consumers are unaffected.

begin;

-- ── 1) rebuild the cheapest-offer matview with the richer flags ──────────────
drop materialized view if exists mv_cheapest_offer_usd cascade;

create materialized view mv_cheapest_offer_usd as
with ranked as (
  select
    o.product_id,
    o.id        as offer_id,
    o.store_id,
    o.discount_percent,
    o.current_price / coalesce(
      (select fr.rate from public.fx_rates fr
        where fr.base = 'USD' and fr.quote = coalesce(o.currency, 'USD')),
      case when coalesce(o.currency, 'USD') = 'NGN' then 1650 else 1 end
    ) as usd_px,
    row_number() over (
      partition by o.product_id
      order by o.current_price / coalesce(
        (select fr.rate from public.fx_rates fr
          where fr.base = 'USD' and fr.quote = coalesce(o.currency, 'USD')),
        case when coalesce(o.currency, 'USD') = 'NGN' then 1650 else 1 end
      ) asc, o.id asc
    ) as rn
  from offers o
  where o.in_stock = true
),
anchor as (
  select product_id, offer_id, store_id, usd_px, discount_percent
  from ranked
  where rn = 1
),
-- cheapest offer from a store OTHER than the anchor's (guarantees >=2 stores)
runner as (
  select r.product_id, min(r.usd_px) as second_usd
  from ranked r
  join anchor a
    on a.product_id = r.product_id
   and r.store_id <> a.store_id
  group by r.product_id
),
-- 30-day high (USD-normalized), >=2 distinct recorded points, no orphan rows
hist as (
  select
    h.product_id,
    max(h.price / coalesce(
      (select fr.rate from public.fx_rates fr
        where fr.base = 'USD' and fr.quote = coalesce(h.currency, 'USD')),
      case when coalesce(h.currency, 'USD') = 'NGN' then 1650 else 1 end
    )) as high_usd,
    count(distinct h.recorded_at) as point_count
  from offer_price_history h
  where h.recorded_at > now() - interval '30 days'
    and h.product_id is not null
  group by h.product_id
)
select
  a.product_id,
  a.offer_id,
  a.usd_px      as anchor_usd,
  r.second_usd,
  (r.second_usd is not null and a.usd_px < r.second_usd * 0.99) as cross_store_cheapest,
  (h.point_count >= 2 and a.usd_px < h.high_usd * 0.99)         as below_30d_high,
  (
    coalesce(a.discount_percent, 0) > 0
    or (r.second_usd is not null and a.usd_px < r.second_usd * 0.99)
    or (h.point_count >= 2 and a.usd_px < h.high_usd * 0.99)
  ) as is_real_deal
from anchor a
left join runner r on r.product_id = a.product_id
left join hist   h on h.product_id = a.product_id;

-- unique index required by REFRESH MATERIALIZED VIEW CONCURRENTLY (refresh_cheapest_offers)
create unique index if not exists mv_cheapest_offer_usd_product_id_idx
  on mv_cheapest_offer_usd (product_id);
create index if not exists mv_cheapest_offer_usd_real_deal_idx
  on mv_cheapest_offer_usd (is_real_deal);

-- ── 2) product_best_offers: existing 18 cols (identical order) + 3 appended ───
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
  s.country              as store_country,
  m.is_real_deal,
  m.below_30d_high,
  m.cross_store_cheapest
from mv_cheapest_offer_usd m
join products p on p.id = m.product_id
join offers   o on o.id = m.offer_id
join stores   s on s.id = o.store_id;

-- ── 3) browse_deals: add opt-in p_deals_only + return is_real_deal ───────────
-- DEFAULT false ⇒ zero behaviour change until a caller passes p_deals_only.
-- DROP signature matches the CURRENT 10-arg function (…p_rotate_seed integer);
-- the new function adds p_deals_only as the 11th arg.
drop function if exists browse_deals(text, integer, text, text, text, text[], integer, boolean, text, integer);

create or replace function browse_deals(
  p_category           text     DEFAULT NULL,
  p_min_discount       integer  DEFAULT 0,
  p_sort               text     DEFAULT 'discount',
  p_search             text     DEFAULT NULL,
  p_origin             text     DEFAULT 'all',
  p_store_ids          text[]   DEFAULT NULL,
  p_max_rows           integer  DEFAULT 6000,
  p_zero_discount_only boolean  DEFAULT false,
  p_country            text     DEFAULT NULL,
  p_rotate_seed        integer  DEFAULT 0,
  p_deals_only         boolean  DEFAULT false
)
RETURNS TABLE (
  product_id        uuid,
  title             text,
  category_slug     text,
  brand             text,
  image_url         text,
  offer_id          uuid,
  store_id          text,
  url               text,
  current_price     numeric(12,2),
  original_price    numeric(12,2),
  discount_percent  integer,
  currency          text,
  scraped_at        timestamptz,
  store_name        text,
  is_international   boolean,
  store_logo_url    text,
  store_country     text,
  is_real_deal      boolean
)
LANGUAGE sql STABLE AS $$
  SELECT
    pbo.product_id, pbo.title, pbo.category_slug, pbo.brand, pbo.image_url,
    pbo.offer_id, pbo.store_id, pbo.url, pbo.current_price, pbo.original_price,
    pbo.discount_percent, pbo.currency, pbo.scraped_at, pbo.store_name,
    pbo.is_international, pbo.store_logo_url, pbo.store_country, pbo.is_real_deal
  FROM product_best_offers pbo
  WHERE (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
    AND (p_zero_discount_only = false OR COALESCE(pbo.discount_percent, 0) = 0)
    AND (p_zero_discount_only = true  OR COALESCE(p_min_discount, 0) = 0 OR COALESCE(pbo.discount_percent, 0) >= p_min_discount)
    AND (p_deals_only = false OR pbo.is_real_deal = true)
    AND (p_search IS NULL OR pbo.title ILIKE '%' || p_search || '%')
    AND (p_origin = 'all'
         OR (p_origin = 'local' AND ((p_country IS NOT NULL AND pbo.store_country = upper(p_country)) OR (p_country IS NULL AND pbo.is_international = false)))
         OR (p_origin = 'intl'  AND pbo.is_international = true))
    AND (p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL OR pbo.store_id = ANY(p_store_ids))
    AND (p_country IS NULL OR pbo.store_country = upper(p_country) OR (pbo.store_country IS NULL AND pbo.is_international = true))
  ORDER BY
    CASE WHEN p_country IS NOT NULL AND pbo.store_country = upper(p_country) THEN 0 ELSE 1 END,
    CASE WHEN p_zero_discount_only THEN pbo.scraped_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'discount'   THEN COALESCE(pbo.discount_percent, 0) END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'     THEN pbo.scraped_at    END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc'  THEN pbo.current_price END ASC  NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN pbo.current_price END DESC NULLS LAST,
    COALESCE(pbo.discount_percent, 0) DESC NULLS LAST, pbo.offer_id ASC
  LIMIT p_max_rows;
$$;

commit;

-- search_deals_fts (0042) is intentionally left unchanged — it has no deals-only
-- mode and its RETURNS TABLE shape stays as-is.
--
-- ── Sanity checks (run AFTER commit) ─────────────────────────────────────────
--   -- How many products qualify under each signal (validate below_30d_high
--   -- isn't dead weight before relying on it):
--   select count(*) filter (where is_real_deal)        as real_deals,
--          count(*) filter (where cross_store_cheapest) as x_store,
--          count(*) filter (where below_30d_high)       as below_high,
--          count(*)                                      as total
--   from product_best_offers;
--   -- Cross-store flag must never fire on a single-store product (expect 0):
--   select count(*) from product_best_offers pbo
--   where pbo.cross_store_cheapest
--     and (select count(distinct o.store_id) from offers o
--          where o.product_id = pbo.product_id and o.in_stock) < 2;
