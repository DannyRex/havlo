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
import { partitionDupesByVariantMatch, variantOffers } from "./variant-pooling";
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

/* Query-understanding gates moved to ./query-understanding (shared
   with /deals search). Re-imported here so pg-fts's existing
   references stay valid. If you're looking for these definitions,
   they live at one canonical location now:

     extractVariantTokens, candidateHasAllVariants
     extractRequiredNumbers, candidateHasAllNumbers
     extractRequiredModelTokens, candidateHasAllModelTokens
     extractQueryBrand, candidateHasBrand
     detectQueryFamily, queryFamily
     looksLikeAccessory, looksSuspicious
     scoreCandidate, stripTrailingModifiers

   Single source of truth — when a gate gets tightened or relaxed,
   both /compare's anchor-FTS and /deals' search inherit the same
   behaviour automatically.

   familiesIncompatible is still imported from ./families. */
import {
  queryFamily,
  looksLikeAccessory,
  looksSuspicious,
  scoreCandidate,
  stripTrailingModifiers,
  extractVariantTokens,
  candidateHasAllVariants,
  extractRequiredNumbers,
  candidateHasAllNumbers,
  extractRequiredModelTokens,
  candidateHasAllModelTokens,
  extractQueryBrand,
  candidateHasBrand,
  detectQueryFamily,
} from "./query-understanding";

function offerToStoreOffer(o: NestedOffer, productTitle?: string): StoreOffer {
  const store = o.stores;
  const priceN = priceInNgn(o.current_price, o.currency);
  const origN = o.original_price ? priceInNgn(o.original_price, o.currency) : priceN;
  const isIntl = store?.is_international ?? false;
  const landedExtra = isIntl ? Math.round(priceN * 0.30) : 0;
  return {
    /* Threaded through so cards rendered from StoreOffer (compare
       dupes, PDP similar-products) can route to the real /p/[offer_id]
       PDP instead of synthetic links. */
    offerId:        o.id,
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
    offerId:        r.offer_id,
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

/* A "tight" signature has BOTH brand AND model parsed. Anything
   with a "?" component is too loose to use for sibling pooling.

   Background: the dedup pass stores signatures as "brand|model"
   (or "brand|model|inches" for screens), with "?" filling in when
   buildSignature couldn't resolve a part from the title. Sibling
   pooling at query time fetches every product sharing this
   signature and merges their offers into one anchor — useful for
   the legit case ("iPhone 15 128GB Black" on Konga + "iPhone 15 -
   128GB - Midnight Black" on Amazon both parse to "apple|iphone15
   |128" and merge into one comparison view).

   But the guard `signature !== "?|?"` is too narrow. Signatures
   like "nike|?" (brand known, model unknown) also catch fire —
   "Nike Authentic Dunk Low Unisex Classic Lightweight Casual
   Sneakers IB2051-400" normalises to "nike|?", and so do 251
   OTHER Nike products in the catalogue ("Nike Air Force 1",
   "Nike Air Max 95", "Nike Phoenix Fleece Hoodie", etc.). User
   report May 2026: clicking Compare on this Dunk anchor showed
   116 "offers" — actually offers from 251 unrelated Nike
   products (socks, boxer briefs, tank tops, joggers, hoodies,
   different sneaker silhouettes).

   New rule: skip sibling pooling unless BOTH brand AND model are
   resolved (no "?" in either slot). The "iPhone 15 128GB" /
   "iPhone 15 - 128GB" case still merges because both sides parse
   to "apple|iphone15|128". The "Nike Dunk Low" case stops merging
   because its signature is "nike|?" and the helper returns false. */
export function isSignatureTightEnoughForPooling(sig: string | null | undefined): boolean {
  if (!sig) return false;
  const parts = sig.split("|");
  if (parts.length < 2) return false;
  /* Brand AND model must both be present and not the "?"
     fallback. Optional third part (inches) can stay loose since
     it's a refinement, not a primary identifier. */
  const [brand, model] = parts;
  if (!brand || brand === "?" || !model || model === "?") return false;
  return true;
}

/* Shared anchor-pool fetch. Three call sites used to repeat this
   logic verbatim with subtle drift:
     - pgFtsFindSimilar.resolveAnchorFromRow (FTS path)
     - pgFtsFindByProductId               (pid path, used by /api/compare)
     - pgFtsAnchorOffersByProductId       (PDP CTA count)
   Drift bites quietly — a sibling-title field added on one path
   silently disappears on another, signature-tightness guards
   change, etc. Centralising the fetch + pool means all three
   surfaces see the same anchor offer set.

   Returns the AnchorProduct shape ready to feed into
   buildAnchorGroup. Per-sibling product title is propagated onto
   each offer via the `productTitle` extension so the compare
   anchor row can render 'as titled at this store' subtitles for
   pooled siblings (the base offers fall back to the parent's title
   via buildAnchorGroup's offerToStoreOffer call).

   Returns null when the product_id doesn't exist. */
async function fetchAnchorProductWithSiblings(
  productId: string,
): Promise<AnchorProduct | null> {
  const supa = getSupabaseAdmin();
  if (!supa) return null;

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

  if (!product) return null;

  const base = product as unknown as AnchorProduct & { signature: string | null };

  if (!isSignatureTightEnoughForPooling(base.signature)) {
    /* Tag base offers with productTitle so downstream callers can
       render consistent subtitles even when no siblings are pooled
       in. */
    return {
      ...base,
      offers: (base.offers ?? []).map((o) => ({
        ...o,
        productTitle: base.title,
      })) as NestedOffer[],
    };
  }

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

  const baseOffers = (base.offers ?? []).map((o) => ({
    ...o,
    productTitle: base.title,
  })) as NestedOffer[];

  if (!siblings || siblings.length === 0) {
    return { ...base, offers: baseOffers };
  }

  const siblingOffers = (siblings as unknown as Array<{ title: string; offers: NestedOffer[] }>)
    .flatMap((s) => (s.offers ?? []).map((o) => ({
      ...o,
      productTitle: s.title,
    }))) as NestedOffer[];

  return { ...base, offers: [...baseOffers, ...siblingOffers] };
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
   (scripts/db/0008-suggest-titles.sql, relaxed in 0020, space-
   insensitive in 0024). Used to populate the empty-mode response's
   `suggestions` array so the EmptySearchState UI can render
   "Did you mean…" pills.

   May 2026: when the literal query returns nothing AND the query has
   spaces, retry with a space-stripped variant. "lawn mower" → ""
   (literal RPC misses) → retry "lawnmower" → matches "Lawnmower X".
   And vice versa: "playstation" → retry "play station" rarely helps
   (titles tend to fuse rather than split), but space-strip handles
   both directions cleanly. Migration 0024 absorbs this logic into
   the SQL so a single RPC call covers it; until that's applied this
   JS retry produces the same end-result with one extra round trip
   (only on empty literal results — rare). */
async function fetchDidYouMean(q: string): Promise<SearchSuggestion[]> {
  const supa = getSupabaseAdmin();
  if (!supa || !q.trim() || q.trim().length < 2) return [];

  async function runOnce(query: string): Promise<SearchSuggestion[]> {
    try {
      const { data, error } = await supa!.rpc("suggest_titles", { q: query, max_results: 3 });
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

  /* Primary literal query. Covers the common case (single-word
     queries, typos, etc.). */
  const literal = await runOnce(q);
  if (literal.length > 0) return literal;

  /* Empty literal → try space-stripped if the query has whitespace.
     "lawn mower" → "lawnmower". Skip when nothing to strip. */
  const stripped = q.replace(/\s+/g, "");
  if (stripped.length >= 2 && stripped !== q.trim()) {
    return await runOnce(stripped);
  }

  return [];
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
    /* Pooling history (now centralised in fetchAnchorProductWithSiblings):
       Round-1: `if (signature)` — too permissive, every "?|?"
         product pooled with every other "?|?" product. The "Handi
         Set" anchor pooled with ~800 unrelated generic titles.
       Round-2 (prior): `signature !== "?|?"` — fixed the both-
         unknown case but not the half-unknown cases. "nike|?"
         anchors STILL pooled with every other "nike|?" product.
       Round-3 (now): isSignatureTightEnoughForPooling requires
         BOTH brand AND model resolved. */
    const anchorPayload = await fetchAnchorProductWithSiblings(row.product_id);
    if (!anchorPayload) return null;

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

    /* Confidence floor: when the candidates haven't matched the
       bare minimum query-token signal, prefer empty over
       confidently wrong. Only fires for queries with NO known
       family — for known families the family gate is already a
       strong precision signal and we don't want to also penalize
       a legitimate but imperfect lexical match (e.g. 'PlayStation
       5 Slim' anchoring on 'PlayStation 5 Standard' when the Slim
       SKU isn't in the DB). For unknown-family queries (e.g.
       'summer dress'), require 2+ token hits so a 'summer rug'
       candidate doesn't anchor on a single weak overlap.

       Updated May 2026 (audit retest): apply the floor to EVERY
       candidate, not just the top. The previous version only
       checked candidates[0]; if that one passed minScore but
       failed downstream validation (resolveAnchorFromRow returns
       null for things like implausible prices), the loop tried
       candidates[1+] without re-checking minScore. User report:
       query "Hank Luxury Bluetooth Key Finder" returned "S75
       Bluetooth Speaker" as anchor — Hank Luxury (score 5) hit
       the priceLooksPlausible floor (mis-categorised as 'phones'),
       resolveAnchorFromRow returned null, loop fell through to
       S75 (score 1) which slipped past the unchecked confidence
       floor. */
    if (candidates.length === 0) return null;
    let qualifyingCandidates = candidates;
    if (!familyConstraint) {
      const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
      const minScore = queryTokens.length <= 1 ? 1 : 2;
      qualifyingCandidates = candidates.filter((c) => c.score >= minScore);
      if (qualifyingCandidates.length === 0) return null;
    }

    for (const { row } of qualifyingCandidates) {
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

  /* Anchor pool (this product + signature-tight siblings) via the
     shared helper. Same pooling logic as pgFtsFindSimilar's FTS
     path so the two surfaces can never diverge in what they
     consider 'the anchor'. */
  const anchorPayload = await fetchAnchorProductWithSiblings(productId);
  if (!anchorPayload) {
    return { mode: "empty", query: productId, suggestions: [] };
  }

  const anchor = buildAnchorGroup(anchorPayload);
  if (anchor.offers.length === 0) {
    return { mode: "empty", query: anchorPayload.title, suggestions: [] };
  }

  /* Dupes pipeline. Mirror pgFtsFindSimilar's gates so a pid-anchored
     search applies the SAME filters as a text-anchored search —
     audit May 2026 flagged that pid-anchored dupes missed variant /
     numeric-model / brand gates, which let an iPhone 15 Pro Max
     PDP-CTA click reveal iPhone 16 alternatives that the same
     anchor text-search would have filtered out.

     Requirements are extracted from the ANCHOR.TITLE (not a user
     query — pid resolution has no user-typed string to lean on).
     That's safe: the anchor's stored title is canonical for the
     product. */
  const { data: similarMatches } = await supa.rpc("search_products_fts", {
    q: anchor.title,
    max_results: 60,
  });

  const anchorVariants     = extractVariantTokens(anchor.title);
  const anchorNumbers      = extractRequiredNumbers(anchor.title);
  const anchorModelTokens  = extractRequiredModelTokens(anchor.title);
  const anchorBrand        = anchor.brand ?? extractQueryBrand(anchor.title);
  const anchorFamily       = detectQueryFamily(anchor.title);
  const anchorIsAccessory  = looksLikeAccessory(anchor.title);

  const dupes: DupeResult[] = ((similarMatches as FtsRow[]) ?? [])
    .filter((r) => r.product_id !== productId)
    .filter((r) => !anchor.category || anchor.category === "general" || r.category_slug === anchor.category)
    /* Strict cheaper-only — pgFtsFindSimilar's contract. /compare's
       "Cheaper alternatives" rail depends on this. PDP's "You may
       also like" intentionally uses pgFtsFindDupes(title, 0) which
       lifts this ceiling (broader browse intent). See PDP page.tsx
       comment on the fetchDupesCached call. */
    .filter((r) => priceInNgn(r.current_price, r.currency) < anchor.bestPrice * 0.99)
    .filter((r) => priceLooksPlausible(priceInNgn(r.current_price, r.currency), r.category_slug, r.title))
    .filter((r) => isUsableMerchantUrl(r.url))
    /* Accessory match-flip: if the anchor itself is an accessory
       (a case, cable, stand, etc.) we want other accessories as
       alternatives, not the parent product. Otherwise drop
       accessories so a phone anchor doesn't pull in cases. */
    .filter((r) => anchorIsAccessory ? looksLikeAccessory(r.title) : !looksLikeAccessory(r.title))
    .filter((r) => !looksSuspicious(r.title))
    /* Family gate. Anchor family inferred from title; candidates
       must match. Skipped when family is null (allows broad
       'gift for mum'-style anchors to surface anything). */
    .filter((r) => !anchorFamily || detectFamily(r.title) === anchorFamily)
    /* Variant gate: 'pro max' / 'ultra' / 'plus' must be honoured. */
    .filter((r) => candidateHasAllVariants(r.title, anchorVariants))
    /* Generation gate: 'iPhone 15' must NOT match 'iPhone 16' rows. */
    .filter((r) => candidateHasAllNumbers(r.title, anchorNumbers))
    /* Model-token gate: 'Galaxy S24' must NOT match 'Galaxy S25' rows. */
    .filter((r) => candidateHasAllModelTokens(r.title, anchorModelTokens))
    /* Brand gate: a Nike anchor must surface Nike alternatives. */
    .filter((r) => candidateHasBrand(r.title, anchorBrand))
    /* Family compatibility — drops cross-family same-brand rows
       (Nike Dunk → Nike Crew Socks). alternativeFamilyMatches is
       stricter than familiesIncompatible for the dupes path. */
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

  /* Variant-aware augmentation. The strict signature pool above
     misses real same-product matches whenever the brand/model
     parser fails at ingest time (Stanley Quencher tumblers,
     non-canonical Apple-line titles, fashion items, etc.). The
     dupes engine DID find the matching listings via FTS — promote
     the ones that pass isLikelySameProduct (brand + family +
     variant + size + model + price band) into the anchor pool, so
     /compare's "Across N stores" section reflects the true
     comparison breadth.

     The same partition runs PDP-side in /[country]/p/[id]/page.tsx
     against fetchDupesCached. Doing it here too keeps /compare's
     anchor section consistent with the PDP CTA's count promise. */
  const partition = partitionDupesByVariantMatch(
    { title: anchor.title, brand: anchor.brand, priceNgn: anchor.bestPrice },
    dupes,
  );
  const augmentedOffers = [
    ...anchor.offers,
    ...variantOffers(partition.likelyVariants),
  ];
  const augmentedAnchor: ProductGroup = {
    ...anchor,
    offers:    augmentedOffers,
    /* Recompute bestPrice/worstPrice from the augmented set —
       variant offers can shift either extreme. storeCount stays
       informational; the compare anchor card derives its display
       count from offers.length directly. */
    bestPrice:  augmentedOffers.length > 0 ? Math.min(...augmentedOffers.map((o) => o.landedPrice)) : anchor.bestPrice,
    worstPrice: augmentedOffers.length > 0 ? Math.max(...augmentedOffers.map((o) => o.landedPrice)) : anchor.worstPrice,
    storeCount: augmentedOffers.length,
  };

  return {
    mode: "similar",
    query: anchorPayload.title,
    anchor: augmentedAnchor,
    /* Dupes rail loses variants — they're now on the anchor card
       directly. Genuinely different products (different size,
       different generation) stay. */
    dupes: partition.otherProducts,
  };
}

/* Lightweight anchor-only fetch by product_id. Same pooling logic as
   pgFtsFindByProductId (this product + signature-tight siblings → run
   through buildAnchorGroup's in_stock + usable-URL + plausible-price
   filters) but SKIPS the dupes FTS pipeline.

   Use case: the PDP's "Compare prices across N stores" CTA. The PDP
   needs N to equal what /compare's anchor section displays as
   "Across N stores" / "Available at" so the click-through promise
   matches the destination view. The full pgFtsFindByProductId would
   work but burns a search_products_fts RPC + per-product offer
   hydration the PDP doesn't need (the dupes rail uses
   pgFtsFindDupes already). Returns the same StoreOffer[] shape so
   the caller can apply isOfferAllowedForCountry + same-store/
   same-price dedup before counting. */
export async function pgFtsAnchorOffersByProductId(
  productId: string,
): Promise<StoreOffer[]> {
  const anchorPayload = await fetchAnchorProductWithSiblings(productId);
  if (!anchorPayload) return [];
  return buildAnchorGroup(anchorPayload).offers;
}
