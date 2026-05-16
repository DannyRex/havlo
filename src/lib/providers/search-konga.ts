/* ──────────────────────────────────────────────────────────────────
   Konga Affiliate provider — Nigerian retail catalog.

   STATUS: SCAFFOLD — pending Konga affiliate approval.
     The provider is wired into the registry and gated on
     KONGA_AFFILIATE_KEY so it's invisible until the key is set.
     The actual fetch + response parser is stubbed against the
     expected feed shape; flip the TODO blocks when the docs land.

   Why we want this:
     - Free (vs paid SerpAPI credits)
     - Native NG catalog → boosts local-pool count, fixes the
       70/30 locality target on the homepage Trending grid
     - Affiliate revenue on every outbound click

   Usage once activated:
     1. Set KONGA_AFFILIATE_KEY (and optionally KONGA_AFFILIATE_API_BASE)
        in .env.local + Vercel env vars
     2. Run: npm run ingest -- --provider=konga-affiliate
        (or it joins the regular cron via SEARCH_PROVIDERS registration)
   ────────────────────────────────────────────────────────────────── */

import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";

/* Default base URL for Konga's affiliate product API.
   Override via KONGA_AFFILIATE_API_BASE if their docs reveal a
   different endpoint (e.g. a regional CDN or a v2 path). */
const DEFAULT_API_BASE = "https://api-affiliate.konga.com";

/* ── Expected response shape ──────────────────────────────────────────
   Best guess based on standard affiliate-feed conventions; tweak the
   field names against the real docs once the key arrives. */
interface KongaProduct {
  sku?:            string;
  product_id?:     string;
  name?:           string;
  brand?:          string;
  category?:       string;
  category_path?:  string;
  price?:          number;       // current selling price in NGN
  original_price?: number;       // pre-discount price
  discount?:       number;       // percent off
  image?:          string;       // product image URL
  url?:            string;       // product detail page (will be wrapped with affiliate ID)
  in_stock?:       boolean;
  rating?:         number;
}

interface KongaResponse {
  status?:    string;
  results?:   KongaProduct[];
  products?:  KongaProduct[];    // alt name some affiliate feeds use
  data?:      KongaProduct[];    // alt name
  total?:     number;
  message?:   string;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/* Wrap the product URL with the affiliate ID so clicks attribute to
   our account. Konga's affiliate URL format isn't published yet —
   placeholder is the typical "?subId=" pattern; correct once docs
   land. Falls through cleanly for URLs that already carry params. */
function withAffiliateId(rawUrl: string, affiliateId: string): string {
  if (!affiliateId) return rawUrl;
  const sep = rawUrl.includes("?") ? "&" : "?";
  // TODO(konga-approval): replace `subId` with the parameter Konga
  // actually expects (could be `aff_id`, `tag`, `partner`, etc.).
  return `${rawUrl}${sep}subId=${encodeURIComponent(affiliateId)}`;
}

/* Map Konga's category strings onto our internal category slugs.
   Conservative: anything we don't recognize lands in "general" so the
   homepage Trending grid still shows it (just untyped). */
const CATEGORY_MAP: Record<string, string> = {
  "phones & tablets":      "phones",
  "phones-tablets":        "phones",
  "mobile phones":         "phones",
  "computing":             "computing",
  "computers":             "computing",
  "laptops":               "computing",
  "electronics":           "electronics",
  "tv & video":            "electronics",
  "audio":                 "audio",
  "home appliances":       "appliances",
  "appliances":            "appliances",
  "fashion":               "fashion",
  "beauty":                "beauty",
  "health & beauty":       "beauty",
  "home & kitchen":        "home",
  "sports & fitness":      "sports",
  "gaming":                "gaming",
};
function normaliseCategory(raw?: string): string {
  if (!raw) return "general";
  const k = raw.toLowerCase().trim();
  return CATEGORY_MAP[k] ?? "general";
}

function inferStoreId(): string {
  return "konga";
}

function mapToDeal(p: KongaProduct, i: number): Deal | null {
  const sale = p.price;
  const url = p.url;
  const title = p.name;
  if (!sale || !url || !title) return null;

  const original = p.original_price && p.original_price > sale ? p.original_price : sale;
  const discountPercent =
    p.discount ??
    (original > sale ? Math.round(((original - sale) / original) * 100) : 0);

  // Don't surface non-deal products on a deals platform
  if (discountPercent < 5) return null;

  const categorySlug = normaliseCategory(p.category_path ?? p.category);

  return {
    id:             `konga-${p.sku ?? p.product_id ?? `p${i}`}`,
    title,
    description:    title,
    category:       categorySlug,
    categorySlug,
    storeId:        inferStoreId(),
    storeName:      "Konga",
    originalPrice:  original,
    salePrice:      sale,
    discountPercent,
    currency:       "NGN",
    imageUrl:       p.image,
    url:            withAffiliateId(url, process.env.KONGA_AFFILIATE_KEY ?? ""),
    expiresAt:      null,
    isHot:          discountPercent >= 30,
    isFeatured:     false,
    tags:           ["Konga", "local", p.brand ?? ""].filter(Boolean),
    saves:          0,
    clicks:         0,
    postedAt:       new Date().toISOString().slice(0, 10),
  };
}

/* ── Provider implementation ──────────────────────────────────────── */

export const kongaSearchProvider: SearchProvider = {
  id:   "konga-affiliate",
  name: "Konga Affiliate",

  isActive() {
    return Boolean(process.env.KONGA_AFFILIATE_KEY?.trim());
  },

  async searchDeals(query: SearchQuery): Promise<Deal[]> {
    const apiKey = process.env.KONGA_AFFILIATE_KEY?.trim();
    if (!apiKey) return [];

    /* Konga is NG-only. When the ingest cron fans out to other
       countries we no-op cleanly so SerpAPI can serve those markets. */
    const cc = (query.countryCode ?? "ng").toLowerCase();
    if (cc !== "ng") return [];

    const q = query.q.trim();
    if (!q) return [];

    const apiBase = process.env.KONGA_AFFILIATE_API_BASE?.trim() || DEFAULT_API_BASE;
    const limit = query.limit ?? 24;

    /* TODO(konga-approval): replace this URL + auth scheme with the real
       endpoint from Konga's affiliate docs. Likely shape will be either:

         GET {base}/v1/products?q=<query>&limit=<n>
           Headers: Authorization: Bearer <KONGA_AFFILIATE_KEY>

       OR (TradeDoubler-style)
         GET {base}/v1/products?token=<KEY>&q=<query>

       Update the URL construction + headers below once confirmed. */
    const url = new URL("/v1/products", apiBase);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", String(limit));

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept:        "application/json",
        },
        // 1-hour revalidate — Konga's catalog doesn't churn fast
        next: { revalidate: 3600 },
      });
    } catch (err) {
      throw new ProviderError(this.id, "Network error contacting Konga affiliate API", err);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new ProviderError(
        this.id,
        `Konga HTTP ${res.status}: ${body.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as KongaResponse;
    if (data.status && data.status !== "ok" && data.status !== "success") {
      throw new ProviderError(this.id, data.message ?? `Unexpected status: ${data.status}`);
    }

    const results = data.results ?? data.products ?? data.data ?? [];

    const mapped = results
      .map((p, i) => mapToDeal(p, i))
      .filter((d): d is Deal => d !== null);

    return mapped.slice(0, limit);
  },
};
