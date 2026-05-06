/* ──────────────────────────────────────────────────────────────────
   Search & compare engine — Phase 6f.

   The previous heuristic engine (BRANDS list, PRODUCT_TYPES regex,
   CATEGORY_KEYWORDS, scoreGroup, dupeSimilarity, …) has been deleted.
   Search relevance is now driven entirely by Postgres FTS — see
   src/lib/search/pg-fts.ts and src/lib/providers/search-pgfts.ts.

   What remains here:
     • Public types (SearchOutput, ProductGroup, StoreOffer, DupeResult)
       — used by the UI components (DupeCard, PriceResults, GroupCard).
     • The in-memory ProductGroup catalog built from the static
       deals.ts file. Used by:
         - searchByKey (legacy /compare?key= URL pattern)
         - suggest (autocomplete) — now backed by pg-fts
   ────────────────────────────────────────────────────────────────── */

import type { Deal } from "@/types";
import { deals } from "@/lib/data/deals";
import { usdToNgn } from "@/lib/utils";
import { buildSignature, extractedSignature, type ProductSignature } from "./normalize";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

/* ── Public types ─────────────────────────────────────────────────── */

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

/* Lightweight 'did you mean' suggestion shape. We don't need full
   ProductGroup payloads here (no offers / brand / prices), just
   enough to render a clickable pill that re-runs search for that
   title or routes by key. Returned in the empty-mode response. */
export interface SearchSuggestion {
  title: string;
  key:   string;     // product_id, for direct ?key=… routing
  score: number;     // 0–1 trigram similarity
}

export type SearchOutput =
  | { mode: "single"; query: string; group: ProductGroup; alternatives: ProductGroup[] }
  | { mode: "list"; query: string; groups: ProductGroup[]; total: number }
  | { mode: "similar"; query: string; anchor: ProductGroup; dupes: DupeResult[] }
  | { mode: "empty"; query: string; suggestions: SearchSuggestion[] };

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

// Accessory titles ("Samsung S26 case") shouldn't bucket with the actual product
const ACCESSORY_RE = /\b(case|cover|sleeve|adapter|cable|charger|stand|mount|protector|replacement|remote|holster|skin|pouch|bag|strap|band|tempered|glass|screen\s*guard)\b/i;

function toNgn(d: Deal): number {
  return d.currency === "USD" ? usdToNgn(d.salePrice) : d.salePrice;
}

function estimateLandedCostExtra(priceNgn: number, category: string, storeId: string): number {
  const shippingEstimates: Record<string, number> = {
    amazon:     12_000,
    aliexpress:  8_000,
    dhgate:     10_000,
    asos:       15_000,
    shein:       8_000,
    temu:        8_000,
  };
  const shipping = shippingEstimates[storeId] ?? 12_000;

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
  return Math.round(shipping + priceNgn * dutyRate);
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
let _dealIdToGroup: Map<string, ProductGroup> | null = null;

function getIndex(): IndexedDeal[] {
  if (_index) return _index;
  _index = deals.map((d) => ({ deal: d, sig: extractedSignature(d.id, d.title) ?? buildSignature(d.title) }));
  return _index;
}

function getGroups(): ProductGroup[] {
  if (_groups) return _groups;

  const buckets = new Map<string, IndexedDeal[]>();
  for (const item of getIndex()) {
    let key = item.sig.key;
    if (key === "?|?" || key === "?") {
      const fallback = item.sig.tokens.slice(0, 4).sort().join("-");
      key = `fallback|${item.deal.categorySlug}|${fallback || item.deal.id}`;
    }
    // Accessories ("Samsung S26 case") get their own bucket — not the same as the product
    if (ACCESSORY_RE.test(item.deal.title)) {
      key = `${key}|acc`;
    }
    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }

  const out: ProductGroup[] = [];
  for (const [key, items] of Array.from(buckets.entries())) {
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

/* ── Public catalog accessors ─────────────────────────────────────── */

export function getProductGroups(): ProductGroup[] {
  return getGroups();
}

export function getDealIdToGroup(): Map<string, ProductGroup> {
  if (_dealIdToGroup) return _dealIdToGroup;
  const map = new Map<string, ProductGroup>();
  const idx = getIndex();
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

/* ── Direct lookup by group key (legacy /compare?key= URL pattern) ── */

export function searchByKey(key: string): SearchOutput {
  const groups = getGroups();
  const target = groups.find((g) => g.key === key);
  if (!target) return { mode: "empty", query: key, suggestions: [] };
  const alts = groups
    .filter((g) => g.category === target.category && g.key !== target.key)
    .sort((a, b) => b.storeCount - a.storeCount || a.bestPrice - b.bestPrice)
    .slice(0, 6);
  return { mode: "single", query: target.title, group: target, alternatives: alts };
}

/* ── Autocomplete — pg-fts backed ─────────────────────────────────── */

export async function suggest(
  rawQuery: string,
  n = 8,
): Promise<{ title: string; key: string; storeCount: number }[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const supa = getSupabaseAdmin();
  if (!supa) return [];

  const { data, error } = await supa.rpc("search_products_fts", {
    q,
    max_results: n,
  });
  if (error || !data) return [];

  const rows = data as Array<{ product_id: string; title: string }>;
  if (rows.length === 0) return [];

  // One quick count query so each suggestion shows a real "N stores" badge
  const ids = rows.map((r) => r.product_id);
  const { data: offers } = await supa
    .from("offers")
    .select("product_id")
    .in("product_id", ids)
    .eq("in_stock", true);

  const counts = new Map<string, number>();
  ((offers ?? []) as Array<{ product_id: string }>).forEach((o) => {
    counts.set(o.product_id, (counts.get(o.product_id) ?? 0) + 1);
  });

  return rows.map((r) => ({
    title: r.title,
    key: r.product_id,
    storeCount: counts.get(r.product_id) ?? 1,
  }));
}
