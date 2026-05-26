/* Query-understanding primitives shared across /compare and /deals
   search paths.

   These helpers were originally defined inline in pg-fts.ts to
   support the FTS-anchored search there. They're now in a shared
   module so the /deals search path can apply the same gates
   without duplicating the logic.

   What's in here:
     - extractVariantTokens     ('pro max', 'ultra', 'plus', ...)
     - extractRequiredNumbers   ('15' from 'iPhone 15')
     - extractRequiredModelTokens ('s24' from 'Galaxy S24')
     - extractQueryBrand        ('apple', 'samsung', 'nike', ...)
     - detectQueryFamily        ('phone', 'tablet', ...)
     - looksLikeAccessory       (case, cover, screen protector, ...)
     - looksSuspicious          (counterfeit-looking title patterns)
     - candidateHasAllVariants / Numbers / ModelTokens / Brand
     - queryFamily              (category-class queries like 'phones')
     - stripTrailingModifiers   (token-strip fallback for FTS retries)
     - scoreCandidate           (query-token overlap with numeric boost)

   All functions are PURE — no DB calls, no IO. Safe to import in
   server, client, or edge contexts.

   When updating any of these, the rule of thumb is: a rule that
   strengthens precision (drops a wrong candidate) is safe to land;
   a rule that loosens precision (accepts more) needs evidence that
   the looser candidates are actually relevant. The QA-agent
   retest catches regressions on the precision side. */

import { detectFamily, PRODUCT_FAMILIES } from "./families";

/* ── Category-class queries ─────────────────────────────────────────
   Bare nouns / plurals that name a product class rather than a
   specific product. When the user's literal query matches one of
   these, the anchor + dupes MUST be in that family (otherwise FTS
   trigram overlap surfaces "headphones" for the bare query "phones"). */
const CATEGORY_CLASS_QUERIES: Record<string, keyof typeof PRODUCT_FAMILIES> = {
  phone: "phone", phones: "phone", smartphone: "phone", smartphones: "phone",
  tablet: "tablet", tablets: "tablet", ipad: "tablet",
  laptop: "laptop", laptops: "laptop", notebook: "laptop", notebooks: "laptop",
  headphone: "headphones", headphones: "headphones", headset: "headphones",
  earbud: "earbuds", earbuds: "earbuds",
  speaker: "speaker", speakers: "speaker", soundbar: "speaker",
  tv: "tv", tvs: "tv", television: "tv", televisions: "tv",
  console: "console", consoles: "console",
  smartwatch: "watch", watch: "watch", watches: "watch",
  camera: "camera", cameras: "camera",
};

export function queryFamily(rawQuery: string): keyof typeof PRODUCT_FAMILIES | null {
  const tokens = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const meaningful = tokens.filter((t) => !/^(the|a|an|for|to|of)$/.test(t));
  if (meaningful.length === 0 || meaningful.length > 2) return null;
  const fams = meaningful.map((t) => CATEGORY_CLASS_QUERIES[t]);
  if (fams.every((f) => f && f === fams[0])) return fams[0] ?? null;
  return null;
}

/* ── Accessory / parts detection ────────────────────────────────────
   When these tokens appear, treat the candidate as an accessory.
   pg-fts's match-flip uses this: queries that LOOK like accessories
   only match other accessories; queries for products drop accessories. */
const ACCESSORY_NOISE = [
  "case", "cover", "skin", "holder", "stand", "tripod", "selfie stick",
  "screen protector", "tempered glass", "replacement", "repair", "lcd screen",
  "battery replacement", "charger only", "cable only", "adapter only",
  "lens kit", "gimbal",
  /* Drinkware accessories — added May 2026 v3 after QA report that
     Stanley searches were anchoring on "Water Bottle Pouch Paint
     Series for Stanley Quencher" (an accessory) instead of the
     Stanley Quencher tumbler itself. */
  "water bottle pouch", "tumbler pouch", "tumbler sleeve", "tumbler boot",
  "silicone boot", "silicone sleeve", "straw cover", "straw replacement",
  "lid replacement", "spare part", "spare parts", "replacement straw",
  "replacement lid",
  /* Laptop replacement parts — added May 2026 re-audit after
     /compare?q=macbook+air anchored on "New A3240 Laptop Battery
     11.58V 4645mAh For Apple macbook air 13 inch M4" (an aliexpress
     battery, not the laptop). Filter applies broadly — any title
     containing these phrases is treated as a part, not a product. */
  "laptop battery", "replacement battery", "battery pack for",
  "keyboard for macbook", "keyboard cover for", "trackpad replacement",
  "screen for macbook", "lcd panel for", "display panel for",
  "ssd upgrade for", "ram upgrade for", "memory upgrade for",
  "charging port", "power button", "logic board",
];

/* Pattern: "for {brand}" — flags accessories whose title doesn't
   include an obvious accessory keyword but explicitly markets itself
   AS for a major brand (e.g. "Carry Bag for Yeti Rambler",
   "Anti-slip Grip for AirPods Max"). Tight on the brand list — only
   brands where this pattern is reliably accessory rather than
   legitimate co-marketing.

   Extended May 2026 re-audit: now also allows ONE optional brand
   word between "for" and the model token, catching the common
   AliExpress listing pattern "Battery For Apple macbook air".
   Previous regex required brand to come directly after "for", so
   "for Apple macbook" wasn't caught — only "for macbook" would
   have matched. */
const FOR_BRAND_PATTERN = /\bfor\s+(?:apple\s+|samsung\s+|sony\s+|microsoft\s+|google\s+)?(stanley\s*quencher|stanley\s*ice\s*flow|stanley\s*iceflow|yeti\s+rambler|hydroflask|owala\s*freesip|airpods|iphone\s*\d|ipad|macbook|imac|galaxy\s*s\d|galaxy\s*tab|surface\s+pro|surface\s+book|pixel\s*\d|nintendo\s*switch|ps[45]|xbox|playstation)\b/i;

export function looksLikeAccessory(title: string): boolean {
  const t = title.toLowerCase();
  if (FOR_BRAND_PATTERN.test(t)) return true;
  return ACCESSORY_NOISE.some((kw) => {
    const pattern = new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
    return pattern.test(t);
  });
}

/* ── Suspicious / counterfeit title patterns ────────────────────────
   Slip past family + accessory + price filters because they LOOK
   like the real product ("Apple MacBook Neo A18 Pro") but combine
   known-Apple naming with non-Apple chipsets. Hard to detect
   generically — keep a small denylist of known bad patterns. */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /macbook[^a-z0-9]+.*\b(a1[0-9]|a2[0-9]|helio|snapdragon|exynos|kirin|dimensity|tensor)\b/i,
  /macbook[^a-z]+neo/i,
  /iphone[^a-z]+.*\b(android|harmonyos|miui|oneui)\b/i,
  /\bm[1-5]\b.*(snapdragon|mediatek|helio|a1[0-9]|a2[0-9])/i,
];

export function looksSuspicious(title: string): boolean {
  return SUSPICIOUS_PATTERNS.some((re) => re.test(title));
}

/* ── Candidate scoring ──────────────────────────────────────────────
   Token-overlap with a 3× boost for numeric tokens — model numbers
   ('15' in 'iphone 15 pro max') are the strongest disambiguator. */
export function scoreCandidate(query: string, candidateTitle: string): number {
  const qTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const t = candidateTitle.toLowerCase();
  let score = 0;
  for (const tok of qTokens) {
    const isNumeric = /^\d+/.test(tok);
    if (t.includes(tok)) score += isNumeric ? 3 : 1;
  }
  return score;
}

/* ── Trailing-modifier strip (fallback queries) ────────────────────
   'iphone 15 pro max' → 'iphone 15'. Used when the literal query
   misses; the stripped fallback reliably surfaces base SKUs that
   FTS ranks low when 'pro max' is present. */
const TRAILING_MODIFIERS = new Set([
  "pro", "max", "ultra", "plus", "mini", "lite", "se", "air",
  "blue", "red", "black", "white", "silver", "gold", "titanium",
  "graphite", "gray", "grey", "purple", "pink", "green", "starlight",
  "256gb", "512gb", "128gb", "64gb", "1tb", "2tb",
  "5g", "4g", "lte", "wifi",
]);

export function stripTrailingModifiers(query: string): string | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  let i = tokens.length;
  while (i > 1 && TRAILING_MODIFIERS.has(tokens[i - 1])) i--;
  if (i === tokens.length) return null;
  if (i < 2) return null;
  return tokens.slice(0, i).join(" ");
}

/* ── Variant tokens ────────────────────────────────────────────────
   High-end SKU distinguishers. When the query contains one, the
   anchor MUST also contain it. */
const VARIANT_TOKENS = [
  "pro max", "ultra", "plus", "max", "pro", "mini", "lite", "se",
  "m4", "m5", "m3", "m2", "m1",
];

export function extractVariantTokens(query: string): string[] {
  const lc = query.toLowerCase();
  const found: string[] = [];
  for (const v of VARIANT_TOKENS) {
    if (v.includes(" ")) {
      if (lc.includes(v)) found.push(v);
    } else {
      const re = new RegExp(`(^|[^a-z0-9])${v}([^a-z0-9]|$)`);
      if (re.test(lc)) found.push(v);
    }
  }
  if (found.includes("pro max")) {
    return found.filter((t) => t !== "pro" && t !== "max");
  }
  return found;
}

export function candidateHasAllVariants(title: string, variants: string[]): boolean {
  if (variants.length === 0) return true;
  const lc = title.toLowerCase();
  return variants.every((v) => {
    if (v.includes(" ")) return lc.includes(v);
    const re = new RegExp(`(^|[^a-z0-9])${v}([^a-z0-9]|$)`);
    return re.test(lc);
  });
}

/* ── Numeric model markers ─────────────────────────────────────────
   '15' from 'iPhone 15', '24' from 'Galaxy S24 Ultra' — but only
   whole-number tokens not glued to letters. extractRequiredModelTokens
   below catches the letter-glued cases.

   Stoplist filters out promotional/descriptive numbers that appear
   in titles but aren't identity markers — primarily years (2024
   Sale Edition, etc.) which were falsely diverging same-product
   matches during the Phase 2 audit. */
const NUMERIC_NOISE = new Set([
  /* Recent and near-future years used in promo / "[year] Edition"
     marketing. Range covers warranty / release dates without
     overlapping with realistic model numbers (no phone is called
     "iPhone 2024"). */
  "2015", "2016", "2017", "2018", "2019", "2020",
  "2021", "2022", "2023", "2024", "2025", "2026",
  "2027", "2028", "2029", "2030",
]);
export function extractRequiredNumbers(query: string): string[] {
  const matches = Array.from(query.toLowerCase().matchAll(/(?<![a-z0-9])(\d{1,4})(?![a-z0-9])/g));
  return matches.map((m) => m[1]).filter((n) => !NUMERIC_NOISE.has(n));
}

export function candidateHasAllNumbers(title: string, numbers: string[]): boolean {
  if (numbers.length === 0) return true;
  const lc = title.toLowerCase();
  return numbers.every((n) => {
    /* Standalone numeric form: "iPhone 15", "Pegasus 41". */
    const standalone = new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`);
    if (standalone.test(lc)) return true;
    /* Ordinal form: "AirPods Pro 2nd Gen", "iPhone 1st Gen". The
       digit IS still semantically present, just spelled with an
       ordinal suffix. Without this match-also rule, an anchor
       formatted "Pro 2" rejects a candidate formatted "Pro 2nd Gen"
       even though they're the same product. */
    const ordinal = new RegExp(`(^|[^a-z0-9])${n}(?:st|nd|rd|th)(?:[^a-z0-9]|$)`);
    return ordinal.test(lc);
  });
}

/* ── Letter-glued model tokens ─────────────────────────────────────
   's24' from 'Galaxy S24', '3s' from 'MX Master 3S'. Excludes
   connectivity flags / storage / display tech that aren't SKU
   identifiers. */
const MODEL_TOKEN_STOPLIST = new Set([
  "5g", "4g", "3g", "2g", "lte", "wifi", "wlan", "nfc",
  "256gb", "512gb", "128gb", "64gb", "32gb", "16gb", "8gb",
  "1tb", "2tb", "4tb",
  "44mm", "45mm", "46mm", "49mm", "40mm", "42mm", "41mm", "38mm",
  "9oz", "10oz", "12oz", "14oz", "16oz", "20oz", "32oz", "40oz",
  "oled", "qled", "uhd", "fhd", "hdr",
  "m1", "m2", "m3", "m4", "m5",
  "h1", "h2", "h3",
  "4k", "8k",
  /* Ordinal generation suffixes ("AirPods Pro 2nd Gen") — these
     describe the generation already encoded by the numeric token
     before them ("Pro 2" + "2nd"). Without stoplisting, the
     candidate-has-all-tokens check requires the ANCHOR to also
     have "2nd" — which a sibling title formatted "Pro 2" wouldn't. */
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th",
  "10th", "11th", "12th", "13th", "14th", "15th", "16th", "17th",
  "18th", "19th", "20th",
]);

export function extractRequiredModelTokens(query: string): string[] {
  const matches = Array.from(query.toLowerCase().matchAll(
    /\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{2,8}\b/g,
  ));
  const tokens = matches.map((m) => m[0]);
  return tokens.filter((t) => !MODEL_TOKEN_STOPLIST.has(t));
}

/* Split an alphanumeric token into its run-length-encoded letter
   and digit components. "1000xm5" -> ["1000", "xm5"]. Lets the
   candidate-match regex tolerate optional whitespace / punctuation
   between the runs ("WH-1000XM5" anchor matches "WH 1000 XM5" or
   "WH-1000-XM5" candidate), which a single \b...\b regex misses. */
function splitTokenRuns(tok: string): string[] {
  const parts: string[] = [];
  let current = "";
  let lastIsDigit: boolean | null = null;
  for (const ch of tok) {
    const isDigit = /\d/.test(ch);
    if (lastIsDigit !== null && isDigit !== lastIsDigit && current.length > 0) {
      parts.push(current);
      current = "";
    }
    current += ch;
    lastIsDigit = isDigit;
  }
  if (current) parts.push(current);
  return parts;
}

function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function candidateHasAllModelTokens(title: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lc = title.toLowerCase();
  return tokens.every((tok) => {
    /* Multi-run tokens (digit+letter runs alternating) get an
       optional-separator regex. "1000xm5" -> /(^|...)1000\W*xm5(...|$)/
       so "1000 xm5" / "1000-xm5" / "1000xm5" all match. Single-run
       or pure tokens fall through to the original exact-word check. */
    const parts = splitTokenRuns(tok);
    const middle = parts.length > 1
      ? parts.map(reEscape).join("\\W*")
      : reEscape(tok);
    const re = new RegExp(`(^|[^a-z0-9])${middle}([^a-z0-9]|$)`);
    return re.test(lc);
  });
}

/* ── Brand gate ────────────────────────────────────────────────────
   When the query contains a recognisable manufacturer brand name,
   every candidate must contain the same brand. Stops LG → Samsung
   TV substitutions, Sony → Bose headphones, etc. */
const KNOWN_BRANDS = new Set([
  // Phones / electronics
  "samsung", "lg", "sony", "hisense", "tcl", "philips", "panasonic",
  "apple", "google", "xiaomi", "oneplus", "motorola", "nokia", "huawei",
  "tecno", "infinix", "itel", "oppo", "realme", "vivo", "honor",
  // Audio
  "bose", "jbl", "marshall", "sonos", "sennheiser", "beats", "anker",
  // Computing
  "dell", "hp", "lenovo", "asus", "acer", "msi", "razer",
  // Cameras / smart
  "gopro", "fitbit", "garmin", "nest", "ring",
  // Appliances
  "dyson", "shark", "ninja", "kitchenaid", "bosch", "miele",
  // Footwear / fashion
  "nike", "adidas", "puma", "reebok", "vans", "converse", "newbalance",
  // Beauty / fragrance
  "fenty", "rimmel", "maybelline", "loreal", "estee", "clinique",
]);

export function extractQueryBrand(query: string): string | null {
  const tokens = query.toLowerCase().split(/\s+/);
  for (const tok of tokens) {
    if (KNOWN_BRANDS.has(tok)) return tok;
  }
  return null;
}

export function candidateHasBrand(title: string, brand: string | null): boolean {
  if (!brand) return true;
  return title.toLowerCase().includes(brand);
}

/* ── Family detection ─────────────────────────────────────────────
   Detects product family directly from the query (not just from
   category-class queries). Reuses the PRODUCT_FAMILIES mapping
   from ./families. */
export function detectQueryFamily(query: string): string | null {
  return detectFamily(query);
}

/* ── Size token extraction ──────────────────────────────────────
   Pulls out numeric-with-unit tokens that distinguish SKU size
   variants of the same product line:
     "Stanley Quencher 40oz"     → ["40oz"]
     "Stanley Quencher 0.88l"    → ["0.88l"]   (different size)
     "MacBook Pro 13-inch 256GB" → ["13inch", "256gb"]
     "iPhone 15 Pro 512GB"       → ["512gb"]
     "Samsung 55-inch 4K TV"     → ["55inch"]

   Why a separate extractor: extractRequiredNumbers + extractRequired
   ModelTokens both miss numeric-glued-to-unit tokens that ARE
   discriminators between same-product-line variants. The MODEL_TOKEN_
   STOPLIST explicitly excludes sizes like 40oz / 256gb because they
   carry meaningful information that we WANT to compare on for the
   spectrum's variant-pooling logic, but DIDN'T want enforced as a
   hard FTS gate. Now the spectrum uses this extractor as the
   variant discriminator.

   Units recognised: oz, ml, l, gb, tb, mm, cm, inch (with " or
   "in" aliases). Decimal values supported (0.88l, 1.5oz). Hyphen
   between number and unit handled (13-inch). Trailing trim of
   .0 (13.0 → 13). */
export function extractSizeTokens(title: string): string[] {
  const lc = title.toLowerCase();
  const matches = Array.from(
    lc.matchAll(/(\d+(?:\.\d+)?)\s*(?:-)?(oz|ml|l|gb|tb|mm|cm|inch|"|in)(?=[^a-z]|$)/g),
  );
  return matches.map((m) => {
    const num  = m[1].replace(/\.0+$/, "");
    let unit = m[2];
    if (unit === '"' || unit === "in") unit = "inch";
    return `${num}${unit}`;
  });
}

/* True when two titles share the SAME SET of size tokens (or both
   have none). Used by the variant-pooling check — pooling a
   "Stanley 40oz" anchor with a "Stanley 0.88l" candidate would
   compare prices across different sizes (probably misleading: a
   30oz being cheaper isn't a deal vs a 40oz). When neither title
   has a size marker, we allow pooling — that's the case for many
   apparel / generic products without explicit size in the title. */
export function shareAllSizeTokens(a: string, b: string): boolean {
  const sa = extractSizeTokens(a);
  const sb = extractSizeTokens(b);
  if (sa.length === 0 && sb.length === 0) return true;
  if (sa.length !== sb.length) return false;
  const setB = new Set(sb);
  for (const s of sa) if (!setB.has(s)) return false;
  return true;
}

/* ── Variant-aware same-product detection ──────────────────────
   Decides whether a search-result candidate is likely the SAME
   product as the anchor, not just a similar one. Used by the
   PDP's spectrum-augmenting code to merge variant offers into
   the anchor pool — so a "Stanley Quencher 40oz Frost Polka Dot"
   PDP can show price comparisons against a "Stanley Quencher
   40oz Holiday Botanical" listing at another store, but NOT
   pool with the 0.88L size variant or the IceFlow product.

   Bidirectional gates — anchor's variant tokens must appear in
   the candidate AND vice versa, so 'MacBook' doesn't pool with
   'MacBook Pro' (different SKUs), and 'iPhone 15 Pro Max'
   doesn't pool with bare 'iPhone 15 Pro'. Variant/number/model
   bidirectionality is NEVER loosened — the impact-probe analysis
   (May 2026) showed one-way matching pools an iPhone 15 with the
   iPhone 15 Plus, which is wrong.

   Brand handling: when both sides have an explicit brand, they
   must match. When only one side has a brand (catalog
   imperfection), allow — the other gates (model, family, size)
   carry the burden of preventing false matches.

   Family-conditional loosening (May 2026):
     • fashion / beauty: skip size-token equality entirely (fashion
       sizing is M/L/XL/EU 42/UK 8 — almost never matches the
       numeric+unit regex anyway, and when it does it's noise).
       Wider price band 0.33x-3.0x because fashion has higher
       intra-SKU price spread (sale vs full-price, region markup).
     • home / appliances: skip size-token equality WHEN ONE SIDE
       HAS NO TOKENS (cookware/drinkware sizing is sometimes in
       the description, not the title). When both sides DO have
       tokens, equality still required (40oz vs 30oz remain
       different SKUs). Price band 0.4x-2.5x.
     • everything else (electronics, computing, audio, gaming,
       phones): strict. Size equality required, price band
       0.5x-2.0x. Pooling a 256GB phone with 512GB across stores
       would mislead — they're different SKUs.

   Returns true ONLY when the candidate passes EVERY gate (with
   loosening conditions noted above). */

/* Coarse product-type lexicon — used by extractProductType + the
   type-mismatch gate inside isLikelySameProduct.

   User report May 2026: clicking from /ng/p/<cap-offer> through to
   /ng/compare landed the visitor on /ng/p/<shorts-offer> because
   "Nike Club Swoosh cap in brown" had pooled with "Nike Club shorts
   in light blue" — same brand (Nike), same family (fashion), passes
   the lenient 0.33x-3.0x price band — but they are different
   products. The existing gates had no axis that distinguishes
   "what kind of thing is this": cap, shorts, shoe, jacket, watch,
   perfume, phone, etc. This list closes that gap.

   Patterns are intentionally narrow (plural-form matchers anchored
   on word boundaries) so common false positives (capacity, short-
   sleeve) don't trigger. List order is "most specific first" so a
   title containing multiple type words gets the most informative
   label — fine in practice because most titles only match one. */
const PRODUCT_TYPE_KEYWORDS: Array<[string, RegExp]> = [
  ["cap",        /\b(?:caps?|snapback)\b/i],
  ["hat",        /\b(?:hats?|beanie|fedora|bucket\s*hat)\b/i],
  ["shorts",     /\bshorts\b/i],
  ["jeans",      /\b(?:jeans|denim)\b/i],
  ["pants",      /\b(?:pants|trousers|joggers|sweatpants|chinos|leggings|tights)\b/i],
  ["shirt",      /\b(?:t[-\s]?shirts?|polo\s*shirts?|shirts?|tees?)\b/i],
  ["jacket",     /\b(?:jacket|coat|blazer|parka|bomber|windbreaker|gilet)\b/i],
  ["hoodie",     /\b(?:hoodie|sweatshirt)\b/i],
  ["sweater",    /\b(?:sweater|jumper|cardigan|pullover)\b/i],
  ["dress",      /\b(?:dress|gown)\b/i],
  ["skirt",      /\bskirts?\b/i],
  ["shoe",       /\b(?:shoes?|sneakers?|trainers?|boots?|sandals?|loafers?|heels?|slippers?)\b/i],
  ["bag",        /\b(?:backpack|handbag|tote|clutch|purse|rucksack|duffel|holdall|messenger\s*bag)\b/i],
  ["watch",      /\b(?:watches?|smartwatch|wristwatch)\b/i],
  ["sunglasses", /\b(?:sunglasses|shades|eyewear)\b/i],
  ["phone",      /\b(?:smartphones?|iphones?|galaxy|pixel|mobile\s*phones?)\b/i],
  ["laptop",     /\b(?:laptops?|macbooks?|notebooks?|chromebooks?)\b/i],
  ["tablet",     /\b(?:tablets?|ipads?)\b/i],
  ["earphone",   /\b(?:earphones?|earbuds?|airpods?|headphones?|headsets?)\b/i],
  ["speaker",    /\b(?:speakers?|soundbars?|subwoofers?)\b/i],
  ["perfume",    /\b(?:perfumes?|fragrances?|eau\s*de\s*toilette|eau\s*de\s*parfum|edt|edp|cologne)\b/i],
];

/** Coarse product-type label inferred from a title. Returns null when
    nothing matches — caller treats that as "unknown" and falls
    through to other gates rather than auto-rejecting. */
export function extractProductType(title: string): string | null {
  for (const [type, re] of PRODUCT_TYPE_KEYWORDS) {
    if (re.test(title)) return type;
  }
  return null;
}

/* Token-overlap helpers used as a second-line gate inside
   isLikelySameProduct. PRODUCT_TYPE_KEYWORDS handles the obvious
   "cap vs shorts" class; this catches harder same-type cases like
   "Nike running shoes" vs "Nike walking shoes" or two unrelated
   perfumes from the same house — they share brand + family + type
   but their real product identity diverges in the descriptive
   tokens.

   STOP_WORDS removes generic descriptors that would otherwise
   inflate overlap (colours, sizes, "for men/women", "new",
   "original" etc.). Brand is stripped per-call so a brand-only
   overlap doesn't qualify. */
const STOP_WORDS = new Set([
  "and", "the", "for", "with", "from", "set", "pack", "size", "color", "colour",
  "men", "women", "kids", "boys", "girls", "unisex",
  "small", "medium", "large", "xl", "xxl", "xs",
  "new", "original", "official", "genuine", "premium", "edition", "version",
  "black", "white", "brown", "blue", "red", "green", "yellow", "pink", "purple",
  "orange", "grey", "gray", "silver", "gold", "navy", "olive", "tan", "beige",
  "cream", "ivory", "khaki", "burgundy", "maroon", "light", "dark",
]);

/* Generate cross-form matching variants for an alphanumeric token.
   Adds the token itself plus prefix/suffix splits at every
   digit<->letter transition. Designed so a compound anchor token
   ("1000xm5") still intersects with the same product written as
   separate runs in the candidate ("1000 xm5").

     "1000xm5"   → {1000xm5, 1000, xm5}
     "wf1000xm5" → {wf1000xm5, wf, 1000xm5, wf1000, xm5}
     "ps5"       → {ps5, ps, 5}
     "iphone"    → {iphone}                          (no transitions)
     "15"        → {15}                              (no transitions)

   Suffix from the FIRST transition is also the most useful
   sub-token in practice (often the actual model identifier with
   its number, e.g. "xm5" from "WH-1000XM5"). The length-3 filter
   downstream removes 2-char prefixes/suffixes (wh, wf, ps) so the
   set stays focused on meaningful identity hits. */
function tokenSubparts(tok: string): string[] {
  const transitions: number[] = [];
  for (let i = 1; i < tok.length; i++) {
    const prevIsDigit = /\d/.test(tok[i - 1]);
    const currIsDigit = /\d/.test(tok[i]);
    if (prevIsDigit !== currIsDigit) transitions.push(i);
  }
  if (transitions.length === 0) return [tok];
  const out = new Set<string>([tok]);
  for (const pos of transitions) {
    out.add(tok.slice(0, pos));
    out.add(tok.slice(pos));
  }
  return Array.from(out);
}

function significantTokens(title: string, brand: string | null): Set<string> {
  const out = new Set<string>();
  for (const raw of title.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)) {
    if (raw.length < 3) continue;
    if (STOP_WORDS.has(raw)) continue;
    if (brand && brand.toLowerCase() === raw) continue;
    out.add(raw);
    /* Also add letter/digit sub-runs of length >= 3 so "1000xm5" on
       one side intersects with "1000" + "xm5" on the other. Phase 2.4
       audit caught this for Sony WH-1000XM5 written with vs without
       the hyphen — same product, no overlap detected pre-fix. */
    const parts = tokenSubparts(raw);
    if (parts.length > 1) {
      for (const p of parts) {
        if (p.length >= 3 && !STOP_WORDS.has(p)) out.add(p);
      }
    }
  }
  return out;
}

/** True when anchor and candidate share at least min(2, |smaller
    set|) significant tokens. "Significant" = length >= 3, not in
    STOP_WORDS, not the brand. Compound tokens (e.g. "1000xm5") also
    contribute their letter/digit sub-runs to the set so split-form
    candidates still intersect. The min() over the SMALLER token set
    (not just anchor) means terse "Sony WH-1000XM5 Black" candidates
    qualify on a single model-token hit when the anchor's long
    descriptor list would otherwise demand 2 overlaps. */
export function shareSignificantTokens(
  anchorTitle: string,
  candidateTitle: string,
  brand: string | null,
): boolean {
  const aTokens = significantTokens(anchorTitle, brand);
  if (aTokens.size === 0) return true; // nothing meaningful to gate on
  const cTokens = significantTokens(candidateTitle, brand);
  if (cTokens.size === 0) return true;
  /* min(2, smaller set) — if either side is a 1-token anchor or
     1-token candidate, a single overlap on that token qualifies. */
  const required = Math.min(2, Math.min(aTokens.size, cTokens.size));
  let overlap = 0;
  Array.from(aTokens).some((t) => {
    if (cTokens.has(t)) overlap++;
    return overlap >= required;
  });
  return overlap >= required;
}

export function isLikelySameProduct(
  anchor: { title: string; brand?: string | null; priceNgn?: number; family?: string | null },
  candidate: { title: string; brand?: string | null; priceNgn?: number },
): boolean {
  /* Brand: when both sides have explicit brand info, they must
     match. When either side is missing (parser miss / unbranded
     listing), defer to the other gates. */
  const aBrand = (anchor.brand?.toLowerCase().trim() || null) ?? extractQueryBrand(anchor.title);
  const cBrand = (candidate.brand?.toLowerCase().trim() || null) ?? extractQueryBrand(candidate.title);
  if (aBrand && cBrand && aBrand !== cBrand) return false;

  /* Product-TYPE discriminator. detectFamily groups things at
     "fashion" / "electronics" / "home" — too coarse to separate
     cap from shorts, shoe from jacket, perfume from skincare.
     Reject the candidate when both sides label a concrete type and
     they differ. Either side null → fall through (unknown type
     can't disprove sameness). See PRODUCT_TYPE_KEYWORDS above. */
  const aType = extractProductType(anchor.title);
  const cType = extractProductType(candidate.title);
  if (aType && cType && aType !== cType) return false;

  /* Token-overlap sanity gate. The type gate above catches the
     cap/shorts/shoe/jacket class, but same-type same-brand pairs
     can still be DIFFERENT products: "Nike running shoes" vs "Nike
     walking shoes", two unrelated AMOUROUD fragrances under the
     same brand, etc. Require >= min(2, |anchor significant tokens|)
     overlap on length>=3 non-brand non-stopword tokens. Cheap and
     defensive. */
  if (!shareSignificantTokens(anchor.title, candidate.title, aBrand ?? cBrand)) {
    return false;
  }

  /* Family: both classified, must match. Either side null → fall
     through (the anchor-removal in pgFtsFindDupes already gates
     family permissively for the dupes pool). */
  const aFamily = detectFamily(anchor.title);
  const cFamily = detectFamily(candidate.title);
  if (aFamily && cFamily && aFamily !== cFamily) return false;

  /* Variant tokens (Pro / Max / Ultra / Plus / Mini / SE / M1-M5).
     Bidirectional — both sides must agree on the variant set so
     base-model and pro-model don't accidentally pool. */
  const aVariants = extractVariantTokens(anchor.title);
  const cVariants = extractVariantTokens(candidate.title);
  if (!candidateHasAllVariants(candidate.title, aVariants)) return false;
  if (!candidateHasAllVariants(anchor.title, cVariants)) return false;

  /* Numeric model markers (15 in iPhone 15, 24 in Galaxy S24).
     Anchor-directional ONLY — candidate must contain every number
     the anchor names, but candidate having EXTRA numbers (SKU codes,
     clothing sizes, batch IDs, etc.) doesn't matter. Phase 2.4
     audit caught two real cases the bidirectional version got wrong:
       "Nike Air Max 95"            vs "Nike Air Max 95 SKU-1234"
       "Nike Air Max 95 Men's"      vs "Nike Air Max 95 White size 10"
     In both, the candidate's extra number is descriptive — not an
     identity marker — yet the c->a check forced an anchor match
     that wasn't present. Anchor-directional preserves the
     "candidate must have anchor's generation number" intent while
     dropping the over-strict reverse. */
  const aNumbers = extractRequiredNumbers(anchor.title);
  if (!candidateHasAllNumbers(candidate.title, aNumbers)) return false;

  /* Letter-glued model tokens (s24, 1000xm5, h2). Anchor-directional
     for the same reason — candidate's extra model tokens may be
     promotional codes / SKU fragments. The required identity comes
     from the anchor's tokens. */
  const aModel = extractRequiredModelTokens(anchor.title);
  if (!candidateHasAllModelTokens(candidate.title, aModel)) return false;

  /* Family-conditional size + price band. Family is detected from
     the anchor title (or passed in by the caller for cases where
     the category is already known).

     Lenient bucket — fashion, beauty, sports:
       Cross-store price spread is genuinely high (sales, regional
       markup, direct-to-consumer vs marketplace). Size tokens are
       either irrelevant (clothing S/M/L not captured by regex) or
       inconsistently tagged (sports footwear sometimes lists size,
       sometimes doesn't).

     Medium bucket — home, appliances, health:
       Cookware + drinkware + supplement pack-counts DO matter when
       both sides have them, but titles often drop the size on one
       side. Pharmacies + supermarkets have 1.5–2.5x spread.

     Strict bucket — everything else (phones, electronics,
     computing, audio, gaming):
       Storage tier / chip generation / model year / console SKU
       are real product identity. Loosening pools different SKUs. */
  const fam = anchor.family ?? detectQueryFamily(anchor.title);
  const isLenientFam = fam === "fashion" || fam === "beauty" || fam === "sports";
  const isMediumFam  = fam === "home"    || fam === "appliances" || fam === "health";

  /* Size match — strict by default. For fashion/beauty: skip
     entirely (size regex doesn't match S/M/L/XL anyway). For
     home/appliances: skip when ONE side has tokens and the other
     doesn't (drinkware sizing inconsistently surfaced in titles).
     When both sides have tokens, equality required regardless of
     family — a 30oz tumbler and a 40oz tumbler at different prices
     should never share a spectrum. */
  if (!isLenientFam) {
    const aS = extractSizeTokens(anchor.title);
    const cS = extractSizeTokens(candidate.title);
    const bothHaveTokens = aS.length > 0 && cS.length > 0;
    const oneHasTokens   = aS.length > 0 || cS.length > 0;
    if (oneHasTokens) {
      if (isMediumFam && !bothHaveTokens) {
        /* skip: home/appliances tolerate one-sided missing size */
      } else if (!shareAllSizeTokens(anchor.title, candidate.title)) {
        return false;
      }
    }
  }

  /* Price band — wider for non-electronics families because
     real-world price spread is genuinely larger there.
       fashion/beauty: 0.33x – 3.0x   (sale + regional markup)
       home/appliances: 0.4x – 2.5x   (cookware + drinkware spread)
       everything else: 0.5x – 2.0x   (strict, current behaviour)
     Skipped entirely when either side has no usable price. */
  if (anchor.priceNgn && candidate.priceNgn && anchor.priceNgn > 0) {
    const ratio = candidate.priceNgn / anchor.priceNgn;
    const lo = isLenientFam ? 0.33 : isMediumFam ? 0.4 : 0.5;
    const hi = isLenientFam ? 3.0  : isMediumFam ? 2.5 : 2.0;
    if (ratio < lo || ratio > hi) return false;
  }

  return true;
}
