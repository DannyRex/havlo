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
import { merchantTrust } from "@/lib/merchant-trust";
import { LANDED_RATE } from "@/lib/landed-price";
import { partitionDupesByVariantMatch, variantOffers } from "./variant-pooling";
import { partitionDupesByVariantMatchDeep } from "./variant-pooling-deep";
import { priceLooksPlausible, isUsedListing, looksCounterfeit } from "./price-floor";
import { isLooseCategoryModel } from "./normalize";
import type {
  SearchOutput, ProductGroup, StoreOffer, DupeResult, SearchSuggestion,
} from "./index";
/* Type-only (erased at build) so it can't create a runtime import cycle:
   pdp-stats -> country -> pg-fts. computeAnchorStats itself is pulled in via
   a dynamic import inside computeAnchorSpectrum, matching the country helpers
   this module already lazy-loads (see isOfferAllowedForCountry below). */
import type { AnchorStats } from "@/lib/pdp-stats";
import type { Country } from "@/lib/country";

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
  /** Added by migration 0041. Optional because legacy callers may
      hit the pre-0041 RPC during the deploy window. */
  store_country?:   string | null;
}

interface NestedStore {
  id:               string;
  name:             string;
  logo_url:         string | null;
  is_international: boolean;
  /** Added May 2026 re-audit. Lets offerToStoreOffer surface
      stores.country onto StoreOffer so the country gate
      (isOfferAllowedForCountry) can use the DB-authoritative
      anchor signal instead of the JS roster fallback. */
  country:          string | null;
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
  scraped_at:       string | null;
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

/* Price-plausibility (category floors + the flagship floor map +
   priceLooksPlausible) lives in ./price-floor — the single source of
   truth, imported above. /compare (this module) and /api/live-search
   share it, so a flagship line added once is enforced on every read
   surface. Previously this file carried a hand-synced duplicate of the
   whole map; QA found the two drifting (XM6, Dyson, Switch 2 and Apple
   Watch were in neither), which is exactly the failure mode the
   consolidation removes. */

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
  const landedExtra = isIntl ? Math.round(priceN * LANDED_RATE) : 0;
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
    /* DB-authoritative country tag — lets isOfferAllowedForCountry
       use storeCountry as primary signal (covers stores backfilled
       by 0037 that aren't in the JS COUNTRY_STORES roster). */
    storeCountry:   store?.country ?? null,
    /* Curated/link-verified retailer? Drives the subtle "Verified"
       cue on /compare rows. Resolved here (server-side) so the
       MERCHANTS table never reaches the client. */
    trust:          merchantTrust(o.store_id, store?.name ?? o.store_id),
    /* Used / refurbished flag — the per-store productTitle is the
       strongest signal we have ("PRE-OWNED…", "Refurbished…",
       "… Renewed"). Lets compare cards label the offer instead of
       pooling it silently beside new listings. */
    isUsed:         isUsedListing(store?.name ?? o.store_id, productTitle),
    /* Stock + last-seen carried through so computeAnchorStats can split OOS
       offers into the separate "last seen — out of stock" context lane
       (never counted in the live spectrum). Only an explicit false is OOS. */
    inStock:        o.in_stock !== false,
    lastSeenAt:     o.scraped_at,
  };
}

function ftsRowToSingleOffer(r: FtsRow): StoreOffer {
  const priceN = priceInNgn(r.current_price, r.currency);
  const origN = r.original_price ? priceInNgn(r.original_price, r.currency) : priceN;
  const landedExtra = r.is_international ? Math.round(priceN * LANDED_RATE) : 0;
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
    /* DB-authoritative country tag from migration 0041's expanded
       search_products_fts return shape. */
    storeCountry:   r.store_country ?? null,
    /* See offerToStoreOffer — same server-side trust resolution. */
    trust:          merchantTrust(r.store_id, r.store_name),
    /* See offerToStoreOffer — used / refurbished detection from the
       FTS row's own title + store name. */
    isUsed:         isUsedListing(r.store_name, r.title),
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
  /* Reject brand|<category> signatures whose "model" is just a
     Fashion / Beauty / personal-care category fallback (jacket,
     mascara, sneakers, …). Those pool an entire category as if it
     were one product and were over-claiming "compare across N stores
     / save £X" on unrelated items — May 2026 E2E audit found one Next
     jacket PDP pooling 17 stores at £24–£78 while its own price
     history tracked a single store. Such products now resolve to a
     solo pool (their own per-store offers, matched tightly via
     GTIN/MPN/title_key at ingest) so the comparison count is honest.
     They still surface in the dupes-based "you may also like" rail. */
  if (isLooseCategoryModel(model)) return false;
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
        id, store_id, url, current_price, original_price, discount_percent, currency, in_stock, scraped_at,
        stores ( id, name, logo_url, is_international, country )
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
        id, store_id, url, current_price, original_price, discount_percent, currency, in_stock, scraped_at,
        stores ( id, name, logo_url, is_international, country )
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
  /* Keep BOTH in-stock and out-of-stock offers (each tagged via
     offerToStoreOffer's inStock). OOS rows ride through to computeAnchorStats,
     which splits them into the separate "last seen" context lane. The
     usable-URL gate still drops relay-only URLs for both; the headline
     count/price below stay in-stock-only. */
  const usable = p.offers
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
  const offers = usable
    .map((o) => offerToStoreOffer(o, (o as NestedOffer & { productTitle?: string }).productTitle ?? p.title))
    /* Pass the product title so the per-flagship floor catches
       counterfeits (AirPods Pro 2 ₦30K, iPhone 17 Pro DHgate ₦42K)
       that the category floor misses. The signal is conservative
       — only kicks in when the title matches a known flagship line. */
    .filter((o) => priceLooksPlausible(o.price, p.category_slug ?? "general", p.title))
    /* Raw price basis (#16/#123): bestPrice, worstPrice, and the dupe
       "save" badge lead with the listed price, NOT the +30% cross-border
       landed estimate, so the compare anchor, spectrum, chart, and dupe
       cards all agree on the same "cheapest". The cross-border surcharge
       is surfaced separately via landedCostExtra on the card, never baked
       into the headline. */
    .sort((a, b) => a.price - b.price);
  /* storeCount / bestPrice / worstPrice describe what's BUYABLE — in-stock
     only — so the headline count + cheapest never count a sold-out store.
     OOS rows stay in `offers` for computeAnchorStats's context lane. */
  const prices = offers.filter((o) => o.inStock !== false).map((o) => o.price);
  return {
    key:            p.id,
    title:          p.title,
    category:       p.category_slug ?? "general",
    imageUrl:       p.image_url ?? undefined,
    brand:          p.brand,
    model:          null,
    storageGb:      null,
    inches:         null,
    storeCount:     prices.length,
    bestPrice:      prices.length > 0 ? Math.min(...prices) : 0,
    worstPrice:     prices.length > 0 ? Math.max(...prices) : 0,
    maxSavings:     prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0,
    offers,
  };
}

function ftsRowToDupe(row: FtsRow, anchor: ProductGroup): DupeResult {
  const offer = ftsRowToSingleOffer(row);
  const rawSavings = Math.max(0, anchor.bestPrice - offer.price);
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
    brand:          row.brand,
    model:          null,
    storageGb:      null,
    inches:         null,
    storeCount:     1,
    bestPrice:      offer.price,
    worstPrice:     offer.price,
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
  /* `strict` (default true) controls the variant/number/model gates
     and is the knob that toggles between "spectrum candidate" mode
     (strict: every gate fires, used when callers will run their own
     same-product partitioning afterward) and "alternatives" mode
     (lenient: family + price + accessory + url, but variant tokens
     and generation numbers are allowed to differ). Lenient mode is
     what the /compare 'Cheaper alternatives' rail wants — a user
     looking at iPhone 15 SHOULD see iPhone 14 / Galaxy S23 as
     legitimate cheaper alternatives, not just same-generation
     siblings. */
  opts?: { limit?: number; strict?: boolean },
): Promise<DupeResult[]> {
  const supa = getSupabaseAdmin();
  if (!supa || !query.trim()) return [];

  /* anchorPriceNgn === 0 means "no price ceiling" — used when sniff
     extracted a title but no price (Jumia + many other retailers).
     We still return similar products, just without the cheaper-than-X
     filter; UI then ranks by FTS similarity alone. */
  const noCeiling = anchorPriceNgn <= 0;
  const limit = opts?.limit ?? 16;
  const strict = opts?.strict ?? true;
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
    max_results: 30,  /* halved May 2026 v3 for Supabase egress relief */
  });
  if (error || !matches) return [];

  // Build a lightweight anchor stand-in for similarity scoring
  const fakeAnchor: ProductGroup = {
    key:           "external-sniff",
    title:         query,
    category:      "general",
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
    // Drop luxury-trademark counterfeits ("...Interlocking G", "Super Clone")
    .filter((r) => !looksCounterfeit(r.title))
    // Product-family gate: an iPhone anchor must not get iPad / MacBook dupes.
    .filter((r) => !familiesIncompatible(query, r.title))
    /* Family match.
       - strict mode (PDP spectrum candidates): anchor query family
         must equal candidate family.
       - lenient mode (PDP "You may also like", /compare "Cheaper
         alternatives", /p/live's rail): SKIPPED — the rails are
         meant to err generous. A fashion cap anchor can surface a
         related shoe, a headphone anchor can surface a speaker,
         etc. familiesIncompatible above still blocks the obvious
         absurdities (iPhone -> iPad, phone -> appliance) and the
         accessory match-flip prevents case clutter on phone
         anchors, so this gate going dormant in lenient mode only
         widens the relevant suggestions — it doesn't open the
         floodgates to random catalog rows.
       Skipped for accessory queries regardless of strict because
       cases / cables cross-fit between phones and tablets and the
       accessory-semantic matching is what we want there. */
    .filter((r) => queryIsAccessory || !familyConstraint || !strict || detectFamily(r.title) === familyConstraint)
    /* Strict-only gates. In lenient mode the alternatives rail
       wants iPhone 14 / Galaxy S23 to surface for iPhone 15 /
       S24 anchors — these are legit cheaper alternatives, not
       false matches. Callers that DO need same-product enforcement
       (PDP spectrum candidates) keep strict=true and run their
       own partition (partitionDupesByVariantMatch) afterward to
       split same-product from sibling-tier from other-brand. */
    .filter((r) => !strict || candidateHasAllVariants(r.title, variants))
    .filter((r) => !strict || candidateHasAllNumbers(r.title, requiredNumbers))
    .filter((r) => !strict || candidateHasAllModelTokens(r.title, requiredModelTokens))
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

  /* Keep accessory listings out of the suggestions when the user isn't
     searching for an accessory. suggest_titles ranks purely on lexical
     similarity, so "iphone 15 pro max" surfaces "iPhone 15 Pro Max
     Ronaldo Football Phone Case" (every query token present) ABOVE an
     actual phone — and that accessory can even become an auto-pivot
     target in the compare route, which only the downstream anchor guard
     then rejects. Mirror the main candidate pipeline's
     `queryIsAccessory ? looksLikeAccessory(t) : !looksLikeAccessory(t)`
     rule (see pickAnchor below) so the empty-state "Did you mean" pills
     stay on-intent. Over-fetch (6) then slice to 3 so dropping an
     accessory doesn't thin the list. */
  const queryIsAccessory = looksLikeAccessory(q);

  async function runOnce(query: string): Promise<SearchSuggestion[]> {
    try {
      const { data, error } = await supa!.rpc("suggest_titles", { q: query, max_results: 6 });
      if (error || !data) return [];
      return (data as Array<{ product_id: string; title: string; score: number }>)
        .filter((r) => queryIsAccessory || !looksLikeAccessory(r.title))
        .slice(0, 3)
        .map((r) => ({
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
  opts?: { limit?: number; country?: import("@/lib/country").Country },
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
    /* Tighter-match tiebreak. scoreCandidate counts how many query
       tokens a title contains, so for the query "iPhone 15" both
       "iPhone 15" and "iPhone 15 Plus" score identically (each has
       "iphone" + "15"). A candidate carrying variant tokens (pro /
       plus / max / ultra ...) the user did NOT type is a sibling
       model, not the literal match. extraVariantCount pins the exact
       model the user named. `variants` is the original query's
       variant set, computed above. */
    const extraVariantCount = (title: string): number =>
      extractVariantTokens(title).filter((v) => !variants.includes(v)).length;

    const candidates = (data as FtsRow[])
      .filter((r) => !looksLikeAccessory(r.title))
      .filter((r) => !looksSuspicious(r.title))
      // Drop luxury-trademark counterfeits ("...Interlocking G", "Super Clone")
      .filter((r) => !looksCounterfeit(r.title))
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
      .map((r) => ({ row: r, score: scoreCandidate(query, r.title), extra: extraVariantCount(r.title) }))
      /* Sort: query-token score desc, then fewest unsolicited variant
         tokens (the tighter model match). Array.sort is stable, so an
         exact tie still preserves the original FTS rank. */
      .sort((a, b) => (b.score - a.score) || (a.extra - b.extra));

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
      if (!anchor) continue;
      /* Country-aware anchor selection (May 2026 launch-readiness
         re-audit). Before this, pickAnchor returned the FIRST
         FTS-scoring product without checking country relevance —
         /compare?q=iphone+15&country=uk would pick "Apple iPhone 15"
         on 93mobiles (an Indian retailer) as the anchor, then the
         downstream country filter would drop every offer and the
         response collapsed to mode:"empty".

         Now: if a country is passed, the anchor must have AT LEAST
         ONE offer that survives isOfferAllowedForCountry. Iterate
         to the next candidate when the current one wipes out.
         Falls through to candidates without country check when no
         country passed (preserves the no-country callers' behaviour). */
      if (opts?.country) {
        const { isOfferAllowedForCountry } = await import("@/lib/country");
        const passing = anchor.offers.filter((o) => isOfferAllowedForCountry(o, opts.country!));
        if (passing.length === 0) continue;
      }
      return { row, anchor };
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
    max_results: 30,  /* halved May 2026 v3 for Supabase egress relief */
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
    // Drop luxury-trademark counterfeits ("...Interlocking G", "Super Clone")
    .filter((r) => !looksCounterfeit(r.title))
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
  opts?: { limit?: number; country?: Country },
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

  /* Candidate pool — the EXACT same source + params the PDP uses
     (pgFtsFindDupes(title, 0, { limit: 30, strict: false }), see
     fetchDupesCached in /[country]/p/[id]/page.tsx), so the shared
     computeAnchorSpectrum below sees identical inputs on both surfaces and the
     store count cannot drift. (June 2026: this used search_products_fts +
     a manual gate chain, which read 15 stores for a PUMA tee where the PDP's
     pgFtsFindDupes read 9.) pgFtsFindDupes already applies the brand / family
     / accessory / plausibility / URL gates internally; computeAnchorSpectrum
     excludes the anchor product + country-filters. */
  const broadDupes = await pgFtsFindDupes(anchor.title, 0, { limit: 30, strict: false });

  /* Variant-aware augmentation. The strict signature pool above
     misses real same-product matches whenever the brand/model
     parser fails at ingest time (Stanley Quencher tumblers,
     non-canonical Apple-line titles, niche perfumes, etc.). The
     FTS engine DID find the matching listings — promote the ones
     that pass isLikelySameProduct (brand + family + variant + size
     + model + price band) into the anchor pool, so /compare's
     "Across N stores" section reflects the true comparison breadth.

     The same partition runs PDP-side in /[country]/p/[id]/page.tsx
     against fetchDupesCached. Doing it here on the BROAD set keeps
     /compare's anchor section consistent with the PDP CTA's count
     promise.

     DEEP path (Phases 2/3/4) — when we have a Supabase handle and a
     real product_id (anchor.key is the products.id for the by-id
     path), route the partition through the deep variant that
     consults image-phash, title-embedding, and the LLM judge as
     fast-paths BEFORE the lexical gates. The deep variant gracefully
     downgrades to the sync path if the enrichment fetch fails.

     For the synthetic-key path (anchor.key is a signature like
     "apple|iphone 15" rather than a UUID) we keep the sync path —
     the bulk SELECT would just return nothing for the anchor since
     the key isn't a real product_id. */
  /* Shared anchor-spectrum (June 2026). The SINGLE function the PDP's "Compare
     prices across N stores" CTA also calls (computeAnchorSpectrum), so the two
     surfaces run the SAME country filter, the SAME brand-gated variant
     partition, the SAME belt-and-braces model veto, and the SAME
     computeAnchorStats count -- they can no longer drift (the 3-vs-1 store
     report). comparableOffers ARE the counted set, so this card's rows equal
     its storeCount, which equals the PDP CTA. The candidate pool (broadDupes)
     is compare's own FTS source; the shared function owns everything from the
     partition onward. anchor.category is the slug, used as the family for the
     fashion brand gate + the outlier band. */
  const spectrum = await computeAnchorSpectrum(
    { productId, title: anchor.title, brand: anchor.brand, priceNgn: anchor.bestPrice, family: anchor.category },
    anchor.offers,
    broadDupes,
    opts?.country?.code ?? "ng",
  );
  const augmentedAnchor: ProductGroup = {
    ...anchor,
    offers:     spectrum.comparableOffers,
    bestPrice:  spectrum.comparableOffers.length > 0 ? Math.min(...spectrum.comparableOffers.map((o) => o.price)) : anchor.bestPrice,
    worstPrice: spectrum.comparableOffers.length > 0 ? Math.max(...spectrum.comparableOffers.map((o) => o.price)) : anchor.worstPrice,
    storeCount: spectrum.totalStores,
  };

  /* Cheaper-alternatives rail — apply the cheaper-only filter HERE
     (rather than on broadDupes above) so the partition step gets to
     see same-or-higher-priced variants for spectrum augmentation.
     Score + slice mirror the chain that used to live inline on the
     pre-partition broad list. */
  const dupesForRail = spectrum.otherProducts
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
    query: anchorPayload.title,
    anchor: augmentedAnchor,
    /* OOS price context for the anchor product — rendered as a labelled
       "last seen — out of stock" lane on the /compare card, never counted. */
    outOfStock: spectrum.outOfStock,
    /* Cheaper-alternatives rail (May 2026 launch-readiness audit):
       siblings DROPPED from the rail. The May 2026 v3 attempt to
       include them on the theory that "the cheaper-only filter would
       hide more-expensive siblings" missed cases where a sibling
       happens to be cheaper than the anchor — iPhone 15 Plus on
       deep promo can come in under iPhone 15 RRP, and the rail
       happily surfaced it as a "cheaper alternative" for the user's
       iPhone 15 search. Audit caught this regression directly.

       Cross-generation comparisons (iPhone 14 vs iPhone 15, MacBook
       Air M3 vs M4, Galaxy S23 vs S24) still surface — those don't
       match sibling detection (different numeric markers) so they
       land in otherProducts and survive here.

       Same-generation sub-tier (iPhone 15 vs iPhone 15 Plus/Pro/Max,
       Galaxy S24 vs S24 Ultra, MacBook Pro M3 vs M3 Max) is what
       the sibling gate catches. Those are legitimately a different
       product — the user wanted base iPhone 15, recommending the
       Plus is misleading even if temporarily cheaper. */
    dupes: dupesForRail,
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

/* ── Single shared anchor-spectrum builder ──────────────────────────
   ONE source of truth for "this product, across stores": the offer set +
   canonical store count that BOTH the PDP (the "Compare prices across N
   stores" CTA + PriceComparisonBar + chart seed) and /compare (the anchor
   card) render. Before this, each surface fetched candidates and counted
   stores through its own pipeline, so the same product could read 3 stores
   on the PDP and 1 on /compare (June 2026 report) -- different candidate
   source, different filters, different final count. Both now call this
   function, so they cannot drift.

   Inputs the caller already holds:
     baseOffers     the product's own offers (pgFtsAnchorOffersByProductId
                    for a real DB product, or a synthesised single offer for
                    a live/oid anchor).
     candidateDupes FTS neighbours to test for same-product variants
                    (pgFtsFindDupes). Country-filtered here (idempotent: a
                    caller that already filtered passes through unchanged).
   Pipeline: country-filter -> brand-gated deep variant partition (image-phash
   / embedding / judge fast-paths + the fashion brand gate) -> fold the matched
   variant offers into baseOffers -> computeAnchorStats (accessory + outlier +
   used handling + same-store/same-price dedup + new-only count). */
export interface AnchorSpectrum {
  totalStores:      number;
  perStoreOffers:   AnchorStats["perStoreOffers"];
  priceStats:       AnchorStats["priceStats"];
  /** Full StoreOffers behind totalStores (cheapest-first, new-only). A caller
      that RENDERS rows uses these so the displayed rows ARE the counted set. */
  comparableOffers: StoreOffer[];
  /** Out-of-stock context lane for the anchor product (labelled "last seen";
      never part of totalStores / priceStats / comparableOffers). */
  outOfStock:       AnchorStats["outOfStock"];
  /** baseOffers + variant offers, pre-stats. */
  spectrumOffers:   StoreOffer[];
  likelyVariants:   DupeResult[];
  siblingVariants:  DupeResult[];
  otherProducts:    DupeResult[];
}

export async function computeAnchorSpectrum(
  anchor:         { productId: string | null; title: string; brand: string | null; priceNgn: number; family: string | null },
  baseOffers:     StoreOffer[],
  candidateDupes: DupeResult[],
  countryCode:    string,
): Promise<AnchorSpectrum> {
  /* Dynamic imports break the pdp-stats -> country -> pg-fts module cycle
     (country.ts imports this file). Both modules are fully loaded by the time
     this async function runs, so there's no init-order hazard. */
  const { computeAnchorStats } = await import("@/lib/pdp-stats");
  const { getCountry, isOfferAllowedForCountry } = await import("@/lib/country");
  const country = getCountry(countryCode);

  /* Exclude the anchor product from its own candidate pool (its offers are
     already in baseOffers). Done here so every caller is normalised the same
     way regardless of what it passes. */
  const deAnchored = anchor.productId
    ? candidateDupes.filter((d) => d.key !== anchor.productId)
    : candidateDupes;

  /* Country filter (idempotent). NG keeps everything; other markets drop
     offers not shoppable from there, dropping a dupe only if it loses ALL
     its offers. */
  const countryDupes = country.code === "ng"
    ? deAnchored
    : deAnchored
        .map((d) => ({ ...d, offers: d.offers.filter((o) => isOfferAllowedForCountry(o, country)) }))
        .filter((d) => d.offers.length > 0);

  /* Brand-gated variant partition. Deep path when we have a real product_id;
     sync fallback for a synthesised anchor. family threads through so
     fashion/beauty get their brand gate + the wider outlier band in stats. */
  const supa = getSupabaseAdmin();
  const isRealId = !!anchor.productId && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(anchor.productId);
  const partition = supa && isRealId
    ? await partitionDupesByVariantMatchDeep(
        supa,
        { id: anchor.productId as string, title: anchor.title, brand: anchor.brand, priceNgn: anchor.priceNgn, family: anchor.family },
        countryDupes,
      )
    : partitionDupesByVariantMatch(
        { title: anchor.title, brand: anchor.brand, priceNgn: anchor.priceNgn, family: anchor.family },
        countryDupes,
      );

  /* Belt-and-braces final veto (was inline in pgFtsFindByProductId; now shared
     so the PDP gets it too). The deep partition SHOULD already reject
     cross-generation / cross-tier variants, but post-deploy testing kept
     surfacing MacBook M3/M5 and M4-Pro/M4-base leaks, so this guarantees a
     clean spectrum regardless of upstream drift. Runs BEFORE computeAnchorStats
     so totalStores counts exactly what survives. */
  const aNum = extractRequiredNumbers(anchor.title);
  const aMod = extractRequiredModelTokens(anchor.title);
  const aVar = extractVariantTokens(anchor.title);
  const passesFinalVeto = (offerTitle: string | undefined): boolean => {
    const t = offerTitle ?? anchor.title;
    if (!t || t === anchor.title) return true;
    const cNum = extractRequiredNumbers(t);
    const cMod = extractRequiredModelTokens(t);
    const cVar = extractVariantTokens(t);
    if (aNum.filter((n) => !cNum.includes(n)).length > 0 &&
        cNum.filter((n) => !aNum.includes(n)).length > 0) return false;
    if (aMod.filter((m) => !cMod.includes(m)).length > 0 &&
        cMod.filter((m) => !aMod.includes(m)).length > 0) return false;
    if (aVar.some((v) => !cVar.includes(v)) ||
        cVar.some((v) => !aVar.includes(v))) return false;
    return true;
  };
  const spectrumOffers = [...baseOffers, ...variantOffers(partition.likelyVariants)]
    .filter((o) => passesFinalVeto(o.productTitle));
  const stats = computeAnchorStats(spectrumOffers, anchor.priceNgn, country, anchor.family, anchor.title);

  return {
    totalStores:      stats.totalStores,
    perStoreOffers:   stats.perStoreOffers,
    priceStats:       stats.priceStats,
    comparableOffers: stats.comparableOffers,
    outOfStock:       stats.outOfStock,
    spectrumOffers,
    likelyVariants:   partition.likelyVariants,
    siblingVariants:  partition.siblingVariants,
    otherProducts:    partition.otherProducts,
  };
}
