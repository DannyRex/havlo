/* ──────────────────────────────────────────────────────────────────
   AliExpress Affiliate API — product search.

   STATUS: Active when ALIEXPRESS_APP_KEY + ALIEXPRESS_APP_SECRET set.

   Endpoint: aliexpress.affiliate.hotproduct.query
   Docs:     https://openservice.aliexpress.com/doc/doc.htm
             #/api?cid=29&path=aliexpress.affiliate.hotproduct.query

   Why hotproduct.query (not product.search):
     AliExpress's affiliate API has tiered method authorisation.
     product.search lives in the Premium tier (separate approval
     gate); hotproduct.query is in the Advanced tier we have today.
     They take identical inputs and return the same product shape.
     Better still, hotproduct.query is curated to trending /
     high-velocity items, so the results we surface skip the
     long-tail dropshipping noise and lean toward genuine deals.

   Why this exists:
     SerpAPI's Google Shopping had near-zero AliExpress coverage,
     leaving Havlo's cross-border tail thin (0 AliExpress products
     in DB before this). The Open Platform API gives direct access
     to AliExpress's catalog at no per-call cost (free tier covers
     normal use).

   Auth + sign:
     Same HMAC-SHA256 pattern as the converter in
     src/lib/aliexpress-converter.ts — shared App Key + Secret.

   Used by:
     - npm run ingest:aliexpress (one-shot bulk ingest)
     - npm run ingest                (joins regular cron fan-out)
     - /api/live-search             (live grid on /compare)

   Country handling:
     AliExpress is global — we don't fan out per country at search
     time. Instead we query once + tag with the user's country in
     the response so per-country filtering on the UI side stays
     accurate. country can be passed via SearchQuery to bias
     results to products that ship to a given market.
   ────────────────────────────────────────────────────────────────── */

import crypto from "crypto";
import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";

const API_BASE     = "https://api-sg.aliexpress.com/sync";
const TRACKING_ID  = "havlo";
const PAGE_SIZE    = 50;  // AliExpress max per call

/* USD-aware floor — same intent as the SerpAPI provider's category
   floors. Stops $1 keychains from polluting deal results. */
const CATEGORY_USD_FLOOR: Record<string, number> = {
  phones:      30,
  computing:   60,
  electronics: 12,
  audio:       4,
  appliances:  15,
  gaming:      12,
  fashion:     2,
  beauty:      1,
  home:        2,
  sports:      2,
};

/* ── Response shape ─────────────────────────────────────────────── */

interface AliexProduct {
  product_id?:               number | string;
  product_title?:            string;
  product_main_image_url?:   string;
  product_detail_url?:       string;
  /* "target_*" prices are normalized to target_currency (USD by default).
     "sale_price" + "original_price" are in the seller's native currency. */
  target_sale_price?:        string;
  target_original_price?:    string;
  target_sale_price_currency?: string;
  sale_price?:               string;
  original_price?:           string;
  discount?:                 string;     // e.g. "45%"
  evaluate_rate?:             string;     // "4.8"
  shop_id?:                  number;
  shop_url?:                 string;
  first_level_category_name?: string;
  second_level_category_name?: string;
  promotion_link?:           string;     // already-tracked deep link if available
  lastest_volume?:           number;     // sales count
}

interface AliexHotProductResponse {
  aliexpress_affiliate_hotproduct_query_response?: {
    resp_result?: {
      result?: {
        products?: { product?: AliexProduct[] };
        total_record_count?: number;
        current_page_no?: number;
      };
      resp_code?: number;
      resp_msg?: string;
    };
  };
  error_response?: {
    code?: number;
    msg?: string;
    sub_code?: string;
    sub_msg?: string;
  };
}

/* ── Helpers ────────────────────────────────────────────────────── */

function signParams(params: Record<string, string>, secret: string): string {
  const keys = Object.keys(params).sort();
  const concat = keys.map((k) => `${k}${params[k]}`).join("");
  return crypto.createHmac("sha256", secret).update(concat).digest("hex").toUpperCase();
}

function inferCategoryFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(iphone|galaxy|pixel|tecno|infinix|smartphone|smart phone)\b/.test(t)) return "phones";
  if (/\b(macbook|laptop|notebook|chromebook|thinkpad|xps)\b/.test(t)) return "computing";
  if (/\b(ipad|tablet|tab a|tab s)\b/.test(t)) return "computing";
  if (/\b(airpods|headphone|headset|earbuds|earphone|speaker)\b/.test(t)) return "audio";
  if (/\b(tv|television|qled|oled)\b/.test(t)) return "electronics";
  if (/\b(playstation|ps5|ps4|xbox|nintendo|switch)\b/.test(t)) return "gaming";
  if (/\b(fridge|washer|dryer|microwave|air fryer)\b/.test(t)) return "appliances";
  return null;
}

function parseNumeric(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isFinite(n) ? n : 0;
}

function mapToDeal(p: AliexProduct, i: number, country: string): Deal | null {
  const title = p.product_title?.trim();
  /* Prefer the pre-tracked promotion_link when AliExpress includes it
     in the response; falls back to the bare product URL which our
     /api/go path will wrap via the URL converter. */
  const url = p.promotion_link?.trim() || p.product_detail_url?.trim();
  if (!title || !url) return null;

  const sale     = parseNumeric(p.target_sale_price);
  const original = parseNumeric(p.target_original_price) || sale;
  if (sale <= 0) return null;

  const discountFromString = parseNumeric(p.discount);
  const discountPercent = discountFromString > 0
    ? Math.round(discountFromString)
    : original > sale
      ? Math.round(((original - sale) / original) * 100)
      : 0;

  // Same implausibility floor as SerpAPI provider
  const cat = inferCategoryFromTitle(title);
  const floor = cat ? (CATEGORY_USD_FLOOR[cat] ?? 0.5) : 0.5;
  if (sale < floor) return null;

  return {
    id:             `aliex-${p.product_id ?? `i${i}`}`,
    title,
    description:    title,
    category:       "general",
    categorySlug:   "all",
    storeId:        "aliexpress",
    storeName:      "AliExpress",
    originalPrice:  original,
    salePrice:      sale,
    discountPercent,
    currency:       "USD",
    imageUrl:       p.product_main_image_url,
    imageGradient:  "linear-gradient(135deg, #ff4747 0%, #c91111 100%)",
    imageEmoji:     "🛍️",
    url,
    expiresAt:      null,
    isHot:          discountPercent >= 30,
    isFeatured:     false,
    tags:           ["AliExpress", "live", `country:${country}`],
    saves:          0,
    clicks:         0,
    postedAt:       new Date().toISOString().slice(0, 10),
  };
}

/* ── Provider implementation ────────────────────────────────────── */

export const aliexpressSearchProvider: SearchProvider = {
  id:   "aliexpress-affiliate",
  name: "AliExpress Affiliate",

  isActive() {
    return Boolean(
      process.env.ALIEXPRESS_APP_KEY?.trim()
      && process.env.ALIEXPRESS_APP_SECRET?.trim(),
    );
  },

  async searchDeals(query: SearchQuery): Promise<Deal[]> {
    const appKey    = process.env.ALIEXPRESS_APP_KEY?.trim();
    const appSecret = process.env.ALIEXPRESS_APP_SECRET?.trim();
    if (!appKey || !appSecret) return [];

    const q = query.q.trim();
    if (!q) return [];

    const country = (query.countryCode ?? "ng").toLowerCase();
    const limit   = Math.min(query.limit ?? PAGE_SIZE, PAGE_SIZE);

    const params: Record<string, string> = {
      app_key:           appKey,
      method:            "aliexpress.affiliate.hotproduct.query",
      timestamp:         new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, ""),
      sign_method:       "hmac-sha256",
      format:            "json",
      v:                 "2.0",
      /* Method-specific */
      keywords:          q,
      tracking_id:       TRACKING_ID,
      page_no:           "1",
      page_size:         String(limit),
      target_currency:   "USD",
      target_language:   "EN",
      /* hotproduct.query uses `country` (not `ship_to_country`) for
         the ship-to bias parameter. Lowercase per docs. */
      country:           country.toLowerCase(),
      /* SALE_PRICE_ASC keeps the cheapest hot items at the top — same
         intent as the SerpAPI provider's price-asc default. The
         min_sale_price floor prevents $0.50 keychains from poisoning
         deal lists; the per-category USD floor in mapToDeal() catches
         the rest. */
      sort:              "SALE_PRICE_ASC",
      min_sale_price:    "1",
    };
    params.sign = signParams(params, appSecret);

    const body = new URLSearchParams(params).toString();

    let res: Response;
    try {
      res = await fetch(API_BASE, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        // 10-min revalidate — keeps results fresh without hammering API
        next: { revalidate: 600 },
      });
    } catch (err) {
      throw new ProviderError(this.id, "Network error contacting AliExpress", err);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      throw new ProviderError(
        this.id,
        `AliExpress HTTP ${res.status}: ${text.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as AliexHotProductResponse;
    if (data.error_response) {
      throw new ProviderError(
        this.id,
        `${data.error_response.code} ${data.error_response.msg ?? ""} ${data.error_response.sub_msg ?? ""}`.trim(),
      );
    }

    const respCode = data.aliexpress_affiliate_hotproduct_query_response?.resp_result?.resp_code;
    if (respCode != null && respCode !== 200) {
      throw new ProviderError(
        this.id,
        `AliExpress resp_code ${respCode}: ${data.aliexpress_affiliate_hotproduct_query_response?.resp_result?.resp_msg ?? ""}`,
      );
    }

    const products = data
      .aliexpress_affiliate_hotproduct_query_response
      ?.resp_result?.result
      ?.products?.product
      ?? [];

    const mapped = products
      .map((p, i) => mapToDeal(p, i, country))
      .filter((d): d is Deal => d !== null);

    return mapped.slice(0, limit);
  },
};
