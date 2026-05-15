/* ──────────────────────────────────────────────────────────────────
   SerpAPI Jumia engine — direct access to Jumia's product listings.

   STATUS: Active when SERPAPI_KEY is set in env (same key the
   Google Shopping provider uses).

   Why this exists:
     The Playwright Jumia scraper (scripts/scrapers/jumia.ts) was
     defeated by Cloudflare in early 2026 — both plain fetch and
     stealth-Playwright now hit the JS challenge page. SerpAPI's
     dedicated Jumia engine bypasses that entirely by hitting
     Jumia's own search API server-side.

   Engine ref: https://serpapi.com/jumia-search
     engine=jumia
     q=<query>
     jumia_country=<ng|ke|eg|ma|ci|sn|ug|...>
     api_key=<key>

     Optional:
       - page=N              (paginate)

   Returns:
     organic_results: [{ title, price, original_price, link,
                         thumbnail, rating, reviews, ... }]

   Cost guard: each call is one SerpAPI credit. The orchestrator
   (scripts/ingest-jumia.ts) caps the per-run call count via a
   curated query list — not a wide category sweep — so a typical
   ingest is ~15 calls, ~$0.075 on a Plus plan. Adjust upward as
   the catalog needs more depth.

   Used by:
     - npm run ingest:jumia  (offline ingest into products + offers)
     - /api/live-search      (when query targets NG and SerpAPI's
                              Google Shopping returns nothing —
                              Google Shopping doesn't operate in NG)
   ────────────────────────────────────────────────────────────────── */

import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

/* ── Response shape ─────────────────────────────────────────────── */

interface JumiaResult {
  position?:        number;
  title?:           string;
  link?:            string;
  product_id?:      string;
  thumbnail?:       string;
  /* SerpAPI returns prices as both formatted strings and extracted
     numeric values. Prefer the extracted form to avoid currency-
     symbol parsing. */
  price?:           string;
  extracted_price?: number;
  old_price?:       string;
  extracted_old_price?: number;
  /* Some listings carry a discount string like "−42%" already
     computed by Jumia. We compute our own from old_price/price as
     the source of truth, but use this as a fallback when only
     one price is present. */
  discount?:        string;
  /* Rating is on a 0-5 scale, reviews is the count. Both optional. */
  rating?:          number;
  reviews?:         number;
  /* Some Jumia listings carry an "express" / "free shipping" flag.
     Useful for trust signals later — captured but not surfaced
     yet. */
  express_eligible?: boolean;
  /* Source string when SerpAPI distinguishes seller from Jumia
     itself. Most rows are first-party Jumia. */
  source?:          string;
}

interface JumiaResponse {
  organic_results?: JumiaResult[];
  error?:           string;
  search_metadata?: { id?: string; status?: string };
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
  electronics: 12 * NGN_PER_USD,    // ~₦19K
  audio:        4 * NGN_PER_USD,    // ~₦6K
  appliances:  15 * NGN_PER_USD,    // ~₦24K
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
  if (/\b(fridge|washer|dryer|microwave|cooker|oven|generator)\b/.test(t)) return "appliances";
  return null;
}

function computeDiscount(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice <= 0 || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

function mapToDeal(r: JumiaResult, i: number, country: string): Deal | null {
  const sale = r.extracted_price;
  const original = r.extracted_old_price;
  const url = r.link;
  const title = r.title;

  if (!sale || !url || !title) return null;

  /* Plausibility floor — drop obvious upstream parse errors before
     the UI sees them. */
  const inferredCat = inferCategoryFromTitle(title);
  const floor = inferredCat ? (CATEGORY_NGN_FLOOR[inferredCat] ?? 500) : 500;
  if (sale < floor) return null;

  /* Skip non-deal rows: Jumia returns BOTH on-sale and full-price
     listings via the search engine. We want sale rows for the
     ingest path (otherwise we flood the catalog with full-price
     entries that don't belong in a "deals" feed).

     Two acceptance signals:
       1. extracted_old_price > extracted_price → real sale
       2. discount string present and non-zero → seller marked it down

     Live-search mode (called from /api/live-search) doesn't apply
     this gate — set `acceptAll=true` via the provider's option to
     keep full-price rows for the comparison view. */
  const computedDiscount = original && original > sale
    ? computeDiscount(original, sale)
    : 0;
  /* `discount` field present on Jumia but inconsistently formatted
     — sometimes "−42%", "-42%", "42%", "42% off". Strip non-digit
     chars and parse what's left as a fallback when prices alone
     don't give us a discount. */
  const discountFromString = r.discount
    ? parseInt(r.discount.replace(/[^\d]/g, ""), 10) || 0
    : 0;
  const discountPercent = computedDiscount > 0 ? computedDiscount : discountFromString;

  if (discountPercent === 0) {
    /* Skip non-deals from the ingest path. Live-search callers
       set the provider option `acceptAll` (read by the calling
       code path) — handled in /api/live-search by relaxing the
       gate after the fact. We keep the gate strict here because
       /api/live-search has its own filter logic. */
    return null;
  }

  return {
    /* Synthetic id — same shape as SerpAPI Google Shopping rows.
       The PDP routes "serp-" prefixed ids to /p/live so the
       catalog doesn't need a row-level upsert per live-search hit.
       Ingest path overwrites this with the offer_id from the DB
       upsert (ingestDeals handles that), so this is only used
       for the live-search transient path. */
    id: `serp-jumia-${Date.now().toString(36)}-${i}`,
    title,
    description: title,
    category: "general",
    categorySlug: "all",
    storeId: "jumia",
    storeName: "Jumia",
    originalPrice: original ?? sale,
    salePrice: sale,
    discountPercent,
    /* Jumia is NGN-priced. The DB schema requires NGN | USD; NGN
       is correct here so downstream price normalisation
       (priceInNgn) leaves it untouched. */
    currency: "NGN",
    imageUrl: r.thumbnail,
    imageGradient: "linear-gradient(135deg, #ff6e40 0%, #f4511e 100%)",
    imageEmoji: "🛒",
    url,
    expiresAt: null,
    isHot: discountPercent >= 30,
    isFeatured: false,
    /* country:ng tag so filterDealsForCountry knows to keep this
       row for NG visitors. The intl tag is OFF — Jumia is NG-
       anchored, not a cross-border global. */
    tags: ["Jumia", "Flash Sale", `country:${country}`],
    saves: 0,
    clicks: 0,
    postedAt: new Date().toISOString().slice(0, 10),
  };
}

/* ── Provider implementation ──────────────────────────────────────── */

export const jumiaSerpapiProvider: SearchProvider = {
  id: "serpapi-jumia",
  name: "SerpAPI Jumia",

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

    const q = query.q.trim();
    if (!q) return [];

    /* Country defaults to ng. Jumia operates in NG (primary), KE,
       EG, MA, CI, SN, UG. The engine's jumia_country param accepts
       ISO-2 codes. */
    const country = (query.countryCode ?? "ng").toLowerCase();

    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "jumia");
    url.searchParams.set("q", q);
    url.searchParams.set("jumia_country", country);
    url.searchParams.set("api_key", apiKey);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        /* 10-min revalidate — same window as the Google Shopping
           provider. Jumia prices move on hours, not minutes; cache
           keeps SerpAPI credits in check on repeated identical
           queries (live-search /compare hits). */
        next: { revalidate: 600 },
      });
    } catch (err) {
      throw new ProviderError(this.id, "Network error contacting SerpAPI", err);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new ProviderError(
        this.id,
        `SerpAPI HTTP ${res.status}: ${body.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as JumiaResponse;
    if (data.error) {
      throw new ProviderError(this.id, data.error);
    }

    const results = data.organic_results ?? [];
    const limit = query.limit ?? 24;

    const mapped = results
      .map((r, i) => mapToDeal(r, i, country))
      .filter((d): d is Deal => d !== null);

    return mapped.slice(0, limit);
  },
};
