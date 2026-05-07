-- ──────────────────────────────────────────────────────────────────
-- Backfill stores.country for non-NG retailers.
--
-- Why this exists:
--   The original ingestion (src/lib/providers/ingestion.ts) wrote
--   country = 'NG' for any NGN-priced offer and country = null for
--   everything else. That left every UK / US / DE / AE / IN / ZA
--   retailer with country = null, which broke per-country queries
--   like the chip-pool RPC (suggest_multistore_products) — a UK
--   user got zero matches because no store had country = 'UK'.
--
--   Patterns below are derived from COUNTRY_STORES in
--   src/lib/country.ts (single source of truth) plus observed
--   storeIds from the live catalog. First-matching pattern wins;
--   storeIds already correctly tagged 'NG' aren't touched.
--
-- Idempotency:
--   Each UPDATE is gated on country IS NULL, so re-running this
--   migration is safe. To force-recompute (e.g. after fixing a
--   pattern), wrap in `update stores set country = null where ...`
--   first, then re-run.
--
-- Stores that DON'T get tagged here:
--   AliExpress, DHGate, Shein, Temu — truly global, no native
--   country market. They keep country = null and act as universal
--   cross-border options in the chip rule (which requires AT LEAST
--   one COUNTRY-LOCAL store + 2 distinct stores total).
-- ──────────────────────────────────────────────────────────────────

-- UK retailers
update stores
set country = 'UK'
where country is null
  and lower(id) ~ '(amazon\.co\.uk|amazon-co-uk|^argos|^currys|^asos|john-lewis|johnlewis|^boots|^next$|^ao$|ao-com|tesco|sainsbury|debenhams|halfords|sports-direct|sportsdirect|^very|primark|^matalan|river-island|selfridges|marks-spencer|qvc-uk|^superdrug|jd-sports|decathlon-uk|peter-tyson|asus-store-uk|^very|smyths-toys|brown-thomas|h-samuel|michael-kors-uk|swarovski-uk|crampton-moore|cherry|^smol|the-range|frasers|appliances-direct|kitchenaid-united-kingdom|sports-direct-uk|dell-uk|qvc|jd-williams|^boozt|fashion-world|the-bank-of-electronics|home-outlet-direct|^waitrose-partners|asda-george)';

-- US retailers
update stores
set country = 'US'
where country is null
  and lower(id) ~ '(amazon\.com|^amazon$|^walmart|^best-buy|^bestbuy|^target|^newegg|home-depot|homedepot|^macy|^kohl|costco|nordstrom|^sephora|^ulta|wayfair|^etsy|^old-navy|oldnavy|^nfm|^dell|dick-s-sporting|b-h-photo|fashion-nova|sweetwater|^hsn$|^harvey-norman|^abercrombie|home-outlet|crutchfield|adorama|tennis-warehouse|champs-sports|shopwss|walgreens|cleamol|micro-center|the-sound-factor|williams-sonoma|^big-sandy-superstore|^office-depot|sacramento-state|chico-s|maurices|gap|nike$|nike-official|adidas$|^audio-advice|^carote|^doogee|^gmktec|^kikcoin|^knoc-knoc|^shopaudioxtc|^techmate|^turtle-beach|^darionindustries|^gilt|^dermstore|^ulta-beauty|^laura-geller|^fragrancenet|^beauty-house|upcircle-beauty|^big-sandy)';

-- DE retailers
update stores
set country = 'DE'
where country is null
  and lower(id) ~ '(amazon\.de|amazon-de|mediamarkt|media-markt|^saturn|^otto$|zalando|cyberport|notebooksbilliger|alternate|tchibo|^idealo|^about-you|^galaxus|vevor-de|sephora-de|boozt-de|^scharferladen|pccomponentes-de|thomann-de|sephora-de)';

-- AE retailers
update stores
set country = 'AE'
where country is null
  and lower(id) ~ '(amazon\.ae|amazon-ae|^noon$|sharaf|carrefour-uae|^lulu|namshi|ounass|centrepoint|6thstreet|sun-sand-sports-uae|sephora-uae|sharafdg|^al-ramil|^dhabi-one|virgin-megastore|ounass-ae|sharafdg|^al-ramil)';

-- IN retailers
update stores
set country = 'IN'
where country is null
  and lower(id) ~ '(amazon\.in|amazon-in|^flipkart|myntra|^ajio|tatacliq|tata-cliq|^snapdeal|^nykaa|^firstcry|^meesho|^croma|reliance|jiomart|^fastrak|^smytten|swiss-beauty|hyugalife|sangeetha-mobiles|motorola-india|reliance-digital|^vlebazaar|hifimart|asomanutritions-in|tata-cliq-fashion|^gameloot|93mobiles|desertcart-in|^himkhand|^gauryog|computech|^saumyasstore|outdoorphoto|kamal-imaging|^syga|^ubuy|^purplle|^mamaearth|^beautyonline|^iherb|^mobilegoo|^national-mobile|^mobile-express|^reliance-digital|^audio-visual-kart|^the-revolver-club|^the-reliable-store|^getit|^gear-change|^addmecart|^unboxify|^vijay|vijaysales|^shopclues|^purplle-com|^nykaa-now|^lookfantastic|^techinn|^techd-out|^geekompc|^neural-system|^alp-it-solutions|^evetech|^trendyol|^green-man-gaming|^undiscovered-realm|^national-mobile|hitech-gamez|^safe-and-sound|^audio-advice|^ads-store|^grab-your-gadget|electronic-express|^smol|^procook|^smol)';

-- ZA retailers
update stores
set country = 'ZA'
where country is null
  and lower(id) ~ '(amazon\.co\.za|amazon-co-za|^takealot|^makro$|^game$|^loot|wantitall|yuppiechef|superbalist|^zando|everyshop|^incredible|^checkers|pick-n-pay|picknpay|onedayonly|sportsmans-warehouse|cash-converters|^edgars|^builders|^kloppers|^dunns|^old-khaki|^rebel|^mhc-world|^evetech|^computer-mania|^the-digital-experience|^outdoorphoto|^addmecart|^pick-n-pay-hypermarket|^harvey-norman|^undiscovered-realm|^maxfashion)';

-- Sanity check after applying
-- select country, count(*) from stores group by country order by count(*) desc;
