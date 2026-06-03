-- 0069 — Give Amazon US (amazon.com) its own store identity.
--
-- Problem (confirmed June 2026): there is no `amazon-us` / `amazon-com`
-- store. The SerpAPI canonicaliser collapsed amazon.com into the generic
-- `amazon` store_id, which is itself corrupted (country='AE',
-- name='Amazon.co.za'). So US Amazon never surfaced as US:
--   - /[cc]/amazon country filter had no "United States" option
--   - /deals "International" bucket never showed amazon.com (it was
--     allowlisted in COUNTRY_CROSS_BORDER for NG/UK/DE/AE/ZA but no
--     amazon-us store existed to match)
-- product_best_offers Amazon distribution was UK/IN/AE/DE/ZA, zero US.
--
-- The app fix (search-serpapi.ts canonicaliseSource/inferStoreId +
-- country.ts US roster) makes FUTURE amazon.com ingests land in
-- `amazon-us` (country US). This migration fixes the EXISTING data.
--
-- Idempotent. Apply in the Supabase SQL editor.

begin;

-- 1. Create the amazon-us store. is_international=true keeps it in the
--    browse_deals cross-border pass (consistent with the other amazon-*
--    marketplaces, which are all is_international=true); store_country='US'
--    is what makes it bucket as US-local / cross-border-for-others.
insert into stores (id, name, country, is_international, trusted)
values ('amazon-us', 'Amazon US', 'US', true, true)
on conflict (id) do update
  set name             = excluded.name,
      country          = 'US',
      is_international  = true,
      trusted          = true;

-- 2. Re-point existing amazon.com (US) offers off the generic `amazon`
--    bucket onto amazon-us. Matches the amazon.com host but NOT regional
--    TLDs like amazon.com.au / amazon.com.br. UNIQUE(store_id,url) can't
--    collide because amazon-us was just created empty.
update offers
   set store_id = 'amazon-us'
 where store_id = 'amazon'
   and url ~* 'amazon\.com(/|\?|$)'
   and url !~* 'amazon\.com\.[a-z]{2}';

-- 3. Fix the corrupted generic `amazon` store row. It is an ambiguous
--    catch-all (mostly unresolved Google relay URLs from AE/ZA ingests),
--    so it should NOT be named "Amazon.co.za". Rename to plain "Amazon";
--    leave its country as-is (the real per-marketplace amazon rows live
--    under amazon-uk / amazon-us / amazon-de / amazon-ae / amazon-in /
--    amazon-co-za-seller, and the relay resolver re-homes these over time).
update stores
   set name = 'Amazon'
 where id = 'amazon'
   and name = 'Amazon.co.za';

commit;

-- Verify after applying:
--   select store_id, store_country, count(*)
--     from product_best_offers where store_id ilike 'amazon%'
--    group by 1,2 order by 3 desc;
-- Expect an amazon-us / US row to appear.
