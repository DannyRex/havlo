/* Hub data layer — category + brand landing pages.
   ──────────────────────────────────────────────────────────────────
   These power the SEO "hub" pages that de-orphan the PDP corpus
   (GSC audit M2: the entire product corpus had ~33 internal links
   because nothing crawlable linked DOWN to /[country]/p/[id] pages).

   Why a dedicated data path instead of reusing /api/deals:
     • /api/deals returns the Deal shape, which carries NO brand field,
       so a brand hub can't filter on it.
     • /api/deals merges the curated Amazon catalog, whose entries have
       SYNTHETIC ids (paapi-*, etc.) that soft-redirect to /deals rather
       than resolving as real PDPs. A hub's whole job is to link to real,
       indexable PDPs — synthetic rows would pollute the ItemList with
       URLs that 404/redirect.

   So hubs read product_best_offers (the canonical cheapest-in-stock
   offer per product) directly. Every offer_id it returns is a real
   offer UUID → a real /[country]/p/[offer_id] PDP, exactly the URLs
   already emitted in sitemap.ts.

   Country-shoppability mirrors browse-db.ts getOriginCounts EXACTLY:
     local  = store_country = <CC>
     global = is_international = true AND store_country IS NULL
   (a foreign-country-anchored retailer — UK stock for an NG shopper —
    is neither, because it doesn't realistically ship to that market.) */

import "server-only";
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { isSyntheticId } from "@/lib/pdp-url";
import { fetchOffersAt30dLow } from "@/lib/search/price-history";
import { categories } from "@/lib/data/categories";
import type { Deal } from "@/types";

/* Columns pulled from product_best_offers — the subset needed to
   render a card + build the ItemList JSON-LD. Keep aligned with the
   BestOfferRow shape in browse-db.ts. */
const HUB_COLS =
  "offer_id, product_id, title, category_slug, brand, image_url, store_id, store_name, store_country, is_international, url, current_price, original_price, discount_percent, currency, scraped_at";

interface HubRow {
  offer_id:         string;
  product_id:       string;
  title:            string;
  category_slug:    string | null;
  brand:            string | null;
  image_url:        string | null;
  store_id:         string;
  store_name:       string;
  store_country:    string | null;
  is_international: boolean;
  url:              string;
  current_price:    number;
  original_price:   number | null;
  discount_percent: number | null;
  currency:         "NGN" | "USD";
  scraped_at:       string;
}

/* How many cards a hub renders. 60 matches the SSR card budget on
   /[country]/deals (set there for crawl depth) — enough inbound links
   per hub to meaningfully de-orphan, small enough to keep the HTML
   payload and Supabase egress in check. */
export const HUB_GRID_LIMIT = 60;

/* A brand needs at least this many country-shoppable products to earn
   an indexable hub. Brand coverage is sparse (~17% of the catalog has
   a brand), so a low bar still leaves plenty of thin would-be pages;
   gating at 3 keeps the index free of one-product "brand" pages that
   read as doorway/thin content to Google. */
export const BRAND_HUB_MIN_PRODUCTS = 3;

/* Cap on how many brand hubs we generate + sitemap per country. Brands
   are an open-ended, noisy set; the long tail past the top ~60 is
   mostly single-product noise already excluded by the threshold, but
   the cap is a hard backstop against runaway static generation. */
export const BRAND_HUB_MAX = 60;

/* ── Slug helpers ─────────────────────────────────────────────────
   Brand values are free text ("Ray-Ban", "L'Oréal", "Samsung"). Map
   to a URL-safe slug for /[country]/brand/[slug]. */
export function slugifyBrand(brand: string): string {
  return brand
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Escape SQL LIKE wildcards so an exact brand label can't smuggle a
   `%`/`_` into the ilike pattern. ilike itself is case-insensitive,
   which is what we want — it matches every casing variant of the
   stored brand. */
function ilikeExact(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

/* The country-shoppable OR group, shared by every hub query. */
function shoppableOr(countryCode: string): string {
  const cc = countryCode.toUpperCase();
  return `store_country.eq.${cc},and(is_international.eq.true,store_country.is.null)`;
}

function rowToDeal(r: HubRow): Deal {
  const original = r.original_price ?? r.current_price;
  return {
    id:              r.offer_id,
    title:           r.title,
    description:     r.title,
    category:        r.category_slug ?? "general",
    categorySlug:    r.category_slug ?? "all",
    storeId:         r.store_id,
    storeName:       r.store_name,
    originalPrice:   original,
    salePrice:       r.current_price,
    discountPercent: r.discount_percent ?? 0,
    currency:        r.currency,
    imageUrl:        r.image_url ?? undefined,
    url:             r.url,
    expiresAt:       null,
    isHot:           (r.discount_percent ?? 0) >= 30,
    isFeatured:      false,
    tags:            [r.store_name, r.category_slug ?? ""].filter(Boolean),
    saves:           0,
    clicks:          0,
    postedAt:        r.scraped_at,
    storeCountry:    r.store_country ?? null,
  };
}

/* Drop synthetic ids defensively (the view is real offers, but the
   guard costs nothing and matches the /deals ItemList filter) and
   dedupe by product so the same product can't appear twice if the
   view ever returns sibling rows. */
function dealsFromRows(rows: HubRow[]): Deal[] {
  const seenProduct = new Set<string>();
  const out: Deal[] = [];
  for (const r of rows) {
    if (isSyntheticId(r.offer_id)) continue;
    /* Skip products with no image — a card/PDP with no picture reads as
       broken, and these can't be reliably back-filled (most source pages
       expose only a site-icon og:image). Tiny slice of the catalogue
       (~17 of 16k), reappears automatically once an image is captured. */
    if (!r.image_url || r.image_url.trim() === "") continue;
    if (seenProduct.has(r.product_id)) continue;
    seenProduct.add(r.product_id);
    out.push(rowToDeal(r));
  }
  return out;
}

/* ── Category hub offers ──────────────────────────────────────────
   Cheapest-in-stock offers in a category that are shoppable from the
   given country, biggest markdowns first. */
export const fetchCategoryHubOffers = cache(async (
  countryCode:  string,
  categorySlug: string,
  limit:        number = HUB_GRID_LIMIT,
): Promise<Deal[]> => {
  const supa = getSupabaseAdmin();
  if (!supa) return [];
  const { data, error } = await supa
    .from("product_best_offers")
    .select(HUB_COLS)
    .eq("category_slug", categorySlug)
    .or(shoppableOr(countryCode))
    .order("discount_percent", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn(`[hubs] category "${categorySlug}" (${countryCode}) error:`, error.message);
    return [];
  }
  return dealsFromRows((data ?? []) as HubRow[]);
});

/* ── Categories that actually have inventory in a country ──────────
   The category-hub page noindexes a category with zero country-
   shoppable offers, so the sitemap must NOT submit those URLs (a
   "Submitted URL marked noindex" warning is exactly what the GSC
   clean-up is trying to avoid). Returns the subset of known category
   slugs that have at least one shoppable offer.

   Implementation: a bounded, order-free scan of just the category_slug
   column that EARLY-EXITS the moment every known category has been
   seen. The catalog is category-dense, so in practice this resolves in
   the first page or two; the page cap is a hard backstop. Cached per
   country so a single sitemap build doesn't re-scan. */
const CATEGORY_SCAN_MAX_PAGES = 6;
const CATEGORY_SCAN_PAGE = 1000;

export const listCategoriesWithInventory = cache(
  async (countryCode: string): Promise<Set<string>> => {
    const supa = getSupabaseAdmin();
    if (!supa) return new Set<string>();
    const known = new Set(
      categories.filter((c) => c.slug !== "all").map((c) => c.slug),
    );
    const found = new Set<string>();
    for (let page = 0; page < CATEGORY_SCAN_MAX_PAGES; page++) {
      const from = page * CATEGORY_SCAN_PAGE;
      const { data, error } = await supa
        .from("product_best_offers")
        .select("category_slug")
        .not("category_slug", "is", null)
        .or(shoppableOr(countryCode))
        .range(from, from + CATEGORY_SCAN_PAGE - 1);
      if (error) {
        console.warn(`[hubs] category-presence scan (${countryCode}) page ${page} error:`, error.message);
        break;
      }
      const rows = (data ?? []) as Array<{ category_slug: string | null }>;
      for (const r of rows) {
        if (r.category_slug && known.has(r.category_slug)) found.add(r.category_slug);
      }
      if (found.size >= known.size) break; // every known category present
      if (rows.length < CATEGORY_SCAN_PAGE) break; // last page
    }
    return found;
  },
);

/* ── Brand hub offers ─────────────────────────────────────────────
   Same shape as the category path but matched on brand (ilike =
   case-insensitive exact). `brandLabel` is the resolved canonical
   label, not the URL slug. */
export const fetchBrandHubOffers = cache(async (
  countryCode: string,
  brandLabel:  string,
  limit:       number = HUB_GRID_LIMIT,
): Promise<Deal[]> => {
  const supa = getSupabaseAdmin();
  if (!supa) return [];
  const { data, error } = await supa
    .from("product_best_offers")
    .select(HUB_COLS)
    .ilike("brand", ilikeExact(brandLabel))
    .or(shoppableOr(countryCode))
    .order("discount_percent", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn(`[hubs] brand "${brandLabel}" (${countryCode}) error:`, error.message);
    return [];
  }
  /* Defensive brand-hub guard. products.brand is derived from the product
     TITLE at ingest (buildSignature), which over-tags third-party "made for
     X" accessories (e.g. "Roller Brush for Dyson", "Battery For Apple
     macbook", "Controller for PS4") and the odd false token. The exact-brand
     query above is correct; the underlying DATA is over-broad. Until the
     extractor is tightened + the catalog re-ingested, drop the clearest
     third-party items at display time so a brand page shows genuine brand
     products, not accessories made for the brand. High precision: only
     removes titles that explicitly say "compatible with / replacement / for
     <brand>", which a first-party product never does, so genuine brand-led
     titles ("Apple Watch …", "Nike Air Max …") are never touched. */
  const escaped = brandLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const thirdParty = new RegExp(
    `\\b(compatible with|replacement|spare part|for use with|fits|for\\s+(the\\s+)?${escaped})\\b`,
    "i",
  );
  return dealsFromRows((data ?? []) as HubRow[]).filter((d) => !thirdParty.test(d.title));
});

/* ── Amazon offers, every marketplace ─────────────────────────────
   Powers the /[country]/amazon browser. Returns EVERY Amazon markdown
   we track across all marketplaces (UK / US / AE / IN / DE / ZA), not
   just the ones reachable from the visitor's market: the page ships
   its own country + category filters and sort, so it wants the whole
   catalogue. Prices are normalised to USD across the board, so the
   page's client-side price sort is apples-to-apples.

   Deduped by product, biggest markdown first. Every card links to a
   real PDP (price history + the affiliate "Buy on Amazon" button). The
   400 cap is a generous backstop — the live set is ~350 — so the whole
   corpus reaches the client for instant filtering. */
export const fetchAllAmazonOffers = cache(async (
  limit: number = 400,
): Promise<Deal[]> => {
  const supa = getSupabaseAdmin();
  if (!supa) return [];
  const { data, error } = await supa
    .from("product_best_offers")
    .select(HUB_COLS)
    .ilike("store_id", "amazon%")
    .gt("discount_percent", 0)
    .order("discount_percent", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn(`[hubs] all-amazon error:`, error.message);
    return [];
  }
  const deals = dealsFromRows((data ?? []) as HubRow[]);
  /* History-derived "Lowest in 30 days" flag (#F2). The Amazon hub renders
     MasonryCards, which already carry the badge -- but only if the offer is
     flagged. The /deals feed enriches via fetchOffersAt30dLow; the Amazon hub
     never did, so the badge never lit and the page's "checked against its
     price history" promise lived only in the tap-through chart. Enrich here so
     the history check is visible ON the card: a single cached RPC over the
     rendered set, safe-degrading to no badge when unavailable. */
  const lowSet = await fetchOffersAt30dLow(deals.map((d) => d.id));
  return lowSet.size === 0
    ? deals
    : deals.map((d) => (lowSet.has(d.id) ? { ...d, at30DayLow: true } : d));
});

/* ── Brand catalogue per country ──────────────────────────────────
   Distinct brands shoppable from a country, with an approximate
   product count, used to: generate brand-hub static params, build the
   /[country]/brands index, gate noindex, and seed the sitemap.

   There is no GROUP BY RPC for this, so we page the brand column of
   the country-shoppable slice of product_best_offers (only ~2.6k rows
   carry a brand catalog-wide) and aggregate in JS. Cached per country
   so generateStaticParams + the index render + the sitemap don't each
   re-run it. */
export interface BrandSummary {
  /** Canonical display label — the most common exact spelling. */
  brand: string;
  /** URL slug for /[country]/brand/[slug]. */
  slug:  string;
  /** Approximate count of country-shoppable products for this brand. */
  count: number;
}

const BRAND_CACHE_TTL_MS = 30 * 60 * 1000;
const brandCache = new Map<string, { data: BrandSummary[]; expires: number }>();

/* Hard cap on rows scanned while aggregating brands. The whole catalog
   has ~2.6k branded rows, so 8 pages (8k) is comfortable headroom and
   bounds egress if the view grows. */
const BRAND_SCAN_MAX_PAGES = 8;
const BRAND_SCAN_PAGE = 1000;

async function aggregateCountryBrands(countryCode: string): Promise<BrandSummary[]> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];

  /* slug → { exact-spelling → frequency, total }. We keep per-spelling
     frequency so the canonical label is the spelling that actually
     dominates the data rather than whichever row happened to come
     first. */
  const bySlug = new Map<string, { spellings: Map<string, number>; total: number }>();

  for (let page = 0; page < BRAND_SCAN_MAX_PAGES; page++) {
    const from = page * BRAND_SCAN_PAGE;
    const { data, error } = await supa
      .from("product_best_offers")
      .select("brand")
      .not("brand", "is", null)
      .or(shoppableOr(countryCode))
      .range(from, from + BRAND_SCAN_PAGE - 1);
    if (error) {
      console.warn(`[hubs] brand scan (${countryCode}) page ${page} error:`, error.message);
      break;
    }
    const rows = (data ?? []) as Array<{ brand: string | null }>;
    for (const r of rows) {
      const raw = r.brand?.trim();
      if (!raw) continue;
      const slug = slugifyBrand(raw);
      if (!slug) continue;
      let entry = bySlug.get(slug);
      if (!entry) {
        entry = { spellings: new Map(), total: 0 };
        bySlug.set(slug, entry);
      }
      entry.total += 1;
      entry.spellings.set(raw, (entry.spellings.get(raw) ?? 0) + 1);
    }
    if (rows.length < BRAND_SCAN_PAGE) break;
  }

  const summaries: BrandSummary[] = [];
  /* Array.from on the Maps: tsconfig sets no explicit `target`, so a
     direct `tsc` run defaults below es2015 and rejects for-of over a
     Map iterator (TS2802). Iterating the materialised entries array
     compiles under any target. */
  for (const [slug, entry] of Array.from(bySlug)) {
    /* Canonical label = most frequent spelling for this slug. */
    let label = slug;
    let best = -1;
    for (const [spelling, freq] of Array.from(entry.spellings)) {
      if (freq > best) {
        best = freq;
        label = spelling;
      }
    }
    summaries.push({ brand: label, slug, count: entry.total });
  }
  /* Most products first so the index + static-param caps keep the
     highest-signal brands. */
  summaries.sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));
  return summaries;
}

async function getCountryBrands(countryCode: string): Promise<BrandSummary[]> {
  const key = countryCode.toLowerCase();
  const now = Date.now();
  const cached = brandCache.get(key);
  if (cached && cached.expires > now) return cached.data;
  const data = await aggregateCountryBrands(key);
  brandCache.set(key, { data, expires: now + BRAND_CACHE_TTL_MS });
  return data;
}

/* Brands that clear the indexable threshold, capped to BRAND_HUB_MAX.
   Used for static params, the index grid, and the sitemap. */
export async function listIndexableBrands(countryCode: string): Promise<BrandSummary[]> {
  const all = await getCountryBrands(countryCode);
  return all.filter((b) => b.count >= BRAND_HUB_MIN_PRODUCTS).slice(0, BRAND_HUB_MAX);
}

/* Resolve a URL slug back to its canonical brand label + count for a
   country. Returns null when the slug isn't a known brand there (the
   hub page 404s on null). Matches against ALL brands, not just the
   indexable set, so a direct hit on a sub-threshold brand still
   renders (just noindex) rather than 404ing. */
export async function resolveBrandSlug(
  countryCode: string,
  slug:        string,
): Promise<BrandSummary | null> {
  const all = await getCountryBrands(countryCode);
  const target = slug.toLowerCase();
  return all.find((b) => b.slug === target) ?? null;
}
