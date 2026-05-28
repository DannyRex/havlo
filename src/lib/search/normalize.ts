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

function findBrand(norm: string): string | null {
  // Sort brands by length descending so multi-word ones win
  for (const b of BRANDS) {
    const re = new RegExp(`\\b${b.replace(/&/g, "\\&")}\\b`, "i");
    if (re.test(norm)) return BRAND_ALIAS[b.toLowerCase()] ?? b.toLowerCase();
  }
  return null;
}

// Common model-line keywords per brand — used to extract a tight model name
const MODEL_HINTS: Record<string, RegExp[]> = {
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
  return kept.join(" ");
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
  // Fall back to "<brand> <next-distinctive-token-with-digit>"
  return fallbackModel(brand, norm);
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

function tokensOf(s: string): string[] {
  return stripPunct(s)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
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
