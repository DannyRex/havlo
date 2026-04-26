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
import type {
  SearchOutput, ProductGroup, StoreOffer, DupeResult,
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

function offerToStoreOffer(o: NestedOffer): StoreOffer {
  const store = o.stores;
  const priceN = priceInNgn(o.current_price, o.currency);
  const origN = o.original_price ? priceInNgn(o.original_price, o.currency) : priceN;
  const isIntl = store?.is_international ?? false;
  const landedExtra = isIntl ? Math.round(priceN * 0.30) : 0;
  return {
    storeId:        o.store_id,
    storeName:      store?.name ?? o.store_id,
    storeLogoUrl:   store?.logo_url ?? `/logos/${o.store_id}.png`,
    storeColor:     "#0057FF",
    price:          priceN,
    currency:       "NGN",
    url:            o.url,
    imageUrl:       undefined,
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
    storeLogoUrl:   r.store_logo_url ?? `/logos/${r.store_id}.png`,
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
  const inStock = p.offers.filter((o) => o.in_stock !== false);
  const offers = inStock.map(offerToStoreOffer).sort((a, b) => a.landedPrice - b.landedPrice);
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
  const savings = Math.max(0, anchor.bestPrice - offer.landedPrice);
  const savingsPercent = anchor.bestPrice > 0
    ? Math.max(0, Math.round((savings / anchor.bestPrice) * 100))
    : 0;

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

/* ── Main entrypoint ──────────────────────────────────────────────── */

export async function pgFtsFindSimilar(
  rawQuery: string,
  opts?: { limit?: number },
): Promise<SearchOutput> {
  const q = rawQuery.trim();
  if (!q) return { mode: "empty", query: q, suggestions: [] };

  const supa = getSupabaseAdmin();
  if (!supa) return { mode: "empty", query: q, suggestions: [] };

  const limit = opts?.limit ?? 16;

  /* 1. Pick the anchor — top FTS match against the user's query */
  const { data: anchorMatches, error: anchorErr } = await supa.rpc(
    "search_products_fts",
    { q, max_results: 1 },
  );

  if (anchorErr || !anchorMatches || anchorMatches.length === 0) {
    return { mode: "empty", query: q, suggestions: [] };
  }

  const topRow = anchorMatches[0] as FtsRow;

  /* 2. Fetch full anchor product with all per-store offers (for price comparison) */
  const { data: productData, error: pErr } = await supa
    .from("products")
    .select(`
      id, title, category_slug, brand, image_url,
      offers (
        id, store_id, url, current_price, original_price, discount_percent, currency, in_stock,
        stores ( id, name, logo_url, is_international )
      )
    `)
    .eq("id", topRow.product_id)
    .single();

  if (pErr || !productData) {
    return { mode: "empty", query: q, suggestions: [] };
  }

  const anchor = buildAnchorGroup(productData as unknown as AnchorProduct);
  if (anchor.offers.length === 0) {
    return { mode: "empty", query: q, suggestions: [] };
  }

  /* 3. Find similar products via FTS using the anchor's title (richer query than user's) */
  const { data: similarMatches } = await supa.rpc("search_products_fts", {
    q: anchor.title,
    max_results: 60,
  });

  const dupes: DupeResult[] = ((similarMatches as FtsRow[]) ?? [])
    // Drop the anchor itself
    .filter((r) => r.product_id !== topRow.product_id)
    // Same category preferred (when the anchor has one)
    .filter((r) => !anchor.category || anchor.category === "general" || r.category_slug === anchor.category)
    // ≤ 115% of anchor price (slightly pricier still allowed if it's a much better match)
    .filter((r) => priceInNgn(r.current_price, r.currency) <= anchor.bestPrice * 1.15)
    .slice(0, limit * 2) // over-sample, then re-rank
    .map((r) => ftsRowToDupe(r, anchor))
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
