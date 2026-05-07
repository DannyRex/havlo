/* ──────────────────────────────────────────────────────────────────
   Product family detection — shared between /api/compare (DB-backed
   pg-fts) and /api/live-search (SerpAPI / external providers).

   Why one shared module: before this file existed, each entrypoint
   maintained its OWN family list. The live-search list was a 6-entry
   subset that didn't include 'console', so 'Nintendo Switch' had no
   detected family — and a satellite-distribution switch surfaced as
   a 'live deal' for a Switch query (QA agent flagged this as
   'satellite splitter for Nintendo Switch click').

   Both surfaces now derive their family from the SAME table here, so
   gates stay consistent across paths.
   ────────────────────────────────────────────────────────────────── */

/* IMPORTANT: order matters. The first family whose tokens match wins.
   Specific accessories listed BEFORE the parent product so 'Silicone
   Strap for Apple Watch Band' detects as a watch accessory (filtered
   out) before falling through to 'watch'. Headphones / desktops /
   tablets listed BEFORE 'phone' so a title containing the substring
   'phone' inside 'headphones' / 'iPhone-style accessory' detects
   correctly. */
export const PRODUCT_FAMILIES: Record<string, string[]> = {
  watch_accessory: ["watch band", "watch strap", "silicone strap", "wristband"],
  game:        ["pc game", "video game", "ps5 game", "ps4 game", "xbox game", "switch game", "nintendo game"],
  /* Earbuds BEFORE headphones so 'Bose QuietComfort Ultra Earbuds'
     detects via the bare 'earbuds' token (correct family) rather
     than via 'quietcomfort' in headphones (wrong). Queries for the
     over-ear model 'Bose QuietComfort Ultra' (no 'earbuds' word)
     fall through earbuds → land on headphones via 'quietcomfort'. */
  earbuds:     ["airpods", "earbuds", "earpods", "tws"],
  /* QuietComfort headphones disambiguation: 'Bose QuietComfort
     Ultra' alone has no family signal (just the brand + line + spec).
     Without the 'quietcomfort' token here, the matcher anchored on
     'Bose QuietComfort Ultra Earbuds' (a different SKU). Adding the
     token here pins the query family to headphones. */
  headphones:  ["airpods max", "wh-1000", "wh-ch", "quietcomfort headphones", "quietcomfort ultra headphones", "quietcomfort", "headphones", "headphone", "headset", "over-ear", "over ear"],
  tablet:      ["ipad", "tablet", "tab a", "tab s", "matepad", "mediapad"],
  desktop:     ["imac", "mac mini", "mac pro", "all-in-one"],
  laptop:      ["macbook", "thinkpad", "xps", "pavilion", "ideapad", "zenbook", "laptop", "notebook", "chromebook"],
  speaker:     ["speaker", "soundbar", "boombox", "home theater", "home theatre"],
  /* Console BEFORE tv so 'Nintendo Switch OLED' detects as console
     via the 'switch' token (word-boundary protected) rather than
     hitting the bare 'oled' token in tv first. The QA agent's 25-
     query script flagged this — Switch OLED was being family-tagged
     as a TV. */
  console:     ["playstation", "ps5", "ps4", "xbox", "nintendo", "switch"],
  tv:          ["smart tv", "qled", "led tv", "uhd tv", "4k tv", "oled tv", "oled smart"],
  watch:       ["smartwatch", "smart watch", "apple watch", "garmin", "fitbit", "fossil"],
  camera:      ["dslr", "mirrorless", "camcorder", "gopro"],
  footwear:    ["air force", "air jordan", "adidas samba", "nike dunk", "crocs", "stan smith", "yeezy", "ultra boost", "running shoe", "running shoes", "sneaker", "sneakers", "trainer", "trainers"],
  mouse:       ["mx master", "g502", "gaming mouse", "wireless mouse", "computer mouse"],
  keyboard:    ["mechanical keyboard", "gaming keyboard", "magic keyboard"],
  appliance:   ["instant pot", "pressure cooker", "slow cooker", "air fryer", "stand mixer", "kitchenaid", "blender", "rice cooker", "toaster"],
  cookware:    ["dutch oven", "le creuset", "cast iron", "frying pan", "saucepan", "stock pot", "skillet"],
  drinkware:   ["tumbler", "quencher", "thermos", "water bottle", "coffee mug"],
  jeans:       ["levi's 501", "501 original", "skinny jeans", "denim jeans"],
  skincare:    ["niacinamide", "moisturizer", "moisturiser", "moisturizing cream", "cleanser", "toner", "cerave", "the ordinary"],
  makeup:      ["lipstick", "mascara", "gloss bomb", "concealer", "lash sensational", "fenty beauty"],
  eyewear:     ["sunglasses", "wayfarer", "aviator", "eyeglasses", "ray-ban", "raybans"],
  /* E-readers — separated from tablets because the buyer intent is
     different (no apps, no games — book reading only). 'kindle'
     alone would over-match Kindle Fire HD which is a tablet, so we
     pin to the e-reader-only product names + Kobo / Nook. */
  ereader:     ["paperwhite", "kindle oasis", "kindle scribe", "kobo", "nook reader", "boox"],
  /* Toys / collectibles. Added after the QA agent's 25-query script
     where 'Lego Millennium Falcon' had no family and could anchor on
     a Star Wars video game via token overlap. */
  toys:        ["lego", "playmobil", "barbie", "hot wheels", "fisher-price", "fisher price", "funko pop", "matchbox cars"],
  phone:       ["iphone", "galaxy", "pixel", "tecno", "infinix", "redmi", "oneplus", "smartphone", "phone"],
};

/* Single-word tokens that are dangerous as substrings. 'phone' lives
   inside 'headphones', 'tv' inside 'savetv', 'switch' inside
   'lightswitch'. For these we require a real word boundary. */
export const WORD_BOUNDARY_TOKENS = new Set([
  "phone", "tv", "buds", "tablet", "watch", "switch",
]);

export function tokenMatchesTitle(token: string, lowerTitle: string): boolean {
  if (!WORD_BOUNDARY_TOKENS.has(token)) return lowerTitle.includes(token);
  const re = new RegExp(`(^|[^a-z])${token}([^a-z]|$)`);
  return re.test(lowerTitle);
}

export function detectFamily(title: string): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const [family, tokens] of Object.entries(PRODUCT_FAMILIES)) {
    if (tokens.some((tok) => tokenMatchesTitle(tok, t))) return family;
  }
  return null;
}

/* True if anchor + candidate are in incompatible families.
   Allows the case where one (or both) families are unidentified — only
   blocks when we have HIGH CONFIDENCE both items are in different
   known families. */
export function familiesIncompatible(anchorTitle: string, candTitle: string): boolean {
  const af = detectFamily(anchorTitle);
  const cf = detectFamily(candTitle);
  if (!af || !cf) return false;
  return af !== cf;
}
