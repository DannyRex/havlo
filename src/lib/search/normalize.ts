// Product normalization — extracts structured fields from messy product titles
// so we can group "Samsung Galaxy A06 64GB Black" sold on Jumia, Konga, Slot, etc.
// as the SAME product even though the title strings differ.

// Pure noise — never useful as a search signal. Things users actually search for
// ("phone", "tv", "laptop", "headphone") are kept as tokens.
const STOP = new Set([
  "the", "and", "for", "with", "free", "new", "official", "original", "brand",
  "shop", "buy", "online", "best", "top", "ng", "nigeria", "by", "of", "in",
  "on", "an", "a",
  "warranty", "year", "month", "fast", "next", "day", "delivery", "ships", "from",
  "abroad", "international", "intl", "ksa", "uk", "us", "usa",
  "set", "model", "edition", "version", "support",
]);

// ── HEURISTIC FALLBACK ONLY ───────────────────────────────────────────────
// The blocks below (BRANDS, MODEL_HINTS, buildSignature, etc.) are kept as a
// safety net for two cases:
//   1. The feature flag USE_VECTOR_SEARCH=false → heuristic engine serves all queries.
//   2. The vector path throws (Supabase/OpenAI down) → route.ts catches + falls back.
// Do NOT delete until the heuristic fallback is explicitly retired.
// ─────────────────────────────────────────────────────────────────────────
// Known brand list — order matters for multi-word brands
const BRANDS = [
  "apple", "iphone", "ipad", "macbook", "airpods", "earpods",
  "samsung", "galaxy",
  "playstation", "ps4", "ps5",
  "tecno", "infinix", "itel", "xiaomi", "redmi", "poco",
  "oppo", "vivo", "realme", "oneplus", "google", "huawei", "honor", "nokia",
  "hisense", "tcl", "lg", "sony", "panasonic", "philips", "polystar", "scanfrost",
  "haier", "thermocool", "syinix", "skyrun", "midea", "sharp",
  /* TV-hardware brands added May 28 2026 after the signature-leak
     audit found Skyworth, Nexus, Vitron, Bruhm in PayPorte / Slot
     TV listings being misattributed to "google" (the OS brand) when
     no hardware brand was recognised. */
  "skyworth", "nexus", "vitron", "bruhm",
  "hp", "dell", "lenovo", "asus", "acer", "msi", "razer", "macbook",
  "microsoft", "surface", "ipad",
  "jbl", "bose", "anker", "soundpeats", "oraimo", "earpods", "airpods", "beats",
  "playstation", "xbox", "nintendo", "switch",
  "binatone", "qasa", "century", "saachi", "hyundai", "qlink",
  "nike", "adidas", "puma", "reebok", "asics", "newbalance", "converse",
  "vans", "fila", "underarmour", "skechers",
  "levis", "zara", "h&m", "uniqlo", "gucci", "prada", "louisvuitton",
  "balenciaga", "fendi", "versace", "burberry", "coach", "michaelkors",
  "tommy", "hilfiger", "calvinklein", "ck",
  // Eyewear
  "rayban", "oakley", "persol", "maui", "jim", "tomford", "carrera",
  "warbyparker", "ditto",
  // Beauty / personal care
  "remington", "philips", "wahl", "braun", "oralb", "colgate",
  "fenty", "maybelline", "loreal", "lancome", "mac",
  // Watches
  "rolex", "casio", "seiko", "fossil", "garmin", "fitbit",
  /* Drinkware — May 2026: variant-pooling probe showed Stanley
     Quencher tumblers collapsed to brand=null, model=null because
     none of these were in the list. Same for Yeti / Hydro Flask /
     Owala — high-volume cross-store inventory we were missing. */
  "stanley", "yeti", "hydroflask", "owala", "contigo", "thermos",
  "klean", "kanteen", "swell", "rtic", "corkcicle",
  /* Home appliances + small kitchen — same probe surfaced many
     brand=null hits on these because the parser bailed at brand
     detection. Adding them lets the model-extractor follow up. */
  "dyson", "roomba", "irobot", "shark", "bissell", "hoover",
  "ninja", "vitamix", "kitchenaid", "cuisinart", "instant", "instantpot",
  "hamilton", "westinghouse", "blackdecker", "kenwood", "moulinex",
  "delonghi", "smeg", "nespresso", "keurig", "breville",
  /* Audio (additional) — Bose QC variants, Sonos lines, Marshall
     speakers and Sennheiser were missing or under-covered. */
  "sennheiser", "audiotechnica", "shure", "akg", "sonos", "marshall",
  "harmankardon", "bang", "olufsen", "klipsch", "polk", "yamaha",
  /* Gaming peripherals + brand-monitors — Logitech mice/keyboards
     and SteelSeries / Corsair headsets surface often in compare
     queries but didn't have brand→model extraction. */
  "logitech", "steelseries", "corsair", "hyperx", "alienware",
  "benq", "viewsonic", "asus", "gigabyte",
  /* Jun 2026 NULL-signature recovery: recognizable manufacturer brands the
     extractor was missing, surfaced by a stratified audit of ~12k NULL-signature
     in-stock products (most NULLs are correctly generic; these are the genuinely
     fixable branded subset). All are real distinct brands, NOT model/category
     words. 'boat' (boAt audio) and 'astro' (Astro Gaming) are common words, so
     they are CONTEXT_REQUIRED below. Deliberately OMITTED after adversarial
     review — real token collisions for near-zero upside: 'wilson' (FG Wilson
     generators / Wilson wok / Sekonda 'Wilson' watch), 'mitre' (mitre saw/box),
     'valve' (Steam Deck listings are used/bundle eBay, no safe model). */
  "motorola", "iqoo", "redmagic", "boat", "astro", "hmd", "gopro",
  "beko", "amica", "agaro", "nutribullet", "cubitt", "marantz", "audioengine",
];

// Aliases / canonicalization
const BRAND_ALIAS: Record<string, string> = {
  iphone:    "apple",
  airpods:   "apple",
  ipad:      "apple",
  macbook:   "apple",
  galaxy:    "samsung",
  redmi:     "xiaomi",
  poco:      "xiaomi",
  earpods:   "apple",
  playstation: "sony",
  ps4:       "sony",
  ps5:       "sony",
  surface:   "microsoft",
  /* Drinkware sub-brand aliases — `kanteen` is Klean Kanteen's
     model word but also appears as the standalone brand in many
     listings. Same for `instantpot` (the model line is so iconic
     it's used in place of the parent brand). */
  kanteen:   "kleankanteen",
  instantpot: "instant",
  /* Audio sub-brand aliases */
  olufsen:   "bang",
  harmankardon: "harman",
  /* iRobot's Roomba is the household name */
  roomba:    "irobot",
  /* Fashion/beauty: collapse the full house name to its short brand
     slug so "Christian Dior Sauvage" and "Dior Sauvage" share one
     signature brand (the data has both forms for the same fragrance). */
  "christian dior": "dior",
};

export interface ProductSignature {
  brand: string | null;        // "apple", "samsung"
  model: string | null;        // "iphone 15 pro max", "galaxy a06", "pop 10"
  storageGb: number | null;    // 256, 1024 (TB→GB)
  ramGb: number | null;        // 8
  inches: number | null;       // 43, 6.5
  color: string | null;        // "black"
  // Generic tokens used for fuzzy matching on stuff we couldn't parse
  tokens: string[];
  // Stable hash key for grouping
  key: string;
  // Original normalized title
  norm: string;
  /* Structured identifiers passed in by the caller (when known
     from the provider response or DB row). These don't influence
     `key` — the signature key stays a heuristic-only fingerprint
     so existing dedup paths (signature column on products) are
     stable across ingests with/without identifiers. Identifiers
     live alongside `key` so isLikelySameProduct can use them as a
     fast-path BEFORE running its 8 lexical gates. */
  gtin?: string | null;
  mpn?: string | null;
  googleShoppingId?: string | null;
}

/** Optional bag of structured identifiers passed to buildSignature
    when the caller has them (from SerpAPI's product_id, scraped
    Schema.org JSON-LD, retailer feed, etc.). All fields optional;
    omitted ones get null. Used downstream by isLikelySameProduct
    as a high-confidence same-product signal. */
export interface ProductIdentifiers {
  gtin?: string | null;
  mpn?: string | null;
  googleShoppingId?: string | null;
}

const COLOR_RE = /\b(black|white|silver|gold|rose\s*gold|blue|red|green|grey|gray|pink|purple|yellow|orange|graphite|titanium|midnight|starlight|ocean|mint|cream)\b/i;
const STORAGE_RE = /(\d+)\s*(gb|tb)\b/gi;
const RAM_RE = /(\d+)\s*gb\s*ram\b/i;
const INCH_RE = /(\d{2,3}(?:\.\d)?)\s*(?:["'″]|inch(?:es)?|"|''|inches)/i;
const PHONE_INCH_RE = /\b(\d\.\d{1,2})\s*(?:["'″]|inch|in)\b/i;

function stripPunct(s: string): string {
  return s.toLowerCase()
    .replace(/[\u2013\u2014\u2018\u2019\u201C\u201D]/g, " ")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Multi-word fashion + beauty brands surfaced from the May 2026
   signature-leak audit. These ride on the same BRANDS pipeline but
   need to be tried BEFORE single-word substrings (e.g. "fashion
   nova" before bare "fashion") — getSortedBrands() length-sorts
   so longer matches always win. The list is intentionally short:
   anchored on brands we saw repeatedly in the catalog (PayPorte,
   Slot, beauty SKUs) rather than a speculative blanket coverage.
   Add new entries as a follow-up when you spot a brand showing up
   in 20+ "?|?" products in the diagnose-signature-leaks output. */
const FASHION_BEAUTY_BRANDS: string[] = [
  /* Fashion houses */
  "fashion nova", "vero moda", "jack jones", "calvin klein",
  "ralph lauren", "tommy hilfiger", "tommy jeans",
  "gina tricot", "victoria secret",
  "inc international concepts", "akkriti pantaloons",
  "carolina herrera", "louis vuitton", "ray ban",
  /* Beauty */
  "fenty beauty", "fenty skin",
  "soap glory", "soap and glory",
  /* Single-word adds. "ecru" removed Jun 2026: it's a fabric COLOUR
     ("jeans in ecru", "navy and ecru") far more often than the niche
     label, so it false-tagged colour mentions as a brand. */
  "dkny", "akkriti", "pantaloons", "lume",
  "bedoyecta", "clarins", "nivea", "remy",

  /* ── Expanded fashion/beauty dictionary (launch QA, Jun 2026).
     Seeded data-driven from the top brands among 8,127 null-signature
     fashion/beauty products (mango, topshop, the Dior Sauvage cluster,
     clinique, afnan, armaf, levis, crocs...) plus the major global
     labels. Multi-word forms are listed first so getSortedBrands()
     length-sorting prefers them over any single-word substring.
     NOTE: a parsed brand alone does NOT pool a generic-title item
     (isLooseCategoryModel still gates brand|<category> out of the pool).
     This lever lifts brand EXTRACTION so (a) the FTS/embedding matchers
     and SKU'd/identifiable items can pool, (b) the compare brand gate is
     precise, and (c) brand labels/SEO improve. The brand|type|attribute
     signature (lever 2) is the follow-up that pools the generic +
     fragrance long tail. ── */

  /* Fashion houses + high-street (multi-word first) */
  "river island", "miss selfridge", "fashion union", "motel rocks",
  "princess polly", "frankies bikinis", "new look", "jack wills",
  "ted baker", "fred perry", "stone island", "the north face",
  "dr martens", "and other stories", "jacqueline de yong",
  "selected homme", "the couture club", "good for nothing",
  "marc jacobs", "michael kors",
  "topshop", "topman", "abercrombie", "hollister", "crocs", "arket",
  "levis", "rayban", "allsaints", "collusion", "missguided", "bershka",
  "stradivarius", "uniqlo", "primark", "boohoo", "prettylittlething",
  "nastygal", "superdry", "reiss", "whistles", "monki", "timberland",
  "birkenstock", "ugg", "patagonia", "columbia", "carhartt", "lacoste",
  "barbour", "napapijri", "siksilk", "castore", "bardot", "jdy",
  "diesel", "zara", "mango",

  /* Beauty + fragrance (multi-word first) */
  "christian dior", "estee lauder", "yves saint laurent",
  "dolce gabbana", "paco rabanne", "jean paul gaultier", "tom ford",
  "maison margiela", "viktor rolf", "thierry mugler", "franck olivier",
  "jacques bogart", "swiss arabian", "ard al zaafaran",
  "charlotte tilbury", "rare beauty", "huda beauty",
  "anastasia beverly hills", "urban decay", "too faced",
  "la roche posay", "first aid beauty", "drunk elephant",
  "sol de janeiro", "mario badescu", "bobbi brown", "real techniques",
  "wet n wild", "sigma beauty", "max factor", "milk makeup",
  "kylie cosmetics", "elizabeth arden", "the ordinary",
  "dior", "clinique", "lancome", "chanel", "givenchy", "versace",
  "creed", "mugler", "afnan", "armaf", "amouage", "lattafa", "rasasi",
  "ajmal", "armani", "revlon", "bourjois", "nyx", "nars", "morphe",
  "cerave", "cetaphil", "loreal", "ysl", "prada", "gucci", "burberry",
  "valentino", "guerlain", "shiseido", "olaplex", "redken",
];

const ALL_BRANDS = [...BRANDS, ...FASHION_BEAUTY_BRANDS];
/* Length-sorted so multi-word brand strings match before any of
   their single-word substrings ("fashion nova" before "fashion",
   "calvin klein" before "calvin", etc.). Sorted once at module
   load. */
const BRANDS_BY_LENGTH = ALL_BRANDS.slice().sort((a, b) => b.length - a.length);

/* Ambiguous brands — names that appear in product titles as OS /
   platform / feature markers rather than the actual hardware
   manufacturer. If one of these matches AND another brand also
   matches the same title, prefer the other brand (the hardware
   maker is the real "brand" identity).

   "google" is the canonical case: "Skyworth 55" Smart Google TV"
   should resolve to skyworth (the hardware brand), not google (the
   OS platform). Genuine Google hardware (Pixel, Nest) doesn't have
   another competing brand in the title, so the fallback to the
   ambiguous match still produces the right answer. */
const AMBIGUOUS_BRANDS = new Set<string>(["google", "mango"]);

/* Compatibility cues — "Case FOR iPhone", "Compatible WITH Dyson",
   "FITS Samsung" mark a fits-for accessory reference, not the product's
   own brand. Ordered longest-phrase-first so "compatible with" matches
   as a unit before bare "compatible", and "for use with" before bare
   "for". Bare "for" is last so it only wins when nothing more specific
   does. */
const COMPAT_CUE_RE =
  /\b(for use with|compatible with|compatible for|replacement for|spare for|suitable for|designed for|works with|fit for|to fit|compatible|fits|for)\s+/gi;

/* Common-word brands — tokens that are also ordinary English words and
   over-match generic titles ("Surface mount diode" → microsoft, "Instant
   coffee" → instant, "Network switch" → switch, "Honor guard" → honor).
   Each only counts when the title corroborates it: the parent brand name
   is present, or a real product line of that brand appears. Extend this
   map when an audit surfaces another common-word false positive. */
const CONTEXT_REQUIRED: Record<string, RegExp> = {
  surface: /\b(microsoft|surface\s+(pro|laptop|go|book|studio|duo|hub|rt|neo))\b/i,
  instant: /\binstant\s*(pot|vortex|omni|duo|pro|zest|ace|brands)\b/i,
  switch:  /\b(nintendo|joy[-\s]?con|switch\s+(oled|lite|sports))\b/i,
  honor:   /\bhonor\s*(\d|magic|pad|band|play|view|x\d|note|pro\b|plus\b|lite\b)/i,
  /* Jun 2026 NULL-signature recovery — common-word brands gated to their real
     product context so 'boat neck' apparel, 'astro turf', 'mac and cheese' /
     'Mac-Book', 'mitre saw' can't mis-tag. A brand only counts when its line/SKU
     cue is present in the title. */
  boat:    /\b(airdopes|rockerz|nirvana|aavante|stone|bassheads|immortal|wave)\b/i,
  astro:   /\ba\d{2}\b/i,
  mac:     /\b(mac\s*(cosmetics|lipstick|foundation|powder|fix|studio|retro|matte|prep)|m\.a\.c)\b/i,
};

/* Index where the compatibility-governed region begins, or Infinity if
   the title has none. A cue only opens the region when the token right
   after it is itself a brand — so "... for MEN adidas" (audience word
   after the cue) does NOT govern adidas, but "... compatible with
   SAMSUNG galaxy" (brand right after the cue) governs both samsung and
   the trailing galaxy. The region runs to end-of-title, so every brand
   token in the fits-for phrase is suppressed while a brand LEADING the
   title (before any cue) is kept ("Anker Charger for iPhone" → anker). */
function compatGovernedStart(norm: string): number {
  COMPAT_CUE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COMPAT_CUE_RE.exec(norm)) !== null) {
    const afterCue = m.index + m[0].length;
    const tail = norm.slice(afterCue);
    for (const b of BRANDS_BY_LENGTH) {
      if (new RegExp(`^${b.replace(/&/g, "\\&")}\\b`, "i").test(tail)) {
        return afterCue;
      }
    }
  }
  return Infinity;
}

function findBrand(norm: string): string | null {
  let ambiguousFallback: string | null = null;
  const governedStart = compatGovernedStart(norm);
  for (const b of BRANDS_BY_LENGTH) {
    const re = new RegExp(`\\b${b.replace(/&/g, "\\&")}\\b`, "i");
    const m = re.exec(norm);
    if (!m) continue;

    /* Compatibility guard: a brand inside the fits-for region is a
       compatibility reference, not the product's brand. */
    if (m.index >= governedStart) continue;

    /* Context-required common-word brands must be corroborated. */
    const ctx = CONTEXT_REQUIRED[b.toLowerCase()];
    if (ctx && !ctx.test(norm)) continue;

    const canonical = BRAND_ALIAS[b.toLowerCase()] ?? b.toLowerCase();
    /* Normalise multi-word brands to a no-space token so the
       signature key stays a stable single-segment slug — i.e.
       "fashion nova" → "fashionnova". This keeps the brand|model
       signature parseable downstream without ambiguity. */
    const slug = canonical.replace(/\s+/g, "");
    if (AMBIGUOUS_BRANDS.has(slug)) {
      /* Hold the ambiguous match; keep iterating to see if a more
         specific hardware brand also matches. */
      if (!ambiguousFallback) ambiguousFallback = slug;
      continue;
    }
    return slug;
  }
  /* No non-ambiguous match found — fall back to the ambiguous one
     (genuine Google Pixel / Nest titles land here). */
  return ambiguousFallback;
}

/* PRODUCT_TYPES — anchors a "model" signal for Fashion / Beauty /
   Personal-care SKUs where there's no parseable model code. With a
   known brand, the signature becomes brand|type (e.g.
   "fashionnova|dress", "maybelline|mascara") which clusters
   meaningfully: same brand + same product type → "you may also like"
   rails surface other items from that brand's line.

   Trade-off: this is COARSER than brand+model. "Maybelline Lash
   Sensational" and "Maybelline Sky High" both end up as
   "maybelline|mascara", so the cluster groups all Maybelline
   mascaras together. That's still useful UX (better than no
   cluster), and the compare-anchor pool layers a separate price-
   proximity gate that protects against direct comparison drift.
   If the coarseness becomes a problem, refine by adding the next
   distinguishing token (e.g. "lashsensational" / "skyhigh") into
   the model phrase. */
const PRODUCT_TYPES: string[] = [
  /* Fashion — apparel */
  "dress", "skirt", "shirt", "blouse", "pants", "trousers", "jeans",
  "shorts", "jacket", "blazer", "coat", "sweater", "hoodie",
  "tshirt", "tank", "top", "bodysuit", "jumpsuit", "playsuit",
  "suit", "lingerie", "swimsuit", "bikini", "bra",
  /* Fashion — footwear */
  "sneakers", "shoes", "boots", "heels", "sandals", "slippers",
  "loafers", "flats", "wedges", "trainers",
  /* Fashion — accessories */
  "bag", "handbag", "purse", "wallet", "backpack", "tote", "clutch",
  "hat", "scarf", "gloves", "belt", "sunglasses", "watch",
  /* Beauty — colour cosmetics */
  "mascara", "lipstick", "foundation", "concealer", "eyeliner",
  "primer", "blush", "bronzer", "highlighter", "eyeshadow",
  "lipgloss", "lipbalm",
  /* Beauty — skincare */
  "moisturizer", "moisturiser", "serum", "cream", "lotion", "mask",
  "cleanser", "toner", "sunscreen", "exfoliant", "essence",
  /* Personal care */
  "perfume", "cologne", "deodorant", "soap", "bodywash", "shampoo",
  "conditioner", "razor", "trimmer", "toothpaste", "toothbrush",
  /* Electronics — display + audio */
  "television", "tv", "monitor", "projector", "display",
  "earbuds", "earphones", "earphone", "headphones", "headphone",
  "headset", "speaker", "soundbar", "amplifier",
  /* Electronics — computing */
  "laptop", "notebook", "desktop", "tablet", "ipad", "chromebook",
  "smartwatch", "smartphone", "phone", "powerbank",
  "keyboard", "mouse", "mousepad", "webcam",
  /* Electronics — networking + photography + storage */
  "router", "modem", "hub", "switch",
  "camera", "camcorder", "drone", "gimbal", "tripod",
  "ssd", "harddrive", "flashdrive", "memorycard",
  /* Electronics — gaming */
  "console", "controller", "joystick", "headset",
  /* Appliances — kitchen */
  "fridge", "refrigerator", "freezer", "microwave", "oven",
  "stove", "cooker", "blender", "mixer", "grinder", "toaster",
  "kettle", "coffeemaker", "fryer", "airfryer", "dishwasher",
  /* Appliances — laundry + comfort */
  "washingmachine", "washer", "dryer", "iron", "steamer",
  "vacuum", "vacuumcleaner", "fan", "heater", "humidifier",
  "dehumidifier", "purifier",
  /* Appliances — climate */
  "airconditioner", "split",
  /* Health */
  "vitamin", "supplement", "tablets", "capsules", "syrup",
  "thermometer", "scale", "monitor",
  /* Apple — small product anchors found in the catalog */
  "airtag", "airpods", "homepod", "magsafe",
];
const PRODUCT_TYPES_BY_LENGTH = PRODUCT_TYPES.slice().sort((a, b) => b.length - a.length);

/* LOOSE_CATEGORY_TYPES — the subset of PRODUCT_TYPES that are pure
   category words (apparel, footwear, accessories, beauty, personal
   care, health consumables). When findModel falls back to one of
   these, the signature becomes brand|<category> — e.g. "next|jacket",
   "maybelline|mascara" — which clusters an ENTIRE category, not a
   single product.

   That coarse cluster is fine for loose "you may also like" discovery
   (a separate, dupes-based path), but it must NEVER drive a same-
   product "compare prices across N stores / save £X" claim. May 2026
   E2E audit caught one Next own-brand jacket PDP pooling 17 stores at
   £24–£78 (3.25x spread) while its own price history showed a single
   tracked store — proof the pool was a category over-merge, not one
   product across 17 sellers.

   Deliberately EXCLUDES the electronics / appliance type words (tv,
   laptop, switch, watch, monitor, console, camera, …): several double
   as legitimate model-line anchors ("nintendo|switch", "apple|watch")
   and their rarer bare-type pools are already bounded by
   computeAnchorStats' family-aware outlier band. Listing only the
   unambiguous category words avoids false-blocking a real electronics
   pool. */
const LOOSE_CATEGORY_TYPES = new Set<string>([
  /* Fashion — apparel */
  "dress", "skirt", "shirt", "blouse", "pants", "trousers", "jeans",
  "shorts", "jacket", "blazer", "coat", "sweater", "hoodie",
  "tshirt", "tank", "top", "bodysuit", "jumpsuit", "playsuit",
  "suit", "lingerie", "swimsuit", "bikini", "bra",
  /* Fashion — footwear */
  "sneakers", "shoes", "boots", "heels", "sandals", "slippers",
  "loafers", "flats", "wedges", "trainers",
  /* Fashion — accessories (watch excluded: doubles as Apple Watch) */
  "bag", "handbag", "purse", "wallet", "backpack", "tote", "clutch",
  "hat", "scarf", "gloves", "belt", "sunglasses",
  /* Beauty — colour cosmetics */
  "mascara", "lipstick", "foundation", "concealer", "eyeliner",
  "primer", "blush", "bronzer", "highlighter", "eyeshadow",
  "lipgloss", "lipbalm",
  /* Beauty — skincare */
  "moisturizer", "moisturiser", "serum", "cream", "lotion", "mask",
  "cleanser", "toner", "sunscreen", "exfoliant", "essence",
  /* Personal care */
  "perfume", "cologne", "deodorant", "soap", "bodywash", "shampoo",
  "conditioner", "razor", "trimmer", "toothpaste", "toothbrush",
  /* Health consumables */
  "vitamin", "supplement", "tablets", "capsules", "syrup",
]);

/* True when a signature's model slot is one of the pure-category
   fallback words above (so the signature is brand|<category>, not
   brand|<real model>). isSignatureTightEnoughForPooling uses this to
   keep category over-merges out of same-product cross-store
   comparison claims while still allowing them to cluster loosely
   elsewhere. */
export function isLooseCategoryModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return LOOSE_CATEGORY_TYPES.has(model.toLowerCase().trim());
}

/* AMBIGUOUS_HARDWARE_TYPES — electronics / appliance category words where a
   single brand sells MANY genuinely-distinct models (Logitech sells dozens of
   headsets; Samsung dozens of monitors; HP hundreds of laptops). Unlike the
   Fashion / Beauty fallback — where brand|<type> is a deliberately-coarse but
   harmless "you may also like" cluster — using the bare hardware type as a
   signature MODEL is actively wrong: it collapses different products under one
   product_id at INGEST, so a $19 AliExpress knockoff "Logitech … Headset" gets
   merged into the real "Logitech PRO X 2" product and shown as one of its
   stores (June 2026 user report: ca652f59 pooled a PRO X 2, a G435, and two
   Astro A50s as "the same product"; catalog audit found 13+ such pools —
   hyperx|headset spanned $5.30–$149.99 across 14 offers).

   When findModel can only resolve one of these bare types (no real model code
   from MODEL_HINTS / SKU fallback), it must return null instead — the title
   then gets a NULL signature (honest opt-out; dedups only via the exact
   title_key path, which never wrong-merges). DELIBERATELY EXCLUDES the genuine
   single-line anchors where the type word IS the model line and grouping its
   variants is correct: nintendo `switch`, apple `watch` / `airpods` /
   `homepod` / `airtag` / `magsafe` / `ipad`. Those keep their brand|type
   signature. */
const AMBIGUOUS_HARDWARE_TYPES = new Set<string>([
  /* display + audio */
  "television", "tv", "monitor", "projector", "display",
  "earbuds", "earphones", "earphone", "headphones", "headphone",
  "headset", "speaker", "soundbar", "amplifier",
  /* computing + peripherals */
  "laptop", "notebook", "desktop", "tablet", "chromebook",
  "smartphone", "phone", "powerbank", "keyboard", "mouse", "mousepad", "webcam",
  /* networking + photography + storage */
  "router", "modem", "hub", "camera", "camcorder", "drone", "gimbal",
  "tripod", "ssd", "harddrive", "flashdrive", "memorycard",
  /* gaming peripherals (the consoles themselves anchor via MODEL_HINTS) */
  "console", "controller", "joystick",
  /* appliances — kitchen */
  "fridge", "refrigerator", "freezer", "microwave", "oven", "stove", "cooker",
  "blender", "mixer", "grinder", "toaster", "kettle", "coffeemaker", "fryer",
  "airfryer", "dishwasher",
  /* appliances — laundry + comfort + climate */
  "washingmachine", "washer", "dryer", "iron", "steamer", "vacuum",
  "vacuumcleaner", "fan", "heater", "humidifier", "dehumidifier", "purifier",
  "airconditioner", "split",
  /* health hardware */
  "thermometer", "scale",
]);

/* True when a category word is one of the ambiguous hardware types above —
   exported so the re-signature backfill recomputes identically to ingest. */
export function isAmbiguousHardwareType(type: string | null | undefined): boolean {
  if (!type) return false;
  return AMBIGUOUS_HARDWARE_TYPES.has(type.toLowerCase().trim());
}

function findProductType(norm: string): string | null {
  /* Some titles concatenate words ("mini skirt" → "miniskirt"). The
     normalised string has spaces preserved, so we match on word
     boundaries to stay robust to drift. Add common compound types
     as their own entries above when seen in the catalog. */
  for (const t of PRODUCT_TYPES_BY_LENGTH) {
    if (new RegExp(`\\b${t}\\b`, "i").test(norm)) return t;
  }
  return null;
}

// Common model-line keywords per brand — used to extract a tight model name
const MODEL_HINTS: Record<string, RegExp[]> = {
  /* Astro Gaming headsets. X-variant FIRST so "Astro A50 X" -> "a50 x" and
     "Astro A50" -> "a50" land on DISTINCT keys. Without this, the bare-number
     SKU fallback reads only "a50" off both and collapses a ~£260 A50 into a
     ~£600 A50 X pool (price ratio 2.3x slips under the backfill's 4x merge
     guard). Brand is CONTEXT_REQUIRED on /a\d{2}/ so 'astro turf' never reaches
     here. */
  astro: [
    /\b(a\d{2}\s*x)\b/i,
    /\b(a\d{2}[a-z]?)\b/i,
  ],
  apple: [
    /* `pro\s*max` listed BEFORE bare `pro` so the alternation
       greedy-matches the longer suffix first. Probe May 2026:
       "iPhone 15 Pro Max" was matching only "iPhone 15 Pro"
       because bare `pro` won the alternation race, which then
       collapsed Pro and Pro Max into the same signature key. */
    /\biphone\s*(\d{1,2}(?:\s*(?:pro\s*max|plus|mini|max|pro))?)\b/i,
    /\bipad\s*(?:(pro|air|mini)\s*)?(\d{1,2})?\b/i,
    /* MacBook now captures the chip generation (M1-M5 + optional
       Pro/Max suffix) so a "MacBook Pro 16 M4" and "MacBook Pro 16
       M3" land on DIFFERENT keys instead of collapsing to bare
       "macbook pro". Without this, every MacBook Pro 16" at every
       store pooled into one product_id regardless of chip year,
       which surfaced wildly different prices in the same spectrum. */
    /\bmacbook\s*(?:pro|air)\s*(?:\d{1,2}\s*(?:inch|"|in)?\s*)?m[1-5](?:\s*(?:pro|max|ultra))?\b/i,
    /\bmacbook\s*(?:(pro|air)\s*)?(\d{1,2})?\b/i,
    /\bairpods?\s*(?:max|pro\s*\d?|\d)\b/i,   /* "AirPods 4", "AirPods Pro 2", "AirPods Max" */
    /\bairpods?\b/i,                            /* bare "AirPods" */
    /\bwatch\s*(?:series\s*)?(?:se|ultra\s*\d?|\d{1,2})\b/i,  /* Watch SE / Ultra / Series N */
  ],
  samsung: [
    /\bgalaxy\s*([a-z]\d{1,3}[a-z]?(?:\s*(?:plus|ultra))?)\b/i,
    /\bgalaxy\s*(s\d{1,2}(?:\s*(?:plus|ultra|fe))?)\b/i,
    /\bgalaxy\s*(z\s*(?:flip|fold)\s*\d?)\b/i,
    /\b(a\d{2}[a-z]?)\b/i,                  // A06, A15, A55
  ],
  tecno: [
    /\b(spark\s*\d+[a-z]*(?:\s*(?:pro|plus))?)\b/i,
    /\b(camon\s*\d+[a-z]*(?:\s*(?:pro|premier))?)\b/i,
    /\b(pop\s*\d+[a-z]*)\b/i,
    /\b(pova\s*\d+[a-z]*)\b/i,
    /\b(phantom\s*[a-z]?\d+)\b/i,
  ],
  infinix: [
    /\b(hot\s*\d+[a-z]*(?:\s*pro(?:\s*plus)?)?)\b/i,
    /\b(smart\s*\d+[a-z]*(?:\s*pro)?)\b/i,
    /\b(note\s*\d+[a-z]*(?:\s*pro)?)\b/i,
    /\b(zero\s*\d+[a-z]*(?:\s*pro)?)\b/i,
    /\b(gt\s*\d+[a-z]*)\b/i,
  ],
  itel: [
    /\b(a\d{2}[a-z]?)\b/i,
    /\b(p\d{2}[a-z]?)\b/i,
    /\b(s\d{2}[a-z]?)\b/i,
  ],
  xiaomi: [
    /\b(redmi\s*(?:note\s*)?\d+[a-z]*(?:\s*(?:pro|plus|ultra))?)\b/i,
    /\b(poco\s*[a-z]?\d+[a-z]*(?:\s*pro)?)\b/i,
    /\b(mi\s*\d+[a-z]*(?:\s*pro)?)\b/i,
  ],
  hisense: [
    /\b(a\d[a-z]?)\b/i,                     // A4k, A6k
    /\b(u\d[a-z]?)\b/i,                     // U6k
    /\b(e\d[a-z]?)\b/i,                     // E7k
  ],
  lg: [
    /\b(oled\s*\w+\d+[a-z]?)\b/i,
    /\b(nano\d+)\b/i,
    /\b(uq\d+)\b/i,
  ],
  sony: [
    /\b(playstation\s*\d|ps\d)\b/i,
    /\b(wh[-\s]?\d+xm\d|wh[-\s]?\d+[a-z]*)\b/i,  /* WH-1000XM5, WH-CH720 */
    /\b(wf[-\s]?\d+xm\d|wf[-\s]?\d+[a-z]*)\b/i,  /* WF-1000XM5 */
    /\b(linkbuds\s*[a-z]*)\b/i,
    /\b(bravia\s*\w+)\b/i,
    /\b(srs[-\s]?[a-z0-9]+)\b/i,                 /* SRS-XB100 portable speaker */
  ],
  bose: [
    /\b(quietcomfort(?:\s*(?:ultra|earbuds|se))?(?:\s*\d+)?)\b/i,
    /\b(qc(?:\s*(?:ultra|se))?\s*\d{0,2})\b/i,   /* QC45, QC SE, QC Ultra */
    /\b(soundlink\s*(?:flex|mini|micro|revolve|max)?(?:\s*\d)?)\b/i,
    /\b(sport\s*earbuds)\b/i,
  ],
  /* Drinkware product lines — Stanley Quencher / IceFlow,
     Yeti Rambler / Hopper, Hydro Flask Standard / Wide Mouth,
     Owala FreeSip. Capturing the line + the size (oz/L) lets
     the spectrum pool same-line/same-size across stores while
     keeping different lines separate. */
  stanley: [
    /\b(quencher(?:\s*(?:h2\.?0|h20|flowstate|adventure|luxe))?)\b/i,
    /\b(iceflow(?:\s*flip\s*straw)?)\b/i,
    /\b(adventure\s*(?:to[-\s]?go|big\s*grip|stein))\b/i,
    /\b(classic\s*(?:trigger[-\s]?action|legendary)?)\b/i,
  ],
  yeti: [
    /\b(rambler(?:\s*(?:tumbler|mug|bottle|jr))?)\b/i,
    /\b(hopper(?:\s*(?:flip|m\d+|backflip))?)\b/i,
    /\b(roadie\s*\d+)\b/i,
    /\b(tundra\s*\d+)\b/i,
  ],
  hydroflask: [
    /\b(standard\s*mouth)\b/i,
    /\b(wide\s*mouth)\b/i,
    /\b(trail\s*series)\b/i,
  ],
  owala: [
    /\b(freesip)\b/i,
    /\b(flip)\b/i,
  ],
  /* Dyson — vacuum + hair appliance lines that span multiple
     generations. Without these, every "Dyson V-series" pooled
     into one bucket. */
  dyson: [
    /\b(v\d{1,2}(?:\s*(?:detect|absolute|animal|motorhead|fluffy|origin|cordless))?)\b/i,
    /\b(airwrap(?:\s*(?:complete|multi|long))?)\b/i,
    /\b(supersonic)\b/i,
    /\b(corrale)\b/i,
    /\b(pure\s*(?:cool|hot)(?:\s*link)?)\b/i,
  ],
  /* Ninja — blenders + kitchen appliances. Many SKUs share a
     family word (Foodi, Creami) with a numeric/letter suffix
     identifying the actual model. */
  ninja: [
    /\b(foodi(?:\s*\d+[a-z]*)?(?:\s*(?:max|pro|deluxe))?)\b/i,
    /\b(creami(?:\s*deluxe)?)\b/i,
    /\b(blast(?:\s*max)?)\b/i,
    /\b(speedi)\b/i,
  ],
  microsoft: [
    /\b(surface\s*(?:pro|laptop|book|studio|go)(?:\s*\d+)?)\b/i,
    /\b(xbox\s*(?:series\s*[sx]|one(?:\s*[sx])?))\b/i,
  ],
  logitech: [
    /\b(mx\s*(?:master|keys|anywhere|ergo|mechanical)(?:\s*[0-9s]+)?)\b/i,
    /\b(g\s*(?:pro|hub|cloud|703|915|x))\b/i,
  ],

  /* Phase 2.3 — model-line additions for the top brand|? collision
     buckets surfaced by the May 2026 audit (~837 products that had
     brand extracted but model=null). Each regex is rooted in a
     brand-specific line name so cross-brand false matches are
     impossible. */

  /* Nike: 346 products. Sneaker/apparel line names with optional
     numeric model suffix. Air Force/Max/Jordan/Pegasus/Zoom/etc. */
  nike: [
    /\b(air\s*max\s*\w+(?:\s*\d+)?)\b/i,
    /\b(air\s*force\s*\d+)\b/i,
    /\b(air\s*jordan\s*\d+(?:\s*[a-z]+)?)\b/i,
    /\b(dunk\s*(?:low|high|mid)(?:\s*\w+)?)\b/i,
    /\b(blazer\s*(?:low|mid|high)(?:\s*\w+)?)\b/i,
    /\b(pegasus\s*\d+(?:\s*\w+)?)\b/i,
    /\b(zoom\s*(?:vomero|fly|pegasus|rival|streak)\s*\w*)\b/i,
    /\b(vaporfly(?:\s*next)?(?:\s*\d)?)\b/i,
    /\b(alphafly(?:\s*\d)?)\b/i,
    /\b(react\s*(?:infinity|miler|element)(?:\s*\w+)?)\b/i,
    /\b(free\s*run(?:\s*\d+)?)\b/i,
    /\b(cortez(?:\s*\w+)?)\b/i,
    /\b(metcon\s*\d+)\b/i,
    /\b(tech\s*(?:fleece|knit))\b/i,
  ],

  /* Adidas: 144 products. Heritage + performance lines. yeezy
     kept here even though the brand split out to Adidas Originals
     post-2022 — the historical inventory still tags as adidas. */
  adidas: [
    /\b(ultraboost(?:\s*(?:light|dna|22|23|5))?)\b/i,
    /\b(stan\s*smith)\b/i,
    /\b(superstar(?:\s*\w+)?)\b/i,
    /\b(samba(?:\s*\w+)?)\b/i,
    /\b(gazelle(?:\s*\w+)?)\b/i,
    /\b(nmd(?:\s*[a-z]\d+)?)\b/i,
    /\b(forum(?:\s*(?:low|mid|hi))?)\b/i,
    /\b(yeezy\s*\w+(?:\s*\d+)?)\b/i,
    /\b(campus\s*\d{2})\b/i,
    /\b(handball\s*spezial)\b/i,
    /\b(originals\s*\w+(?:\s*\d+)?)\b/i,
    /\b(predator\s*\w+)\b/i,
    /\b(copa\s*\w+)\b/i,
  ],

  /* Apple additions: iMac + Mac mini + iPad mini lines that the
     existing macbook-pattern didn't cover. ipad-mini handled
     separately from the ipad-pro/ipad-air pattern to keep
     generation numbers explicit. */
  apple_extra: [
    /\b(imac(?:\s*\d{2})?(?:\s*m[1-5])?)\b/i,
    /\b(mac\s*mini(?:\s*m[1-5](?:\s*(?:pro|max|ultra))?)?)\b/i,
    /\b(ipad\s*mini(?:\s*\d)?)\b/i,
    /\b(homepod(?:\s*mini)?)\b/i,
    /\b(apple\s*tv(?:\s*4k)?)\b/i,
  ],

  /* Samsung additions: Z Fold/Flip when the title omits "Galaxy"
     prefix (Samsung-Z Fold7-Asda Mobile, etc.). 73 products affected. */
  samsung_extra: [
    /\b(z\s*(?:flip|fold)\s*\d?(?:\s*[a-z]+)?)\b/i,
    /\b(bespoke\s*\w+)\b/i,
    /\b(crystal\s*uhd)\b/i,
  ],

  /* Google: Pixel phones + Nest smart home + Chromecast. 40 products. */
  google: [
    /\b(pixel\s*\d+(?:\s*(?:pro|xl|a|fold))?)\b/i,
    /\b(pixel\s*(?:buds|watch|tablet)(?:\s*\w+)?)\b/i,
    /\b(nest\s*(?:mini|hub|audio|cam|wifi|doorbell|protect|thermostat)(?:\s*\w+)?)\b/i,
    /\b(chromecast(?:\s*(?:ultra|with\s*google\s*tv))?)\b/i,
  ],

  /* Dell: Inspiron / XPS / OptiPlex / Latitude / Precision / Vostro
     / Alienware (still sold under Dell brand). 35 products. */
  dell: [
    /\b(inspiron(?:\s*\d{4})?)\b/i,
    /\b(xps\s*\d{2})\b/i,
    /\b(optiplex(?:\s*\d{4})?)\b/i,
    /\b(latitude(?:\s*\d{4})?)\b/i,
    /\b(precision(?:\s*\d{4})?)\b/i,
    /\b(vostro(?:\s*\d{4})?)\b/i,
    /\b(alienware\s*\w+)\b/i,
    /\b(ultrasharp(?:\s*\w+)?)\b/i,
    /\b(slim\s*desktop)\b/i,
    /\b(pro\s*(?:tower|slim|micro))\b/i,
  ],

  /* HP: Pavilion / Omen / Spectre / EliteBook / ProBook / Envy /
     OmniDesk / All-in-One. 31 products. */
  hp: [
    /\b(pavilion(?:\s*\w+)?)\b/i,
    /\b(omen(?:\s*\d+(?:\s*\w+)?)?)\b/i,
    /\b(spectre(?:\s*x\d+)?)\b/i,
    /\b(elitebook(?:\s*\d{3,4})?)\b/i,
    /\b(probook(?:\s*\d{3,4})?)\b/i,
    /\b(envy(?:\s*x\d+)?)\b/i,
    /\b(omnidesk(?:\s*\w+)?)\b/i,
    /\b(all\s*in\s*one)\b/i,
    /\b(zbook(?:\s*\w+)?)\b/i,
    /\b(victus(?:\s*\d+)?)\b/i,
  ],

  /* Lenovo: IdeaCentre / IdeaPad / ThinkPad / Yoga / Legion. 29. */
  lenovo: [
    /\b(ideacentre(?:\s*\w+)?)\b/i,
    /\b(ideapad(?:\s*\w+)?)\b/i,
    /\b(thinkpad(?:\s*[a-z]\d+)?)\b/i,
    /\b(thinkbook(?:\s*\d+)?)\b/i,
    /\b(yoga(?:\s*\w+)?)\b/i,
    /\b(legion(?:\s*\w+)?)\b/i,
    /\b(tab\s*\w+)\b/i,
    /\b(idea\s*tab)\b/i,
  ],

  /* Nintendo: Switch family is the main consumer line. 31 products. */
  nintendo: [
    /\b(switch\s*oled)\b/i,
    /\b(switch\s*lite)\b/i,
    /\b(switch\s*sports)\b/i,
    /\b(switch(?:\s*\d)?)\b/i,
    /\b(metroid\s*prime\s*\d?)\b/i,
    /\b(legend\s*of\s*zelda(?:\s*\w+)?)\b/i,
    /\b(super\s*mario(?:\s*\w+)?)\b/i,
  ],

  /* LG additions: audio / appliances / laptops. 40 products. The
     pre-existing `lg` array (TVs only) gets extended via MERGE_HINTS
     at the bottom of the file so both regex sets fire on the same
     match attempt. */
  lg_extra: [
    /\b(xboom(?:\s*\w+(?:\s*\w+)?)?)\b/i,
    /\b(gram(?:\s*\d+)?)\b/i,
    /\b(velvet)\b/i,
    /\b(side\s*by\s*side(?:\s*door)?)\b/i,
    /\b(washtower)\b/i,
    /\b(styler)\b/i,
  ],

  /* Instant brand (formerly Instant Pot). 34 products. */
  instant: [
    /\b(pot\s*(?:pro|duo|max|classic|ultra|nova|lux|plus)(?:\s*\d+)?)\b/i,
    /\b(pot(?:\s*\d+)?)\b/i,
    /\b(vortex(?:\s*\w+)?)\b/i,
    /\b(omni(?:\s*\w+)?)\b/i,
    /\b(zest)\b/i,
  ],
};

/* Apple/Samsung extras are appended to the main entries via the
   findModel helper — keeps the per-brand arrays focused. */
const MERGE_HINTS = (target: string, source: string) => {
  const existing = MODEL_HINTS[target] ?? [];
  const extra = MODEL_HINTS[source] ?? [];
  if (extra.length > 0) MODEL_HINTS[target] = [...existing, ...extra];
};
MERGE_HINTS("apple",   "apple_extra");
MERGE_HINTS("samsung", "samsung_extra");
MERGE_HINTS("lg",      "lg_extra");
delete MODEL_HINTS.apple_extra;
delete MODEL_HINTS.samsung_extra;
delete MODEL_HINTS.lg_extra;

// Words that look like model tokens but are actually descriptors / fluff —
// must NOT be picked as a fallback model.
const GENERIC_MODEL_NOISE = new Set([
  "android", "smart", "mobile", "phone", "smartphone", "ios", "tv", "led", "uhd",
  "fhd", "qled", "oled", "hd", "4k", "8k", "wireless", "bluetooth", "speaker",
  "soundbar", "headphone", "headphones", "earphone", "earphones", "earbuds",
  "tablet", "laptop", "notebook", "watch", "gaming", "console", "pro", "max",
  "plus", "mini", "ultra", "fe", "lite", "neo", "with", "and", "for",
  "ch", "cell", "wifi", "type", "usb", "hdmi", "dual",
  /* Size-unit words (Jun 2026): keep them out of the model so a 2-token model
     never becomes "<number> inch". The attribute-as-model guard in fallbackModel
     then drops the leading bare size entirely. */
  "inch", "inches", "cm", "mm",
]);

/* A laptop/monitor context — used only to recognise a LONE leading 2-digit panel
   size (11-18") as a size, not a model. Brand phones with a bare number (Xiaomi
   14, Realme 12) never match these words, so they keep their model. */
const LAPTOP_CONTEXT = /\b(laptop|notebook|ultrabook|chromebook|macbook|ideapad|thinkpad|inspiron|vivobook|zenbook|aspire|swift|spectre|envy|pavilion|omen|legion|predator|nitro|monitor|ips)\b/i;
/* A TV/display context — recognises a lone bare 2-digit screen size (e.g. from
   a stripped 65") as a size when no "inch" word survived. */
const TV_CONTEXT = /\b(tv|television|qled|oled|uhd|led\s*tv|smart\s*tv|monitor|display)\b/i;
/* Generic descriptors that, AFTER a panel size, mean "still just a size" — chip
   makers / marketing words, never a specific SKU. A real SKU (fc0057ni, dw3145ne)
   is alphanumeric and is NOT in this set, so it survives. */
const SIZE_DESCRIPTOR_NOISE = new Set([
  "intel", "amd", "ryzen", "core", "celeron", "touchscreen", "touch",
  "full", "premium", "business", "student", "everyday", "hd", "fhd", "uhd",
  "ips", "cu", "cup", "inch", "in",
]);

function fallbackModel(brand: string, norm: string): string | null {
  // After the brand word, take the next 1–2 distinctive tokens that look like a
  // model identifier. Lets us bucket "JBL Clip 4 Speaker" with "Jbl Clip 4 - Mini
  // Bluetooth Speaker" → both produce model "clip 4".
  const re = new RegExp(`\\b${brand}\\b\\s*([a-z0-9-]+(?:\\s+[a-z0-9-]+)?)`, "i");
  const m = norm.match(re);
  if (!m) return null;
  const after = m[1].toLowerCase().split(/\s+/);
  const kept: string[] = [];
  for (const t of after) {
    if (GENERIC_MODEL_NOISE.has(t)) break;
    // Allow single-char tokens only if they're digits (model numbers like "4")
    if (t.length < 2 && !/\d/.test(t)) break;
    if (!t) break;
    kept.push(t);
    if (kept.length >= 2) break;
  }
  if (kept.length === 0) return null;
  // Require at least one token containing a digit (so we get model numbers like
  // "clip 4" or "a06") — bare adjectives ("portable", "stereo") are too generic.
  if (!kept.some((t) => /\d/.test(t))) return null;

  /* Attribute-as-model guard (Jun 2026): a model that LEADS with a bare 2-3 digit
     number which is really a SIZE or COMPOSITION, not a model code. Without this,
     "Samsung 65 inch TV" → samsung|65, "TCL 43 Inches" → tcl|43 inches, "Mango
     100% Leather Bag" → mango|100 leather, and "HP 15 Laptop" → hp|15 each
     collapse genuinely-different products (a budget LED + a flagship OLED of the
     same size, every "100% leather" Mango bag, every 15" HP) into one signature.
     We drop to NULL — an honest opt-out; the title then falls through to the
     ambiguous-hardware path. Carefully scoped to NOT touch real numbered models:
       • anker|737 power, anker|313 — number not followed by a size unit.
       • hp|15 fc0057ni — a real alphanumeric SKU follows the panel size.
       • xiaomi 14 / realme 12 phones — no laptop/monitor context word. */
  if (/^\d{2,3}$/.test(kept[0])) {
    const num = kept[0];
    // (A) explicit size unit immediately after the number ("65 inch", "36 in", "43 cm")
    if (new RegExp(`\\b${num}\\s*(inch|inches|in|cm|mm)\\b`, "i").test(norm)) return null;
    // (B) material composition ("100% leather/cotton/...") read as a model
    if (num === "100" && /\b100\s+(leather|cotton|suede|wool|silk|polyester|linen|denim|nylon|cashmere|velvet)\b/i.test(norm)) return null;
    // (C) lone laptop/monitor panel size (11-18"), or size + a generic descriptor
    //     (intel/amd/touchscreen/premium...) — but NOT size + a real SKU code.
    if (/^1[1-8]$/.test(num) && LAPTOP_CONTEXT.test(norm)) {
      if (kept.length === 1) return null;
      if (kept.length === 2 && SIZE_DESCRIPTOR_NOISE.has(kept[1])) return null;
    }
    // (D) lone bare 2-digit TV/monitor screen size where the unit word didn't
    //     survive stripping (e.g. 65" → "65") — gated to a TV/display context.
    if (kept.length === 1 && /^[2-9][0-9]$/.test(num) && TV_CONTEXT.test(norm)) return null;
  }
  return kept.join(" ");
}

/* ── Fragrance identity (lever 2) ──────────────────────────────────
   Fragrances title as "<brand> <line> <concentration> <size> [<format>]"
   (e.g. "Dior Sauvage Eau de Parfum 100ml"). The LINE ("sauvage") is the
   product identity; concentration (edt/edp/parfum/elixir), format
   (deodorant/shower gel/refill...) and size (ml) are VARIANT attributes
   that should pool, not split the cluster. fragranceLineName takes the
   words between the brand and the first such variant token. Elixir /
   Extrait is a genuinely different juice, so it is kept ON the line
   (distinct key from the base EDT/EDP). */
const FRAGRANCE_CONCENTRATION = /\b(eau\s+de\s+parfum|eau\s+de\s+toilette|eau\s+de\s+cologne|edp|edt|edc|parfum|cologne|elixir|extrait)\b/i;
const FRAGRANCE_FORMAT = /\b(deodorant|deo\s+stick|shower\s+gel|body\s+spray|after\s*shave|aftershave|body\s+lotion|hair\s+mist|travel\s+spray|refill|gift\s+set|shaving\s+gel|shampoo|balm)\b/i;

function isFragranceTitle(norm: string): boolean {
  return FRAGRANCE_CONCENTRATION.test(norm) || /\b(perfume|fragrance|cologne)\b/i.test(norm);
}

/* Extract the fragrance line name (the model identity) for a parsed brand.
   Returns a compact slug ("sauvage", "sauvageelixir") or null. */
function fragranceLineName(brand: string, norm: string): string | null {
  const idx = norm.search(new RegExp(`\\b${brand}\\b`, "i"));
  if (idx < 0) return null; // multi-word brand slug not present verbatim — skip
  let after = norm.slice(idx + brand.length);
  const hasElixir = /\belixir\b|\bextrait\b/i.test(after);
  /* Cut at the first variant token: concentration / format / size / audience. */
  const stopRe = new RegExp(
    `(${FRAGRANCE_CONCENTRATION.source}|${FRAGRANCE_FORMAT.source}|` +
      `\\b\\d+(?:\\.\\d+)?\\s*ml\\b|\\bfor\\s+(?:men|women|him|her|unisex)\\b|` +
      `\\b(?:men|women|unisex|him|her|ladies|gents)\\b)`,
    "i",
  );
  const stop = after.search(stopRe);
  if (stop >= 0) after = after.slice(0, stop);
  let line = after
    .replace(/\b(perfume|fragrance|cologne|the|by|spray|natural|new|original|limited|edition|set)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (hasElixir && !/elixir|extrait/i.test(line)) line += " elixir";
  const slug = line.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug.length >= 3 ? slug : null;
}

function findModel(brand: string | null, norm: string): string | null {
  if (!brand) return null;
  const hints = MODEL_HINTS[brand];
  if (hints) {
    for (const re of hints) {
      const m = norm.match(re);
      if (m) {
        return m[0].toLowerCase().replace(/\s+/g, " ").trim();
      }
    }
  }
  /* Fragrance line-name (lever 2): runs BEFORE the SKU fallback, which
     would otherwise fold the size into the model ("sauvage 100ml") and
     shatter the cluster by size. Gated by isFragranceTitle, so non-
     fragrances are untouched. The line ("sauvage") becomes the model ->
     key "dior|sauvage"; not a loose-category word, so it pools through the
     existing gate and collapses the EDT/EDP/Parfum/format/size variants. */
  if (isFragranceTitle(norm)) {
    const line = fragranceLineName(brand, norm);
    if (line) return line;
  }

  /* SKU-style fallback first ("Hisense 50A6K" → "50a6k") because
     it's the most discriminating signal when present. */
  const skuModel = fallbackModel(brand, norm);
  if (skuModel) return skuModel;

  /* Fashion / Beauty fallback (May 2026): when the brand-specific
     hints + numeric SKU fallback both miss, use the product TYPE
     (dress, mascara, sneakers, etc.) as the model. Lets us still
     produce a useful brand|type signature for the long tail of
     descriptive Fashion / Beauty titles that don't follow a
     model-code grammar. See PRODUCT_TYPES + findProductType above. */
  const type = findProductType(norm);
  /* …but NEVER for ambiguous hardware types (June 2026). A brand sells
     dozens of distinct headsets / monitors / laptops, so brand|<type>
     here is not a coarse-but-harmless cluster (as for Fashion) — it
     MERGES different products under one product_id at ingest and pools a
     $19 knockoff into the real product's offer list. Return null so the
     title gets a NULL signature and dedups only via the exact title_key
     path, which never wrong-merges. Genuine single-line anchors
     (nintendo|switch, apple|watch/airpods/…) are excluded from the set,
     so they still resolve here. */
  if (isAmbiguousHardwareType(type)) return null;
  return type;
}

function findStorage(norm: string): number | null {
  const matches = Array.from(norm.matchAll(STORAGE_RE));
  if (matches.length === 0) return null;
  // Pick the largest storage candidate that's plausibly storage (8..2048 GB)
  let max = 0;
  for (const m of matches) {
    let n = parseInt(m[1], 10);
    if (m[2].toLowerCase() === "tb") n *= 1024;
    if (n >= 8 && n <= 4096 && n > max) max = n;
  }
  return max || null;
}

function findRam(norm: string): number | null {
  const m = norm.match(RAM_RE);
  return m ? parseInt(m[1], 10) : null;
}

function findInches(norm: string): number | null {
  const tv = norm.match(INCH_RE);
  if (tv) {
    const n = parseFloat(tv[1]);
    if (n >= 19 && n <= 120) return Math.round(n);
  }
  const phone = norm.match(PHONE_INCH_RE);
  if (phone) return parseFloat(phone[1]);
  // bare TV inches like "Hisense 50 UHD" → catch standalone 32–98 followed by tv keyword
  const bare = norm.match(/\b(32|40|43|49|50|55|58|65|70|75|85|98)\b.{0,30}\b(tv|television|uhd|qled|oled|smart)\b/i);
  if (bare) return parseInt(bare[1], 10);
  return null;
}

function findColor(norm: string): string | null {
  const m = norm.match(COLOR_RE);
  return m ? m[0].toLowerCase().replace(/\s+/g, "") : null;
}

/* ── Canonical colour extraction (fashion/beauty matcher gate) ──────────
   Shades fold into a PRIMARY group so cross-store naming variance does NOT
   false-split a real same-product pair ("navy" vs "blue" → both blue), while a
   clearly-different colour still splits ("black" vs "white"). Used ONLY by the
   fashion/beauty colour-conflict gate in the variant partition, where a same-
   brand white jacket and a navy one are different SKUs that must not pool.
   NOTE intentionally NOT wired into electronics matching, where colour
   variants share a product_id by design. */
const COLOR_GROUPS: Record<string, string> = {
  black: "black", jet: "black", onyx: "black",
  white: "white", ivory: "white", cream: "white", offwhite: "white", "off-white": "white", pearl: "white", eggshell: "white",
  grey: "grey", gray: "grey", charcoal: "grey", slate: "grey", graphite: "grey", ash: "grey", smoke: "grey",
  silver: "silver",
  gold: "gold", "rose gold": "gold", rosegold: "gold", champagne: "gold",
  blue: "blue", navy: "blue", royal: "blue", cobalt: "blue", indigo: "blue", denim: "blue", teal: "blue", sky: "blue", aqua: "blue",
  red: "red", burgundy: "red", maroon: "red", wine: "red", crimson: "red", scarlet: "red", cherry: "red",
  green: "green", olive: "green", emerald: "green", mint: "green", sage: "green", khaki: "green", forest: "green", lime: "green",
  pink: "pink", rose: "pink", blush: "pink", fuchsia: "pink", magenta: "pink", salmon: "pink",
  purple: "purple", violet: "purple", lavender: "purple", lilac: "purple", plum: "purple", mauve: "purple",
  yellow: "yellow", mustard: "yellow", lemon: "yellow",
  orange: "orange", coral: "orange", peach: "orange", rust: "orange", apricot: "orange",
  brown: "brown", tan: "brown", beige: "brown", camel: "brown", taupe: "brown", chocolate: "brown", mocha: "brown", nude: "brown", caramel: "brown", coffee: "brown",
};
/* Word-boundary alternation over every colour term, longest-first so
   "rose gold" / "off white" win over "rose" / "white". */
const COLOR_TERMS = Object.keys(COLOR_GROUPS).sort((a, b) => b.length - a.length);
const COLOR_TERM_RE = new RegExp(`\\b(${COLOR_TERMS.map((t) => t.replace(/[-\s]/g, "[-\\s]?")).join("|")})\\b`, "gi");

/** Resolve a title to a single canonical colour group, or null when there's no
    colour OR more than one distinct group (multi-/two-tone → no clean signal,
    so the gate stays off). */
export function extractCanonicalColor(title: string): string | null {
  const lc = ` ${title.toLowerCase()} `;
  const groups = new Set<string>();
  let m: RegExpExecArray | null;
  COLOR_TERM_RE.lastIndex = 0;
  while ((m = COLOR_TERM_RE.exec(lc)) !== null) {
    const term = m[1].toLowerCase().replace(/[-\s]+/g, (s) => (s.includes("-") ? "-" : " ")).trim();
    const g = COLOR_GROUPS[term] ?? COLOR_GROUPS[term.replace(/[-\s]/g, "")];
    if (g) groups.add(g);
  }
  return groups.size === 1 ? Array.from(groups)[0] : null;
}

/** True only when BOTH titles resolve a (different) canonical colour. A title
    with no colour, or a multi-colour title, never triggers a conflict. */
export function titlesColorConflict(a: string, b: string): boolean {
  const ca = extractCanonicalColor(a);
  const cb = extractCanonicalColor(b);
  return ca !== null && cb !== null && ca !== cb;
}

function tokensOf(s: string): string[] {
  return stripPunct(s)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/* ── Distinctive-token gate (fashion/beauty over-pooling fix) ───────────
   Generic dropship listings ("Designer Shoulder Bags for Women - Versatile
   Crossbody Bag", "Men's Slim Fit Wool Blend Suit Jacket") share dozens of
   filler words but no IDENTITY. Title embeddings rate them ~0.95 cosine, so
   the deep matcher's embedding admission pooled wildly-different products as
   "the same" (June 2026 validation: ~3% fashion precision). This gate strips
   the filler and keeps only IDENTIFYING tokens (brand / model / material /
   pattern), then requires the two titles' identifying-token sets to broadly
   AGREE before fashion/beauty may pool. A listing with no identifying token
   (pure generic) can never assert a cross-store match -- which is the honest
   outcome, because it genuinely cannot be matched. Electronics/phones/etc are
   never gated (they match on brand+model already). */
const FASHION_FILLER = new Set<string>([
  /* generic marketing descriptors */
  "designer","luxury","luxurious","fashion","fashionable","style","styles","stylish","trendy","chic",
  "classic","vintage","retro","elegant","premium","quality","high","end","sense","niche","simple",
  "modern","new","hot","selling","sell","soft","light","large","small","mini","micro","big","capacity",
  "everyday","casual","commuter","commuting","outdoor","indoor","sport","sports","business","professional",
  "formal","waterproof","breathable","durable","comfortable","comfort","adjustable","portable","wireless",
  "multifunctional","multi","functional","super","ultra","versatile","inspired","handheld","cross","border",
  /* demographics + fit */
  "men","mens","man","women","womens","woman","ladies","lady","unisex","kids","boys","girls","male","female",
  "slim","regular","tailored","skinny","relaxed","oversized","fit","fitted","wear","ready",
  /* product-type nouns (a TYPE is shared by different products of that type) */
  "bag","bags","handbag","handbags","purse","tote","clutch","crossbody","shoulder","underarm","sling",
  "satchel","backpack","wallet","shoe","shoes","sneaker","sneakers","trainer","trainers","boot","boots",
  "sandal","sandals","heel","heels","flat","flats","footwear","board","watch","watches","wristwatch",
  "shirt","tshirt","tee","top","tops","blouse","tunic","jacket","blazer","coat","suit","dress","skirt",
  "jeans","trousers","pants","short","shorts","brief","briefs","boxer","boxers","underwear","hoodie",
  "sweater","jumper","cardigan","wig","wigs","hair","dryer","trimmer","trimmers","clipper","clippers",
  "frontal","lace","poster","flag","tapestry","decor","art","wall",
  /* connectors / units / packaging */
  "for","with","and","the","of","by","to","in","on","set","sets","pack","piece","pieces","pcs","free",
  "shipping","ship","delivery","inch","cm","mm","ml","density","drawn","pre","cut","plucked","glueless",
  /* fragrance concentration + volume + pack units: shared by every flanker of
     a scent, so they must NOT count as identity. Without this, "Givenchy
     Irresistible EDP 100ml" and "Givenchy Irresistible Nectar EDP 100ml"
     overlap at ~0.8 (edp + 100ml inflate it) and pool as the same perfume. */
  "edp","edt","edc","parfum","perfume","cologne","eau","fragrance","spray","oz","cl","fl",
  "gram","grams","kg","litre","liter","capsules","tablets","count",
]);

/** Identifying tokens only: drops filler, colours, and pure numbers (sizes /
    years / units), keeping brand / model / material / pattern words. */
export function distinctiveTokens(title: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokensOf(title)) {
    if (FASHION_FILLER.has(t)) continue;
    if (COLOR_GROUPS[t]) continue;     // colours handled by the colour gate, not identity
    if (/^\d+$/.test(t)) continue;     // pure numbers: sizes / years / unit counts
    if (/^\d+(\.\d+)?(ml|cl|l|oz|g|kg|mg|gsm)$/.test(t)) continue;  // volume/weight (perfume 100ml, food 400g)
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Jaccard overlap (0..1) of two titles' identifying-token sets. Returns 0 when
    EITHER side has no identifying token -- a generic listing we must not assert
    a cross-store match for. Callers gate fashion/beauty pooling on a threshold. */
export function distinctiveOverlap(a: string, b: string): number {
  const ta = distinctiveTokens(a);
  const tb = distinctiveTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const sb = new Set(tb);
  let inter = 0;
  for (const t of ta) if (sb.has(t)) inter++;
  const union = ta.length + tb.length - inter;
  return union === 0 ? 0 : inter / union;
}

/* ── Panel-tech + storage-capacity conflict (number-identity over-pool fix) ──
   TVs over-pooled across panel types ("LG 4K OLED" vs "LG 4K QNED") and
   consoles/phones across storage ("Xbox Series S 1TB" vs "512GB"), because the
   one-word spec difference sits among many shared tokens. These families keep
   the model matcher (so PS5 == PlayStation 5), but like the colour gate we
   SPLIT when both titles resolve a DIFFERENT value on the same axis. Asymmetric
   (one side unspecified) never conflicts, so a terse listing still pools with a
   detailed one. */
const PANEL_TERMS = ["oled", "qned", "qled", "nanocell", "plasma", "miniled"];
const PANEL_RE = new RegExp(`\\b(${PANEL_TERMS.join("|")})\\b`, "gi");
function extractPanel(title: string): string | null {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  PANEL_RE.lastIndex = 0;
  while ((m = PANEL_RE.exec(title.toLowerCase())) !== null) seen.add(m[1].toLowerCase());
  return seen.size === 1 ? Array.from(seen)[0] : null;
}
const CAPACITY_RE = /\b(\d+)\s?(gb|tb)\b/gi;
function extractCapacity(title: string): string | null {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  CAPACITY_RE.lastIndex = 0;
  while ((m = CAPACITY_RE.exec(title.toLowerCase())) !== null) seen.add(`${m[1]}${m[2].toLowerCase()}`);
  /* Two capacities present (e.g. "8GB RAM 256GB ROM") is ambiguous -> no clean
     signal, stay silent rather than risk splitting on the RAM token. */
  return seen.size === 1 ? Array.from(seen)[0] : null;
}
/* Alphanumeric model/SKU code (letter+digit): TV tiers "C5"/"G5"/"B5",
   "QN70F"/"Q8F", phone "S24"/"S23", "X6725B", headphone "1000XM5". Excludes
   resolutions (4K), capacities (256GB), volumes (100ml), ordinals (4th). Two
   DIFFERENT single codes => different model tier => different product. When a
   title carries 2+ codes (e.g. "S24 5G") it's ambiguous, so stay silent. */
function extractModelCode(title: string): string | null {
  const codes = new Set<string>();
  for (const t of title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (t.length < 2 || t.length > 7) continue;
    if (!/[a-z]/.test(t) || !/\d/.test(t)) continue;
    if (/^\d+k$/.test(t)) continue;                              // 4k / 8k resolution
    if (/^\d+(\.\d+)?(gb|tb|mb|ml|cl|oz|g|kg|mg)$/.test(t)) continue; // capacity / volume
    if (/^\d+(st|nd|rd|th)$/.test(t)) continue;                  // 4th gen ordinals
    codes.add(t);
  }
  return codes.size === 1 ? Array.from(codes)[0] : null;
}
/** Whether a title carries an alphanumeric model code (TV tier, phone SKU). */
export function hasModelCode(title: string): boolean {
  return extractModelCode(title) !== null;
}
/* Major TV brands. Used to split cross-brand TVs (Samsung OLED vs LG OLED),
   which otherwise pool because TVs aren't brand-gated. Scoped to pairs where
   BOTH titles carry a panel term (clearly TVs), so the words can't misfire as
   adjectives ("sharp design") on non-TV products. */
const TV_BRANDS = ["lg","samsung","sony","tcl","hisense","panasonic","philips","toshiba","sharp","jvc","hitachi","blaupunkt","cello","loewe","metz"];
function extractTvBrand(title: string): string | null {
  const lc = title.toLowerCase();
  for (const b of TV_BRANDS) if (new RegExp(`\\b${b}\\b`).test(lc)) return b;
  return null;
}
/** True when two titles name DIFFERENT TV panel types, DIFFERENT TV brands (same
    panel), DIFFERENT single storage capacities, or DIFFERENT single model codes
    -- different SKUs that must not pool. Asymmetric/ambiguous cases never
    conflict, so a terse listing still pools with a detailed one. */
export function titlesTechConflict(a: string, b: string): boolean {
  const pa = extractPanel(a), pb = extractPanel(b);
  if (pa && pb) {
    if (pa !== pb) return true;                       // different panel type
    const ba = extractTvBrand(a), bb = extractTvBrand(b);
    if (ba && bb && ba !== bb) return true;           // same panel, different TV brand
  }
  const ca = extractCapacity(a), cb = extractCapacity(b);
  if (ca && cb && ca !== cb) return true;
  const ma = extractModelCode(a), mb = extractModelCode(b);
  if (ma && mb && ma !== mb) return true;
  const sa = extractSeriesNumber(a), sb = extractSeriesNumber(b);
  if (sa && sb && sa !== sb) return true;                // Apple Watch Series 9 vs 10, Gen 4 vs 5
  return false;
}
/* Numbered model-line designator ("Series 9", "Gen 4", "Mark 3"). A different
   number is a different generation -- splits word-model families (watches) whose
   only numeric differentiator is the series, where the bare digit was stripped. */
const SERIES_RE = /\b(?:series|gen|generation|mark|mk|version)\s*\.?\s*(\d{1,3})\b/i;
function extractSeriesNumber(title: string): string | null {
  const m = title.toLowerCase().match(SERIES_RE);
  return m ? m[1] : null;
}

/** Whether a title carries a concrete model identity (panel type or alphanumeric
    model code). Used to suppress pooling for GENERIC electronics anchors
    ("LG 4K Smart TV") that would otherwise pool every model in the line. */
export function hasModelIdentity(title: string): boolean {
  return extractPanel(title) !== null || extractModelCode(title) !== null;
}

/* Fragrance concentration: a different concentration is a different SKU
   ("Dior Sauvage Parfum" vs "...EDP"). Colour-safe (none of these are colours),
   unlike open-ended flavour/flanker names. "parfum" as a line name ("Le Parfum")
   matches on both sides so it self-cancels; only a genuine EDP-vs-EDT-style
   mismatch conflicts. */
const CONCENTRATION_TERMS = ["extrait", "parfum", "cologne", "edp", "edt", "edc"];
const CONCENTRATION_RE = new RegExp(`\\b(${CONCENTRATION_TERMS.join("|")})\\b`, "gi");
function extractConcentration(title: string): string | null {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  CONCENTRATION_RE.lastIndex = 0;
  while ((m = CONCENTRATION_RE.exec(title.toLowerCase())) !== null) seen.add(m[1].toLowerCase());
  return seen.size === 1 ? Array.from(seen)[0] : null;
}
/** True when two titles name a DIFFERENT single fragrance concentration. */
export function titlesConcentrationConflict(a: string, b: string): boolean {
  const ca = extractConcentration(a), cb = extractConcentration(b);
  return ca !== null && cb !== null && ca !== cb;
}

export function buildSignature(
  title: string,
  identifiers?: ProductIdentifiers,
): ProductSignature {
  const norm = stripPunct(title);

  const brand = findBrand(norm);
  const model = findModel(brand, norm);
  const storageGb = findStorage(norm);
  const ramGb = findRam(norm);
  const inches = findInches(norm);
  const color = findColor(norm);
  const tokens = tokensOf(norm);

  // Build a stable key. Color + storage intentionally NOT in the key — both
  // are variants of the same product and price comparison should still group
  // them together.
  //
  // Inches: include ONLY for product families where size genuinely splits
  // identity (TVs / monitors / laptops). For phones it's fixed by model
  // and varies in title formatting between retailers ("6.1 inch" on Amazon
  // vs no inch on Konga), which previously shattered iPhone 15 listings
  // across product_ids despite having the exact same brand+model.
  //
  // NOTE: structured identifiers (gtin/mpn/googleShoppingId) are NOT
  // folded into the key. The signature column on `products` must be
  // stable across re-ingests that may or may not have identifier data —
  // if we keyed on GTIN, a first ingest without GTIN would land on
  // `apple|iphone 15` and a later ingest WITH GTIN would land on
  // `gtin:0194...`, creating duplicate product rows. Instead, the
  // ingestion writer's identifier-dedup pass (bulk lookup against
  // products.gtin / .google_shopping_id / (.brand,.mpn)) runs BEFORE
  // the signature/title_key passes — see ingestion.ts. Identifiers
  // also serve as a fast-path in isLikelySameProduct at query time.
  const inchesIsProductIdentity =
    inches != null && (
      inches >= 19   // 19"+ → TV / monitor / large laptop. Phones are
                      // <8", so this also excludes phones cleanly.
    );

  /* Signature key — ONLY produced when both brand AND model extract
     cleanly. Otherwise we return an empty string so the caller writes
     NULL into products.signature (see dealToProductRow).

     History: previous versions wrote `brand|?` whenever brand was
     known but model wasn't ("Samsung 65 Inch Smart TV" → `samsung|?`)
     and `?|?` when neither was known ("Vero Moda lace mini skirt" →
     `?|?`). May 2026 audit found these "give-up" signatures were
     silently lying: 70 unrelated Samsung products (TVs + fridges +
     earbuds + ACs) were grouped under `samsung|?`, 37 unrelated LG
     products under `lg|?`, etc. Downstream consumers (similar-
     products rails, compare anchor pool, FTS clustering) trusted the
     grouping and surfaced wrong matches.

     The honest behaviour is: when we can't extract a full identity
     (brand + model), don't claim a cluster. NULL signatures opt
     out of heuristic clustering for those rows. They still dedupe
     across stores via the title_key path (also stored on each
     product), which is the right signal for descriptive titles
     where the regex matcher couldn't anchor on a known model. */
  const key = brand && model
    ? [
        brand,
        model,
        inchesIsProductIdentity ? `${inches}in` : null,
      ].filter(Boolean).join("|")
    : "";

  return {
    brand, model, storageGb, ramGb, inches, color, tokens, key, norm,
    gtin:             identifiers?.gtin ?? null,
    mpn:              identifiers?.mpn ?? null,
    googleShoppingId: identifiers?.googleShoppingId ?? null,
  };
}

/* ── Chip / label display helpers ─────────────────────────────────
   Display-friendly versions of brand and model tokens. The internal
   buildSignature() lowercases + normalises everything (so 'apple'
   matches 'Apple matches APPLE'); for UI surfaces we want the
   human casing back. Special cases for stylised brand names
   (iPhone, MacBook, AirPods, JBL, HP, LG, etc.) — anything not in
   the map falls through to capitalize-first, which covers most of
   the long tail correctly. */

const BRAND_DISPLAY: Record<string, string> = {
  apple: "Apple", samsung: "Samsung", google: "Google", microsoft: "Microsoft",
  hp: "HP", lg: "LG", msi: "MSI", jbl: "JBL", asus: "ASUS", acer: "Acer",
  dell: "Dell", lenovo: "Lenovo", sony: "Sony", bose: "Bose", anker: "Anker",
  beats: "Beats", oraimo: "Oraimo", soundpeats: "SoundPEATS",
  xiaomi: "Xiaomi", oneplus: "OnePlus", huawei: "Huawei", honor: "Honor",
  oppo: "Oppo", vivo: "Vivo", realme: "Realme", nokia: "Nokia",
  tecno: "Tecno", infinix: "Infinix", itel: "Itel",
  hisense: "Hisense", tcl: "TCL", panasonic: "Panasonic", philips: "Philips",
  scanfrost: "Scanfrost", thermocool: "Thermocool", haier: "Haier",
  midea: "Midea", sharp: "Sharp", binatone: "Binatone",
  rayban: "Ray-Ban", oakley: "Oakley",
  nike: "Nike", adidas: "Adidas", puma: "Puma", reebok: "Reebok",
  garmin: "Garmin", fitbit: "Fitbit", fossil: "Fossil",
  remington: "Remington", braun: "Braun", oralb: "Oral-B",
};

const MODEL_TERM_DISPLAY: Record<string, string> = {
  iphone: "iPhone", ipad: "iPad", imac: "iMac", macbook: "MacBook",
  airpods: "AirPods", earpods: "EarPods",
  galaxy: "Galaxy",
  ps3: "PS3", ps4: "PS4", ps5: "PS5", ps6: "PS6",
  surface: "Surface",
  oled: "OLED", qled: "QLED", uhd: "UHD", led: "LED",
};

function capitalize(w: string): string {
  if (!w) return w;
  return w[0].toUpperCase() + w.slice(1);
}

function modelDisplay(model: string): string {
  return model
    .split(/\s+/)
    .map((w) => MODEL_TERM_DISPLAY[w.toLowerCase()] ?? capitalize(w))
    .join(" ");
}

function brandDisplay(brand: string): string {
  return BRAND_DISPLAY[brand.toLowerCase()] ?? capitalize(brand);
}

/* Build a short, clean label suitable for a chip / button. Used by
   /api/popular-suggestions so search-bar chips show 'Apple iPhone 15
   Pro Max' instead of 'Apple iPhone 15 Pro Max - 6.9 inch, 256gb Rom,
   8gb Ram, 5g Network, Black Titanium - International Version'.

   Strategy:
     1. Title under maxLen chars → use as-is (already short)
     2. buildSignature parses brand+model → use 'Brand Model' (clean)
     3. Otherwise truncate at word boundary with ellipsis */
export function chipLabelForTitle(title: string, maxLen: number = 32): string {
  const clean = title.trim();
  if (clean.length <= maxLen) return clean;

  const sig = buildSignature(clean);
  if (sig.brand && sig.model) {
    const label = `${brandDisplay(sig.brand)} ${modelDisplay(sig.model)}`;
    if (label.length <= maxLen) return label;
    /* Even brand+model exceeds budget → truncate */
    return label.slice(0, maxLen - 1).trim() + "…";
  }

  /* No parseable signature: truncate at last word boundary */
  const truncated = clean.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen / 2) {
    return truncated.slice(0, lastSpace) + "…";
  }
  return truncated.trim() + "…";
}

/* ── AI-EXTRACTED SIGNATURES (extracted.json) ── */
// Loaded once at module init — safe in both Next.js server and scripts.
// Falls back to heuristic buildSignature() when no entry exists (new deals
// added between scrapes) or when confidence is too low to trust.
// File is gitignored (generated artefact); loaded via fs so webpack doesn't
// fail the build when it's absent — callers already handle null returns.

import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface _AiEntry {
  brand: string | null;
  model: string | null;
  variant: string | null;
  product_type: string | null;
  storage_gb: number | null;
  ram_gb: number | null;
  inches: number | null;
  color: string | null;
  is_accessory: boolean;
  confidence: "high" | "medium" | "low";
  search_terms: string;
}

const _AI_DATA: Record<string, _AiEntry> = (() => {
  const p = join(process.cwd(), "data/ai-search/extracted.json");
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
})();

/**
 * Return a ProductSignature sourced from the LLM-extracted cache for a deal,
 * or null if the entry is missing or low-confidence (caller falls back to
 * heuristic buildSignature).
 */
export function extractedSignature(dealId: string, title: string): ProductSignature | null {
  const e = _AI_DATA[dealId];
  if (!e) return null;
  // Low-confidence + no brand → not worth trusting over the heuristic
  if (e.confidence === "low" && !e.brand) return null;

  const norm = title
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = norm.split(/\s+/).filter((t) => t.length > 1);

  const parts: string[] = [
    e.brand ?? "?",
    e.model ?? "?",
    e.inches != null ? `${Math.round(e.inches)}in` : null,
  ].filter((p): p is string => p !== null);

  return {
    brand:     e.brand,
    model:     e.model,
    storageGb: e.storage_gb,
    ramGb:     e.ram_gb,
    inches:    e.inches,
    color:     e.color,
    tokens,
    key:       parts.join("|") + (e.is_accessory ? "|acc" : ""),
    norm,
  };
}
/* ── END AI-EXTRACTED SIGNATURES ── */
