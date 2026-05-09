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
  { pattern: /\b(headphone|headphones|headset|earbuds|earpods|earphone|tws)\b/i, slug: "audio", reason: "ear-worn audio" },
  { pattern: /\b(soundbar|home\s*theatre|home\s*theater|boombox|bluetooth\s*speaker|wireless\s*speaker|portable\s*speaker|party\s*speaker|party\s*box)\b/i, slug: "audio", reason: "speaker form factor" },
  { pattern: /\b(jbl|bose|sonos|harman\s*kardon|marshall|wh-1000|qc(35|45|ultra)|quietcomfort)\b/i, slug: "audio", reason: "audio brand+model" },

  // ── Phones (after computing rules so iPad doesn't slip in) ──
  { pattern: /\b(iphone|galaxy\s*(s|a|m|note|z)\d|pixel\s*\d|tecno|infinix|redmi|oneplus|smartphone)\b/i, slug: "phones", reason: "phone model" },
  // Generic 'phone' last — the word 'phone' appears in 'headphone',
  // 'earphone', 'megaphone', etc. Use word boundaries + negative
  // lookahead for known compound prefixes.
  { pattern: /(^|[^a-z])(?<!head|ear|micro|mega|saxo)phone(?!\w)/i, slug: "phones", reason: "bare phone word" },

  // ── TV / Electronics ──
  { pattern: /\b(qled|oled|uhd|smart\s*tv|led\s*tv|4k\s*tv|8k\s*tv)\b/i, slug: "electronics", reason: "TV tech" },
  { pattern: /\b(television)\b/i, slug: "electronics", reason: "television" },
  { pattern: /\b(\d{2})\s*("?inch|"?-inch|"?in)\b.*\b(tv|hisense|lg|samsung|tcl|sony|bravia)\b/i, slug: "electronics", reason: "TV size+brand" },
  /* Electrical accessories that frequently get scraped from
     "phones" category pages on retailers and end up mis-tagged.
     Route to electronics so the Phones filter stays clean. */
  { pattern: /\b(power\s*strip|surge\s*protector|extension\s*cord|smart\s*plug|wall\s*charger|car\s*charger|wireless\s*charger|wall\s*adapter)\b/i, slug: "electronics", reason: "electrical accessory" },
  { pattern: /\b(usb\s*(adapter|hub|extender|extension|dock|cable|drive|stick)|hdmi\s*(cable|adapter|switch))\b/i, slug: "electronics", reason: "USB/HDMI accessory" },
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
     phone contexts: when title contains 'case' or 'cover', skip. */
  { pattern: /\b(handbag|backpack|tote\s*bag|crossbody|messenger\s*bag)\b/i, slug: "fashion", reason: "bag" },
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
