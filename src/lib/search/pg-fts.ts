/* ──────────────────────────────────────────────────────────────────
   PostgreSQL Full-Text Search-backed find-similar engine.

   Replaces the heuristic findSimilar() from src/lib/search/index.ts
   which depended on hardcoded BRANDS / PRODUCT_TYPES / CATEGORY_KEYWORDS.

   Pipeline:
     1. FTS rank against `products.search_doc`  → top match becomes anchor
     2. Fetch full anchor (all per-store offers) for price comparison
     3. FTS again using the anchor's title       → similar products
     4. Filter to same category + price ≤ 115% of anchor  → dupes
     5. Build SearchOutput with NGN-normalised prices

   No code maintenance needed when new brands appear in the catalog —
   Postgres FTS handles them automatically the moment they're ingested.
   ────────────────────────────────────────────────────────────────── */

import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { usdToNgn } from "@/lib/utils";
import { isUsableMerchantUrl } from "@/lib/url-helpers";
import { resolveStoreLogoUrl } from "@/lib/store-logo";
import type {
  SearchOutput, ProductGroup, StoreOffer, DupeResult, SearchSuggestion,
} from "./index";

/* ── Row shapes ───────────────────────────────────────────────────── */

interface FtsRow {
  product_id:       string;
  title:            string;
  category_slug:    string | null;
  brand:            string | null;
  image_url:        string | null;
  offer_id:         string;
  store_id:         string;
  store_name:       string;
  store_logo_url:   string | null;
  is_international: boolean;
  url:              string;
  current_price:    number;
  original_price:   number | null;
  discount_percent: number | null;
  currency:         "NGN" | "USD";
  rank:             number;
}

interface NestedStore {
  id:               string;
  name:             string;
  logo_url:         string | null;
  is_international: boolean;
}

interface NestedOffer {
  id:               string;
  store_id:         string;
  url:              string;
  current_price:    number;
  original_price:   number | null;
  discount_percent: number | null;
  currency:         "NGN" | "USD";
  in_stock:         boolean | null;
  stores:           NestedStore | null;
}

interface AnchorProduct {
  id:            string;
  title:         string;
  category_slug: string | null;
  brand:         string | null;
  image_url:     string | null;
  offers:        NestedOffer[];
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function priceInNgn(price: number, currency: "NGN" | "USD"): number {
  return currency === "USD" ? usdToNgn(price) : price;
}

/* Per-category price floors in NGN. Anything below the floor is almost
   always bad data (mis-parsed accessory/case price tagged as the product,
   currency unit confusion, or scammy listing). Conservative numbers —
   genuine deals that fall below should be the exception, not the rule. */
const CATEGORY_PRICE_FLOOR_NGN: Record<string, number> = {
  phones:      40_000,
  computing:   80_000,
  electronics: 15_000,
  audio:        5_000,
  appliances:  20_000,
  gaming:      15_000,
  fashion:      3_000,
  beauty:       1_500,
  home:         3_000,
  sports:       2_500,
};

/* Per-flagship-line price floors. Catches counterfeit listings that
   pass the category floor but are way below the legitimate retail
   range for that specific product. Each entry is a lowercase
   substring → minimum NGN price.

   QA round 3 caught:
     • Apple AirPods Pro 2 anchored at ₦30K — real is ₦300K+
     • iPhone 17 Pro DHgate $27.55 (~₦42K) — real is ₦1.5M+
     • Galaxy S26 Ultra DHgate counterfeits passing audio floor
     • Adidas Samba ₦7K — real is ~₦150K
   These weren't caught by the category floor (audio ₦5K, phones
   ₦40K) because the floor is set to allow legitimate cheap audio /
   phones / fashion. Per-flagship floors are the only way to draw
   a sharper line for products with a well-known retail range.

   Match on substring of the LOWERCASED title. First-match-wins by
   declaration order (longer / more specific keys go first). */
const FLAGSHIP_PRICE_FLOOR_NGN: Array<[string, number]> = [
  // Apple — flagship phones
  ["iphone 17 pro max",   1_500_000],
  ["iphone 17 pro",       1_300_000],
  ["iphone 17",             900_000],
  ["iphone 16 pro max",   1_200_000],
  ["iphone 16 pro",       1_000_000],
  ["iphone 16",             750_000],
  ["iphone 15 pro max",     900_000],
  ["iphone 15 pro",         750_000],
  ["iphone 15",             600_000],
  // Apple — audio
  ["airpods max",           300_000],
  ["airpods pro 2",         150_000],
  ["airpods pro",           120_000],
  ["airpods 4",             100_000],
  ["airpods 3",              80_000],
  // Apple — laptops
  ["macbook pro m4",      1_500_000],
  ["macbook pro m3",      1_200_000],
  ["macbook air m3",        900_000],
  ["macbook air m2",        700_000],
  ["ipad pro m4",         1_000_000],
  ["ipad air m2",           600_000],
  // Samsung — flagship phones
  ["galaxy z fold 7",     1_500_000],
  ["galaxy z fold 6",     1_300_000],
  ["galaxy z flip 7",       900_000],
  ["galaxy z flip 6",       800_000],
  ["galaxy s26 ultra",      900_000],
  ["galaxy s26",            600_000],
  ["galaxy s25 ultra",      700_000],
  ["galaxy s24 ultra",      600_000],
  // Pixel
  ["pixel 10 pro",          700_000],
  ["pixel 10",              500_000],
  ["pixel 9 pro",           500_000],
  // Audio — premium headphones
  ["wh-1000xm5",            150_000],
  ["wh-1000xm4",            100_000],
  ["bose quietcomfort ultra",150_000],
  ["bose quietcomfort 45",  120_000],
  // Gaming — current consoles
  ["playstation 5 slim",    400_000],
  ["playstation 5",         350_000],
  ["xbox series x",         400_000],
  ["xbox series s",         200_000],
  ["nintendo switch oled",  250_000],
  // Footwear flagships — real Nike retail
  ["air jordan 1",           80_000],
  ["nike dunk low",          70_000],
  ["air force 1",            45_000],
  ["adidas samba",           80_000],
  ["yeezy",                 100_000],
];

function flagshipFloorFor(title: string): number | null {
  const lc = title.toLowerCase();
  for (const [key, floor] of FLAGSHIP_PRICE_FLOOR_NGN) {
    if (lc.includes(key)) return floor;
  }
  return null;
}

function priceLooksPlausible(priceNgn: number, categorySlug: string | null, title?: string): boolean {
  /* Flagship floor wins when present — sharper signal than the
     category floor for products with a known retail range. */
  if (title) {
    const flagshipFloor = flagshipFloorFor(title);
    if (flagshipFloor !== null) return priceNgn >= flagshipFloor;
  }
  const floor = categorySlug ? (CATEGORY_PRICE_FLOOR_NGN[categorySlug] ?? 1_000) : 1_000;
  return priceNgn >= floor;
}

/* Product-family detection lives in families.ts (shared with
   /api/live-search). Re-exported here so existing imports of these
   from pg-fts continue to resolve. */
export { PRODUCT_FAMILIES, detectFamily, familiesIncompatible, alternativeFamilyMatches } from "./families";
import { PRODUCT_FAMILIES, detectFamily, familiesIncompatible, alternativeFamilyMatches } from "./families";

/* Category-class queries — bare nouns / plurals that name a product class
   rather than a specific product. When the user's literal query matches
   one of these, the anchor + dupes MUST be in that family (otherwise FTS
   trigram overlap surfaces "headphones" for the bare query "phones").

   Map any category-class word → the canonical PRODUCT_FAMILIES key. */
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

function queryFamily(rawQuery: string): keyof typeof PRODUCT_FAMILIES | null {
  const tokens = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);
  // Only treat as a category-class query if EVERY meaningful token is a
  // class noun (so "iphone 15" isn't reduced to "phone"). Skip very short
  // articles that don't carry meaning.
  const meaningful = tokens.filter((t) => !/^(the|a|an|for|to|of)$/.test(t));
  if (meaningful.length === 0 || meaningful.length > 2) return null;
  const fams = meaningful.map((t) => CATEGORY_CLASS_QUERIES[t]);
  if (fams.every((f) => f && f === fams[0])) return fams[0] ?? null;
  return null;
}

/* Accessory / parts noise — when these tokens appear in a candidate title
   for a product-name query, we drop the candidate. A query for "iPhone 15
   Pro Max" should never anchor on a phone case, screen protector, or
   replacement LCD. Whole-word boundaries to avoid false positives like
   "case" inside "casework" (not a real concern but good hygiene). */
const ACCESSORY_NOISE = [
  "case", "cover", "skin", "holder", "stand", "tripod", "selfie stick",
  "screen protector", "tempered glass", "replacement", "repair", "lcd screen",
  "battery replacement", "charger only", "cable only", "adapter only",
  "lens kit", "gimbal",
];

function looksLikeAccessory(title: string): boolean {
  const t = title.toLowerCase();
  return ACCESSORY_NOISE.some((kw) => {
    // simple word-boundary check — kw can be multi-word so we use \b at
    // either end where alphabetic
    const pattern = new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
    return pattern.test(t);
  });
}

/* Suspicious / counterfeit-looking titles. These slip past family +
   accessory + price filters because they LOOK like the real product
   ("Apple MacBook Neo A18 Pro 13-inch") but combine known-Apple naming
   with a non-Apple chipset (A18 is Mediatek/Infinix; Apple uses M1–M5).
   Hard to detect generically — we maintain a small denylist of known
   bad patterns. Easy to extend as new fake listings surface. */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  // "Apple MacBook ... <non-Apple chip>" — Apple ships M1–M5 only.
  /macbook[^a-z0-9]+.*\b(a1[0-9]|a2[0-9]|helio|snapdragon|exynos|kirin|dimensity|tensor)\b/i,
  // "Apple MacBook Neo" — Apple has never made a "Neo" line.
  // Allow any non-letter separator so "MacBook-Neo", "MacBook  Neo" all match.
  /macbook[^a-z]+neo/i,
  // "Apple iPhone ... <Android marker>" — fake iPhone clones.
  /iphone[^a-z]+.*\b(android|harmonyos|miui|oneui)\b/i,
  // Generic: a title that names two competing chip ecosystems is bogus.
  // Apple Silicon (M1–M5) AND a competing chip in the same title.
  /\bm[1-5]\b.*(snapdragon|mediatek|helio|a1[0-9]|a2[0-9])/i,
];

function looksSuspicious(title: string): boolean {
  return SUSPICIOUS_PATTERNS.some((re) => re.test(title));
}

/* Score a candidate title against the user's query.
   Token-overlap with a 3× boost for numeric tokens (model numbers like
   "15" in "iphone 15 pro max" are the strongest disambiguator). Returns
   a number — higher is better. */
function scoreCandidate(query: string, candidateTitle: string): number {
  const qTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const t = candidateTitle.toLowerCase();
  let score = 0;
  for (const tok of qTokens) {
    const isNumeric = /^\d+/.test(tok);
    if (t.includes(tok)) score += isNumeric ? 3 : 1;
  }
  return score;
}

/* Strip trailing modifier tokens for fallback queries.
   "iphone 15 pro max" → "iphone 15", "macbook pro 16" → "macbook pro".
   Rules: drop trailing color words, sizes, storage, generic modifiers. */
const TRAILING_MODIFIERS = new Set([
  "pro", "max", "ultra", "plus", "mini", "lite", "se", "air",
  "blue", "red", "black", "white", "silver", "gold", "titanium",
  "graphite", "gray", "grey", "purple", "pink", "green", "starlight",
  "256gb", "512gb", "128gb", "64gb", "1tb", "2tb",
  "5g", "4g", "lte", "wifi",
]);

function stripTrailingModifiers(query: string): string | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  let i = tokens.length;
  while (i > 1 && TRAILING_MODIFIERS.has(tokens[i - 1])) i--;
  if (i === tokens.length) return null;     // nothing stripped
  if (i < 2) return null;                   // would over-strip
  return tokens.slice(0, i).join(" ");
}

/* Variant tokens that distinguish a higher-end SKU from its base
   model. When the query contains one of these, the anchor MUST also
   contain it — otherwise we'd surface 'iPhone 15' as the answer to
   'iPhone 15 Pro Max' (Bucket 3#3 from QA audit, where the user
   pays 50% more for the Pro Max but Havlo recommended the cheaper
   base model and three even-cheaper older iPhones).

   Multi-word variants ('pro max') checked as substrings; single
   words checked with word-boundary regex so 'pro' inside 'product'
   doesn't false-match. Order: longest first so 'pro max' matches
   before falling through to 'pro' alone. */
const VARIANT_TOKENS = [
  "pro max", "ultra", "plus", "max", "pro", "mini", "lite", "se",
  "m4", "m5", "m3", "m2", "m1",
];

function extractVariantTokens(query: string): string[] {
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
  /* Dedupe: if 'pro max' matched, drop 'pro' and 'max' so we don't
     require a candidate to triple-match an inclusion that's already
     covered by the multi-word match. */
  if (found.includes("pro max")) {
    return found.filter((t) => t !== "pro" && t !== "max");
  }
  return found;
}

function candidateHasAllVariants(title: string, variants: string[]): boolean {
  if (variants.length === 0) return true;
  const lc = title.toLowerCase();
  return variants.every((v) => {
    if (v.includes(" ")) return lc.includes(v);
    const re = new RegExp(`(^|[^a-z0-9])${v}([^a-z0-9]|$)`);
    return re.test(lc);
  });
}

/* Extract whole-number model markers from the query (e.g. '15' from
   'iPhone 15 Pro Max', '24' from 'Galaxy S24 Ultra'). When present,
   every candidate must contain each one as a whole token; otherwise
   'iPhone 15 Pro Max' silently anchored to 'iPhone 16 Pro Max' (the
   variant gate alone passed both). Numeric-only tokens, 1-4 digits,
   excluding tokens like 'M4' where the digit is glued to letters. */
function extractRequiredNumbers(query: string): string[] {
  const matches = Array.from(query.toLowerCase().matchAll(/(?<![a-z0-9])(\d{1,4})(?![a-z0-9])/g));
  return matches.map((m) => m[1]);
}

function candidateHasAllNumbers(title: string, numbers: string[]): boolean {
  if (numbers.length === 0) return true;
  const lc = title.toLowerCase();
  return numbers.every((n) => {
    const re = new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`);
    return re.test(lc);
  });
}

/* Extract letter-glued model tokens from the query — these are the
   identifiers extractRequiredNumbers misses because the digit is
   glued to a letter:
     'Galaxy S24 Ultra'      → ['s24']
     'Logitech MX Master 3S' → ['3s']
     'Galaxy A55'            → ['a55']
     'iPhone 16 Plus'        → []     (16 is bare, caught by extractRequiredNumbers)
     'MacBook Pro M4'        → ['m4'] (also covered by extractVariantTokens)

   QA agent flagged 'Galaxy S24 Ultra → Galaxy S25 Ultra' (same
   family + same variants slipped past). The S24/S25 distinction
   only lives in this letter-glued form, so we need a dedicated
   gate.

   Stop-list excludes connectivity flags (5G/4G/LTE), storage sizes
   (256GB), watch sizes (44mm/45mm), display tech (OLED/QLED), and
   chip names already enforced by the variant gate (M1–M5). Without
   this list, requiring '5g' to appear in every candidate would drop
   legitimate non-5G variants of the same SKU. */
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

/* Brand gate (added May 2026 after QA report flagged an LG OLED 55
   query anchoring on a Samsung TV).

   When the query contains a recognisable manufacturer brand name,
   every candidate must contain the same brand. Stops cross-brand
   matches inside the same family (LG → Samsung TV, Sony → Bose
   headphones, etc.). Brands that share family but compete head-to-
   head shouldn't substitute for each other.

   Conservative list — only major brands where users genuinely
   shop by brand identity. Non-brand queries (e.g. "55 inch TV"
   without a brand name) bypass this gate. */
const KNOWN_BRANDS = new Set([
  // Phones / electronics — typed by users when they want THAT brand
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
  "dyson", "shark", "ninja", "kitchenaid", "bosch", "miele", "lg", "samsung",
  // Footwear / fashion
  "nike", "adidas", "puma", "reebok", "vans", "converse", "newbalance",
  // Beauty / fragrance
  "fenty", "rimmel", "maybelline", "loreal", "estee", "clinique",
]);

function extractQueryBrand(query: string): string | null {
  const tokens = query.toLowerCase().split(/\s+/);
  for (const tok of tokens) {
    if (KNOWN_BRANDS.has(tok)) return tok;
  }
  return null;
}

function candidateHasBrand(title: string, brand: string | null): boolean {
  if (!brand) return true;
  return title.toLowerCase().includes(brand);
}

function extractRequiredModelTokens(query: string): string[] {
  /* Pattern: token of length 2-8 that contains BOTH at least one
     letter and at least one digit. Lookaheads enforce the
     letter+digit requirement; \b anchors avoid mid-word matches.

     Length cap of 8 (was 5) catches longer compound IDs like
     '1000XM5' from 'Sony WH-1000XM5' — without this the matcher
     anchored XM5 queries on XM6 because nothing forced the
     specific generation marker (QA agent's 25-query script). */
  const matches = Array.from(query.toLowerCase().matchAll(
    /\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{2,8}\b/g,
  ));
  const tokens = matches.map((m) => m[0]);
  return tokens.filter((t) => !MODEL_TOKEN_STOPLIST.has(t));
}

function candidateHasAllModelTokens(title: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lc = title.toLowerCase();
  return tokens.every((tok) => {
    const re = new RegExp(`(^|[^a-z0-9])${tok}([^a-z0-9]|$)`);
    return re.test(lc);
  });
}

/* Detect product family from the user's query directly (not just
   from category-class queries like 'phones'). Reuses the same
   PRODUCT_FAMILIES mapping as detectFamily(title). When the query
   names a specific product (iPhone, MacBook, Galaxy), we know the
   family and can require candidates to match it.

   Closes the cross-category bleed in the variant gate from the QA
   re-test: 'iPhone 16 Plus' was matching 'Dell 16 Plus DB16250'
   (laptop), 'MacBook Pro M4' was matching 'iPad Pro M4' (tablet).
   Token overlap alone wasn't enough; we need a category guard. */
function detectQueryFamily(query: string): string | null {
  return detectFamily(query);
}

/* familiesIncompatible is now imported from ./families. */

function offerToStoreOffer(o: NestedOffer, productTitle?: string): StoreOffer {
  const store = o.stores;
  const priceN = priceInNgn(o.current_price, o.currency);
  const origN = o.original_price ? priceInNgn(o.original_price, o.currency) : priceN;
  const isIntl = store?.is_international ?? false;
  const landedExtra = isIntl ? Math.round(priceN * 0.30) : 0;
  return {
    storeId:        o.store_id,
    storeName:      store?.name ?? o.store_id,
    storeLogoUrl:   resolveStoreLogoUrl(o.store_id, store?.logo_url),
    storeColor:     "#0057FF",
    price:          priceN,
    currency:       "NGN",
    url:            o.url,
    imageUrl:       undefined,
    productTitle,
    originalPrice:  origN,
    discountPercent: o.discount_percent ?? 0,
    rating:         0,
    deliveryDays:   isIntl ? 14 : 3,
    isInternational: isIntl,
    landedCostExtra: landedExtra,
    landedPrice:    priceN + landedExtra,
  };
}

function ftsRowToSingleOffer(r: FtsRow): StoreOffer {
  const priceN = priceInNgn(r.current_price, r.currency);
  const origN = r.original_price ? priceInNgn(r.original_price, r.currency) : priceN;
  const landedExtra = r.is_international ? Math.round(priceN * 0.30) : 0;
  return {
    storeId:        r.store_id,
    storeName:      r.store_name,
    storeLogoUrl:   resolveStoreLogoUrl(r.store_id, r.store_logo_url),
    storeColor:     "#0057FF",
    price:          priceN,
    currency:       "NGN",
    url:            r.url,
    imageUrl:       r.image_url ?? undefined,
    originalPrice:  origN,
    discountPercent: r.discount_percent ?? 0,
    rating:         0,
    deliveryDays:   r.is_international ? 14 : 3,
    isInternational: r.is_international,
    landedCostExtra: landedExtra,
    landedPrice:    priceN + landedExtra,
  };
}

function buildAnchorGroup(p: AnchorProduct): ProductGroup {
  /* Two filters:
     1. in_stock — drop offers the merchant has sold out of
     2. isUsableMerchantUrl — drop offers whose stored URL points at
        Google Shopping relay URLs that /api/go can't reliably resolve.
        Without this, users were clicking compare offers and getting
        bounced to /ng?deal_unavailable=1 (open new tab → immediate
        redirect home → confusing). Same gate /deals already applies
        via browse-db.ts. */
  const inStock = p.offers
    .filter((o) => o.in_stock !== false)
    .filter((o) => isUsableMerchantUrl(o.url));
  /* Pass the parent product's title down to each offer so the
     comparison rows on /compare can show 'as titled at this store'
     subtitles. For pooled cross-product anchors, each offer's
     productTitle was already set in resolveAnchorFromRow before
     they got merged in here — that field takes precedence.

     Per-offer plausibility filter (added May 2026 after QA report):
     dedup pooling sometimes merges accessory listings (e.g. Konga
     "Galaxy S24 Ultra Wallet Case" at ~₦5K) under the same
     signature as the actual phone (~₦1.3M). Without filtering
     individual offers by category-floor, bestPrice = the case
     price → priceLooksPlausible at the anchor level rejects the
     entire product → /compare returns empty for searches that
     SHOULD have anchored on the real phone. Filtering at the
     offer level keeps the phone offers and drops the accessory
     ones. */
  const offers = inStock
    .map((o) => offerToStoreOffer(o, (o as NestedOffer & { productTitle?: string }).productTitle ?? p.title))
    /* Pass the product title so the per-flagship floor catches
       counterfeits (AirPods Pro 2 ₦30K, iPhone 17 Pro DHgate ₦42K)
       that the category floor misses. The signal is conservative
       — only kicks in when the title matches a known flagship line. */
    .filter((o) => priceLooksPlausible(o.price, p.category_slug ?? "general", p.title))
    .sort((a, b) => a.landedPrice - b.landedPrice);
  const prices = offers.map((o) => o.landedPrice);
  return {
    key:            p.id,
    title:          p.title,
    category:       p.category_slug ?? "general",
    imageUrl:       p.image_url ?? undefined,
    imageEmoji:     "🛍️",
    imageGradient:  "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    brand:          p.brand,
    model:          null,
    storageGb:      null,
    inches:         null,
    storeCount:     offers.length,
    bestPrice:      prices.length > 0 ? Math.min(...prices) : 0,
    worstPrice:     prices.length > 0 ? Math.max(...prices) : 0,
    maxSavings:     prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0,
    offers,
  };
}

function ftsRowToDupe(row: FtsRow, anchor: ProductGroup): DupeResult {
  const offer = ftsRowToSingleOffer(row);
  const rawSavings = Math.max(0, anchor.bestPrice - offer.landedPrice);
  const rawPercent = anchor.bestPrice > 0
    ? Math.max(0, Math.round((rawSavings / anchor.bestPrice) * 100))
    : 0;

  /* Suppress savings UI for absurdly-high "savings" — almost always a
     category mismatch (case shown as dupe for phone) or upstream parsing
     error. >=85% off the anchor's best price is a strong red flag. We still
     return the dupe but with savings zeroed so the green badge doesn't
     misrepresent the comparison. */
  const looksFake = rawPercent >= 85;
  const savings = looksFake ? 0 : rawSavings;
  const savingsPercent = looksFake ? 0 : Math.min(rawPercent, 99);

  return {
    key:            row.product_id,
    title:          row.title,
    category:       row.category_slug ?? "general",
    imageUrl:       row.image_url ?? undefined,
    imageEmoji:     "🛍️",
    imageGradient:  "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    brand:          row.brand,
    model:          null,
    storageGb:      null,
    inches:         null,
    storeCount:     1,
    bestPrice:      offer.landedPrice,
    worstPrice:     offer.landedPrice,
    maxSavings:     0,
    offers:         [offer],
    similarityScore: Math.min(100, Math.round(row.rank * 60)),
    savingsVsAnchor: savings,
    savingsPercent,
  };
}

/* ── Dupes-only entrypoint (for sniffed-URL flow) ─────────────────────
   Used when the anchor is provided externally (e.g. parsed from a
   user-pasted store URL). We skip anchor selection entirely and just
   return cheaper alternatives ranked by similarity to the given title. */

interface FakeAnchor {
  title: string;
  bestPrice: number;
  category?: string | null;
}

export async function pgFtsFindDupes(
  query: string,
  anchorPriceNgn: number,
  opts?: { limit?: number },
): Promise<DupeResult[]> {
  const supa = getSupabaseAdmin();
  if (!supa || !query.trim()) return [];

  /* anchorPriceNgn === 0 means "no price ceiling" — used when sniff
     extracted a title but no price (Jumia + many other retailers).
     We still return similar products, just without the cheaper-than-X
     filter; UI then ranks by FTS similarity alone. */
  const noCeiling = anchorPriceNgn <= 0;
  const limit = opts?.limit ?? 16;
  const qFamily = queryFamily(query);

  /* Same gate set as the main entrypoint, applied to the externally-
     provided title (typically a paste-a-link sniff). Without these,
     URL pasting an iPhone 15 Pro Max anchor was returning iPhone 16
     and iPhone 14 alternatives because the dupes path didn't
     enforce variant / number / model exactness. */
  const variants            = extractVariantTokens(query);
  const requiredNumbers     = extractRequiredNumbers(query);
  const requiredModelTokens = extractRequiredModelTokens(query);
  const familyConstraint    = qFamily ?? detectQueryFamily(query);

  /* Accessory routing (QA report Bucket 4):
     User pasted an Amazon URL for "iPhone 15 Plus Clear Case with
     MagSafe". Returned alternatives were the actual iPhone, plus
     two unrelated phones — because the matcher treated "iPhone 15
     Plus" tokens as the signal and ignored "Case".

     When the query title looks like an accessory, FLIP the
     accessory filter: only candidates that ALSO look like
     accessories pass. The parent product (the actual phone) gets
     dropped. A shopper looking at a $5 case sees other cases, not
     $1M phones marked as 'cheaper'. */
  const queryIsAccessory = looksLikeAccessory(query);

  const { data: matches, error } = await supa.rpc("search_products_fts", {
    q: query,
    max_results: 60,
  });
  if (error || !matches) return [];

  // Build a lightweight anchor stand-in for similarity scoring
  const fakeAnchor: ProductGroup = {
    key:           "external-sniff",
    title:         query,
    category:      "general",
    imageEmoji:    "",
    imageGradient: "",
    brand:         null,
    model:         null,
    storageGb:     null,
    inches:        null,
    storeCount:    1,
    bestPrice:     anchorPriceNgn,
    worstPrice:    anchorPriceNgn,
    maxSavings:    0,
    offers:        [],
  };

  return ((matches as FtsRow[]))
    /* If we have an anchor price, strict cheaper-only (≤ 99% of anchor).
       If we don't (sniff returned no price), keep all plausible matches. */
    .filter((r) => noCeiling || priceInNgn(r.current_price, r.currency) < anchorPriceNgn * 0.99)
    .filter((r) => priceLooksPlausible(priceInNgn(r.current_price, r.currency), r.category_slug, r.title))
    /* URL usability — drop Google-relay rows that /api/go can't
       reliably resolve to a real merchant. Without this, paste-a-link
       dupes were occasionally returning offers that bounced to
       /ng?deal_unavailable=1 on click. */
    .filter((r) => isUsableMerchantUrl(r.url))
    /* Accessory match-flip: a query that's an accessory ('iPhone 15
       Case') must only see other accessories. Otherwise, drop them. */
    .filter((r) => queryIsAccessory ? looksLikeAccessory(r.title) : !looksLikeAccessory(r.title))
    // Drop counterfeit-looking titles ("Apple MacBook Neo A18 Pro")
    .filter((r) => !looksSuspicious(r.title))
    // Product-family gate: an iPhone anchor must not get iPad / MacBook dupes.
    .filter((r) => !familiesIncompatible(query, r.title))
    /* Strict family match: anchor query family must equal candidate
       family. Skipped for accessory queries because cases / cables
       cross-fit between phones and tablets — matching by accessory
       semantics is what we want there. */
    .filter((r) => queryIsAccessory || !familyConstraint || detectFamily(r.title) === familyConstraint)
    // Variant gate: 'pro max' / 'ultra' / 'plus' must be honoured.
    .filter((r) => candidateHasAllVariants(r.title, variants))
    // Generation gate: 'iPhone 15' must NOT match 'iPhone 16' rows.
    .filter((r) => candidateHasAllNumbers(r.title, requiredNumbers))
    // Model-token gate: 'Galaxy S24' must NOT match 'Galaxy S25' rows.
    .filter((r) => candidateHasAllModelTokens(r.title, requiredModelTokens))
    .map((r) => ftsRowToDupe(r, fakeAnchor))
    /* No savings floor — was '>= 5%' but the user's UX guidance is
       'show everything, let me decide'. Even 1-2% off the anchor is
       worth surfacing for big-ticket items. The >=85% absurdity gate
       below still trims data-error rows (savingsPercent zeroed by
       the builder for those). */
    // Drop the >=85% suppressed rows entirely (savingsPercent zeroed by builder)
    .filter((d) => noCeiling || d.savingsPercent > 0)
    .slice(0, limit * 2)
    .sort((a, b) => {
      const aScore = a.similarityScore * 0.55 + Math.min(a.savingsPercent, 80) * 0.45;
      const bScore = b.similarityScore * 0.55 + Math.min(b.savingsPercent, 80) * 0.45;
      return bScore - aScore;
    })
    .slice(0, limit);
}

/* ── Main entrypoint ──────────────────────────────────────────────── */

/* Did-you-mean: top-3 closest title matches via the suggest_titles RPC
   (scripts/db/0008-suggest-titles.sql). Used to populate the empty-mode
   response's `suggestions` array so the EmptySearchState UI can render
   "Did you mean…" pills. Falls through to [] gracefully if the RPC
   isn't migrated yet — no error surface. */
async function fetchDidYouMean(q: string): Promise<SearchSuggestion[]> {
  const supa = getSupabaseAdmin();
  if (!supa || !q.trim() || q.trim().length < 2) return [];
  try {
    const { data, error } = await supa.rpc("suggest_titles", { q, max_results: 3 });
    if (error || !data) return [];
    return (data as Array<{ product_id: string; title: string; score: number }>).map((r) => ({
      title: r.title,
      key:   r.product_id,
      score: r.score,
    }));
  } catch {
    return [];
  }
}

export async function pgFtsFindSimilar(
  rawQuery: string,
  opts?: { limit?: number },
): Promise<SearchOutput> {
  const q = rawQuery.trim();
  if (!q) return { mode: "empty", query: q, suggestions: [] };

  const supa = getSupabaseAdmin();
  if (!supa) return { mode: "empty", query: q, suggestions: [] };

  const limit = opts?.limit ?? 16;
  const qFam = queryFamily(q);

  /* Build a candidate anchor from an FTS row.

     Query-time cross-store pooling: after fetching the chosen product,
     ALSO fetch every other product with the same `signature` (compact
     'brand|model[|inches]' key from buildSignature). Pool their offers
     into one anchor.

     Why: catalog ingestion creates fresh product_ids for each retailer
     because titles vary ('iPhone 15 128GB Black' on Konga vs
     'iPhone 15 - 128GB - Midnight Black' on Amazon). Even after the
     dedup backfill, edge cases survive. Doing the merge at QUERY time
     is forgiving — products only need to share the same parsed key,
     they don't have to be physically merged in the DB.

     Skip pooling when signature is null ('?|?' bucket — unparsed
     brand/model). Pooling those would over-merge unrelated rows.

     Returns null when no product survives validation (no in-stock
     offers, implausible price). Caller falls through to other
     candidates / fallback queries before giving up. */
  async function resolveAnchorFromRow(row: FtsRow): Promise<ProductGroup | null> {
    const { data: productData, error: pErr } = await supa!
      .from("products")
      .select(`
        id, title, category_slug, brand, image_url, signature,
        offers (
          id, store_id, url, current_price, original_price, discount_percent, currency, in_stock,
          stores ( id, name, logo_url, is_international )
        )
      `)
      .eq("id", row.product_id)
      .single();
    if (pErr || !productData) return null;

    /* Default: anchor uses just the chosen product's offers. */
    let anchorPayload = productData as unknown as AnchorProduct;

    /* Cross-product pool: only when the chosen product has a usable
       compact signature (brand+model parsed). The signature column
       was rewritten from JSON.stringify(sig) to sig.key by the dedup
       backfill — it's now either 'brand|model' or '?|?' (fallback
       when brand or model couldn't be parsed).

       Round-4 user-reported bug: searching "10 Pcs Stainless Steel
       Colored Handi Set" returned an anchor with 804 offers. Root
       cause: this check used to be just `if (signature)` which was
       truthy for "?|?". That made EVERY brand-less product pool
       with every OTHER brand-less product. The single 1-offer
       Handi Set anchor was pooling with ~800 unrelated generic-
       title products' offers. Skip the pool when signature is
       null OR "?|?". */
    const signature = (productData as { signature: string | null }).signature;
    if (signature && signature !== "?|?") {
      const { data: siblings } = await supa!
        .from("products")
        .select(`
          id, title, category_slug, brand, image_url,
          offers (
            id, store_id, url, current_price, original_price, discount_percent, currency, in_stock,
            stores ( id, name, logo_url, is_international )
          )
        `)
        .eq("signature", signature)
        .neq("id", row.product_id);

      if (siblings && siblings.length > 0) {
        const base = productData as unknown as AnchorProduct;
        /* Tag each base offer with its source product's title so
           the comparison row subtitle can show 'as titled at this
           store'. Same for sibling offers — each carries its own
           parent's title which differs from the chosen anchor's. */
        const baseOffers = (base.offers ?? []).map((o) => ({
          ...o,
          productTitle: base.title,
        })) as AnchorProduct["offers"];
        const siblingOffers = (siblings as unknown as AnchorProduct[]).flatMap(
          (p) => (p.offers ?? []).map((o) => ({
            ...o,
            productTitle: p.title,
          })),
        ) as AnchorProduct["offers"];
        anchorPayload = {
          ...base,
          offers: [...baseOffers, ...siblingOffers],
        };
      }
    }

    const a = buildAnchorGroup(anchorPayload);
    if (a.offers.length === 0) return null;
    /* Pass title so flagship floor catches counterfeit anchors. */
    if (!priceLooksPlausible(a.bestPrice, a.category, a.title)) return null;
    return a;
  }

  /* Try in this order:
       1. The user's exact query
       2. A token-stripped fallback ("iphone 15 pro max" → "iphone 15")
     For each candidate query we walk the top-N FTS rows (not just top-1)
     so a single bad row (offers gone, category-implausible price) can't
     poison the entire result. The Apple iPhone 15 Pro Max row may not
     exist; Apple iPhone 15 likely does — anchoring on the related model
     beats showing empty for the headline product family. */
  /* Variant tokens from the ORIGINAL user query (q), not the
     `query` arg — `query` may be a token-stripped fallback like
     'iphone 15' which intentionally drops 'pro max'. We always
     enforce the variants from what the user actually typed so
     falling back through stripTrailingModifiers can't sneak a
     base-model SKU past a 'pro max' query. */
  const variants            = extractVariantTokens(q);
  const requiredNumbers     = extractRequiredNumbers(q);
  const requiredModelTokens = extractRequiredModelTokens(q);
  const queryBrand          = extractQueryBrand(q);
  /* Family constraint: prefer the category-class family (qFam) when
     the query is bare class noun like 'phones'; otherwise infer from
     the query directly (detectQueryFamily('iPhone 16 Plus') →
     'phone'). Either way, candidates must match the inferred family
     so token overlap alone can't surface cross-category nonsense
     ('iPhone 16 Plus' → Dell 16 Plus laptop, 'MacBook Pro M4' →
     iPad Pro M4). Returning null means 'no family inferred, allow
     anything' so freeform searches like 'gift for mum under 50'
     aren't accidentally over-filtered. */
  const familyConstraint = qFam ?? detectQueryFamily(q);

  async function pickAnchor(query: string): Promise<{ row: FtsRow; anchor: ProductGroup } | null> {
    const { data, error } = await supa!.rpc("search_products_fts", {
      q: query,
      max_results: 20,
    });
    if (error || !data) return null;

    /* Re-rank candidates by query-token overlap (with a 3× boost for
       numeric tokens). FTS rank alone treats "iphone 15 pro max" against
       "iPhone 17 Pro" as a strong match because "iphone" + "pro" both
       hit. By weighting model numbers heavily we keep the literal "15"
       in the user's query from being silently swapped for "17". */
    const candidates = (data as FtsRow[])
      .filter((r) => !looksLikeAccessory(r.title))
      .filter((r) => !looksSuspicious(r.title))
      /* Family gate covers BOTH category-class queries ('phones')
         AND specific-product queries ('iPhone 16 Plus', 'MacBook
         Pro M4'). Together they prevent cross-category bleed. */
      .filter((r) => !familyConstraint || detectFamily(r.title) === familyConstraint)
      /* Variant gate (Bucket 3#3 from QA audit): when the user typed
         'pro max' / 'ultra' / 'plus' etc., the chosen anchor must
         contain that exact variant. */
      .filter((r) => candidateHasAllVariants(r.title, variants))
      /* Numeric model gate: 'iPhone 15 Pro Max' must NOT match an
         iPhone 16 row — the variant gate alone let that through
         because both have 'Pro Max'. Whole-number tokens in the
         query (15, 24, etc.) must appear as whole tokens in the
         candidate title. */
      .filter((r) => candidateHasAllNumbers(r.title, requiredNumbers))
      /* Letter-glued model gate (Galaxy S24 vs S25, MX Master 3S
         vs G502). Catches identifiers the bare-numeric gate misses
         because the digit is glued to a letter. */
      .filter((r) => candidateHasAllModelTokens(r.title, requiredModelTokens))
      /* Brand gate: queries naming a known manufacturer (LG, Sony,
         Bose, Nike, etc.) must anchor on candidates from the same
         brand. Stops cross-brand matches like "LG OLED 55 inch TV"
         → "Samsung 55 Inch Smart TV". Bypassed when the query
         doesn't include any recognized brand. */
      .filter((r) => candidateHasBrand(r.title, queryBrand))
      .map((r) => ({ row: r, score: scoreCandidate(query, r.title) }))
      // Stable sort: score desc, then preserve original FTS rank as tiebreak
      .sort((a, b) => b.score - a.score);

    /* Confidence floor (P0 #2): when the top-scoring candidate
       hasn't matched the bare minimum signal, prefer empty over
       confidently wrong. Only fires for queries with NO known family
       — for known families the family gate is already a strong
       precision signal and we don't want to also penalize a
       legitimate but imperfect lexical match (e.g. 'PlayStation 5
       Slim' anchoring on 'PlayStation 5 Standard' when the Slim
       SKU isn't in the DB). For unknown-family queries (e.g.
       'summer dress'), require 2+ token hits so a 'summer rug'
       candidate doesn't anchor on a single weak overlap. */
    if (candidates.length === 0) return null;
    if (!familyConstraint) {
      const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
      const minScore = queryTokens.length <= 1 ? 1 : 2;
      if (candidates[0].score < minScore) return null;
    }

    for (const { row } of candidates) {
      const anchor = await resolveAnchorFromRow(row);
      if (anchor) return { row, anchor };
    }
    return null;
  }

  /* Always try BOTH the literal query AND the token-stripped fallback,
     then pick whichever anchor scores higher against the ORIGINAL user
     query. FTS ranks "iPhone 17 Pro" above "Apple iPhone 15" for the
     query "iphone 15 pro max" (3 of 4 tokens vs 2 of 4) — so iPhone 15
     never enters the top-20 candidate set if we only run one query.
     The stripped fallback "iphone 15" reliably surfaces iPhone 15 SKUs;
     the comparison then pins the result to the right model generation. */
  const fallbackQ = stripTrailingModifiers(q);
  const [primary, fallback] = await Promise.all([
    pickAnchor(q),
    fallbackQ ? pickAnchor(fallbackQ) : Promise.resolve(null),
  ]);

  function pickBetter(
    a: { row: FtsRow; anchor: ProductGroup } | null,
    b: { row: FtsRow; anchor: ProductGroup } | null,
  ): { row: FtsRow; anchor: ProductGroup } | null {
    if (!a) return b;
    if (!b) return a;
    return scoreCandidate(q, b.anchor.title) > scoreCandidate(q, a.anchor.title) ? b : a;
  }

  const picked = pickBetter(primary, fallback);
  if (!picked) {
    /* Truly empty — surface 'did you mean' candidates so the user
       has a one-click recovery path. Pulls top-3 closest titles via
       trigram similarity in suggest_titles(). */
    const suggestions = await fetchDidYouMean(q);
    return { mode: "empty", query: q, suggestions };
  }

  const topRow = picked.row;
  const anchor = picked.anchor;

  /* 3. Find similar products via FTS using the anchor's title (richer query than user's) */
  const { data: similarMatches } = await supa.rpc("search_products_fts", {
    q: anchor.title,
    max_results: 60,
  });

  const dupes: DupeResult[] = ((similarMatches as FtsRow[]) ?? [])
    // Drop the anchor itself
    .filter((r) => r.product_id !== topRow!.product_id)
    // Same category preferred (when the anchor has one)
    .filter((r) => !anchor.category || anchor.category === "general" || r.category_slug === anchor.category)
    // Strict cheaper-only — the anchor's own offer leaks through with
    // equal price otherwise; allow ≤ 99% of anchor so true sub-100% only.
    .filter((r) => priceInNgn(r.current_price, r.currency) < anchor.bestPrice * 0.99)
    // Implausibly low prices are almost always upstream data errors
    // OR counterfeits. Pass title so per-flagship floor catches the
    // AirPods Pro 2 ₦8K / Apple iPhone 17 Pro ₦42K cases that the
    // category floor misses.
    .filter((r) => priceLooksPlausible(priceInNgn(r.current_price, r.currency), r.category_slug, r.title))
    // URL usability — drop Google-relay rows /api/go can't resolve.
    .filter((r) => isUsableMerchantUrl(r.url))
    // Drop accessory / parts / replacement noise
    .filter((r) => !looksLikeAccessory(r.title))
    // Drop counterfeit-looking titles ("Apple MacBook Neo A18 Pro")
    .filter((r) => !looksSuspicious(r.title))
    /* Strict family match — when the anchor has a recognised family
       (footwear, watch, earbuds, etc.), candidates must be in the
       same family. Stops cross-family same-brand dupes like
       "Nike Air Force 1" → "Nike Crew Socks" / "Nike Waistpack" /
       "Nike T-Shirt" that the QA agent flagged. familiesIncompatible
       was too permissive here (treats null candidate family as
       compatible), so apparel items with no family classification
       were slipping through. */
    .filter((r) => alternativeFamilyMatches(anchor.title, r.title))
    .map((r) => ftsRowToDupe(r, anchor))
    // No savings floor — show every cheaper alternative, even 1-2% off
    // the anchor. The >=85% suppressed-zero rows still get filtered
    // below so absurd-discount data errors stay out.
    .filter((d) => d.savingsPercent > 0)
    .slice(0, limit * 2) // over-sample, then re-rank
    .sort((a, b) => {
      // Blend: similarity (FTS rank) + savings, capped to avoid runaway
      const aScore = a.similarityScore * 0.55 + Math.min(a.savingsPercent, 80) * 0.45;
      const bScore = b.similarityScore * 0.55 + Math.min(b.savingsPercent, 80) * 0.45;
      return bScore - aScore;
    })
    .slice(0, limit);

  return {
    mode: "similar",
    query: q,
    anchor,
    dupes,
  };
}

/* Direct product lookup by id. Used as a backstop when a homepage /
   compare chip click can't be anchored via FTS — typically because
   the chip data was fresher than what FTS can find right now
   (catalog shift, signature mismatch, etc.). Round-4 QA: user
   clicked a chip and got "Nothing in our local index" even though
   the chip was supposed to guarantee ≥2 stores.

   Same shape as pgFtsFindSimilar — anchor + dupes — but skips the
   FTS anchor selection entirely and uses the product_id directly.
   Dupes are still found via FTS over the anchor's title.

   Returns empty if the product_id doesn't exist or has no offers. */
export async function pgFtsFindByProductId(
  productId: string,
  opts?: { limit?: number },
): Promise<SearchOutput> {
  const supa = getSupabaseAdmin();
  if (!supa) return { mode: "empty", query: productId, suggestions: [] };
  const limit = opts?.limit ?? 16;

  /* Fetch the product + its offers + pool any siblings sharing the
     same signature (same cross-store-pool behavior as the FTS path). */
  const { data: product } = await supa
    .from("products")
    .select(`
      id, title, category_slug, brand, image_url, signature,
      offers (
        id, store_id, url, current_price, original_price, discount_percent, currency, in_stock,
        stores ( id, name, logo_url, is_international )
      )
    `)
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    return { mode: "empty", query: productId, suggestions: [] };
  }

  const base = product as unknown as AnchorProduct & { signature: string | null };
  let anchorPayload: AnchorProduct = base;

  /* Pool siblings by signature (best-effort — fall through silently
     if the join fails). */
  if (base.signature && base.signature !== "?|?") {
    const { data: siblings } = await supa
      .from("products")
      .select(`
        id, title, category_slug, brand, image_url,
        offers (
          id, store_id, url, current_price, original_price, discount_percent, currency, in_stock,
          stores ( id, name, logo_url, is_international )
        )
      `)
      .eq("signature", base.signature)
      .neq("id", productId);
    if (siblings && siblings.length > 0) {
      const baseOffers = (base.offers ?? []) as NestedOffer[];
      const siblingOffers = (siblings as unknown as Array<{ offers: NestedOffer[] }>)
        .flatMap((s) => s.offers ?? []);
      anchorPayload = { ...base, offers: [...baseOffers, ...siblingOffers] };
    }
  }

  const anchor = buildAnchorGroup(anchorPayload);
  if (anchor.offers.length === 0) {
    return { mode: "empty", query: product.title, suggestions: [] };
  }

  /* Same dupes pipeline as pgFtsFindSimilar — FTS over the anchor's
     title, then the standard family / variant / price filters. */
  const { data: similarMatches } = await supa.rpc("search_products_fts", {
    q: anchor.title,
    max_results: 60,
  });

  const dupes: DupeResult[] = ((similarMatches as FtsRow[]) ?? [])
    .filter((r) => r.product_id !== productId)
    .filter((r) => !anchor.category || anchor.category === "general" || r.category_slug === anchor.category)
    .filter((r) => priceInNgn(r.current_price, r.currency) < anchor.bestPrice * 0.99)
    .filter((r) => priceLooksPlausible(priceInNgn(r.current_price, r.currency), r.category_slug, r.title))
    .filter((r) => isUsableMerchantUrl(r.url))
    .filter((r) => !looksLikeAccessory(r.title))
    .filter((r) => !looksSuspicious(r.title))
    .filter((r) => alternativeFamilyMatches(anchor.title, r.title))
    .map((r) => ftsRowToDupe(r, anchor))
    .filter((d) => d.savingsPercent > 0)
    .slice(0, limit * 2)
    .sort((a, b) => {
      const aScore = a.similarityScore * 0.55 + Math.min(a.savingsPercent, 80) * 0.45;
      const bScore = b.similarityScore * 0.55 + Math.min(b.savingsPercent, 80) * 0.45;
      return bScore - aScore;
    })
    .slice(0, limit);

  return {
    mode: "similar",
    query: product.title,
    anchor,
    dupes,
  };
}
