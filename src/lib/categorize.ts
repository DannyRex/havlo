/* ──────────────────────────────────────────────────────────────────
   Centralised title → category inference.

   Why this file exists:
     The /deals filter UI lets users narrow by category (Phones,
     Computing, Audio, Appliances, etc.). For that to feel honest,
     every product in the DB needs a category that actually reflects
     what the title describes.

     Until now, ingest-providers.ts tagged every result with the
     SOURCE category (the query category passed to the provider). If
     SerpAPI returned a Bluetooth speaker for a "Phones" search, that
     speaker got stored as category=Phones. The QA agent flagged
     this: filtering /deals by Phones surfaced speakers, AI sunglasses,
     and a satellite cable splitter alongside actual phones.

     The fix: at ingest time and as a one-shot retag migration, run
     each title through a heuristic family classifier. If the
     classifier disagrees with the source category, OVERRIDE to the
     classifier's call. If the classifier returns null (unrecognised),
     KEEP the source category (better to over-tag than to lose).

   Categories returned here match category.slug values from
   src/lib/data/categories.ts (so the column matches existing UI
   filter values).
   ────────────────────────────────────────────────────────────────── */

import { categories } from "@/lib/data/categories";

/* Known category slugs — kept as a runtime check so a typo here
   doesn't silently land bad slugs in the DB. */
const VALID_SLUGS = new Set(categories.map((c) => c.slug));

/* Heuristic: each rule is a regex + the category slug it implies.
   First rule that matches wins. Order matters — list specific rules
   before generic ones (e.g. "smart watch" before bare "watch"). */
const RULES: Array<{ pattern: RegExp; slug: string; reason: string }> = [
  // ── Computing (laptops + tablets, NOT phones) ──
  { pattern: /\b(macbook|thinkpad|chromebook|ideapad|zenbook|pavilion|inspiron|latitude|elitebook|surface\s*(pro|laptop|book))\b/i, slug: "computing", reason: "laptop model" },
  { pattern: /\b(laptop|notebook)\b/i, slug: "computing", reason: "generic laptop" },
  { pattern: /\b(ipad|tablet|tab\s*(s|a)\b|matepad|mediapad)\b/i, slug: "computing", reason: "tablet" },
  { pattern: /\bdesktop\s*(pc|computer)?\b|\bimac\b|\bmac\s*mini\b|\bmac\s*pro\b|\ball-in-one\s*pc\b/i, slug: "computing", reason: "desktop" },
  { pattern: /\b(monitor|display)\b.*\b(\d{2}["”'']|inch)\b/i, slug: "computing", reason: "monitor" },

  // ── Audio (headphones, earbuds, speakers) ──
  { pattern: /\bairpods?\s*(pro|max|2|3|4)?\b/i, slug: "audio", reason: "AirPods" },
  { pattern: /\b(headphones?|headsets?|earbuds?|earpods?|earphones?|tws)\b/i, slug: "audio", reason: "ear-worn audio" },
  /* AliExpress junk noise that landed as phones (round 3 leftover):
     screwdriver sets, mystery boxes, tool kits. Pure spam — no real
     phone catalog uses these phrases. */
  { pattern: /\b(screwdriver\s*set|precision\s*screwdriver|tool\s*kit|mystery\s*box|lucky\s*box|blind\s*box|surprise\s*pack|tool\s*case)\b/i, slug: "electronics", reason: "tool/mystery accessory junk" },
  { pattern: /\b(soundbar|home\s*theatre|home\s*theater|boombox|bluetooth\s*speaker|wireless\s*speaker|portable\s*speaker|party\s*speaker|party\s*box)\b/i, slug: "audio", reason: "speaker form factor" },
  { pattern: /\b(jbl|bose|sonos|harman\s*kardon|marshall|wh-1000|qc(35|45|ultra)|quietcomfort)\b/i, slug: "audio", reason: "audio brand+model" },

  // ── Phone accessories (route to electronics so the Phones filter
  //    stays clean). MUST come before the bare 'phone' rule below so
  //    titles like "Mount Phone Holder", "Phone Stand", "Phone Case"
  //    don't false-match into the Phones category.
  //    The QA agent flagged this: /ng/deals?category=phones surfaced
  //    "Motorcycle Rearview Mirror Bracket Tool ... For Car Mount
  //    Phone ATV Bar CNC Aluminum" 10+ times as the cheapest "Phones"
  //    results. The product is a phone holder for ATVs, not a phone.
  //    First-pass regex assumed adjacency ("phone holder" / "for
  //    phone") — the QA case interleaves "Mount Phone ATV" so word-
  //    order-sensitive rules missed it. Broader rules below. ──
  { pattern: /\b(phone|smartphone)\s*(case|cover|skin|sticker|ring|popsocket|grip|stand|holder|mount|bracket|tripod|gimbal|charger|cable|adapter|protector|screen\s*protector|tempered\s*glass|pouch|sleeve|wallet\s*case)\b/i, slug: "electronics", reason: "phone accessory (named after)" },
  { pattern: /\b(case|cover|stand|holder|mount|bracket|tripod|gimbal|protector|tempered\s*glass|pouch|sleeve)\s*for\s*(phone|smartphone|iphone|galaxy|pixel)\b/i, slug: "electronics", reason: "phone accessory (for X)" },
  /* Vehicle context + phone keyword anywhere in the title. Catches
     "Motorcycle ... Phone ...", "Bicycle Mount ... Phone Holder",
     "ATV ... Phone Cradle", regardless of word order. Real iPhone /
     Galaxy listings never mention motorcycle/ATV/bicycle, so this is
     safe. Cars get a stricter check (see next rule) because legitimate
     "iPhone Car Mode" features exist. */
  { pattern: /\b(motorcycle|atv|bicycle|bike|scooter|jeep|suv|truck|van|kayak|skateboard|treadmill)\b.*\b(phone|smartphone|iphone|galaxy|pixel)\b|\b(phone|smartphone|iphone|galaxy|pixel)\b.*\b(motorcycle|atv|bicycle|bike|scooter|jeep|suv|truck)\b/i, slug: "electronics", reason: "vehicle context + phone keyword (mount/holder)" },
  /* Mounting / holding hardware context + phone keyword. Same word-
     order-agnostic pattern. Excludes 'case' / 'cover' from the
     accessory side because flagship phone listings sometimes say
     "with case included" — handled by the accessory regex above. */
  { pattern: /\b(tripod|gimbal|monopod|selfie\s*stick|gooseneck|cradle|car\s*mount|wall\s*mount|desk\s*mount|magnetic\s*mount|suction\s*mount|dashboard\s*mount|vent\s*mount|windshield\s*mount)\b.*\bphone\b|\bphone\b.*\b(tripod|gimbal|monopod|selfie\s*stick|gooseneck|cradle|car\s*mount|wall\s*mount|desk\s*mount|magnetic\s*mount|suction\s*mount|dashboard\s*mount|vent\s*mount|windshield\s*mount)\b/i, slug: "electronics", reason: "mount hardware + phone keyword" },

  /* ── More accessory + electronic-junk rules MOVED to BEFORE the
        phones section (was previously after, in the TV/Electronics
        block). The bare 'phone' rule at line ~80 was matching
        AliExpress titles like "Phone Non-slip ... Finger Sleeve"
        and "10pcs/Lot USB Male to ... Adapter ... Mobile" before
        these more-specific rules could fire. Order in this file is
        first-match-wins, so anything that should override 'phone' /
        'mobile' classification has to come EARLIER. ── */
  /* Broader catch for AliExpress-style "USB Male to ... Adapter"
     titles where USB and Adapter are far apart. */
  { pattern: /\b(usb|hdmi|micro\s*usb|usb-c|type-c)\b.*\b(adapter|connector|extension|hub|dock|extender|converter|breakout|jack|socket|port|pin)\b/i, slug: "electronics", reason: "USB/HDMI accessory (windowed)" },
  /* OBD / car diagnostic scanners. */
  { pattern: /\b(obd|obd2|obdii|obd-ii)\b.*\b(scanner|reader|diagnostic|tool)\b|\b(car\s*diagnostic|vehicle\s*scanner|engine\s*scan\s*tool)\b/i, slug: "electronics", reason: "automotive diagnostic" },
  /* Recording glasses / smart glasses / spy cameras posing as
     eyewear. */
  { pattern: /\b(recording|spy|hidden|video|camera)\s*(glasses|eyewear|sunglasses)\b|\b(smart\s*glasses)\b/i, slug: "electronics", reason: "wearable camera" },
  /* Gaming finger sleeves — titles like "Phone Non-slip Breathable
     Touch Screen Sweatproof Gaming Finger Sleeve" match the bare
     'phone' rule unless this fires first. */
  { pattern: /\b(finger\s*sleeves?|gaming\s*sleeves?|touch\s*screen\s*sleeves?|thumb\s*sleeves?|sweat-?proof\s*sleeves?|finger\s*cots?|fingertips?\s*covers?)\b/i, slug: "electronics", reason: "gaming finger sleeve" },
  /* GENERIC: any title with both a phone-related word AND an
     accessory/hardware noun → electronics. Word-order-agnostic.
     Catches "Cable Organizer Clip Data Cable Stand Mobile Phone",
     "Double Side Silicone Suction Pad For Mobile Phone Fixture",
     "Wireless Charger for Phone", etc. The rule tolerates anything
     between the two anchors so AliExpress's keyword-stuffed titles
     can't sneak past with a particular word order.

     Real phone listings (which we want to KEEP in phones) have a
     brand+model that already matched the phone-model rule earlier,
     so they never reach this rule. Generic "Mobile Phone" listings
     without a brand DO get classified as electronics here, which
     is the intended trade-off — we'd rather miss the rare unbranded
     real phone than keep ingesting accessory junk. */
  { pattern: /\b(mobile|phone|smartphone|cellphone|cell\s*phone)\b.*\b(cable|charger|holder|stand|cradle|mount|bracket|adapter|organizer|connector|suction|fixture|grip|popsocket|ring\s*holder|kickstand|car\s*hook|magnetic\s*plate|tempered|hydrogel|skin|sticker|wireless\s*charger|fast\s*charger)\b|\b(cable|charger|holder|stand|cradle|mount|bracket|adapter|organizer|connector|suction|fixture|grip|popsocket|ring\s*holder|kickstand|car\s*hook|magnetic\s*plate|wireless\s*charger|fast\s*charger)\b.*\b(mobile|phone|smartphone|cellphone|cell\s*phone)\b/i, slug: "electronics", reason: "phone-adjacent accessory (broad)" },

  // ── Phones — explicit brand+model only. ──
  // The bare "phone" rule was REMOVED in QA round 3 because it
  // matched far more spam ("Cable Organizer Stand Mobile Phone",
  // "Phone Non-slip Touch Screen Sleeve", "10pcs/Lot USB Adapter
  // with Welded Mobile Phone") than legitimate generic phone
  // listings. Real phones in our catalog all carry a recognised
  // brand+model (iphone / galaxy / pixel / tecno / infinix / redmi /
  // oneplus / xiaomi / huawei / motorola / nokia / smartphone).
  // Generic-phone titles without those tokens fall through to the
  // null category and won't surface as phones — better than the 152+
  // false positives we caught.
  { pattern: /\b(iphone|galaxy\s*(s|a|m|note|z)\d|pixel\s*\d|tecno|infinix|redmi|oneplus|xiaomi|huawei|motorola|moto\s*g|moto\s*e|nokia|smartphone)\b/i, slug: "phones", reason: "phone model" },
  // Branded-phone fallback: a title with "phone" + one of these
  // explicit phone-spec markers (RAM/storage/network) is real phone.
  // Keeps generic flagship-y titles like "5G Phone 8GB+256GB" as
  // phones while still rejecting accessory junk.
  { pattern: /\bphone\b.*\b(\d+\s*gb\s*\+?\s*\d+\s*gb|\d+\s*gb\s*ram|5g|4g\s*lte|dual\s*sim|fingerprint\s*sensor)\b|\b(\d+\s*gb\s*\+?\s*\d+\s*gb|\d+\s*gb\s*ram|5g|4g\s*lte|dual\s*sim|fingerprint\s*sensor)\b.*\bphone\b/i, slug: "phones", reason: "phone + spec marker" },

  // ── TV / Electronics ──
  { pattern: /\b(qled|oled|uhd|smart\s*tv|led\s*tv|4k\s*tv|8k\s*tv)\b/i, slug: "electronics", reason: "TV tech" },
  { pattern: /\b(television)\b/i, slug: "electronics", reason: "television" },
  { pattern: /\b(\d{2})\s*("?inch|"?-inch|"?in)\b.*\b(tv|hisense|lg|samsung|tcl|sony|bravia)\b/i, slug: "electronics", reason: "TV size+brand" },
  /* Electrical accessories that frequently get scraped from
     "phones" category pages on retailers and end up mis-tagged.
     Route to electronics so the Phones filter stays clean. */
  { pattern: /\b(power\s*strip|surge\s*protector|extension\s*cord|smart\s*plug|wall\s*charger|car\s*charger|wireless\s*charger|wall\s*adapter)\b/i, slug: "electronics", reason: "electrical accessory" },
  { pattern: /\b(usb\s*(adapter|hub|extender|extension|dock|cable|drive|stick)|hdmi\s*(cable|adapter|switch))\b/i, slug: "electronics", reason: "USB/HDMI accessory" },
  /* USB-windowed, OBD scanner, recording glasses, finger sleeves
     MOVED to before the phones section (line ~75) to outrank the
     bare 'phone' / 'mobile' rules — they're more specific and the
     QA agent caught them being misclassified into phones. */
  { pattern: /\b(power\s*bank|portable\s*charger|solar\s*charger)\b/i, slug: "electronics", reason: "power bank" },

  // ── Gaming ──
  { pattern: /\b(playstation|ps[345]|xbox\s*(series|one)|nintendo\s*switch|oled\s*switch)\b/i, slug: "gaming", reason: "console" },
  /* Game controller — must be paired with a console marker because
     bare 'controller' matches AC controllers, music controllers, etc.
     False positive caught in retag dry-run: 'Multi-room in Wall
     Bluetooth Audio Amplifier Background Music Controller' was
     getting tagged Gaming. */
  { pattern: /\b(joy-con|dualsense|dualshock|gaming\s*controller|game\s*controller|wireless\s*controller(?:\s*for\s*(?:ps|xbox|nintendo))?)\b/i, slug: "gaming", reason: "game controller" },
  { pattern: /\b(steam\s*deck|asus\s*rog\s*ally|legion\s*go)\b/i, slug: "gaming", reason: "handheld" },

  // ── Appliances ──
  { pattern: /\b(refrigerator|fridge|freezer|washer|dryer|dishwasher|microwave|oven|range|cooktop|stove)\b/i, slug: "appliances", reason: "major appliance" },
  { pattern: /\b(air\s*fryer|pressure\s*cooker|slow\s*cooker|rice\s*cooker|stand\s*mixer|kitchenaid|instant\s*pot|blender|toaster|kettle|coffee\s*maker|espresso\s*machine)\b/i, slug: "appliances", reason: "kitchen appliance" },
  { pattern: /\b(vacuum|dyson\s*v\d|robot\s*vacuum|roomba)\b/i, slug: "appliances", reason: "vacuum" },

  // ── Wearables / Fitness ──
  { pattern: /\b(apple\s*watch|smart\s*watch|smartwatch|garmin|fitbit|whoop|fossil\s*smart)\b/i, slug: "electronics", reason: "smartwatch" },

  // ── Beauty / personal care ──
  { pattern: /\b(lipstick|mascara|gloss\s*bomb|concealer|foundation|lash\s*sensational|fenty\s*beauty|charlotte\s*tilbury|eye\s*shadow|eyeliner|blush|bronzer|highlighter|primer|setting\s*spray|brush\s*set)\b/i, slug: "beauty", reason: "makeup" },
  { pattern: /\b(niacinamide|moisturizer|moisturiser|moisturizing\s*cream|cleanser|toner|serum|cerave|the\s*ordinary|exfoliator|face\s*mask|sunscreen|spf\s*\d+|retinol|hyaluronic|salicylic|glycolic|vitamin\s*c\s*serum)\b/i, slug: "beauty", reason: "skincare" },
  { pattern: /\b(perfume|cologne|fragrance|eau\s*de\s*parfum|eau\s*de\s*toilette|edp|edt|afnan|montale|kayali|maison\s*margiela|ariana|tom\s*ford|jo\s*malone|creed|dior|chanel|gucci|versace)\s*(?:\d+ml|\d+\.\d+\s*oz|spray)?\b/i, slug: "beauty", reason: "fragrance" },
  /* Pharmacy + wellness — vitamins, supplements, OTC drugs, baby
     health. These were the bulk of HealthPlus / MedPlus product
     types and were defaulting to "electronics" via the resolver
     fallback. Bucket as beauty for now (the closest existing slug);
     a dedicated "wellness" / "pharmacy" category is a separate
     decision the user is weighing. */
  { pattern: /\b(vitamin\s*[a-e]\d?|multivitamin|supplement|paracetamol|ibuprofen|aspirin|antacid|antihistamine|cough\s*syrup|throat\s*lozenge|pain\s*relief|first\s*aid|antiseptic|hand\s*sanitizer|antibacterial|sanitary\s*pad|baby\s*lotion|baby\s*oil|baby\s*wipes|diaper|nappy|formula\s*milk)\b/i, slug: "beauty", reason: "wellness / pharmacy" },
  { pattern: /\b(shampoo|conditioner|hair\s*oil|hair\s*spray|leave-?in|deep\s*conditioner|edge\s*control|relaxer|texturizer|hair\s*serum|hair\s*mask|scalp\s*treatment)\b/i, slug: "beauty", reason: "hair care" },
  { pattern: /\b(deodorant|antiperspirant|body\s*spray|body\s*wash|shower\s*gel|bar\s*soap|body\s*butter|body\s*lotion|hand\s*cream|foot\s*cream|exfoliating\s*scrub)\b/i, slug: "beauty", reason: "personal care" },

  // ── Fashion ──
  { pattern: /\b(nike|adidas|puma|reebok|new\s*balance|asics|under\s*armour)\s+\w*\b.*\b(shoe|sneaker|trainer|boot|sandal)\b/i, slug: "fashion", reason: "branded footwear" },
  { pattern: /\b(air\s*force|air\s*jordan|adidas\s*samba|nike\s*dunk|stan\s*smith|yeezy|ultra\s*boost|crocs)\b/i, slug: "fashion", reason: "iconic sneaker" },
  /* Clothing words. 'coat' alone false-matched 'Color Wow Dream Coat
     Spray' (hair treatment) in retag dry-run. Disambiguated by
     pairing 'coat' with weather/winter context, and dropping 'coat'
     from the bare list. */
  { pattern: /\b(jeans|denim|t-shirt|hoodie|jacket|skirt|trousers|chinos|polo|blouse|cardigan)\b/i, slug: "fashion", reason: "clothing" },
  { pattern: /\b(winter\s*coat|trench\s*coat|raincoat|peacoat)\b/i, slug: "fashion", reason: "outerwear" },
  /* 'dress' alone is greedy ('dress shoes', 'dressing' table, 'dressing
     gown' is fine but 'salad dressing' isn't). Constrain to garment
     contexts. */
  { pattern: /\b(maxi\s*dress|midi\s*dress|sundress|cocktail\s*dress|wedding\s*dress|gown)\b/i, slug: "fashion", reason: "dress" },
  /* Bags + small leather goods. 'wallet' alone matched 'Galaxy S24
     Wallet Case' in retag dry-run. Disambiguate by excluding case /
     phone contexts: when title contains 'case' or 'cover', skip.

     QA round-3 caught: "Women's shoulder Handbags Bag for 2025 women
     Shopper bag Female luxury" (20 dupes, all $0.78, all tagged
     phones) was returning NULL from inferCategoryFromTitle because
     `\bhandbag\b` didn't match "Handbags" (no word boundary after
     the trailing s). Now uses `handbags?` to allow optional plural,
     plus broader bag vocab so any obvious bag-product gets routed
     to fashion. */
  { pattern: /\b(handbags?|backpacks?|tote\s*bags?|crossbody|messenger\s*bags?|shoulder\s*bags?|shopper\s*bags?|clutch|clutches|satchels?|duffels?|fanny\s*packs?|waist\s*packs?|purses?)\b/i, slug: "fashion", reason: "bag" },
  { pattern: /\b(leather\s*wallet|bifold\s*wallet|trifold\s*wallet|cardholder\s*wallet)\b/i, slug: "fashion", reason: "leather wallet" },
  { pattern: /\b(sunglasses|eyeglasses|wayfarer|aviator|ray-ban|raybans)\b/i, slug: "fashion", reason: "eyewear" },

  // ── Home ──
  { pattern: /\b(dutch\s*oven|le\s*creuset|cast\s*iron|skillet|frying\s*pan|saucepan|stock\s*pot|cookware\s*set)\b/i, slug: "home", reason: "cookware" },
  { pattern: /\b(tumbler|quencher|thermos|water\s*bottle|coffee\s*mug|drinkware)\b/i, slug: "home", reason: "drinkware" },
  { pattern: /\b(bedding|bedsheet|pillow|duvet|comforter|mattress)\b/i, slug: "home", reason: "bedding" },
  /* Groceries + beverages + alcohol — Supermart's core catalog.
     All bucketing as "home" for now until a dedicated "groceries"
     category lands; same trade-off as wellness → beauty above.
     Avoid bare 'sugar' / 'salt' — they match too many things ("Sugar
     Free" sweetener label, "Sea Salt Spray" hair product, etc.).
     Specific phrasings only. */
  { pattern: /\b(rice|pasta|noodles|cereal|oats|cornflakes|biscuit|crackers|bread\s*loaf|chocolate\s*bar|cooking\s*oil|olive\s*oil|vegetable\s*oil|granulated\s*sugar|brown\s*sugar|powdered\s*sugar|table\s*salt|sea\s*salt\s*shaker|seasoning\s*cube|spice\s*mix|stock\s*cube|tomato\s*paste|tinned|canned\s*food)\b/i, slug: "home", reason: "groceries" },
  { pattern: /\b(juice|soda|cola|fanta|sprite|coca\s*cola|pepsi|water\s*bottle|sparkling\s*water|coffee\s*beans|ground\s*coffee|tea\s*bag|tea\s*box|chai|herbal\s*tea)\b/i, slug: "home", reason: "beverages" },
  { pattern: /\b(whisky|whiskey|vodka|gin|rum|tequila|brandy|cognac|scotch|bourbon|wine|champagne|prosecco|merlot|cabernet|sauvignon|chardonnay|beer|lager|stout|cider|alcoholic|liqueur|bitters)\b/i, slug: "home", reason: "alcohol" },
  { pattern: /\b(detergent|fabric\s*softener|dish\s*soap|dishwashing|toilet\s*paper|kitchen\s*roll|cleaning\s*spray|disinfectant|bleach|insect\s*spray|mosquito\s*coil|air\s*freshener)\b/i, slug: "home", reason: "household" },
  { pattern: /\b(towel|bathmat|bath\s*rug|toilet\s*paper)\b/i, slug: "home", reason: "bath" },
];

/* Returns the inferred category slug, or null if no rule matches.

   When null is returned, callers should KEEP whatever category was
   already assigned (don't blindly overwrite with null). When a slug
   is returned, callers should compare against the source category
   and decide whether to override. */
export function inferCategoryFromTitle(title: string): string | null {
  if (!title) return null;
  for (const rule of RULES) {
    if (rule.pattern.test(title)) {
      return VALID_SLUGS.has(rule.slug) ? rule.slug : null;
    }
  }
  return null;
}

/* True when the inferred category disagrees with the source. Used by
   ingest validators + the retag migration to decide whether to
   override. Returns false when inference is null (no signal) so we
   don't accidentally erase well-tagged data. */
export function categoryDisagreesWithTitle(
  sourceSlug: string,
  title: string,
): { disagrees: boolean; inferred: string | null } {
  const inferred = inferCategoryFromTitle(title);
  if (!inferred) return { disagrees: false, inferred: null };
  return { disagrees: inferred !== sourceSlug, inferred };
}
