/* SerpAPI Google Shopping provider — live product search.
   Activates when SERPAPI_KEY is set in env.
   Docs: https://serpapi.com/google-shopping-api */

import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

interface SerpShoppingResult {
  position?: number;
  title?: string;
  link?: string;
  product_link?: string;
  source?: string;          // store name (e.g. "Jumia", "Amazon.com")
  price?: string;           // formatted (e.g. "₦47,000.00")
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  product_id?: string;
  serpapi_product_api?: string;
  delivery?: string;
  tag?: string;             // e.g. "SALE", "BEST MATCH"
}

interface SerpResponse {
  shopping_results?: SerpShoppingResult[];
  error?: string;
  search_metadata?: { google_shopping_url?: string };
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function inferStoreId(source: string): string {
  return source
    .toLowerCase()
    .replace(/\.(com|ng|co|uk|net|org)(\.[a-z]{2})?$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* Countries Google Shopping operates in.
   Source: https://support.google.com/merchants/answer/160637
   If unsupported, falls back to "us" with a warning. */
const SUPPORTED_GL = new Set([
  "us", "uk", "gb", "ca", "au", "de", "fr", "es", "it", "nl", "be",
  "at", "ch", "se", "no", "dk", "fi", "pl", "cz", "in", "jp", "br",
  "mx", "ar", "cl", "co", "ie", "pt", "ro", "tr", "za", "nz",
  "ae", "sa", "hk", "sg", "my", "th", "id", "ph", "vn", "tw", "kr",
]);

const FALLBACK_COUNTRY = "us";

/* Approximate FX → USD. Used to normalise prices across markets so the
   `offers.current_price` column is always comparable in USD.
   These are static — refresh quarterly or wire a real FX feed later. */
const FX_TO_USD: Record<string, number> = {
  us: 1.00,
  uk: 1.27, gb: 1.27,
  ca: 0.73, au: 0.66, nz: 0.61,
  // Eurozone (one rate)
  de: 1.08, fr: 1.08, es: 1.08, it: 1.08, nl: 1.08, be: 1.08,
  at: 1.08, ie: 1.08, pt: 1.08, fi: 1.08,
  // Other
  ch: 1.13, se: 0.094, no: 0.092, dk: 0.144, pl: 0.247, cz: 0.043,
  in: 0.012, jp: 0.0064, br: 0.18, mx: 0.054, ar: 0.0011, cl: 0.001,
  co: 0.00024, ro: 0.218, tr: 0.029, za: 0.054,
  ae: 0.272, sa: 0.267, hk: 0.128, sg: 0.74, my: 0.21, th: 0.028,
  id: 0.000061, ph: 0.018, vn: 0.000039, tw: 0.031, kr: 0.00071,
};

function resolveCountry(requested: string | undefined): { country: string; warned: boolean } {
  const cc = (requested ?? FALLBACK_COUNTRY).toLowerCase();
  if (SUPPORTED_GL.has(cc)) return { country: cc, warned: false };
  console.warn(
    `[serpapi-shopping] Country "${cc}" not supported by Google Shopping — falling back to "${FALLBACK_COUNTRY}"`,
  );
  return { country: FALLBACK_COUNTRY, warned: true };
}

/** Convert a native price into USD using static FX. Returns rounded to 2dp. */
function toUSD(nativePrice: number, country: string): number {
  const rate = FX_TO_USD[country] ?? 1;
  return Math.round(nativePrice * rate * 100) / 100;
}

function computeDiscount(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice <= 0 || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

/* USD-equivalent floors per category — same intent as the NGN floors in
   pg-fts.ts, but applied to live SerpAPI results before they reach the UI.
   Anything below the floor is upstream parsing error or scammy listing. */
const CATEGORY_USD_FLOOR: Record<string, number> = {
  phones:      30,    // ~₦40K
  computing:   60,    // ~₦80K
  electronics: 12,    // ~₦15K
  audio:       4,     // ~₦5K
  appliances:  15,    // ~₦20K
  gaming:      12,
  fashion:     2,
  beauty:      1,
  home:        2,
  sports:      2,
};

/* Shaky heuristic: infer category from the title for the floor check.
   Better than nothing — catches the desertcart-iPhone-for-$5 case. */
function inferCategoryFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(iphone|galaxy|pixel|tecno|infinix|smartphone)\b/.test(t)) return "phones";
  if (/\b(macbook|laptop|notebook|chromebook|thinkpad|xps)\b/.test(t)) return "computing";
  if (/\b(ipad|tablet|tab a|tab s)\b/.test(t)) return "computing";
  if (/\b(airpods|headphone|headset|earbuds|earphone|speaker)\b/.test(t)) return "audio";
  if (/\b(tv|television|qled|oled)\b/.test(t)) return "electronics";
  if (/\b(playstation|ps5|ps4|xbox|nintendo|switch)\b/.test(t)) return "gaming";
  if (/\b(fridge|washer|dryer|microwave)\b/.test(t)) return "appliances";
  return null;
}

/* True if the URL points at Google's own Shopping product page rather
   than the merchant. SerpAPI's `link` and `product_link` for sponsored
   ads + many organic listings relay through Google — clicking lands
   the user on a Google product card, not the actual store. */
function isGoogleRelayUrl(u: string): boolean {
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host === "google.com" || host.endsWith(".google.com");
  } catch {
    return false;
  }
}

function mapToDeal(r: SerpShoppingResult, i: number, country: string): Deal | null {
  const saleNative = r.extracted_price;
  const originalNative = r.extracted_old_price;     // undefined ⇒ not on sale
  const url = r.product_link ?? r.link;
  const store = r.source;
  const title = r.title;

  if (!saleNative || !url || !store || !title) return null;

  /* Google-relay URLs go through /api/go at click time so the user
     lands on the merchant (resolver hits SerpAPI's product endpoint
     once, caches in resolved_clicks for 30 days, then 307s).
     Direct merchant URLs pass through unchanged — no overhead. */
  const finalUrl = isGoogleRelayUrl(url)
    ? `/api/go?url=${encodeURIComponent(url)}`
    : url;

  // Skip non-deals: this is a *deals* page, not a generic product feed.
  // We require either an explicit old_price OR a SALE tag from Google.
  const hasSaleTag = (r.tag ?? "").toLowerCase().includes("sale");
  if (!originalNative && !hasSaleTag) return null;

  // Normalise to USD so prices across markets are comparable
  const sale = toUSD(saleNative, country);
  const original = toUSD(originalNative ?? saleNative, country);
  const discountPercent = computeDiscount(original, sale);

  // After USD rounding, a "fake" discount can collapse to 0 — drop those too
  if (discountPercent === 0 && !hasSaleTag) return null;

  // Reject implausibly-low prices — same logic as pg-fts dupe filter,
  // applied here before the UI sees the data.
  const inferredCat = inferCategoryFromTitle(title);
  const floor: number = inferredCat ? (CATEGORY_USD_FLOOR[inferredCat] ?? 0.5) : 0.5;
  if (sale < floor) return null;

  const storeId = inferStoreId(store);

  return {
    id: `serp-${Date.now().toString(36)}-${i}`,
    title,
    description: title,
    category: "general",
    categorySlug: "all",
    storeId,
    storeName: store,
    originalPrice: original,
    salePrice: sale,
    discountPercent,
    currency: "USD",
    imageUrl: r.thumbnail,
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    imageEmoji: "🛍️",
    url: finalUrl,
    expiresAt: null,
    isHot: discountPercent >= 30,
    isFeatured: false,
    // Country tag lets us know which market this came from later
    tags: [store, "live", `country:${country}`],
    saves: 0,
    clicks: 0,
    postedAt: new Date().toISOString().slice(0, 10),
  };
}

/* ── Provider implementation ──────────────────────────────────────── */

export const serpapiSearchProvider: SearchProvider = {
  id: "serpapi-shopping",
  name: "SerpAPI Google Shopping",

  isActive() {
    /* Kill switch: SERPAPI_DISABLED=true forces this provider off even
       when SERPAPI_KEY is present. Use case: credits exhausted and we
       don't want to pay right now, but we don't want to delete the
       integration either. Flipping the env var back (or removing it)
       re-enables on next deploy.

       Why a kill switch instead of just unsetting SERPAPI_KEY: keeps
       the key in Vercel envs so it's not lost. Many ops accidentally
       lose API keys when they "temporarily" remove them. */
    if (process.env.SERPAPI_DISABLED === "true") return false;
    return Boolean(process.env.SERPAPI_KEY?.trim());
  },

  async searchDeals(query: SearchQuery): Promise<Deal[]> {
    const apiKey = process.env.SERPAPI_KEY?.trim();
    if (!apiKey) return [];   // Inactive — caller falls back to other providers

    const q = query.q.trim();
    if (!q) return [];

    const { country } = resolveCountry(query.countryCode);

    /* Append "deals" to bias Google Shopping toward sale-tagged results,
       BUT skip the suffix for highly-branded queries where Google's
       relevance is already strong (e.g. "airpods max", "iphone 15 pro").
       Adding "deals" to those dilutes the brand signal. */
    const isBrandedQuery = /\b(airpods?|iphone|ipad|macbook|galaxy|playstation|ps[45]|xbox|airmax|jordan|yeezy|samba|dunk)\b/i.test(q);
    const alreadyHasDealKeyword = /deal|sale|discount|offer/i.test(q);
    const dealsQuery = isBrandedQuery || alreadyHasDealKeyword ? q : `${q} deals`;

    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", dealsQuery);
    url.searchParams.set("gl", country);
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", apiKey);
    /* tbs=mr:1 sorts by recency; helps surface fresher promotions */
    url.searchParams.set("tbs", "mr:1");

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        // 10-minute revalidate — keeps Google Shopping fresh without hammering credits
        next: { revalidate: 600 },
      });
    } catch (err) {
      throw new ProviderError(this.id, "Network error contacting SerpAPI", err);
    }

    if (!res.ok) {
      // Capture body so we can see WHY SerpAPI rejected us (bad gl, bad query, quota, etc.)
      const body = await res.text().catch(() => "<no body>");
      throw new ProviderError(
        this.id,
        `SerpAPI HTTP ${res.status}: ${body.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as SerpResponse;
    if (data.error) {
      throw new ProviderError(this.id, data.error);
    }

    const results = data.shopping_results ?? [];
    const limit = query.limit ?? 24;

    // Map then filter — keep limit applied to *kept* results, not raw
    const mapped = results
      .map((r, i) => mapToDeal(r, i, country))
      .filter((d): d is Deal => d !== null);

    return mapped.slice(0, limit);
  },
};
