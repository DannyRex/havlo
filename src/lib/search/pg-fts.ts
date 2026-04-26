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

function priceLooksPlausible(priceNgn: number, categorySlug: string | null): boolean {
  const floor = categorySlug ? (CATEGORY_PRICE_FLOOR_NGN[categorySlug] ?? 1_000) : 1_000;
  return priceNgn >= floor;
}

/* Product-family detection — token sets that should NOT cross-match.
   When the anchor title contains a token from one family, dupe titles
   containing tokens from a different family are rejected.

   Repro this prevents:
     • iPhone anchor → iPad / MacBook dupes (Apple cross-product)
     • Phone anchor → Tablet / Laptop / TV dupes
     • Headphone anchor → Speaker dupes (already partly handled by FTS)

   Lightweight string-match — no regex chains, no maintenance per brand. */
/* IMPORTANT: order matters. The first family whose tokens match wins.
   Headphones / earbuds / desktop / tablet are listed BEFORE phone so a
   title like "Sony WH-CH520 Wireless Headphones" detects as headphones,
   not as phone (the substring "phone" lives inside "headphones"). */
const PRODUCT_FAMILIES: Record<string, string[]> = {
  headphones:  ["airpods max", "wh-1000", "headphones", "headphone", "headset", "over-ear", "over ear"],
  earbuds:     ["airpods", "earbuds", "earpods", "tws"],
  tablet:      ["ipad", "tablet", "tab a", "tab s", "matepad", "mediapad"],
  desktop:     ["imac", "mac mini", "mac pro", "all-in-one"],
  laptop:      ["macbook", "thinkpad", "xps", "pavilion", "ideapad", "zenbook", "laptop", "notebook", "chromebook"],
  speaker:     ["speaker", "soundbar", "boombox", "home theater", "home theatre"],
  tv:          ["smart tv", "qled", "oled", "led tv", "uhd tv", "4k tv"],
  console:     ["playstation", "ps5", "ps4", "xbox", "nintendo", "switch"],
  watch:       ["smartwatch", "smart watch", "apple watch", "garmin", "fitbit", "fossil"],
  camera:      ["dslr", "mirrorless", "camcorder", "gopro"],
  phone:       ["iphone", "galaxy", "pixel", "tecno", "infinix", "redmi", "oneplus", "smartphone", "phone"],
};

/* Single-word tokens that are dangerous as substrings (e.g. "phone"
   inside "headphones", "buds" inside "earbuds-style"). For these we
   require a real word boundary instead of a naive String.includes. */
const WORD_BOUNDARY_TOKENS = new Set(["phone", "tv", "buds", "tablet", "watch"]);

function tokenMatchesTitle(token: string, lowerTitle: string): boolean {
  if (!WORD_BOUNDARY_TOKENS.has(token)) return lowerTitle.includes(token);
  const re = new RegExp(`(^|[^a-z])${token}([^a-z]|$)`);
  return re.test(lowerTitle);
}

function detectFamily(title: string): string | null {
  const t = title.toLowerCase();
  for (const [family, tokens] of Object.entries(PRODUCT_FAMILIES)) {
    if (tokens.some((tok) => tokenMatchesTitle(tok, t))) return family;
  }
  return null;
}

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

/* True if anchor + candidate are in incompatible families (e.g. phone vs tablet).
   Allows the case where one (or both) families are unidentified — only blocks
   when we have HIGH CONFIDENCE both items are in different known families. */
function familiesIncompatible(anchorTitle: string, candTitle: string): boolean {
  const af = detectFamily(anchorTitle);
  const cf = detectFamily(candTitle);
  if (!af || !cf) return false; // unknown → allow
  return af !== cf;
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
    .filter((r) => priceLooksPlausible(priceInNgn(r.current_price, r.currency), r.category_slug))
    // Drop accessory / parts / replacement noise
    .filter((r) => !looksLikeAccessory(r.title))
    // Product-family gate: an iPhone anchor must not get iPad / MacBook dupes.
    .filter((r) => !familiesIncompatible(query, r.title))
    // Category-class queries ("phones") must produce dupes in that family
    .filter((r) => !qFamily || detectFamily(r.title) === qFamily)
    .map((r) => ftsRowToDupe(r, fakeAnchor))
    /* When we have an anchor price, also drop near-zero-savings rows.
       Anything < 5% off is noise; the user wants meaningful alternatives. */
    .filter((d) => noCeiling || d.savingsPercent >= 5)
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

  /* 1. Pick the anchor — top FTS match against the user's query.
        Pull a small candidate set (not just top-1) so we can apply
        family + accessory filters BEFORE picking the anchor. The first
        FTS hit for "phones" is "Sony Headphones" (trigram overlap) — by
        scoring with our gates we pick the first phone instead. */
  async function fetchAnchorCandidate(query: string): Promise<FtsRow | null> {
    const { data, error } = await supa!.rpc("search_products_fts", {
      q: query,
      max_results: 20,
    });
    if (error || !data) return null;
    const candidates = (data as FtsRow[])
      .filter((r) => !looksLikeAccessory(r.title))
      .filter((r) => !qFam || detectFamily(r.title) === qFam);
    return candidates[0] ?? null;
  }

  /* Build a candidate anchor from a single FTS row, validating it has
     in-stock offers AND a category-plausible price. Returns null when
     the row exists but doesn't survive validation — caller should then
     try a fallback query (e.g. token-stripped form) before giving up. */
  async function resolveAnchorFromRow(row: FtsRow): Promise<ProductGroup | null> {
    const { data: productData, error: pErr } = await supa!
      .from("products")
      .select(`
        id, title, category_slug, brand, image_url,
        offers (
          id, store_id, url, current_price, original_price, discount_percent, currency, in_stock,
          stores ( id, name, logo_url, is_international )
        )
      `)
      .eq("id", row.product_id)
      .single();
    if (pErr || !productData) return null;
    const a = buildAnchorGroup(productData as unknown as AnchorProduct);
    if (a.offers.length === 0) return null;
    if (!priceLooksPlausible(a.bestPrice, a.category)) return null;
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
  async function pickAnchor(query: string): Promise<{ row: FtsRow; anchor: ProductGroup } | null> {
    const { data, error } = await supa!.rpc("search_products_fts", {
      q: query,
      max_results: 20,
    });
    if (error || !data) return null;
    const candidates = (data as FtsRow[])
      .filter((r) => !looksLikeAccessory(r.title))
      .filter((r) => !qFam || detectFamily(r.title) === qFam);
    for (const row of candidates) {
      const anchor = await resolveAnchorFromRow(row);
      if (anchor) return { row, anchor };
    }
    return null;
  }

  let picked = await pickAnchor(q);
  if (!picked) {
    const fallback = stripTrailingModifiers(q);
    if (fallback) picked = await pickAnchor(fallback);
  }
  if (!picked) {
    return { mode: "empty", query: q, suggestions: [] };
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
    // Implausibly low prices are almost always upstream data errors.
    .filter((r) => priceLooksPlausible(priceInNgn(r.current_price, r.currency), r.category_slug))
    // Drop accessory / parts / replacement noise
    .filter((r) => !looksLikeAccessory(r.title))
    // Product-family gate: an iPhone anchor must not get iPad / MacBook dupes.
    .filter((r) => !familiesIncompatible(anchor.title, r.title))
    .map((r) => ftsRowToDupe(r, anchor))
    // Drop near-zero-savings rows (≤ 1% rounding noise) and the
    // suppressed >=85% rows (savingsPercent zeroed by builder)
    .filter((d) => d.savingsPercent >= 5)
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
