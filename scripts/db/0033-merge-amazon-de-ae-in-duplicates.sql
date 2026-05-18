-- ──────────────────────────────────────────────────────────────────
-- Migration 0033: consolidate amazon-{de,ae,in} duplicates
--
-- Pattern from 0031 (amazon-co-uk → amazon-uk) applied to the other
-- Amazon marketplaces. The May 2026 launch-readiness audit caught:
--
--   DE local-tab roster: "Amazon DE" + "Amazon.de" — same merchant,
--     two store_id rows. Result: /de/deals shows 2 effective stores
--     instead of the 11-store DE roster, fragmenting the store filter
--     pills and the catalog-coverage perception.
--
--   AE local-tab roster: "Amazon AE" + "Amazon UAE" — same pattern.
--
--   IN local-tab — same pattern likely (less audit signal because
--     IN is one of the lowest-traffic markets).
--
-- This migration handles all three pairs the same way:
--   1. Pick canonical id (amazon-de / amazon-ae / amazon-in — the
--      shorter, dotless form that matches the inferStoreCountry
--      naming convention and the curated-Amazon slug pattern
--      "amazon-{marketplace}-{slug}").
--   2. Ensure the canonical row exists in stores.
--   3. Move offers from the duplicate id → canonical id, deduping
--      on the (store_id, url) UNIQUE constraint.
--   4. Drop the duplicate stores row.
--
-- Idempotent — DO blocks skip when the source id doesn't exist.
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('amazon.de', 'amazon-de', 'Amazon DE', 'DE'),
      ('amazon.ae', 'amazon-ae', 'Amazon AE', 'AE'),
      ('amazon.in', 'amazon-in', 'Amazon IN', 'IN'),
      /* Defensive: catch the verbose names too. SerpAPI sometimes
         writes "amazon germany" / "amazon uae" / "amazon india" as
         storeName which the ingest dealToStoreRow() turns into a
         storeId slug like "amazon-germany". */
      ('amazon-germany',  'amazon-de', 'Amazon DE', 'DE'),
      ('amazon-uae',      'amazon-ae', 'Amazon AE', 'AE'),
      ('amazon-india',    'amazon-in', 'Amazon IN', 'IN')
    ) AS t(src_id, canonical_id, canonical_name, country_code)
  LOOP
    /* Skip cleanly if source id doesn't exist (idempotent re-run). */
    IF NOT EXISTS (SELECT 1 FROM stores WHERE id = pair.src_id) THEN
      CONTINUE;
    END IF;

    /* Ensure canonical row exists. Copy metadata from source if not. */
    INSERT INTO stores (id, name, country, url, logo_url, is_international, trusted)
    SELECT
      pair.canonical_id,
      pair.canonical_name,
      pair.country_code,
      url,
      '/logos/' || pair.canonical_id || '.png',
      is_international,
      trusted
      FROM stores WHERE id = pair.src_id
    ON CONFLICT (id) DO NOTHING;

    /* Backfill country on the canonical row if it's NULL. The new
       merged store should always have country set. */
    UPDATE stores
       SET country = pair.country_code
     WHERE id = pair.canonical_id
       AND country IS NULL;

    /* Move offers: drop duplicates on (store_id, url) FIRST so the
       UPDATE doesn't trip the UNIQUE constraint. */
    DELETE FROM offers
     WHERE store_id = pair.src_id
       AND url IN (SELECT url FROM offers WHERE store_id = pair.canonical_id);

    UPDATE offers
       SET store_id = pair.canonical_id
     WHERE store_id = pair.src_id;

    /* Drop the duplicate store row. */
    DELETE FROM stores WHERE id = pair.src_id;

    RAISE NOTICE 'Consolidated % → %', pair.src_id, pair.canonical_id;
  END LOOP;
END $$;

-- ── Part 2: backfill stores.country for any rows still NULL ──────
-- Many stores were ingested before COUNTRY_STORES roster expanded.
-- This is a one-shot best-effort backfill — uses substring patterns
-- that mirror inferStoreCountry's matching logic so the DB ends up
-- consistent with what the TypeScript layer thinks.

UPDATE stores SET country = 'NG'
 WHERE country IS NULL
   AND lower(id || ' ' || coalesce(name, '')) ~ '(konga|jumia|3c[ -]?hub|^slot$|pointek|fouani|zit-trading|hayathub|spar\.com\.ng|medplus|healthplus|^kara\.com\.ng|bitmarte|ajebomarket|obiwezy|essenza|supermart\.ng)';

UPDATE stores SET country = 'UK'
 WHERE country IS NULL
   AND lower(id || ' ' || coalesce(name, '')) ~ '(amazon\.co\.uk|amazon-co-uk|amazon-uk|^argos|^currys|john[ -]?lewis|^very$|^asos|^boots\.com|^next\.co\.uk|marks[ -]?(spencer|and-spencer)|selfridges|ao\.com|screwfix|wickes|halfords|sportsdirect|river[ -]?island|primark|matalan|house[ -]?of[ -]?fraser|debenhams|ebay\.co\.uk|b&q|diy\.com|jdsports|jd[ -]sports|dunelm|smyths|qvc[ -]?uk|qvc\.co\.uk|^marks |waitrose|ocado|morrisons|^iceland\.|aldi[ -]?uk|tk[ -]?maxx|hotel[ -]?chocolat|robert[ -]?dyas|the[ -]?range|toolstation|ebay[ -]?uk|ee\.co\.uk|ubisoft.*uk)';

UPDATE stores SET country = 'US'
 WHERE country IS NULL
   AND lower(id || ' ' || coalesce(name, '')) ~ '(amazon\.com$|amazon-com|amazon-us$|^walmart|best[ -]?buy|^target|^newegg|^ebay$|home[ -]?depot|^macy|^kohl|^costco|^bjs|^nordstrom|^sephora|^ulta|^wayfair|^etsy|^lowe|^staples|^gap$|old[ -]?navy|^nike|^adidas|^gamestop|qvc\.com|fashion[ -]?nova|dick.+sporting|nfm|nebraska[ -]?furniture|express\.com|going[ -]?going[ -]?gone|^ggg$|xbox\.com|bloomingdale|neiman[ -]?marcus|^saks|bed[ -]?bath|^loft$|^j\.?crew|michael[ -]?kors|tory[ -]?burch|ralph[ -]?lauren|tigerdirect|microcenter|^verizon|^att\.com|t-mobile|^tmobile|boost[ -]?mobile|cricket[ -]?wireless)';

UPDATE stores SET country = 'DE'
 WHERE country IS NULL
   AND lower(id || ' ' || coalesce(name, '')) ~ '(amazon\.de|amazon-de|amazon-germany|amazon germany|mediamarkt|media-markt|^saturn|^otto|^zalando|^idealo|notebooksbilliger|^alternate|^cyberport|^lidl|^kaufland|real\.de|^tchibo|^conrad|computeruniverse|voelkner|alza\.de|smyths-toys\.de|^rewe|^edeka|mytoys|^bonprix|^redcoon|^comtech|^douglas|^rossmann|dm\.de|^deichmann|thalia\.de|^thalia|^weltbild|hugendubel|^schiesser|esprit\.de|h&m[ -]?de|apple\.de|microsoft\.de|xbox\.de)';

UPDATE stores SET country = 'AE'
 WHERE country IS NULL
   AND lower(id || ' ' || coalesce(name, '')) ~ '(amazon\.ae|amazon-ae|amazon-uae|amazon uae|^noon|sharaf[ -]?dg|carrefour\.ae|carrefour uae|lulu[ -]?hypermarket|luluwebstore|firstcry\.ae|firstcry-ae|^centrepoint|^namshi|^ounass|^6thstreet|^ace\.ae|acehardware\.ae|jumbo\.ae|jumbo[ -]?electronics|^emax|plug-ins|^plugins\.ae|max[ -]?fashion|maxfashion\.ae|^splash|splashfashions|^babyshop|babyshopstores|mothercare\.ae|^shukran|home[ -]?centre|homecentre|westelm\.ae|west[ -]?elm[ -]?uae|pottery[ -]?barn[ -]?uae|ubuy\.ae|^desertcart|^letstango|^menakart)';

UPDATE stores SET country = 'IN'
 WHERE country IS NULL
   AND lower(id || ' ' || coalesce(name, '')) ~ '(amazon\.in|amazon-in|amazon[ -]?india|^flipkart|^myntra|^ajio|tata[ -]?cliq|tatacliq|^snapdeal|^nykaa|^firstcry$|^firstcry-in|^meesho|^croma|reliance[ -]?digital|reliancedigital|vijay[ -]?sales|vijaysales|^shopclues|^naaptol|^indiamart|^purplle|^1mg|tata[ -]?1mg|^lenskart|boat[ -]?lifestyle|^mamaearth|^swiggy|^zomato|^blinkit|^limeroad|^voonik|^abof|^yepme|vivo india|oneplus india|samsung india|^smytten|swiss[ -]?beauty|hyugalife|sangeetha[ -]?mobiles)';

UPDATE stores SET country = 'ZA'
 WHERE country IS NULL
   AND lower(id || ' ' || coalesce(name, '')) ~ '(^takealot|^makro|game\.co\.za|game[ -]?stores|loot\.co\.za|^wantitall|^yuppiechef|^superbalist|^zando|^everyshop|incredible[ -]?connection|incredibleconnection|^checkers|pick[ -]?n[ -]?pay|picknpay|wellness[ -]?warehouse|wellnesswarehouse|^clicks\.co\.za|dis-chem|^dischem|woolworths[ -]?sa|woolworths\.co\.za|^raru|^evetech|^bobshop|^spree\.co\.za|^mr[ -]?price|^mrp\.com|^mrprice|^edgars|^ackermans|^pep|^pepstores|^shoprite|checkers[ -]?hyper|builders[ -]?warehouse|wantitall\.co\.za|^kalahari)';

-- ── Sanity checks (run after applying) ────────────────────────────
-- SELECT id, name, country FROM stores WHERE id LIKE 'amazon%' ORDER BY id;
--   → expect: amazon, amazon-uk, amazon-de, amazon-ae, amazon-in
--     (no amazon.de / amazon.ae / amazon.in / amazon-germany / etc.)
--
-- SELECT country, count(*) FROM stores GROUP BY country ORDER BY 1 NULLS LAST;
--   → expect: NULL count significantly reduced from pre-migration
--     baseline. Stores still tagged NULL are true cross-border
--     globals (AliExpress / Shein / Temu / DHgate) which intentionally
--     have no anchored country.
