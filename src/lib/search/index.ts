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
import { usdToNgn, cleanTitle } from "@/lib/utils";
import { buildSignature, extractedSignature, type ProductSignature } from "./normalize";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { resolveStoreLogoUrl } from "@/lib/store-logo";

/* ── Public types ─────────────────────────────────────────────────── */

export interface StoreOffer {
  /** Offer UUID from the offers table. Empty string for live SerpAPI
      rows that don't exist in the DB yet — those need the
      query-param synthetic PDP at /[country]/p/live. */
  offerId: string;
  storeId: string;
  storeName: string;
  storeLogoUrl: string;
  storeColor: string;
  price: number;       // always NGN
  currency: "NGN";
  url: string;
  imageUrl?: string;
  /** Product title as listed at THIS store. Differs across retailers
   *  for the same physical product ('iPhone 15 Pro Max - 256GB' vs
   *  'Apple iPhone 15 Pro Max — 256gb Rom — 8gb Ram'). Surfaced as
   *  the per-row subtitle in the /compare anchor card so users can
   *  see the proof that pooled offers really are the same item. */
  productTitle?: string;
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
    /* Deal.id is the offer_id when sourced from the DB (browse-db.ts
       sets `id: r.offer_id`). For synthetic curated rows the id is
       the curated slug — still acceptable for routing to /p/[id]
       which handles both formats. */
    offerId: d.id,
    storeId: d.storeId,
    storeName: meta.name,
    storeLogoUrl: resolveStoreLogoUrl(d.storeId),
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

  /* Store-count badge must match what /compare actually surfaces, or
     the user sees "1 store" in the dropdown and gets a comparison
     with many. User-reported case (May 2026): "Nike Men's Dunk Low
     Retro Sneakers" suggestion said "1 store" but /compare showed
     several different stores.

     Two bugs in the prior implementation:
       1. Counted OFFER ROWS, not distinct stores. Two offers from
          the same store (e.g. different size variants) double-counted.
       2. Counted only the literal product_id's offers. /compare
          pools by signature (brand|model) and shows offers across
          ALL products with the same signature. The dropdown didn't
          pool, so the badge undercounted.

     New flow mirrors /compare exactly (pg-fts.ts pgFtsFindSimilar):
       a. Fetch signatures for the suggested products.
       b. For products with a usable signature (not null, not "?|?"),
          fetch all sibling product_ids sharing that signature.
       c. Count DISTINCT store_ids across the full pool (suggested
          product + siblings). Products with no usable signature
          stand alone.

     Cost: +2 DB queries (signature lookup + sibling lookup). All
     indexed. ~30-50ms overhead on a typeahead that's already
     debounced — acceptable for accuracy. */
  const ids = rows.map((r) => r.product_id);

  /* Step 1: signatures for the suggested products. */
  const { data: products } = await supa
    .from("products")
    .select("id, signature")
    .in("id", ids);
  const sigByProductId = new Map<string, string | null>();
  for (const p of (products ?? []) as Array<{ id: string; signature: string | null }>) {
    sigByProductId.set(p.id, p.signature);
  }

  /* Step 2: gather all usable signatures, then fetch every product_id
     that shares one. Treat "?|?" as solo — that's the placeholder
     for "couldn't parse brand+model", so pooling those together
     would mix unrelated products (the same bug fixed in pg-fts.ts
     commit a34eb9d for the "10 Pcs Handi Set" case). */
  /* Array.from(Map.values()) instead of for-of so the TS target in
     this repo (downlevelIteration off) accepts it. forEach pattern
     matches what the older offer-count code used. */
  const usableSigs = new Set<string>();
  Array.from(sigByProductId.values()).forEach((sig) => {
    if (sig && sig !== "?|?") usableSigs.add(sig);
  });
  const siblingsBySig = new Map<string, string[]>();
  if (usableSigs.size > 0) {
    const { data: siblings } = await supa
      .from("products")
      .select("id, signature")
      .in("signature", Array.from(usableSigs));
    for (const s of (siblings ?? []) as Array<{ id: string; signature: string | null }>) {
      if (!s.signature) continue;
      const arr = siblingsBySig.get(s.signature) ?? [];
      arr.push(s.id);
      siblingsBySig.set(s.signature, arr);
    }
  }

  /* Step 3: build the full pool per suggestion. */
  const poolByProductId = new Map<string, string[]>();
  for (const r of rows) {
    const sig = sigByProductId.get(r.product_id);
    if (sig && sig !== "?|?" && siblingsBySig.has(sig)) {
      poolByProductId.set(r.product_id, siblingsBySig.get(sig)!);
    } else {
      poolByProductId.set(r.product_id, [r.product_id]);
    }
  }

  /* Step 4: fetch (product_id, store_id) for every pooled product and
     count distinct stores per suggestion. */
  const allPooledIds = new Set<string>();
  Array.from(poolByProductId.values()).forEach((pool) => {
    pool.forEach((id) => allPooledIds.add(id));
  });

  const { data: offers } = await supa
    .from("offers")
    .select("product_id, store_id")
    .in("product_id", Array.from(allPooledIds))
    .eq("in_stock", true);

  const storesByProductId = new Map<string, Set<string>>();
  for (const o of (offers ?? []) as Array<{ product_id: string; store_id: string }>) {
    let set = storesByProductId.get(o.product_id);
    if (!set) { set = new Set(); storesByProductId.set(o.product_id, set); }
    set.add(o.store_id);
  }

  return rows.map((r) => {
    const pool = poolByProductId.get(r.product_id) ?? [r.product_id];
    const stores = new Set<string>();
    pool.forEach((pid) => {
      const s = storesByProductId.get(pid);
      if (s) Array.from(s).forEach((sid) => stores.add(sid));
    });
    return {
      /* cleanTitle strips HTML tags + collapses dirty separators so
         autocomplete entries don't render with literal "<strong>"
         text from DHgate / SerpAPI seller feeds. */
      title: cleanTitle(r.title),
      key: r.product_id,
      storeCount: Math.max(1, stores.size),
    };
  });
}
