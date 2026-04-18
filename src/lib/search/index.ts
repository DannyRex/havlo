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
  buildSignature, signatureMatches, tokenJaccard, tokensOf,
  type ProductSignature,
} from "./normalize";

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

export type SearchOutput =
  | { mode: "single"; query: string; group: ProductGroup; alternatives: ProductGroup[] }
  | { mode: "list"; query: string; groups: ProductGroup[]; total: number }
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

function dealToOffer(d: Deal): StoreOffer {
  const meta = STORE_META[d.storeId] ?? { name: d.storeName, color: "#64748B", rating: 3.8, deliveryDays: 5, intl: false };
  const price = toNgn(d);
  const orig  = d.currency === "USD" ? usdToNgn(d.originalPrice) : d.originalPrice;
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
    isInternational: meta.intl,
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
  _index = deals.map((d) => ({ deal: d, sig: buildSignature(d.title) }));
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

/** Lightweight autocomplete: top N matching titles for type-ahead. */
export function suggest(rawQuery: string, n = 6): { title: string; key: string; storeCount: number }[] {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const query = buildSignature(q);
  const groups = getGroups();
  const scored = groups
    .map((g) => ({ g, s: scoreGroup(query, q, g) }))
    .filter((x) => x.s > 30)
    .sort((a, b) => b.s - a.s)
    .slice(0, n);
  return scored.map(({ g }) => ({ title: g.title, key: g.key, storeCount: g.storeCount }));
}
