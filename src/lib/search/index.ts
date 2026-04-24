// High-level search & compare engine.
//
// Two output modes:
//   1. SINGLE — query is specific enough to identify ONE product. Returns that
//      product's price comparison across stores + similar alternatives.
//   2. LIST   — query is broad ("phone", "tv"). Returns a list of distinct
//      product groups so the user can pick which one to compare.

import type { Deal } from "@/types";
import { deals } from "@/lib/data/deals";
import { usdToNgn } from "@/lib/utils";
import {
  buildSignature, extractedSignature, signatureMatches, tokenJaccard, tokensOf,
  type ProductSignature,
} from "./normalize";
import { parseStoreUrl, isUrl } from "./url-parser";

/* ── Types returned to API/UI ─────────────────────────────────────── */

export interface StoreOffer {
  storeId: string;
  storeName: string;
  storeLogoUrl: string;
  storeColor: string;
  price: number;       // always NGN
  currency: "NGN";
  url: string;
  imageUrl?: string;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  deliveryDays: number;
  isInternational: boolean;
  /** For international stores: estimated shipping + customs in NGN */
  landedCostExtra: number;
  /** price + landedCostExtra */
  landedPrice: number;
}

export interface ProductGroup {
  key: string;
  title: string;       // representative title
  category: string;
  imageUrl?: string;
  imageEmoji: string;
  imageGradient: string;
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  inches: number | null;
  storeCount: number;
  bestPrice: number;
  worstPrice: number;
  maxSavings: number;
  offers: StoreOffer[];
}

export interface DupeResult extends ProductGroup {
  similarityScore: number;    // 0–100
  savingsVsAnchor: number;    // NGN saved
  savingsPercent: number;     // 0–100
}

export type SearchOutput =
  | { mode: "single"; query: string; group: ProductGroup; alternatives: ProductGroup[] }
  | { mode: "list"; query: string; groups: ProductGroup[]; total: number }
  | { mode: "similar"; query: string; anchor: ProductGroup; dupes: DupeResult[] }
  | { mode: "empty"; query: string; suggestions: ProductGroup[] };

/* ── Store metadata ───────────────────────────────────────────────── */

const STORE_META: Record<string, { name: string; color: string; rating: number; deliveryDays: number; intl: boolean }> = {
  jumia:      { name: "Jumia",      color: "#F97316", rating: 4.2, deliveryDays: 2,  intl: false },
  konga:      { name: "Konga",      color: "#EF4444", rating: 4.0, deliveryDays: 3,  intl: false },
  slot:       { name: "Slot",       color: "#3B82F6", rating: 4.3, deliveryDays: 1,  intl: false },
  threechub:  { name: "3C Hub",     color: "#8B5CF6", rating: 4.1, deliveryDays: 2,  intl: false },
  spar:       { name: "Spar",       color: "#22C55E", rating: 4.0, deliveryDays: 1,  intl: false },
  jiji:       { name: "Jiji",       color: "#10B981", rating: 3.8, deliveryDays: 1,  intl: false },
  asos:       { name: "ASOS",       color: "#000000", rating: 4.3, deliveryDays: 12, intl: true  },
  dhgate:     { name: "DHgate",     color: "#E53935", rating: 3.9, deliveryDays: 18, intl: true  },
  amazon:     { name: "Amazon",     color: "#FF9900", rating: 4.5, deliveryDays: 10, intl: true  },
  aliexpress: { name: "AliExpress", color: "#FF4747", rating: 4.0, deliveryDays: 21, intl: true  },
};

function toNgn(d: Deal): number {
  return d.currency === "USD" ? usdToNgn(d.salePrice) : d.salePrice;
}

/** Estimate shipping + customs for international orders to Nigeria.
 *  Categories with higher duty rates (electronics = 20%, fashion = 35%)
 *  and realistic forwarding costs. */
function estimateLandedCostExtra(priceNgn: number, category: string, storeId: string): number {
  // Base shipping estimate per store (NGN)
  const shippingEstimates: Record<string, number> = {
    amazon:     12_000,
    aliexpress:  8_000,
    dhgate:     10_000,
    asos:       15_000,
    shein:       8_000,
    temu:        8_000,
  };
  const shipping = shippingEstimates[storeId] ?? 12_000;

  // Customs duty rate by category
  const dutyRates: Record<string, number> = {
    "Phones & Tablets": 0.20,
    "Computing":        0.20,
    "Electronics":      0.20,
    "Audio":            0.20,
    "Appliances":       0.25,
    "Fashion":          0.35,
    "Beauty":           0.10,
  };
  const dutyRate = dutyRates[category] ?? 0.15;
  const customs = Math.round((priceNgn + shipping) * dutyRate);

  return shipping + customs;
}

function dealToOffer(d: Deal): StoreOffer {
  const meta = STORE_META[d.storeId] ?? { name: d.storeName, color: "#64748B", rating: 3.8, deliveryDays: 5, intl: false };
  const price = toNgn(d);
  const orig  = d.currency === "USD" ? usdToNgn(d.originalPrice) : d.originalPrice;
  const isIntl = meta.intl;
  const landedCostExtra = isIntl ? estimateLandedCostExtra(price, d.category, d.storeId) : 0;
  return {
    storeId: d.storeId,
    storeName: meta.name,
    storeLogoUrl: `/logos/${d.storeId}.png`,
    storeColor: meta.color,
    price,
    currency: "NGN",
    url: d.url,
    imageUrl: d.imageUrl,
    originalPrice: orig,
    discountPercent: d.discountPercent,
    rating: meta.rating,
    deliveryDays: meta.deliveryDays,
    isInternational: isIntl,
    landedCostExtra,
    landedPrice: price + landedCostExtra,
  };
}

/* ── Build & cache product groups (compute once per process) ──────── */

interface IndexedDeal {
  deal: Deal;
  sig: ProductSignature;
}

let _index: IndexedDeal[] | null = null;
let _groups: ProductGroup[] | null = null;

function getIndex(): IndexedDeal[] {
  if (_index) return _index;
  _index = deals.map((d) => ({ deal: d, sig: extractedSignature(d.id, d.title) ?? buildSignature(d.title) }));
  return _index;
}

function getGroups(): ProductGroup[] {
  if (_groups) return _groups;

  // Group by signature key. Deals with no extracted brand/model fall into
  // category-token "buckets" so we still get grouping for fashion/etc.
  const buckets = new Map<string, IndexedDeal[]>();
  for (const item of getIndex()) {
    let key = item.sig.key;
    // If we couldn't extract anything meaningful, fall back to the first
    // 4 most-distinctive tokens — keeps the bucket from being one giant bag
    if (key === "?|?" || key === "?") {
      const fallback = item.sig.tokens.slice(0, 4).sort().join("-");
      key = `fallback|${item.deal.categorySlug}|${fallback || item.deal.id}`;
    }
    // Critical: an accessory ("Samsung Galaxy S26 charger") must NOT bucket with
    // the actual product ("Samsung Galaxy S26 Ultra phone") even though they
    // share brand+model. Push accessories into a separate sub-bucket.
    if (ACCESSORY_RE.test(item.deal.title)) {
      key = `${key}|acc`;
    }
    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }

  const out: ProductGroup[] = [];
  for (const [key, items] of Array.from(buckets.entries())) {
    // Pick the deal with the longest title as representative (usually most info)
    const rep = items.reduce((best, cur) =>
      cur.deal.title.length > best.deal.title.length ? cur : best,
    );

    // One offer per store (cheapest)
    const byStore = new Map<string, StoreOffer>();
    for (const it of items) {
      const o = dealToOffer(it.deal);
      const existing = byStore.get(o.storeId);
      if (!existing || o.price < existing.price) byStore.set(o.storeId, o);
    }
    const offers = Array.from(byStore.values()).sort((a, b) => a.price - b.price);
    if (offers.length === 0) continue;

    const bestPrice = offers[0].price;
    const worstPrice = offers[offers.length - 1].price;

    out.push({
      key,
      title: rep.deal.title,
      category: rep.deal.category,
      imageUrl: items.find((i) => i.deal.imageUrl)?.deal.imageUrl,
      imageEmoji: rep.deal.imageEmoji,
      imageGradient: rep.deal.imageGradient,
      brand: rep.sig.brand,
      model: rep.sig.model,
      storageGb: rep.sig.storageGb,
      inches: rep.sig.inches,
      storeCount: offers.length,
      bestPrice,
      worstPrice,
      maxSavings: worstPrice - bestPrice,
      offers,
    });
  }

  _groups = out;
  return out;
}

/* ── Public accessors for the vector layer (Phase 2.5) ───────────────
 * Vector search returns dealIds from Supabase ANN; we still need to map
 * each id back to its already-built ProductGroup with merged offers.
 * These helpers keep that lookup cheap without leaking internals.        */

let _dealIdToGroup: Map<string, ProductGroup> | null = null;

export function getProductGroups(): ProductGroup[] {
  return getGroups();
}

export function getDealIdToGroup(): Map<string, ProductGroup> {
  if (_dealIdToGroup) return _dealIdToGroup;
  const map = new Map<string, ProductGroup>();
  // Re-walk the bucket logic to know which dealId went into which group.
  // Cheap because getIndex() is already cached and we only do this once.
  const idx = getIndex();
  // Build the same key the bucket would have produced for each item.
  for (const item of idx) {
    let key = item.sig.key;
    if (key === "?|?" || key === "?") {
      const fallback = item.sig.tokens.slice(0, 4).sort().join("-");
      key = `fallback|${item.deal.categorySlug}|${fallback || item.deal.id}`;
    }
    if (ACCESSORY_RE.test(item.deal.title)) key = `${key}|acc`;
    const group = getGroups().find((g) => g.key === key);
    if (group) map.set(item.deal.id, group);
  }
  _dealIdToGroup = map;
  return map;
}

export { classifyProductType, dupeSimilarity, ACCESSORY_RE, RELATED_CATS, suggestFallbacks };

/* ── Scoring ──────────────────────────────────────────────────────── */

// Penalize accessory/replacement/case titles unless the query asks for them
const ACCESSORY_RE = /\b(case|cover|sleeve|adapter|cable|charger|stand|mount|protector|replacement|remote|holster|skin|pouch|bag|strap|band|tempered|glass|screen\s*guard)\b/i;

// Category keyword → matching deal categories. Used so "phone" returns ALL phones
// even if "phone" isn't literally a token in the title (e.g. "Galaxy A06").
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  phone:        ["Phones & Tablets"],
  phones:       ["Phones & Tablets"],
  smartphone:   ["Phones & Tablets"],
  tablet:       ["Phones & Tablets"],
  ipad:         ["Phones & Tablets"],
  tv:           ["Electronics"],
  television:   ["Electronics"],
  laptop:       ["Computing"],
  computer:     ["Computing"],
  macbook:      ["Computing"],
  headphone:    ["Audio"],
  headphones:   ["Audio"],
  earbuds:      ["Audio"],
  earphones:    ["Audio"],
  speaker:      ["Audio"],
  fridge:       ["Appliances"],
  washer:       ["Appliances"],
  console:      ["Electronics"],
  playstation:  ["Electronics"],
  xbox:         ["Electronics"],
};

function scoreGroup(query: ProductSignature, queryRaw: string, g: ProductGroup): number {
  const repSig = buildSignature(g.title);
  if (!signatureMatches(query, repSig)) return 0;

  // Generic single-word query (no brand, no model) → require candidate to have a
  // recognized brand AND fall in a matching category if the term is a category keyword.
  const queryRawLower = queryRaw.toLowerCase();
  const generic = !query.brand && !query.model && !query.storageGb && !query.inches;
  if (generic) {
    if (!repSig.brand) return 0;
    const cats = CATEGORY_KEYWORDS[queryRawLower];
    if (cats && !cats.includes(g.category)) return 0;
  }

  let score = 0;

  // Accessory penalty (unless user explicitly searched for an accessory term)
  const accessoryHit = ACCESSORY_RE.test(g.title);
  const userWantsAccessory = ACCESSORY_RE.test(queryRawLower);
  if (accessoryHit && !userWantsAccessory) score -= 60;

  // Strong: brand match
  if (query.brand && repSig.brand && query.brand === repSig.brand) score += 30;

  // Very strong: model match
  if (query.model && repSig.model) {
    if (repSig.model === query.model) score += 80;
    else if (repSig.model.includes(query.model) || query.model.includes(repSig.model)) score += 50;
  }

  // Storage exact
  if (query.storageGb && repSig.storageGb === query.storageGb) score += 25;
  // Inches exact
  if (query.inches && repSig.inches === query.inches) score += 25;

  // Token overlap (residual fuzzy)
  const qTokens = tokensOf(queryRaw);
  const tokenSim = tokenJaccard(qTokens, repSig.tokens);
  score += tokenSim * 40;

  // Boost groups with more stores (means it's actually a real product, not noise)
  score += Math.min(g.storeCount, 5) * 4;

  // Word-boundary boost — query terms appearing as actual words in the title
  // (not substrings — "phone" should NOT match "headphone" or "smartphone")
  const qWords = queryRawLower.split(/\s+/).filter((w) => w.length > 1);
  for (const w of qWords) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
    if (re.test(g.title)) score += 15;
  }

  return score;
}

/* ── Main search entrypoint ───────────────────────────────────────── */

/** Best-effort suggestions when the user's query returns nothing. Tries (in order):
 *  1. Same brand as query (if any).
 *  2. Same inferred category (from CATEGORY_KEYWORDS).
 *  3. Token overlap with any group title.
 *  4. Most popular products (highest store count, then cheapest).
 */
function suggestFallbacks(query: ProductSignature, queryRaw: string, groups: ProductGroup[], n = 8): ProductGroup[] {
  const qLower = queryRaw.toLowerCase();
  const qTokens = tokensOf(queryRaw);

  // 1) brand-matching groups
  if (query.brand) {
    const sameBrand = groups
      .filter((g) => g.brand === query.brand)
      .sort((a, b) => b.storeCount - a.storeCount || a.bestPrice - b.bestPrice)
      .slice(0, n);
    if (sameBrand.length > 0) return sameBrand;
  }

  // 2) category routed from query keyword
  const cats = CATEGORY_KEYWORDS[qLower];
  if (cats) {
    const sameCat = groups
      .filter((g) => cats.includes(g.category) && g.brand)
      .sort((a, b) => b.storeCount - a.storeCount || a.bestPrice - b.bestPrice)
      .slice(0, n);
    if (sameCat.length > 0) return sameCat;
  }

  // 3) any token overlap (loose)
  if (qTokens.length > 0) {
    const overlap = groups
      .map((g) => ({ g, sim: tokenJaccard(qTokens, buildSignature(g.title).tokens) }))
      .filter((x) => x.sim > 0)
      .sort((a, b) => b.sim - a.sim || b.g.storeCount - a.g.storeCount)
      .slice(0, n)
      .map((x) => x.g);
    if (overlap.length > 0) return overlap;
  }

  // 4) generic popular fallback
  return groups
    .filter((g) => g.brand)
    .sort((a, b) => b.storeCount - a.storeCount || b.maxSavings - a.maxSavings)
    .slice(0, n);
}

export function search(rawQuery: string, opts?: { limit?: number }): SearchOutput {
  const q = rawQuery.trim();
  if (!q) return { mode: "empty", query: q, suggestions: [] };

  const limit = opts?.limit ?? 24;
  const query = buildSignature(q);
  const groups = getGroups();

  const scored = groups
    .map((g) => ({ g, s: scoreGroup(query, q, g) }))
    .filter((x) => x.s > 10)
    .sort((a, b) => b.s - a.s);

  if (scored.length === 0) {
    return { mode: "empty", query: q, suggestions: suggestFallbacks(query, q, groups) };
  }

  const top = scored[0];
  const second = scored[1];

  // Decide single vs list mode:
  //  - SINGLE if query is specific (brand+model present) AND top score >> second
  //  - SINGLE if top group has many stores AND clearly dominates
  //  - Otherwise LIST
  const querySpecific = !!(query.brand && (query.model || query.storageGb || query.inches));
  const dominates = !second || top.s > second.s * 1.4;
  const mode: "single" | "list" = querySpecific && dominates ? "single" : "list";

  if (mode === "single") {
    // Alternatives = next 6 groups in same category, different product key
    const alts = scored.slice(1)
      .filter(({ g }) => g.category === top.g.category && g.key !== top.g.key)
      .slice(0, 6)
      .map(({ g }) => g);
    return { mode: "single", query: q, group: top.g, alternatives: alts };
  }

  // LIST mode: dedupe across very similar adjacent groups, return top N
  const out: ProductGroup[] = [];
  const seenKeys = new Set<string>();
  for (const { g } of scored) {
    if (seenKeys.has(g.key)) continue;
    seenKeys.add(g.key);
    out.push(g);
    if (out.length >= limit) break;
  }
  return { mode: "list", query: q, groups: out, total: scored.length };
}

/** Look up a single product group by its stable key. Returns single-mode output
 *  with sibling groups in the same category as alternatives. Used when the user
 *  drills in from a list result — we don't want to re-run fuzzy matching on the
 *  long title text and risk landing back on the list view. */
export function searchByKey(key: string): SearchOutput {
  const groups = getGroups();
  const target = groups.find((g) => g.key === key);
  if (!target) return { mode: "empty", query: key, suggestions: suggestFallbacks(buildSignature(""), "", groups) };
  const alts = groups
    .filter((g) => g.category === target.category && g.key !== target.key)
    .sort((a, b) => b.storeCount - a.storeCount || a.bestPrice - b.bestPrice)
    .slice(0, 6);
  return { mode: "single", query: target.title, group: target, alternatives: alts };
}

/* ── Find Similar / "Dupe" mode ────────────────────────────────── */

// Related categories — products in these categories can be "dupes" of each other
const RELATED_CATS: Record<string, string[]> = {
  "Phones & Tablets": ["Phones & Tablets"],
  "Computing":        ["Computing"],
  "Electronics":      ["Electronics"],
  "Audio":            ["Audio"],
  "Appliances":       ["Appliances"],
  "Fashion":          ["Fashion"],
  "Beauty":           ["Beauty"],
};

// Product-type classifiers — sub-categories within a broad category.
// Products within the same type are much stronger dupes of each other.
const PRODUCT_TYPES: { re: RegExp; type: string; category: string }[] = [
  // Phones
  { re: /\b(iphone|galaxy\s*s\d|pixel\s*\d|oneplus|phantom|zero|note\s*\d+\s*pro)\b/i, type: "flagship-phone", category: "Phones & Tablets" },
  { re: /\b(galaxy\s*a\d|spark|hot\s*\d|smart\s*\d|pop\s*\d|camon|pova|a0\d|a1\d|redmi\s*\d|poco)\b/i, type: "budget-phone", category: "Phones & Tablets" },
  { re: /\b(ipad|tab\s*[as]|tablet|mediapad)\b/i, type: "tablet", category: "Phones & Tablets" },
  // Computing
  { re: /\b(macbook|thinkpad|zenbook|xps|swift|spectre|gram)\b/i, type: "premium-laptop", category: "Computing" },
  { re: /\b(laptop|notebook|chromebook|ideapad|aspire|pavilion|inspiron)\b/i, type: "laptop", category: "Computing" },
  // Audio
  { re: /\b(airpods|buds\s*pro|wf-|galaxy\s*buds|freebuds)\b/i, type: "premium-earbuds", category: "Audio" },
  { re: /\b(earbuds|earphones|earphone|wireless\s*ear|tws|earpods)\b/i, type: "earbuds", category: "Audio" },
  { re: /\b(headphone|headphones|wh-|headset|over[\s-]*ear)\b/i, type: "headphones", category: "Audio" },
  { re: /\b(speaker|soundbar|boombox|portable\s*speaker)\b/i, type: "speaker", category: "Audio" },
  // Electronics
  { re: /\b(tv|television|smart\s*tv|\d{2,3}\s*inch|\d{2,3}")\b/i, type: "tv", category: "Electronics" },
  { re: /\b(playstation|ps[45]|xbox|nintendo|switch|console|gaming\s*console)\b/i, type: "console", category: "Electronics" },
  { re: /\b(watch|smartwatch|smart\s*watch|band|fitness\s*tracker)\b/i, type: "smartwatch", category: "Electronics" },
  // Fashion
  { re: /\b(sneaker|trainer|running\s*shoe|air\s*max|air\s*force|jordan|yeezy|boost)\b/i, type: "sneakers", category: "Fashion" },
  { re: /\b(dress|gown|maxi|midi)\b/i, type: "dress", category: "Fashion" },
  { re: /\b(jacket|coat|hoodie|sweatshirt|puffer)\b/i, type: "outerwear", category: "Fashion" },
  { re: /\b(shirt|tee|t-shirt|polo|blouse|top)\b/i, type: "tops", category: "Fashion" },
  { re: /\b(jeans|pants|trousers|shorts|jogger|chinos)\b/i, type: "bottoms", category: "Fashion" },
  { re: /\b(bag|handbag|backpack|tote|crossbody|clutch|purse)\b/i, type: "bags", category: "Fashion" },
];

function classifyProductType(title: string, category: string): string | null {
  for (const pt of PRODUCT_TYPES) {
    if (pt.re.test(title)) return pt.type;
  }
  return null;
}

// Price tiers relative to category medians. Products in the same tier are better dupes.
function priceTier(price: number, category: string): "budget" | "mid" | "premium" {
  // Approximate tier thresholds per category (in NGN)
  const thresholds: Record<string, [number, number]> = {
    "Phones & Tablets": [150_000, 600_000],
    "Computing":        [300_000, 1_000_000],
    "Electronics":      [100_000, 500_000],
    "Audio":            [20_000, 100_000],
    "Appliances":       [50_000, 200_000],
    "Fashion":          [15_000, 80_000],
    "Beauty":           [5_000, 25_000],
  };
  const [low, high] = thresholds[category] ?? [50_000, 200_000];
  if (price <= low) return "budget";
  if (price >= high) return "premium";
  return "mid";
}

/** Score how "similar" a candidate product group is to an anchor product.
 *  Returns 0–100 where higher = more similar (good dupe).
 *
 *  Key insight from Dupe.com: a good dupe is a product that serves the SAME
 *  PURPOSE as the anchor — same type (phone vs phone, laptop vs laptop),
 *  similar specs, from a different brand, at a better price. */
function dupeSimilarity(anchor: ProductGroup, anchorSig: ProductSignature, anchorType: string | null,
                        cand: ProductGroup): number {
  const candSig = buildSignature(cand.title);
  const candType = classifyProductType(cand.title, cand.category);
  let score = 0;

  // ── 1. Product type match (strongest signal) ──
  // Same product type (e.g. both "flagship-phone") is the #1 indicator of a good dupe
  if (anchorType && candType) {
    if (anchorType === candType) {
      score += 35; // exact type match: both flagship phones, both earbuds, etc.
    } else {
      // Adjacent types within same category still count (budget phone ↔ flagship phone)
      const anchorBase = anchorType.replace(/^(premium|budget|flagship)-/, "");
      const candBase = candType.replace(/^(premium|budget|flagship)-/, "");
      if (anchorBase === candBase) {
        score += 20; // same base type, different tier (budget-phone vs flagship-phone)
      }
    }
  }

  // ── 2. Same category base boost ──
  // Even without type classification, being in the same category is essential
  score += 10;

  // ── 3. Spec proximity ──
  // Storage similarity (128GB vs 256GB is similar; 32GB vs 1TB is not)
  if (anchorSig.storageGb && candSig.storageGb) {
    const ratio = Math.min(anchorSig.storageGb, candSig.storageGb) / Math.max(anchorSig.storageGb, candSig.storageGb);
    score += ratio * 15;
  }

  // Screen size similarity
  if (anchorSig.inches && candSig.inches) {
    const diff = Math.abs(anchorSig.inches - candSig.inches);
    const maxIn = Math.max(anchorSig.inches, candSig.inches);
    const ratio = 1 - (diff / maxIn);
    score += ratio * 12;
  }

  // ── 4. Feature token overlap (catches "pro", "gaming", "smart", "wireless", etc.) ──
  // Filter out brand/model tokens to focus on feature descriptors
  const anchorFeatures = anchorSig.tokens.filter((t) => t !== anchorSig.brand && !anchorSig.model?.includes(t));
  const candFeatures = candSig.tokens.filter((t) => t !== candSig.brand && !candSig.model?.includes(t));
  if (anchorFeatures.length > 0 && candFeatures.length > 0) {
    const featureSim = tokenJaccard(anchorFeatures, candFeatures);
    score += featureSim * 18;
  }

  // ── 5. Price tier proximity — same tier products are better dupes ──
  const anchorTier = priceTier(anchor.bestPrice, anchor.category);
  const candTier = priceTier(cand.bestPrice, cand.category);
  if (anchorTier === candTier) {
    score += 8;
  } else if (
    (anchorTier === "premium" && candTier === "mid") ||
    (anchorTier === "mid" && candTier === "budget")
  ) {
    score += 5; // adjacent tier — still a reasonable dupe
  }

  // ── 6. Multi-store validation — available across stores = real product ──
  if (cand.storeCount >= 3) score += 4;
  else if (cand.storeCount >= 2) score += 2;

  // ── 7. Brand diversity bonus — different brand is the whole point of "dupes" ──
  if (cand.brand && anchor.brand && cand.brand !== anchor.brand) {
    score += 6;
  }

  // ── Penalties ──
  // Accessory penalty (a case is NOT a dupe for a phone)
  if (ACCESSORY_RE.test(cand.title) && !ACCESSORY_RE.test(anchor.title)) {
    score -= 40;
  }

  // Way too cheap = probably a different class of product or an accessory
  if (cand.bestPrice > 0 && anchor.bestPrice > 0) {
    const priceRatio = cand.bestPrice / anchor.bestPrice;
    if (priceRatio < 0.05) score -= 20; // ₦5K phone for ₦1.2M anchor = noise
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** "Find for Less" — inspired by Dupe.com. Finds an anchor product then discovers
 *  cross-brand alternatives that serve the same purpose at a lower price.
 *
 *  Key differences from regular search/compare:
 *  - Finds DIFFERENT products, not the same product at different stores
 *  - Cross-brand: Samsung can be a dupe for Apple, Tecno for Samsung
 *  - Same-brand, different-model allowed: Galaxy A06 can dupe Galaxy S24
 *  - Only the exact anchor product is excluded
 *  - Includes items up to 10% more expensive (but prioritizes cheaper)
 *  - Ranked by a blend of similarity + savings
 */
export function findSimilar(rawQuery: string, opts?: { limit?: number }): SearchOutput {
  const q = rawQuery.trim();
  if (!q) return { mode: "empty", query: q, suggestions: [] };

  const limit = opts?.limit ?? 16;
  const query = buildSignature(q);
  const groups = getGroups();

  // ── Step 1: find the anchor (same logic as regular search) ──
  const scored = groups
    .map((g) => ({ g, s: scoreGroup(query, q, g) }))
    .filter((x) => x.s > 10)
    .sort((a, b) => b.s - a.s);

  if (scored.length === 0) {
    return { mode: "empty", query: q, suggestions: suggestFallbacks(query, q, groups) };
  }

  const anchor = scored[0].g;
  const anchorSig = buildSignature(anchor.title);
  const anchorType = classifyProductType(anchor.title, anchor.category);

  // Categories that count as "same type"
  const relatedCats = RELATED_CATS[anchor.category] ?? [anchor.category];

  // Price ceiling: include items up to 10% more expensive (user might want
  // a slightly pricier but better-reviewed alternative from a different brand)
  const priceCeiling = anchor.bestPrice * 1.1;

  // ── Step 2: find dupes across the entire catalog ──
  const dupes: DupeResult[] = [];

  for (const g of groups) {
    // Skip the exact same product
    if (g.key === anchor.key) continue;
    // Must be in a related category
    if (!relatedCats.includes(g.category)) continue;
    // Must be at or below price ceiling
    if (g.bestPrice > priceCeiling) continue;
    // Skip accessories when anchor is not an accessory
    if (ACCESSORY_RE.test(g.title) && !ACCESSORY_RE.test(anchor.title)) continue;
    // Skip unparseable fallback groups (noise)
    if (g.key.startsWith("fallback|") && !g.brand) continue;

    const similarityScore = dupeSimilarity(anchor, anchorSig, anchorType, g);
    if (similarityScore < 15) continue; // too dissimilar

    const savingsVsAnchor = anchor.bestPrice - g.bestPrice;
    const savingsPercent = anchor.bestPrice > 0
      ? Math.round((savingsVsAnchor / anchor.bestPrice) * 100)
      : 0;

    dupes.push({
      ...g,
      similarityScore,
      savingsVsAnchor: Math.max(0, savingsVsAnchor), // clamp for slightly pricier items
      savingsPercent: Math.max(0, savingsPercent),
    });
  }

  // Sort: primary by similarity (good dupes first), secondary by savings
  dupes.sort((a, b) => {
    // Heavily weight similarity so good matches rank above random cheap stuff
    const aScore = a.similarityScore * 0.55 + Math.min(a.savingsPercent, 80) * 0.45;
    const bScore = b.similarityScore * 0.55 + Math.min(b.savingsPercent, 80) * 0.45;
    if (Math.abs(bScore - aScore) > 2) return bScore - aScore;
    // Tie-break: more stores = more validated product
    return b.storeCount - a.storeCount;
  });

  return {
    mode: "similar",
    query: q,
    anchor,
    dupes: dupes.slice(0, limit),
  };
}

/** "Smart Switch" — find similar products starting from a store URL.
 *  Parses the URL to identify the product, finds it (or the closest match) in our
 *  scraped catalog, then runs findSimilar to discover alternatives. */
export function findSimilarByUrl(rawUrl: string): SearchOutput {
  const parsed = parseStoreUrl(rawUrl);
  if (!parsed || !parsed.searchTerms) {
    return { mode: "empty", query: rawUrl, suggestions: [] };
  }

  const groups = getGroups();

  // Strategy 1: Try to find the exact product by matching the URL in our deal data
  let exactMatch: ProductGroup | null = null;
  for (const g of groups) {
    for (const offer of g.offers) {
      // Normalize URLs for comparison (remove trailing slashes, query params, etc.)
      const normalizedOffer = offer.url.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
      const normalizedInput = parsed.originalUrl.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
      if (normalizedOffer === normalizedInput) {
        exactMatch = g;
        break;
      }
    }
    if (exactMatch) break;
  }

  // Strategy 2: If no exact URL match, search by extracted terms
  if (!exactMatch) {
    const query = buildSignature(parsed.searchTerms);
    const scored = groups
      .map((g) => ({ g, s: scoreGroup(query, parsed.searchTerms, g) }))
      .filter((x) => x.s > 10)
      .sort((a, b) => b.s - a.s);

    // Boost results from the same store as the URL
    const boosted = scored.map(({ g, s }) => ({
      g, s: g.offers.some((o) => o.storeId === parsed.storeId) ? s + 30 : s,
    })).sort((a, b) => b.s - a.s);

    if (boosted.length > 0) {
      exactMatch = boosted[0].g;
    }
  }

  if (!exactMatch) {
    return { mode: "empty", query: parsed.searchTerms, suggestions: suggestFallbacks(buildSignature(parsed.searchTerms), parsed.searchTerms, groups) };
  }

  // Now run the full dupe engine using the matched product as anchor
  const anchor = exactMatch;
  const anchorSig = buildSignature(anchor.title);
  const anchorType = classifyProductType(anchor.title, anchor.category);
  const relatedCats = RELATED_CATS[anchor.category] ?? [anchor.category];
  const priceCeiling = anchor.bestPrice * 1.1;

  const dupes: DupeResult[] = [];
  for (const g of groups) {
    if (g.key === anchor.key) continue;
    if (!relatedCats.includes(g.category)) continue;
    if (g.bestPrice > priceCeiling) continue;
    if (ACCESSORY_RE.test(g.title) && !ACCESSORY_RE.test(anchor.title)) continue;
    if (g.key.startsWith("fallback|") && !g.brand) continue;

    const similarityScore = dupeSimilarity(anchor, anchorSig, anchorType, g);
    if (similarityScore < 15) continue;

    const savingsVsAnchor = anchor.bestPrice - g.bestPrice;
    const savingsPercent = anchor.bestPrice > 0
      ? Math.round((savingsVsAnchor / anchor.bestPrice) * 100)
      : 0;

    dupes.push({
      ...g,
      similarityScore,
      savingsVsAnchor: Math.max(0, savingsVsAnchor),
      savingsPercent: Math.max(0, savingsPercent),
    });
  }

  dupes.sort((a, b) => {
    const aScore = a.similarityScore * 0.55 + Math.min(a.savingsPercent, 80) * 0.45;
    const bScore = b.similarityScore * 0.55 + Math.min(b.savingsPercent, 80) * 0.45;
    if (Math.abs(bScore - aScore) > 2) return bScore - aScore;
    return b.storeCount - a.storeCount;
  });

  return {
    mode: "similar",
    query: anchor.title,
    anchor,
    dupes: dupes.slice(0, 16),
  };
}

export { isUrl } from "./url-parser";

/** Lightweight autocomplete: top N matching titles for type-ahead.
 *
 *  The autocomplete's whole value prop is "pick a product you can COMPARE
 *  across stores." So we bias hard toward multi-store groups:
 *
 *    1. Exclude `fallback|…` groups — these are products whose titles we
 *       couldn't parse (wholesale-style DHgate/AliExpress/ASOS listings,
 *       off-brand retailer entries, etc.). They're always single-store (the
 *       deal id goes into the key), and clicking one just echoes that exact
 *       title back — no new comparison.
 *
 *    2. When sorting, a multi-store group beats a single-store group of
 *       similar score. Big score gaps (>25) still win so a perfect model
 *       match isn't displaced by a fuzzier multi-store near-miss.
 *
 *    3. If we have ≥3 multi-store matches, cut single-store results
 *       entirely — the dropdown is dense enough. Otherwise mix them in so
 *       narrow queries (rare products) still surface *something*.
 */
export function suggest(rawQuery: string, n = 6): { title: string; key: string; storeCount: number }[] {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const query = buildSignature(q);
  const groups = getGroups();

  const scored = groups
    // Unparseable single-product buckets have no comparison value and just
    // crowd out real grouped products — drop them from autosuggest.
    .filter((g) => !g.key.startsWith("fallback|"))
    .map((g) => ({ g, s: scoreGroup(query, q, g) }))
    .filter((x) => x.s > 30)
    .sort((a, b) => {
      const aMulti = a.g.storeCount >= 2;
      const bMulti = b.g.storeCount >= 2;
      if (aMulti !== bMulti && Math.abs(a.s - b.s) < 25) return aMulti ? -1 : 1;
      return b.s - a.s;
    });

  const multi = scored.filter((x) => x.g.storeCount >= 2);
  const pool = multi.length >= 3 ? multi : scored;

  return pool
    .slice(0, n)
    .map(({ g }) => ({ title: g.title, key: g.key, storeCount: g.storeCount }));
}
