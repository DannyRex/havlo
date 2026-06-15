/* ──────────────────────────────────────────────────────────────────
   SerpAPI Amazon-engine provider — INGEST-ONLY.

   Unlike search-serpapi.ts (engine=google_shopping), this hits SerpAPI's
   dedicated `engine=amazon`, which returns the actual Amazon marketplace
   catalogue for a keyword. Every result already belongs to the queried
   marketplace, so the store is KNOWN per request — no source-string
   inference, no canonicalisation. We just stamp the marketplace's
   canonical store (amazon-us / amazon-uk / amazon-ae / amazon-in).

   WHY ingest-only (NOT registered in SEARCH_PROVIDERS): the live-search
   fan-out fires a credit per active provider per user query. Amazon's
   value here is catalogue DEPTH for cross-store comparison, which a
   scheduled cron delivers without taxing every interactive search. It is
   driven by scripts/ingest-amazon-serpapi.ts on the paid cron.

   Replaces the retired PA-API path (search-amazon.ts, engine deprecated
   May 2026). Docs: https://serpapi.com/amazon-search-api
   ────────────────────────────────────────────────────────────────── */

import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

/* country code → Amazon marketplace config. Only the marketplaces SerpAPI's
   amazon engine SUPPORTS and we serve:
     - ZA omitted: SerpAPI returns "Unsupported `amazon.co.za` Amazon domain".
     - DE omitted: deferred launch (middleware 307s /de/* → /uk/*).
     - NG omitted: Amazon has no Nigerian marketplace.
   fxToUsd mirrors the static native→USD rates in search-serpapi.ts so both
   SerpAPI lanes store comparable USD prices (all Amazon offers are USD in
   the offers table, by long-standing convention). Refresh quarterly. */
export interface AmazonMarketplace {
  countryCode:  string;   // ISO-2 lower, the SearchQuery.countryCode
  amazonDomain: string;
  storeId:      string;
  storeName:    string;
  storeCountry: string;   // stores.country (the real anchor) — Amazon is LOCAL where it has a marketplace
  fxToUsd:      number;
}

export const AMAZON_MARKETPLACES: Record<string, AmazonMarketplace> = {
  us: { countryCode: "us", amazonDomain: "amazon.com",   storeId: "amazon-us", storeName: "Amazon US",    storeCountry: "US", fxToUsd: 1.00  },
  uk: { countryCode: "uk", amazonDomain: "amazon.co.uk", storeId: "amazon-uk", storeName: "Amazon UK",    storeCountry: "UK", fxToUsd: 1.27  },
  ae: { countryCode: "ae", amazonDomain: "amazon.ae",    storeId: "amazon-ae", storeName: "Amazon UAE",   storeCountry: "AE", fxToUsd: 0.272 },
  in: { countryCode: "in", amazonDomain: "amazon.in",    storeId: "amazon-in", storeName: "Amazon India", storeCountry: "IN", fxToUsd: 0.012 },
};

/** The marketplace codes the Amazon ingest covers, in display order. */
export const AMAZON_MARKETPLACE_CODES = Object.keys(AMAZON_MARKETPLACES);

/* One organic Amazon search result (SerpAPI engine=amazon shape, verified
   live June 2026). Only the fields we map are typed. */
interface AmazonOrganicResult {
  position?: number;
  asin?: string;
  title?: string;
  /** Tracking-wrapped URL — carries a per-run `qid` that changes every
      request, so it is NOT stable for the (store_id, url) upsert key. */
  link?: string;
  /** Canonical `/dp/ASIN/` URL with the tracking params stripped — STABLE
      across runs, so this is the offer URL we persist. */
  link_clean?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  brand?: string;
  price?: string;             // formatted, e.g. "$119.99"
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  sponsored?: boolean | null; // ad placement — skipped (often an off-target upsell)
}

interface AmazonResponse {
  organic_results?: AmazonOrganicResult[];
  error?: string;
}

/** Convert a native marketplace price into USD. Returns rounded to 2dp. */
function toUSD(nativePrice: number, fxToUsd: number): number {
  return Math.round(nativePrice * fxToUsd * 100) / 100;
}

/* Last-ditch price parser for the rare row where SerpAPI omits
   extracted_price but gives the formatted `price` string. Strips any
   currency symbol / thousands separators and reads the first number. */
function parseNativePrice(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.replace(/[,\s]/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function computeDiscount(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice <= 0 || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

/* Prefer the stable link_clean. Fall back to `link` with its query string
   stripped so a changing `qid` can't spawn a duplicate offer each run. */
function stableUrl(r: AmazonOrganicResult): string | undefined {
  if (r.link_clean) return r.link_clean;
  if (!r.link) return undefined;
  try {
    const u = new URL(r.link);
    return `${u.origin}${u.pathname}`;
  } catch {
    return r.link.split("?")[0] || undefined;
  }
}

function mapToDeal(
  r: AmazonOrganicResult,
  i: number,
  mk: AmazonMarketplace,
  keepFullPrice: boolean,
): Deal | null {
  // Sponsored rows are ad placements — frequently an unrelated upsell for
  // the keyword (a phone case under "anker powerbank"). Keep the catalogue
  // clean and skip them.
  if (r.sponsored === true) return null;

  const saleNative = r.extracted_price ?? parseNativePrice(r.price);
  const originalNative = r.extracted_old_price ?? parseNativePrice(r.old_price);
  const url = stableUrl(r);
  const title = r.title?.trim();

  if (!saleNative || !url || !title) return null;

  // Deals lane requires a markdown (old_price). The enrichment lane
  // (keepFullPrice) keeps full-price listings too, so the PDP spectrum +
  // /compare see the honest market range, not just whatever's on promo.
  if (!keepFullPrice && !originalNative) return null;

  const sale = toUSD(saleNative, mk.fxToUsd);
  const original = toUSD(originalNative ?? saleNative, mk.fxToUsd);
  const discountPercent = computeDiscount(original, sale);

  if (!keepFullPrice && discountPercent === 0) return null;

  // Floor out obvious parse errors / junk (sub-$1). ingestDeals applies the
  // canonical per-category price floor downstream (price-floor.ts).
  if (sale < 1) return null;

  return {
    id: `azn-${Date.now().toString(36)}-${i}`,
    title,
    description: title,
    category: "general",
    categorySlug: "all",          // ingest script overrides per seed query
    storeId: mk.storeId,
    storeName: mk.storeName,
    storeCountry: mk.storeCountry,
    originalPrice: original,
    salePrice: sale,
    discountPercent,
    currency: "USD",
    imageUrl: r.thumbnail,
    url,
    expiresAt: null,
    isHot: discountPercent >= 30,
    isFeatured: false,
    tags: [mk.storeName, "amazon", "live", `country:${mk.countryCode}`],
    saves: 0,
    clicks: 0,
    postedAt: new Date().toISOString().slice(0, 10),
  };
}

export const serpapiAmazonProvider: SearchProvider = {
  id: "serpapi-amazon",
  name: "SerpAPI Amazon",

  isActive() {
    // Same kill switch as the google_shopping lane: SERPAPI_DISABLED=true
    // forces it off even with a key present (credits paused).
    if (process.env.SERPAPI_DISABLED === "true") return false;
    return Boolean(process.env.SERPAPI_KEY?.trim());
  },

  async searchDeals(query: SearchQuery): Promise<Deal[]> {
    const apiKey = process.env.SERPAPI_KEY?.trim();
    if (!apiKey) return [];

    const q = query.q.trim();
    if (!q) return [];

    const cc = (query.countryCode ?? "us").toLowerCase();
    const mk = AMAZON_MARKETPLACES[cc];
    if (!mk) {
      console.warn(`[serpapi-amazon] no Amazon marketplace for "${cc}" — skipping`);
      return [];
    }

    const keepFullPrice = query.keepFullPrice ?? false;

    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "amazon");
    url.searchParams.set("k", q);                          // amazon engine keyword param is `k`, not `q`
    url.searchParams.set("amazon_domain", mk.amazonDomain);
    url.searchParams.set("api_key", apiKey);

    let res: Response;
    try {
      res = await fetch(url.toString(), { next: { revalidate: 600 } });
    } catch (err) {
      throw new ProviderError(this.id, "Network error contacting SerpAPI", err);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new ProviderError(this.id, `SerpAPI HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as AmazonResponse;
    if (data.error) {
      throw new ProviderError(this.id, data.error);
    }

    const results = data.organic_results ?? [];
    const limit = query.limit ?? 24;

    return results
      .map((r, i) => mapToDeal(r, i, mk, keepFullPrice))
      .filter((d): d is Deal => d !== null)
      .slice(0, limit);
  },
};
