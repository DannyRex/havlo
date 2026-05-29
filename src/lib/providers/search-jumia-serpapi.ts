/* ──────────────────────────────────────────────────────────────────
   Jumia ingest via SerpAPI's Google engine (site-filtered).

   STATUS: Active when SERPAPI_KEY is set in env (same key the
   Google Shopping provider uses).

   Why this approach:
     The Playwright Jumia scraper (scripts/scrapers/jumia.ts) was
     defeated by Cloudflare in early 2026. SerpAPI does NOT offer
     a dedicated `engine=jumia` (verified by HTTP probe in May
     2026 — returns "Unsupported `jumia` search engine"). Google
     Shopping doesn't operate in NG either.

     The working path: SerpAPI's `engine=google` with a
     `site:jumia.com.ng` query operator. Google's rich-snippet
     parser extracts the product price + currency from the
     structured-data markup Jumia already publishes on every
     product page, so we get clean (price, currency) pairs without
     needing to load Jumia's HTML directly.

   API ref: https://serpapi.com/search-api
     engine=google
     q=<query> site:jumia.com.ng
     gl=ng                       (country code biases ranking)
     hl=en
     num=<n>                     (results per page; max 100)
     api_key=<key>

   Returns:
     organic_results: [{
       title, link, snippet,
       rich_snippet?: {
         bottom?: {
           detected_extensions?: { price?: number, currency?: string },
           extensions?: ["₦X,XXX.00", "In stock" | ...]
         }
       }
     }]

   We KEEP rows that satisfy ALL of:
     - link ends with `.html` (direct product page, not a /slp/
       search-results redirect)
     - rich_snippet.bottom.detected_extensions.price is a number
     - currency parses as NGN (₦ sign or "NGN")

   We DROP rows that look like search-results pages (no price in
   the rich snippet, or URL pattern that says it's a Jumia
   search-results page).

   Image data: NOT available through this path. The DB stores
   image_url=null for Jumia rows ingested this way; the UI falls
   back to gradient + emoji placeholder. A future enhancement
   could fetch the product page's og:image meta tag at ingest time
   (Jumia's per-product pages are usually accessible even when the
   category browse is Cloudflare-walled).

   Cost guard: each call is one SerpAPI credit. The orchestrator
   (scripts/ingest-jumia.ts) caps the per-run call count via a
   curated query list — not a wide category sweep — so a typical
   ingest is ~17 calls, ~$0.085 on a Plus plan. Adjust upward as
   the catalog needs more depth.

   Used by:
     - npm run ingest:jumia  (offline ingest into products + offers)
   ────────────────────────────────────────────────────────────────── */

import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const JUMIA_DOMAIN     = "jumia.com.ng";

/* ── Google organic-result shape (subset we need) ──────────────── */

interface DetectedExtensions {
  price?:        number;
  currency?:     string;
  /* Other fields Google sometimes detects (rating, reviews,
     stock, etc.) — captured implicitly via the object spread but
     not type-narrowed here. */
}

interface RichSnippet {
  bottom?: {
    detected_extensions?: DetectedExtensions;
    extensions?:           string[];
  };
}

interface GoogleOrganicResult {
  position?:      number;
  title?:         string;
  link?:          string;
  snippet?:       string;
  rich_snippet?:  RichSnippet;
  /* Some inline image grid results carry a thumbnail. Most product
     organic results don't. Captured for the rare case it's
     present. */
  thumbnail?:     string;
}

interface GoogleSearchResponse {
  organic_results?: GoogleOrganicResult[];
  error?:           string;
}

/* google_images sub-engine result shape — used to enrich the
   organic-result rows with product images. The `engine=google`
   response doesn't carry images; google_images does, with a
   direct CDN URL under `original`. We do TWO parallel SerpAPI
   calls per ingest query (google + google_images), match by
   canonical Jumia URL, and attach the image. */
interface GoogleImagesResult {
  link?:     string;     // the destination URL (Jumia product page)
  thumbnail?: string;    // SerpAPI proxy (expires; not used)
  original?: string;     // direct image CDN URL (Jumia: ng.jumia.is/...)
  in_stock?: boolean;
}

interface GoogleImagesResponse {
  images_results?: GoogleImagesResult[];
  error?:          string;
}

/* ── Mapping helpers ─────────────────────────────────────────────── */

/* USD-equivalent floor (re-using SerpAPI Google Shopping's table
   for consistency). Jumia is NGN-priced, so we convert to NGN
   floors via a static FX rate. ~₦1600 = $1 baseline; refresh
   quarterly. The floors below catch obvious mis-parsed prices
   (₦5 iPhone, etc.) before they reach the UI. */
const NGN_PER_USD = 1600;
const CATEGORY_NGN_FLOOR: Record<string, number> = {
  phones:      30 * NGN_PER_USD,    // ~₦48K
  computing:   60 * NGN_PER_USD,    // ~₦96K
  electronics: 12 * NGN_PER_USD,    // ~₦19K (incl. former appliances)
  audio:        4 * NGN_PER_USD,    // ~₦6K
  gaming:      12 * NGN_PER_USD,
  fashion:      2 * NGN_PER_USD,
  beauty:       1 * NGN_PER_USD,
  home:         2 * NGN_PER_USD,
  sports:       2 * NGN_PER_USD,
};

/* Same heuristic as the Google Shopping provider — peek at the
   title to assign a floor. Not exhaustive, but covers the
   high-stakes categories where mis-priced rows do the most damage. */
function inferCategoryFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(iphone|galaxy|pixel|tecno|infinix|smartphone|itel)\b/.test(t)) return "phones";
  if (/\b(macbook|laptop|notebook|chromebook|thinkpad|xps|hp pavilion)\b/.test(t)) return "computing";
  if (/\b(ipad|tablet|tab a|tab s)\b/.test(t)) return "computing";
  if (/\b(airpods|headphone|headset|earbuds|earphone|speaker|soundbar)\b/.test(t)) return "audio";
  if (/\b(tv|television|qled|oled)\b/.test(t)) return "electronics";
  if (/\b(playstation|ps5|ps4|xbox|nintendo|switch)\b/.test(t)) return "gaming";
  if (/\b(fridge|washer|dryer|microwave|cooker|oven|generator)\b/.test(t)) return "electronics"; // appliances merged into electronics
  return null;
}

function computeDiscount(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice <= 0 || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

/* Strip leftover Google tracking params from Jumia URLs so the
   stored URL is canonical. `srsltid` is Google's structured-data
   tracking id; removing it keeps `(store_id, url)` unique-key
   stable across runs (different srsltid each crawl → would
   look like a new offer every time). */
function canonicaliseJumiaUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("srsltid");
    u.searchParams.delete("gclid");
    u.searchParams.delete("gad_source");
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    return u.toString();
  } catch {
    return url;
  }
}

/* True when the Google organic-result URL points at a Jumia
   product DETAIL page (ends with .html and includes a numeric
   product id pattern), false for category / search-result pages
   (/slp/, /catalog/, /flash-sales/, etc.) — those don't carry
   product-level price data. */
function isJumiaProductUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(JUMIA_DOMAIN)) return false;
    /* Product pages: /<slug>-<digits>.html.
       Search pages:  /slp/<slug> or /catalog/?q=...
       Stay strict — false positives here introduce price-less
       rows into the catalog. */
    if (!/\.html(\?|$)/i.test(u.pathname + u.search)) return false;
    if (u.pathname.startsWith("/slp/") || u.pathname.startsWith("/catalog/")) return false;
    return true;
  } catch {
    return false;
  }
}

function isNgnCurrency(currency: string | undefined): boolean {
  if (!currency) return false;
  const c = currency.trim();
  /* ₦ glyph, "NGN" code, or "N" prefix all map to NGN. Google
     sometimes returns the Naira sign as a single char, sometimes
     as the ISO code, sometimes as the older N-with-stroke. */
  return c === "₦" || c.toUpperCase() === "NGN" || c === "N";
}

function mapToDeal(
  r: GoogleOrganicResult,
  i: number,
  country: string,
  imageByUrl: Map<string, string>,
): Deal | null {
  const url    = r.link;
  const title  = r.title;
  if (!url || !title) return null;
  if (!isJumiaProductUrl(url)) return null;

  const ext = r.rich_snippet?.bottom?.detected_extensions ?? {};
  const sale = ext.price;
  if (typeof sale !== "number" || sale <= 0) return null;
  if (!isNgnCurrency(ext.currency)) return null;

  /* Plausibility floor — same intent as the Google Shopping
     provider, NGN-denominated. */
  const inferredCat = inferCategoryFromTitle(title);
  const floor = inferredCat ? (CATEGORY_NGN_FLOOR[inferredCat] ?? 500) : 500;
  if (sale < floor) return null;

  /* Stock signal. Google's rich snippet often carries "In stock"
     / "Out of stock" / "Sold out" as an extension string. Drop
     OOS rows from the deals path — the user would land on a Jumia
     page where they can't buy. */
  const exts = r.rich_snippet?.bottom?.extensions ?? [];
  const stockText = exts.join(" ").toLowerCase();
  if (stockText.includes("out of stock") || stockText.includes("sold out")) {
    return null;
  }

  /* Google doesn't surface an "old price" in the organic-result
     rich snippet for Jumia. We can't compute a real discount %
     here. Treat the listing as a current-price snapshot —
     discountPercent=0 — and let downstream surfaces (price
     spectrum, history table) handle the "is this a deal?" call
     when more data arrives.

     This means the FLASH-SALE filter on /deals won't include
     Jumia rows until we get original-price data. The price-
     comparison spectrum across stores still works because it
     ranks by current price relative to other stores. */
  const discountPercent = 0;

  /* Canonical URL — strip Google tracking params so the
     (store_id, url) unique key is stable across runs. Same
     canonicalisation runs on the google_images side, so URL
     keys match between the two responses. */
  const canonicalUrl = canonicaliseJumiaUrl(url);

  /* Image from the parallel google_images call. Key match is
     canonical URL after srsltid + tracking strip. Falls back to
     undefined (gradient + emoji placeholder) when the images
     call returned nothing or failed. */
  const imageUrl = imageByUrl.get(canonicalUrl);

  return {
    id: `serp-jumia-${Date.now().toString(36)}-${i}`,
    title,
    description: title,
    category: "general",
    categorySlug: "all",
    storeId: "jumia",
    storeName: "Jumia",
    originalPrice: sale,    // no MSRP available from this path
    salePrice:     sale,
    discountPercent,
    currency: "NGN",
    imageUrl,
    url: canonicalUrl,
    expiresAt: null,
    isHot: false,
    isFeatured: false,
    /* country:ng tag so filterDealsForCountry keeps this row for
       NG visitors. The intl tag stays OFF — Jumia is NG-anchored,
       not a cross-border global. */
    tags: ["Jumia", `country:${country}`],
    saves: 0,
    clicks: 0,
    postedAt: new Date().toISOString().slice(0, 10),
  };
}

/* ── Provider implementation ──────────────────────────────────────── */

export const jumiaSerpapiProvider: SearchProvider = {
  id: "serpapi-jumia",
  name: "SerpAPI Jumia (Google site-filter)",

  isActive() {
    /* Same kill-switch + key-required pattern as the Google Shopping
       provider (search-serpapi.ts). SERPAPI_DISABLED=true forces
       inactive even when the key is present. */
    if (process.env.SERPAPI_DISABLED === "true") return false;
    return Boolean(process.env.SERPAPI_KEY?.trim());
  },

  async searchDeals(query: SearchQuery): Promise<Deal[]> {
    const apiKey = process.env.SERPAPI_KEY?.trim();
    if (!apiKey) return [];

    const userQuery = query.q.trim();
    if (!userQuery) return [];

    /* country defaults to ng. The provider also accepts other Jumia
       markets via the country param — switches the domain used for
       the site: filter. */
    const country = (query.countryCode ?? "ng").toLowerCase();
    /* Map ISO-2 to Jumia's market domain. NG primary; KE, EG, MA,
       CI, SN, UG also covered (Jumia's known markets). When the
       country doesn't map, fall back to .com.ng — losing some
       Jumia-XX coverage is better than zero ingest. */
    const jumiaDomain = (() => {
      switch (country) {
        case "ke": return "jumia.co.ke";
        case "eg": return "jumia.com.eg";
        case "ma": return "jumia.ma";
        case "ci": return "jumia.ci";
        case "sn": return "jumia.sn";
        case "ug": return "jumia.ug";
        case "ng":
        default:   return "jumia.com.ng";
      }
    })();

    /* Site-filtered query string — reused for both the organic
       (price-bearing) Google call AND the parallel google_images
       call (image-bearing). The site: operator scopes both to
       the same Jumia domain so the image results are matched to
       the same product set. */
    const siteFilteredQuery = `${userQuery} site:${jumiaDomain}`;

    const googleUrl = new URL(SERPAPI_ENDPOINT);
    googleUrl.searchParams.set("engine", "google");
    googleUrl.searchParams.set("q", siteFilteredQuery);
    googleUrl.searchParams.set("gl", country);
    googleUrl.searchParams.set("hl", "en");
    googleUrl.searchParams.set("num", "30");
    googleUrl.searchParams.set("api_key", apiKey);

    const imagesUrl = new URL(SERPAPI_ENDPOINT);
    imagesUrl.searchParams.set("engine", "google_images");
    imagesUrl.searchParams.set("q", siteFilteredQuery);
    imagesUrl.searchParams.set("gl", country);
    imagesUrl.searchParams.set("hl", "en");
    imagesUrl.searchParams.set("api_key", apiKey);

    /* Two SerpAPI calls per query, run in parallel:
         google → prices (rich_snippet.detected_extensions)
         google_images → image URLs (results[].original)
       Merge by canonical Jumia URL. The images call adds one
       SerpAPI credit per query, doubling per-query cost (~$0.005)
       — net ingest cost still well within plan budget given the
       29-query curated list. Images call wrapped in Promise.all
       Settled so a failed images request doesn't kill the run;
       we degrade to imageless rows when that branch fails. */
    const [googleSettled, imagesSettled] = await Promise.allSettled([
      fetch(googleUrl.toString(), { next: { revalidate: 600 } }),
      fetch(imagesUrl.toString(), { next: { revalidate: 600 } }),
    ]);

    if (googleSettled.status === "rejected") {
      throw new ProviderError(this.id, "Network error contacting SerpAPI", googleSettled.reason);
    }
    const res = googleSettled.value;
    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new ProviderError(
        this.id,
        `SerpAPI HTTP ${res.status}: ${body.slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as GoogleSearchResponse;
    if (data.error) {
      if (/hasn't returned any results/i.test(data.error)) return [];
      throw new ProviderError(this.id, data.error);
    }

    /* Build URL → image map from google_images results. We strip
       Google's `srsltid` + tracking params via canonicaliseJumiaUrl
       so the URL keys agree across the google and google_images
       responses (Google generates different srsltid tokens per
       engine + per request). Failures here non-fatal — degrade
       to imageless rows. */
    const imageByUrl = new Map<string, string>();
    if (imagesSettled.status === "fulfilled" && imagesSettled.value.ok) {
      try {
        const imagesJson = await imagesSettled.value.json() as GoogleImagesResponse;
        for (const img of imagesJson.images_results ?? []) {
          if (!img.link || !img.original) continue;
          const canon = canonicaliseJumiaUrl(img.link);
          /* First image wins. Google often returns multiple variant
             images for the same product page; the first is usually
             the primary listing photo. */
          if (!imageByUrl.has(canon)) imageByUrl.set(canon, img.original);
        }
      } catch { /* silent — imageless fallback */ }
    }

    const results = data.organic_results ?? [];
    const limit = query.limit ?? 24;

    const mapped = results
      .map((r, i) => mapToDeal(r, i, country, imageByUrl))
      .filter((d): d is Deal => d !== null);

    return mapped.slice(0, limit);
  },
};
