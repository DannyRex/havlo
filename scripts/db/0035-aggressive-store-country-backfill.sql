-- ──────────────────────────────────────────────────────────────────
-- Migration 0035: aggressive backfill of stores.country
--
-- Context (May 2026 launch-readiness pass): after 0011 + 0033's
-- explicit-roster backfills landed, 890 of 1,000 stores STILL had
-- country=NULL. The roster regexes only matched stores we'd
-- explicitly enumerated; the long tail (American Eagle Outfitters,
-- Sony Store Online UK, Dell South Africa, Cash Crusaders, AT&T,
-- mobile-phones-direct, wallis-uk, oppostore.co.uk, wmf-com-de,
-- and ~300+ other clearly country-anchored stores) stayed NULL.
--
-- Consequence: those stores get filtered OUT for every visitor in
-- filterDealsForCountry (since they're not in any country roster
-- AND they're untagged). Effectively orphaned — paid SerpAPI
-- credits to ingest them, but they never reach a user.
--
-- This migration uses three heuristic layers, each more specific:
--   1. TLD in storeId — `.co.uk`, `.de`, `.co.za`, `.ae`, `.com.ng`
--      etc. Most reliable signal — a domain TLD strongly implies
--      market anchorage.
--   2. Name/ID suffix — `-uk`, `-de`, `-za`, `uk` / `germany` /
--      `south africa` / `uae` / `india` substring in NAME.
--   3. Common-brand catch-all for big retailers not on the rosters
--      yet (American Eagle, AT&T, Bath & Body Works, etc.) —
--      adds another layer of US/UK coverage.
--
-- Order matters: each UPDATE skips rows where country IS NOT NULL,
-- so the more-reliable signal (TLD) gets first pass. Later passes
-- can't overwrite an established tag.
--
-- Expected result: ~600-700 of the 890 NULL rows get tagged. The
-- residue (~200-300) are stores with truly opaque IDs / names
-- (Unihertz, "AND", "Big Apple Buddy", etc.) — those stay NULL,
-- which means they're filtered out of every market pool. That's
-- correct: if we can't confidently place a store, the user
-- shouldn't see it.
--
-- Idempotent — all UPDATEs are WHERE country IS NULL.
-- ──────────────────────────────────────────────────────────────────

-- ── Layer 1: TLD in storeId (most reliable) ───────────────────────

-- UK: .co.uk, .uk
UPDATE stores SET country = 'UK'
 WHERE country IS NULL
   AND (id ~* '\.co\.uk(\W|$)|\.uk(\W|$)|-co-uk(\W|$)|-uk-' OR id ~* '\.co-uk(\W|$)');

-- Germany: .de
UPDATE stores SET country = 'DE'
 WHERE country IS NULL
   AND (id ~* '\.de(\W|$)|-de(\W|$)' AND id !~* 'aldi-de-uk');  -- defensive: avoid mis-tagging German-named UK stores

-- South Africa: .co.za, .za
UPDATE stores SET country = 'ZA'
 WHERE country IS NULL
   AND id ~* '\.co\.za(\W|$)|\.za(\W|$)|-co-za(\W|$)|-za(\W|$)';

-- UAE: .ae
UPDATE stores SET country = 'AE'
 WHERE country IS NULL
   AND id ~* '\.ae(\W|$)|-ae(\W|$)';

-- India: .in, .co.in
UPDATE stores SET country = 'IN'
 WHERE country IS NULL
   AND id ~* '\.in(\W|$)|\.co\.in(\W|$)|-co-in(\W|$)|-in(\W|$)';

-- Nigeria: .com.ng, .ng
UPDATE stores SET country = 'NG'
 WHERE country IS NULL
   AND id ~* '\.com\.ng(\W|$)|\.ng(\W|$)|-com-ng(\W|$)';

-- US: .com, .us — applied LAST among TLDs because .com is the
-- broadest signal. Only catches stores whose ID is JUST .com /
-- domain.com (no country prefix). After UK/DE/ZA/AE/IN/NG pre-
-- claim, leftover .com stores are presumed US-anchored.
UPDATE stores SET country = 'US'
 WHERE country IS NULL
   AND (id ~* '\.com(\W|$)|-com(\W|$)|\.us(\W|$)|-us(\W|$)');

-- ── Layer 2: name/ID suffix patterns ──────────────────────────────

-- UK: "UK" suffix in name, "-uk" in id
UPDATE stores SET country = 'UK'
 WHERE country IS NULL
   AND (
     name ~* '\W(UK|United Kingdom|Britain)(\W|$)'
     OR id ~* '(^|\W)uk(\W|$)|-uk-|^uk-'
     OR name ~* '(^|\s)(Argos|Currys|John Lewis|Boots|Next|M&S|Marks & Spencer|Selfridges|Harrods|Debenhams|JD Sports|Sports Direct|Argos|Halfords|Wickes|Screwfix|B&Q|Smyths)(\s|$)'
   );

-- South Africa: name patterns
UPDATE stores SET country = 'ZA'
 WHERE country IS NULL
   AND (
     name ~* 'south africa|\WSA(\W|$)'
     OR id ~* 'south-africa|-sa$|^sa-'
     OR name ~* '(^|\s)(Takealot|Makro|Loot|Wantitall|Yuppiechef|Superbalist|Zando|Everyshop|Incredible Connection|Cellucity|Cash Crusaders|Wellness Warehouse|Dis-Chem|Clicks)(\s|$)'
   );

-- Germany: name patterns
UPDATE stores SET country = 'DE'
 WHERE country IS NULL
   AND (
     name ~* 'germany|deutschland'
     OR id ~* 'germany|deutschland'
     OR name ~* '(^|\s)(MediaMarkt|Saturn|Otto|Zalando|Conrad|Lidl|Kaufland|Tchibo|Notebooksbilliger|Cyberport|Alternate)(\s|$)'
   );

-- UAE: name patterns
UPDATE stores SET country = 'AE'
 WHERE country IS NULL
   AND (
     name ~* '\W(UAE|U\.A\.E\.|Dubai|Abu Dhabi|Emirates)(\W|$)'
     OR id ~* 'uae|dubai|emirates'
     OR name ~* '(^|\s)(Noon|Sharaf DG|Carrefour UAE|Lulu Hypermarket|Centrepoint|Namshi|Ounass|6thStreet|Jumbo|Splash|Babyshop|Letstango|Menakart|Desertcart)(\s|$)'
   );

-- India: name patterns
UPDATE stores SET country = 'IN'
 WHERE country IS NULL
   AND (
     name ~* '\WIndia(\W|$)|\WIndian(\W|$)'
     OR id ~* '(^|-)india(-|$)|(^|-)indian(-|$)'
     OR name ~* '(^|\s)(Flipkart|Myntra|Ajio|Tata CLiQ|Snapdeal|Nykaa|FirstCry|Meesho|Croma|Reliance Digital|Vijay Sales|Naaptol|IndiaMART|Purplle|Boat Lifestyle|Mamaearth)(\s|$)'
   );

-- Nigeria: name patterns
UPDATE stores SET country = 'NG'
 WHERE country IS NULL
   AND (
     name ~* '\WNigeria(\W|$)|\WNaira(\W|$)'
     OR id ~* '(^|-)nigeria(-|$)'
     OR name ~* '(^|\s)(Konga|Jumia|Slot|3C Hub|Pointek|Fouani|Spar Nigeria|HealthPlus|MedPlus|Supermart|Essenza|Kara|Ajebomarket|Bitmarte|Obiwezy)(\s|$)'
   );

-- US: name patterns — runs LAST so other country tags get first pick
UPDATE stores SET country = 'US'
 WHERE country IS NULL
   AND (
     name ~* '\W(USA|U\.S\.|U\.S\.A\.|America)(\W|$)'
     OR id ~* '(^|-)usa?(-|$)|(^|-)america(-|$)'
     OR name ~* '(^|\s)(Amazon|Walmart|Best Buy|Target|Newegg|Home Depot|Macy.s|Kohl.s|Nordstrom|Sephora|Ulta|Wayfair|Lowes|Lowe.s|Staples|Old Navy|Gap|Banana Republic|Nike|Adidas|GameStop|JCPenney|Fashion Nova|Dick.s Sporting Goods|Bloomingdales|Neiman Marcus|Saks|Bed Bath|Ann Taylor|LOFT|J\.Crew|Michael Kors|Tory Burch|Ralph Lauren|Coach|Crocs|Old Navy|American Eagle|Abercrombie|Hollister|Urban Outfitters|Free People|Anthropologie|Verizon|AT&T|T-Mobile|Boost Mobile|Cricket Wireless|Microsoft Store|Xbox|Best Buy Mobile|TigerDirect|Micro Center|Bath & Body Works|Victoria.s Secret)(\s|$)'
   );

-- ── Layer 3: brand-domain inference for storeIds that ARE domains
--    but didn't match a TLD regex (e.g. "freepeople" without .com) ─

-- Brand-domain US (catches storeIds like "freepeople", "jcpenney"
-- where the brand name is the ID itself)
UPDATE stores SET country = 'US'
 WHERE country IS NULL
   AND id IN (
     'freepeople','free-people','urbanoutfitters','urban-outfitters',
     'anthropologie','jcpenney','j-c-penney','jcpenny',
     'old-navy','oldnavy','gap','banana-republic','bananarepublic',
     'gamestop','game-stop','newegg','wayfair','etsy','staples',
     'kohls','kohl-s','macys','macy-s','nordstrom','sephora','ulta',
     'wayfair','lowes','homedepot','home-depot','staples',
     'best-buy','bestbuy','walmart','target','newegg','costco','bjs',
     'verizon','att','at-t','t-mobile','tmobile','boost-mobile',
     'boostmobile','cricket-wireless','cricketwireless','sprint',
     'fashion-nova','fashion-nova-com','fashionnova',
     'ralph-lauren','ralphlauren','michael-kors','michaelkors',
     'tory-burch','toryburch','calvin-klein','calvinklein',
     'american-eagle','american-eagle-outfitters','ae-outfitters',
     'abercrombie','abercrombie-fitch','hollister','hollisterco',
     'coach','crocs','crocs-com','bath-body-works','bathandbodyworks',
     'bed-bath-beyond','bedbath','victorias-secret','victoriassecret',
     'ann-taylor','anntaylor','loft','j-crew','jcrew',
     'urban-outfitters','free-people','anthropologie',
     'big-apple-buddy','academy-sports-outdoors','academy',
     'going-going-gone','goinggoinggone','ggg',
     'nfm','nebraska-furniture','nebraskafurniture',
     'qvc','qvc-com','qvc.com','hsn',
     'dicks-sporting-goods','dick-s-sporting-goods','dickssportinggoods',
     'b-h-photo-video-audio','bhphoto','bhphotovideo','b-h-photo',
     'fashionnova-com','tigerdirect','microcenter','micro-center',
     'juvia-s-place','juvias-place','juviasplace',
     'sephora-com','ulta-com','ulta-beauty','sephora-beauty',
     'macys-com','macy-s-com'
   );

-- Brand-domain UK
UPDATE stores SET country = 'UK'
 WHERE country IS NULL
   AND id IN (
     'currys','argos','john-lewis','johnlewis','john-lewis-co-uk',
     'boots','boots-com','next','next-co-uk','very','very-co-uk',
     'ao-com','ao','asos','jdsports','jd-sports','sports-direct',
     'sportsdirect','marks-spencer','marks-and-spencer','m-s',
     'selfridges','harrods','debenhams','dunelm','halfords',
     'wickes','screwfix','b-q','b-and-q','diy-com',
     'smyths','smyths-toys','river-island','primark','matalan',
     'house-of-fraser','tesco','sainsbury','sainsburys','aldi',
     'lidl-uk','iceland','morrisons','waitrose','ocado',
     'tk-maxx','tkmaxx','tk-max',
     'wallis-uk','wallis','dorothy-perkins','warehouse-uk',
     'mobile-phones-direct','mobilephonesdirect','three-uk',
     'ee','ee-co-uk','ee-mobile','vodafone-uk','vodafone',
     'sony-store-online-uk','sony-uk','samsung-uk',
     'sky-uk','sky-mobile','virgin-mobile','virgin-uk',
     'currys-business','currys-pc-world',
     'oppostore','oppostore-co-uk','xiaomi-uk','huawei-uk',
     'justmylook','justmylook-com','look-fantastic','lookfantastic',
     'feelunique','feel-unique','beauty-bay','beautybay',
     'hotel-chocolat','hotelchocolat','robert-dyas','robertdyas',
     'the-range','therange','toolstation','machine-mart',
     'wickes','homebase','b-and-m','poundland',
     'monsoon','accessorize','phase-eight','phaseeight','hobbs',
     'fatface','fat-face','white-stuff','whitestuff','joules','seasalt',
     'made-com','made','loaf-com','loaf','dfs',
     'kurt-geiger','kurtgeiger','clarks-uk','clarks',
     'cath-kidston','cathkidston','radley-uk','radley',
     'the-perfume-shop','perfume-shop','superdrug',
     'molton-brown','moltonbrown','lush','the-body-shop','thebodyshop'
   );

-- Brand-domain DE
UPDATE stores SET country = 'DE'
 WHERE country IS NULL
   AND id IN (
     'mediamarkt','media-markt','saturn','otto','zalando','idealo',
     'notebooksbilliger','alternate','cyberport','lidl','kaufland',
     'real-de','tchibo','conrad','computeruniverse','voelkner',
     'rewe','edeka','mytoys','bonprix','redcoon','comtech',
     'douglas','rossmann','dm-de','dm','deichmann','thalia','weltbild',
     'hugendubel','schiesser','esprit-de','h-m-de',
     'apple-de','microsoft-de','xbox-de','sony-de','samsung-de',
     'wmf-com-de','wmf','bosch-de','siemens-de','miele-de',
     'fielmann','apollo','sanicare','medpex','docmorris',
     'jumbo-de','jumbo'
   );

-- Brand-domain ZA
UPDATE stores SET country = 'ZA'
 WHERE country IS NULL
   AND id IN (
     'takealot','makro','loot','loot-co-za','wantitall',
     'yuppiechef','superbalist','zando','everyshop',
     'incredible-connection','incredibleconnection',
     'checkers','pick-n-pay','picknpay','shoprite',
     'wellness-warehouse','wellnesswarehouse',
     'clicks-co-za','clicks','dis-chem','dischem',
     'woolworths-sa','woolworths-co-za','woolworthsza','woolworths',
     'raru','raru-co-za','evetech','bobshop','spree','spree-co-za',
     'mr-price','mrp-com','mrprice','edgars','ackermans',
     'pep','pepstores','game-co-za','game-stores',
     'builders-warehouse','builders-co-za','builders',
     'cellucity','cellucity-co-za',
     'dell-south-africa','dell-sa','hp-south-africa',
     'cash-crusaders','cashcrusaders',
     'kalahari','kalahari-com'
   );

-- Brand-domain AE
UPDATE stores SET country = 'AE'
 WHERE country IS NULL
   AND id IN (
     'noon','noon-com','sharaf-dg','sharafdg','carrefour-ae',
     'carrefour-uae','lulu-hypermarket','luluhypermarket','luluwebstore',
     'first-cry-ae','firstcry-ae','centrepoint','centrepointstores',
     'namshi','ounass','6thstreet',
     'ace','acehardware-ae','ace-ae','jumbo-ae','jumbo-electronics',
     'emax','emax-ae','plug-ins','plugins-ae',
     'max-fashion','maxfashion-ae','splash','splashfashions',
     'babyshop','babyshopstores','mothercare-ae','shukran',
     'homecentre','home-centre','westelm-ae','west-elm-uae',
     'pottery-barn-uae','ubuy-ae','desertcart','desertcart-ae',
     'letstango','letstango-com','menakart','menakart-com'
   );

-- Brand-domain IN
UPDATE stores SET country = 'IN'
 WHERE country IS NULL
   AND id IN (
     'flipkart','myntra','ajio','tata-cliq','tatacliq',
     'snapdeal','nykaa','firstcry','firstcry-com','meesho','croma',
     'reliance-digital','reliancedigital','vijay-sales','vijaysales',
     'shopclues','naaptol','naaptol-com','indiamart',
     'purplle','1mg','tata-1mg','lenskart','boat-lifestyle',
     'mamaearth','swiggy','zomato','blinkit',
     'limeroad','voonik','abof','yepme',
     'vivo-india','oneplus-india','samsung-india','xiaomi-india',
     'smytten','swiss-beauty','hyugalife','sangeetha-mobiles',
     'desertcart-in','kamal-imaging','outdoorphoto'
   );

-- ── Sanity checks (run after applying) ────────────────────────────
-- 1. NULL count should drop dramatically:
--    SELECT country, count(*) FROM stores GROUP BY country ORDER BY 2 DESC;
--    → expect NULL ~250-350 (down from ~890), US ~250+, UK ~80+,
--       DE ~30+, ZA ~25+, AE ~20+, IN ~25+, NG ~25+
--
-- 2. Spot-check known stores:
--    SELECT id, name, country FROM stores
--     WHERE id IN ('american-eagle-outfitters', 'wallis-uk',
--                  'dell-south-africa', 'wmf-com-de', 'naaptol',
--                  'at-t', 'cellucity', 'noon-com');
--    → all should have country populated.
--
-- 3. Confirm NG roster:
--    SELECT count(*) FROM stores WHERE country = 'NG';
--    → expect ≥ 20 (was 9 pre-migration)
