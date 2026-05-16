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
];

export function looksLikeAccessory(title: string): boolean {
  const t = title.toLowerCase();
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
   below catches the letter-glued cases. */
export function extractRequiredNumbers(query: string): string[] {
  const matches = Array.from(query.toLowerCase().matchAll(/(?<![a-z0-9])(\d{1,4})(?![a-z0-9])/g));
  return matches.map((m) => m[1]);
}

export function candidateHasAllNumbers(title: string, numbers: string[]): boolean {
  if (numbers.length === 0) return true;
  const lc = title.toLowerCase();
  return numbers.every((n) => {
    const re = new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`);
    return re.test(lc);
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
]);

export function extractRequiredModelTokens(query: string): string[] {
  const matches = Array.from(query.toLowerCase().matchAll(
    /\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{2,8}\b/g,
  ));
  const tokens = matches.map((m) => m[0]);
  return tokens.filter((t) => !MODEL_TOKEN_STOPLIST.has(t));
}

export function candidateHasAllModelTokens(title: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lc = title.toLowerCase();
  return tokens.every((tok) => {
    const re = new RegExp(`(^|[^a-z0-9])${tok}([^a-z0-9]|$)`);
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
     Bidirectional — same generation requirement. */
  const aNumbers = extractRequiredNumbers(anchor.title);
  const cNumbers = extractRequiredNumbers(candidate.title);
  if (!candidateHasAllNumbers(candidate.title, aNumbers)) return false;
  if (!candidateHasAllNumbers(anchor.title, cNumbers)) return false;

  /* Letter-glued model tokens (s24, 1000xm5, h2). Bidirectional
     so the candidate must share every model identifier the anchor
     uses AND vice versa. */
  const aModel = extractRequiredModelTokens(anchor.title);
  const cModel = extractRequiredModelTokens(candidate.title);
  if (!candidateHasAllModelTokens(candidate.title, aModel)) return false;
  if (!candidateHasAllModelTokens(anchor.title, cModel)) return false;

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
