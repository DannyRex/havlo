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
