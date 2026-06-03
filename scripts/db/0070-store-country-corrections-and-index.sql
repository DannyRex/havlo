-- 0070 — Store-country data corrections + the missing stores.country index.
-- From the June 2026 deep data + perf audit. Apply in the Supabase SQL editor.
-- All idempotent.

begin;

-- 1. PERF: there was NO index on the `stores` table at all, yet
--    `country = upper(<cc>)` is the single most-evaluated predicate in the
--    system (browse_deals, list_country_stores_with_counts, every
--    getOriginCounts head-count, hub queries, trending). Partial index on
--    the non-null anchors keeps it tiny.
create index if not exists idx_stores_country on stores(country) where country is not null;
analyze stores;

-- 2. DATA: stores whose NAME carries an explicit ccTLD that contradicts the
--    stored `country` (mis-anchored at ingest -> wrong local/intl bucketing
--    for those markets). The ccTLD in the name is authoritative.
--    (The generic `amazon` row's "Amazon.co.za" name is corrected separately
--    in 0069.)
update stores set country = 'AE' where id = 'nike-ae'         and country <> 'AE';
update stores set country = 'AE' where id = 'bloomingdales-ae' and country <> 'AE';
update stores set country = 'AE' where id = 'nextmobile-ae'    and country <> 'AE';
update stores set country = 'UK' where id = 'adidas'           and country <> 'UK';  -- name "adidas.co.uk"
update stores set country = 'UK' where id = 'zalando'          and country <> 'UK';  -- name "Zalando.co.uk"
update stores set country = 'DE' where id = 'adidas-de'        and country <> 'DE';
update stores set country = 'DE' where id = 'sportsdirect-de'  and country <> 'DE';

-- 3. DATA: single category leak — `televisions` is not a real Havlo category.
update products set category_slug = 'electronics' where category_slug = 'televisions';

commit;
