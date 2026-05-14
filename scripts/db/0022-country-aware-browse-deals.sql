-- ──────────────────────────────────────────────────────────────────
-- Country-aware browse_deals + NG backfill.
--
-- WHY THIS EXISTS
--
--   Migration 0019 introduced browse_deals as a global top-N pool
--   (4000 rows by discount DESC + 2000 rows of freshest 0% rows =
--   6000 max). Country-filtering happened in JS via
--   filterDealsForCountry. That works for markets whose retailers
--   discount aggressively (UK / US / AE / IN have decent share at
--   the high-discount end), but NG 0%-only retailers (HealthPlus,
--   Ajebomarket, Bitmarte, Supermart, Slot) get starved out of the
--   6000-row global pool because:
--
--     - Pass A sorts by discount DESC → 0%-only NG rows sit at
--       the very bottom, edged out by ~4000 discounted rows from
--       AliExpress + UK retailers + DHgate
--     - Pass B is freshness-sorted within 0%-discount only, but
--       all 0% rows globally compete for those 2000 slots — NG
--       pharmacy / grocery feeds often scraped less recently than
--       global 0% feeds, so they lose Pass B too
--
--   User report May 2026 retest: "/ng/deals at origin=all has 133
--   stores in the dropdown but HealthPlus, Ajebomarket, Bitmarte,
--   Supermart, Slot are all absent despite having 100-554 offers
--   each in the catalog audit."
--
--   Fix: make browse_deals country-aware. When p_country is set,
--   filter to rows whose store is either anchored in that country
--   (stores.country = upper(p_country)) OR is a truly global
--   cross-border shipper (stores.country IS NULL with
--   is_international = true). This isolates each market's pool
--   from the global volume and gives every country its own
--   six-thousand-row headroom.
--
-- WHAT THIS MIGRATION DOES
--
--   Part 1: backfill stores.country for NG-anchored retailers
--           (migration 0011 only covered non-NG). Pattern set
--           derived from src/lib/country.ts NG_STORES + observed
--           live storeIds.
--
--   Part 2: replace browse_deals with a country-aware variant. New
--           p_country parameter (default null = current global
--           behaviour). When supplied, filters rows AND prioritises
--           country-local in the ORDER BY so they always survive
--           the limit cap even when the cross-border pool is huge.
--
--   Part 3: refresh product_best_offers to expose s.country alongside
--           the existing is_international. (Otherwise we'd need a
--           cross-table join at every RPC call. Adding the column
--           to the view is free — the underlying join is identical.)
--
-- IDEMPOTENCY
--   Backfill UPDATEs are gated on `country is null` so reruns don't
--   reclassify already-tagged rows. The RPC + view are CREATE OR
--   REPLACE. Safe to apply multiple times.
-- ──────────────────────────────────────────────────────────────────

-- ── Part 1: NG country backfill ──────────────────────────────────
update stores
set country = 'NG'
where country is null
  and lower(id) ~ '(^konga$|^jumia|3c-hub|3chub|^slot$|^pointek|^ajebomarket|^healthplus|^medplus|^bitmarte|^kara|^obiwezy|^supermart|^essenza|^foodco|^addidemart|^pricepally|^payporte|^spar-ng|^sparng|^jiji-ng|^yudala|^megaplaza|^tezza|^mobinex|^carfax-ng|^carfax\.com\.ng|^switz-electronics|^switzelectronics|^okadabooks|^fouani|^zit-trading|^hayathub|^park-n-shop|^parknshop)';

-- ── Part 2: re-extend non-NG patterns for newly-ingested storeIds ─
--   These were observed in the May 2026 store-audit (scripts/
--   audit-top-stores.ts) but missed by migration 0011's regex.
update stores
set country = 'UK'
where country is null
  and lower(id) ~ '(^amazon-uk$|^marks-electrical$|^everymonday$|^the-range$|^waitrose-partners$|^iceland$|^screwfix$|^smyths-toys$|^debenhams$|^currys-business$|^john-lewis-partners$|^sports-direct-uk$|^jd-sports-global$)';

update stores
set country = 'US'
where country is null
  and lower(id) ~ '(^walmart-|^ebay-|^newegg-com-|^lowestrate-shopping$|^nike-official$|^carote-official$|^gmktec-usa$|^cellphonemax$|^turtle-beach$|^minisforum|^shopaudioxtc$|^hotdeals$|^macy-s$|^kohl-s$|^dick-s-sporting-goods$|^ulta-beauty$|^home-depot$)';

update stores
set country = 'DE'
where country is null
  and lower(id) ~ '(^amazon-de-amazon-de-seller$|^en-zalando-de$|^mediamarkt-de$)';

update stores
set country = 'AE'
where country is null
  and lower(id) ~ '(^amazon-ae-seller$|^amazon-ae-retail$|^ounass-ae$|^lulu-hypermarket$)';

update stores
set country = 'IN'
where country is null
  and lower(id) ~ '(^tata-cliq-fashion$|^tata-cliq-luxury$|^myntra-mnow$|^nykaa-fashion$|^nykaa-now$|^shopsy-by-flipkart$|^reliance-digital$|^vijay-sales$|^93mobiles$)';

update stores
set country = 'ZA'
where country is null
  and lower(id) ~ '(^pick-n-pay-hypermarket$|^superbalist$|^takealot$|^makro$|^yuppiechef$)';

-- ── Part 3: refresh product_best_offers to expose store_country ──
--   Surfaces stores.country in the view so browse_deals can filter
--   without a per-call extra join. Same row-shape PLUS the new
--   column; existing consumers ignore the additional field, no
--   breakage.
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
  s.country              as store_country,
  s.logo_url             as store_logo_url
from products p
join lateral (
  select * from offers
  where offers.product_id = p.id
    and offers.in_stock = true
  order by offers.current_price asc
  limit 1
) o on true
join stores s on s.id = o.store_id;

-- ── Part 4: country-aware browse_deals ───────────────────────────
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
    /* Country filter — when p_country is set, keep rows whose
       store is anchored to that country OR is a truly global
       cross-border shipper (store_country IS NULL + is_international
       = true: AliExpress, DHgate, Shein, Temu). Stores anchored to
       a DIFFERENT country are dropped (a UK retailer's offer is not
       useful to an NG shopper, and vice versa). When p_country is
       null, behaves identically to the pre-0022 RPC (no filter). */
    and (p_country is null
         or store_country = upper(p_country)
         or (store_country is null and is_international = true))
  order by
    /* Country prioritisation — when p_country is set, anchored-
       local rows sort FIRST so they always survive the limit cap
       even when the cross-border pool is huge. AliExpress at 4638
       rows shouldn't push NG pharmacy stores out of the response. */
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
--   select count(*) from browse_deals(p_country=>'NG', p_max_rows=>10);
--   select store_id, count(*) from browse_deals(p_country=>'NG', p_max_rows=>5000) group by store_id order by 2 desc limit 10;
--   select country, count(*) from stores group by country order by 2 desc;
