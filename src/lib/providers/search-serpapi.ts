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

/* Canonicalise the raw source string SerpAPI returns BEFORE it flows
   into both storeId and storeName. Google Shopping returns the same
   merchant under several spellings — e.g. "Amazon.co.uk", "Amazon UK",
   "Amazon.co.uk - Amazon.co.uk-Seller" — each producing a different
   storeId via inferStoreId() below, and therefore a separate row in
   the stores table. The UK "local" pool ended up with 35% of its
   deals split across three Amazon-UK variants (per the post-launch
   inventory audit), inflating Amazon's apparent dominance and
   thinning the perceived diversity of UK retailers.

   This normaliser collapses Amazon's country variants to one
   canonical name + ID per market. Other merchant collapses (e.g.
   John Lewis & Partners → John Lewis) can be added here too —
   keep the prefix tests case-insensitive and ordered most-specific
   first. */
function canonicaliseSource(raw: string): string {
  const lc = raw.toLowerCase().trim();

  /* Amazon — collapse all known variants per market.
     Order matters: ".co.uk" is more specific than bare "amazon",
     same for ".de" / ".ae" / ".in". The bare "amazon" / "amazon.com"
     branches sit last so they don't swallow the others. */
  if (lc.startsWith("amazon.co.uk") || lc.startsWith("amazon uk") ||
      lc === "amazon.co.uk-seller" || lc.includes("amazon.co.uk-seller")) {
    return "Amazon UK";
  }
  if (lc.startsWith("amazon.de") || lc.startsWith("amazon germany") || lc === "amazon de") {
    return "Amazon Germany";
  }
  if (lc.startsWith("amazon.ae") || lc.startsWith("amazon uae") || lc === "amazon ae") {
    return "Amazon UAE";
  }
  if (lc.startsWith("amazon.in") || lc.startsWith("amazon india") || lc === "amazon in") {
    return "Amazon India";
  }
  if (lc.startsWith("amazon.ca") || lc.startsWith("amazon canada")) {
    return "Amazon Canada";
  }
  if (lc === "amazon" || lc === "amazon.com" || lc.startsWith("amazon.com -") ||
      lc.startsWith("amazon.com seller") || lc.startsWith("amazon - amazon")) {
    return "Amazon";
  }

  /* JD Sports — Google Shopping returns "JD Sports - Global" for the
     international shipping arm, and would create a separate store
     row from "JD Sports". Same retailer, same logo, same affiliate
     network — collapse to one. */
  if (lc.startsWith("jd sports") || lc.startsWith("jdsports")) {
    return "JD Sports";
  }

  /* Currys — "Currys Business" is the B2B subdomain. Stocks the same
     catalogue at the same prices for retail buyers; the B2B framing
     is purely a different checkout flow. Collapsing keeps the UK
     pool cleaner. */
  if (lc.startsWith("currys")) {
    return "Currys";
  }

  /* John Lewis — "John Lewis & Partners" is the rebranded name; the
     same retailer also appears as bare "John Lewis" from older
     SerpAPI snapshots. Collapse to the current trading name. */
  if (lc.startsWith("john lewis")) {
    return "John Lewis & Partners";
  }

  return raw;
}

function inferStoreId(source: string): string {
  /* Canonical short IDs for Amazon marketplaces so the slugifier
     doesn't produce amazon-germany / amazon-uae / amazon-india /
     amazon-canada (the verbose forms canonicaliseSource emits for
     human-readable display names). Without this, every cron run
     re-creates the verbose-named store_id rows that migration 0033
     consolidates — and the DB drifts back to a fragmented state.
     Re-audit May 2026 launch-readiness pass caught this exact
     regression: amazon-germany + amazon-india reappeared after one
     cron run despite 0033 having run.

     The map mirrors what migration 0033 + the roster expansion in
     country.ts treat as canonical: amazon-uk / amazon-de / amazon-ae
     / amazon-in / amazon-ca / amazon. */
  const lc = source.toLowerCase().trim();
  switch (lc) {
    case "amazon uk":
    case "amazon.co.uk":          return "amazon-uk";
    case "amazon germany":
    case "amazon.de":
    case "amazon de":             return "amazon-de";
    case "amazon uae":
    case "amazon.ae":
    case "amazon ae":             return "amazon-ae";
    case "amazon india":
    case "amazon.in":
    case "amazon in":             return "amazon-in";
    case "amazon canada":
    case "amazon.ca":
    case "amazon ca":             return "amazon-ca";
    case "amazon":
    case "amazon.com":            return "amazon";
  }

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

/* Per-country Google domain. Critical for non-English markets — `gl`
   alone tells Google Shopping the user's COUNTRY but routes through
   google.com by default, which biases the index toward US/UK inventory.
   `google_domain` actually routes through the country-specific Google
   index (google.de for Germany, google.co.za for South Africa, etc.)
   which surfaces local-merchant inventory Google.com doesn't.

   Audit May 2026 launch-readiness pass: DE/AE/IN/ZA were returning
   2-3 stores' worth of inventory each because the SerpAPI ingest was
   hitting google.com instead of country-routed domains. Setting
   google_domain.de for the DE ingest pulls MediaMarkt / Saturn / Otto
   / Conrad rows that google.com simply doesn't surface for Eurozone
   queries.

   List from https://serpapi.com/google-domains. Coverage: every
   country we support. Verified live May 2026 against SerpAPI's
   country-domain table. */
const GOOGLE_DOMAIN_BY_COUNTRY: Record<string, string> = {
  us: "google.com",
  uk: "google.co.uk", gb: "google.co.uk",
  ca: "google.ca", au: "google.com.au", nz: "google.co.nz",
  de: "google.de", fr: "google.fr", es: "google.es", it: "google.it",
  nl: "google.nl", be: "google.be", at: "google.at", ch: "google.ch",
  ie: "google.ie", pt: "google.pt", se: "google.se", no: "google.no",
  dk: "google.dk", fi: "google.fi", pl: "google.pl", cz: "google.cz",
  ro: "google.ro", tr: "google.com.tr",
  in: "google.co.in", jp: "google.co.jp",
  br: "google.com.br", mx: "google.com.mx", ar: "google.com.ar",
  cl: "google.cl", co: "google.com.co",
  za: "google.co.za", ae: "google.ae", sa: "google.com.sa",
  hk: "google.com.hk", sg: "google.com.sg", my: "google.com.my",
  th: "google.co.th", id: "google.co.id", ph: "google.com.ph",
  vn: "google.com.vn", tw: "google.com.tw", kr: "google.co.kr",
};

/* Per-country interface language. Mostly stays "en" because:
   - Our query strings are in English ("iphone 15 pro max deals")
   - English listings are the most cross-merchant comparable
   - We don't translate the UI on the receiving end

   Exception: DE specifically benefits from hl=de — German shoppers
   search Google in German, so the Google Shopping index is more
   complete in German for products like home appliances, books,
   household goods where the German title differs significantly
   from the English one (Spülmaschine vs dishwasher). For other
   non-English markets (AE, IN, ZA) English is the lingua franca of
   commerce, so en is fine. */
const HL_BY_COUNTRY: Record<string, string> = {
  de: "de",
  // every other supported country uses default "en"
};

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
    `[serpapi-shopping] Country "${cc}" not supported by Google Shopping - falling back to "${FALLBACK_COUNTRY}"`,
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
  /* Prefer `link` (direct merchant URL) over `product_link` (Google
     Shopping relay). Was the wrong way around — the May 2026 UK
     retailer ingest landed 100+ Currys / John Lewis / Argos / Very
     rows in the DB but EVERY ONE of them got a Google relay URL
     because we picked product_link first. browse-db's
     isUsableMerchantUrl filter then dropped them all (correctly —
     they would land users on a Google search page, not the
     merchant). The diagnostic showed 0 UK retailer rows in the pool
     even though the ingest reported 68 successful upserts.

     SerpAPI returns `link` as the direct merchant URL when it can
     extract one from the Google Shopping result; `product_link` is
     always Google's tracking-wrapped URL. Picking link first means
     direct merchant URLs go through cleanly and only the unresolved
     cases fall back to the relay+/api/go path. */
  const url = r.link ?? r.product_link;
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

  /* Canonicalise the merchant string BEFORE deriving both ID and
     display name. See canonicaliseSource() at the top of this file
     for the why — without this, "Amazon UK" and "Amazon.co.uk -
     Amazon.co.uk-Seller" produce two separate store rows and the
     UK local pool double-counts Amazon. */
  const canonicalStore = canonicaliseSource(store);
  const storeId = inferStoreId(canonicalStore);

  return {
    id: `serp-${Date.now().toString(36)}-${i}`,
    title,
    description: title,
    category: "general",
    categorySlug: "all",
    storeId,
    storeName: canonicalStore,
    originalPrice: original,
    salePrice: sale,
    discountPercent,
    currency: "USD",
    imageUrl: r.thumbnail,
    url: finalUrl,
    expiresAt: null,
    isHot: discountPercent >= 30,
    isFeatured: false,
    // Country tag lets us know which market this came from later
    tags: [store, "live", `country:${country}`],
    saves: 0,
    clicks: 0,
    postedAt: new Date().toISOString().slice(0, 10),
    /* Google Shopping's cross-merchant product_id. Comes free with
       every shopping-search response — was previously discarded,
       now flowed through to ingestion so two stores selling the
       same Google-canonicalised product collapse to one
       products.id without needing to agree on the title (huge win
       for cross-store comparison recall — see
       isLikelySameProduct's identifier fast-path). */
    googleShoppingId: r.product_id || undefined,
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

    /* Query strategy depends on mode:
         - "deals" (default): append "deals" suffix to bias Google Shopping
           toward sale-tagged results. Skip suffix for branded queries
           where Google's relevance is already strong (adding "deals" to
           "iphone 15 pro" dilutes the brand signal).
         - "market": drop the suffix entirely. We want broader catalogue
           coverage including full-price listings, so the spectrum on
           PDPs and the alternatives rail reflect honest market range,
           not just whatever's on promo right now.

       tbs=mr:1 (sort by recency) is kept for deals mode but DROPPED
       for market mode — recency biases toward fresh promos, which is
       the opposite of what market mode wants. */
    const mode = query.mode ?? "deals";
    const isBrandedQuery = /\b(airpods?|iphone|ipad|macbook|galaxy|playstation|ps[45]|xbox|airmax|jordan|yeezy|samba|dunk)\b/i.test(q);
    const alreadyHasDealKeyword = /deal|sale|discount|offer/i.test(q);
    const effectiveQuery = mode === "market"
      ? q
      : (isBrandedQuery || alreadyHasDealKeyword ? q : `${q} deals`);

    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", effectiveQuery);
    url.searchParams.set("gl", country);
    /* google_domain routes through the country-specific Google index.
       Without this every query hits google.com (which biases toward
       US/UK inventory) — even when gl=de. Added May 2026 launch-
       readiness pass after the audit caught DE/AE/IN/ZA pools at
       2-3 stores each. Falls back to google.com for the (now
       impossible) case where a SUPPORTED_GL country doesn't have a
       google_domain entry — defensive only. */
    url.searchParams.set("google_domain", GOOGLE_DOMAIN_BY_COUNTRY[country] ?? "google.com");
    url.searchParams.set("hl", HL_BY_COUNTRY[country] ?? "en");
    url.searchParams.set("api_key", apiKey);
    if (mode === "deals") {
      /* recency sort — helps surface fresher promotions */
      url.searchParams.set("tbs", "mr:1");
    }

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
