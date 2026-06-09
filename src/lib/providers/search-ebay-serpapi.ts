/* eBay UK ingest via SerpAPI's dedicated eBay engine (ebay.co.uk).
 *
 *   Why a separate engine (not google_shopping like the main ingest):
 *   Google Shopping for gl=uk surfaces ebay.COM sellers + Google redirect
 *   links, so the catalogue ended up ~99% ebay.com (US, cross-border) and
 *   essentially zero ebay.co.uk. This module hits eBay's own UK index
 *   directly, so every result is a real ebay.co.uk listing with a proper
 *   ebay.co.uk product URL. Once ingested, dealToStoreRow's ebayMarketFromUrl
 *   reads that .co.uk host and tags store_country = UK automatically, so the
 *   listings land as UK-local with no special-casing.
 *
 *   SerpAPI ref: https://serpapi.com/ebay-organic-results
 *     engine=ebay  ebay_domain=ebay.co.uk  _nkw=<query>  LH_BIN=1  api_key=<key>
 *   Cost: 1 SerpAPI credit per query.
 *
 *   Prices arrive in GBP (the marketplace currency). Deal.currency is
 *   "USD" | "NGN" only, so we convert GBP -> USD here (USD_FX["GBP"] = GBP
 *   per USD); the display layer converts USD -> the visitor's currency, so a
 *   UK shopper still sees the price in GBP. */

import type { Deal } from "@/types";
import { USD_FX } from "@/lib/country";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

/* eBay engine `organic_results[]` shape (the subset we read). `price` is
   either a single {raw, extracted} or a {from,to} range for multi-variant
   listings — we take the single value, else the range's low end. */
interface EbayPriceLeg { raw?: string; extracted?: number }
interface EbayPrice extends EbayPriceLeg { from?: EbayPriceLeg; to?: EbayPriceLeg }
interface EbayResult {
  title?:     string;
  link?:      string;
  condition?: string;
  thumbnail?: string;
  price?:     EbayPrice;
}
interface EbayResponse { organic_results?: EbayResult[]; error?: string }

export interface EbayQuery { q: string; category: string }

/* GBP -> USD. USD_FX["GBP"] is GBP-per-USD (e.g. 0.79), so divide. */
function gbpToUsd(gbp: number): number {
  const rate = USD_FX.GBP || 0.79;
  return Math.round(gbp / rate);
}

function priceGbp(p?: EbayPrice): number | null {
  if (!p) return null;
  if (typeof p.extracted === "number" && p.extracted > 0) return p.extracted;
  if (typeof p.from?.extracted === "number" && p.from.extracted > 0) return p.from.extracted;
  return null;
}

/* One eBay-UK query -> Deal[]. Throws on hard SerpAPI failure (so the
   orchestrator can log it); returns [] on a clean "no results". */
export async function fetchEbayUkDealsViaSerpapi(query: EbayQuery, apiKey: string): Promise<Deal[]> {
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "ebay");
  url.searchParams.set("ebay_domain", "ebay.co.uk");
  url.searchParams.set("_nkw", query.q);
  url.searchParams.set("LH_BIN", "1"); // Buy It Now only — skip auctions (no fixed price)
  url.searchParams.set("api_key", apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (err) {
    throw new Error(`Network error contacting SerpAPI eBay for "${query.q}": ${String(err)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`SerpAPI eBay HTTP ${res.status} for "${query.q}": ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as EbayResponse;
  if (data.error) {
    if (/returned no results|hasn't returned any results|no results/i.test(data.error)) return [];
    throw new Error(`SerpAPI eBay error for "${query.q}": ${data.error}`);
  }

  const results = data.organic_results ?? [];
  const out: Deal[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const title = r.title?.trim();
    const link = r.link?.trim();
    if (!title || !link) continue;

    /* Hard-require a real ebay.co.uk product listing. The engine should
       only ever return these, but guard so a stray result can't slip in
       and get mis-tagged. /itm/ is eBay's item-page marker. */
    let host: string;
    try { host = new URL(link).hostname.toLowerCase().replace(/^www\./, ""); } catch { continue; }
    if (host !== "ebay.co.uk") continue;
    if (!link.includes("/itm/")) continue;

    const gbp = priceGbp(r.price);
    if (gbp === null) continue;
    const usd = gbpToUsd(gbp);
    if (usd < 1) continue;

    const condition = r.condition?.trim();
    const isUsed = condition ? !/new/i.test(condition) : false;

    out.push({
      id:              `ebayuk-${Date.now().toString(36)}-${i}`,
      title,
      description:     title,
      attributes:      condition || undefined,
      category:        query.category,
      categorySlug:    query.category,
      storeId:         "ebay-uk",
      storeName:       "eBay",
      storeCountry:    "UK",
      originalPrice:   usd,        // BIN listings carry no separate MSRP
      salePrice:       usd,
      discountPercent: 0,
      currency:        "USD",      // GBP converted above; Deal currency is USD|NGN
      imageUrl:        r.thumbnail || undefined,
      url:             link,       // ebay.co.uk -> ebayMarketFromUrl tags store_country UK
      expiresAt:       null,
      isHot:           false,
      isFeatured:      false,
      /* country:uk so the ingest writer's country resolution agrees with
         the domain tag; "used" so pre-owned listings don't read as fresh
         deals. */
      tags:            isUsed ? ["eBay", "country:uk", "used"] : ["eBay", "country:uk"],
      saves:           0,
      clicks:          0,
      postedAt:        new Date().toISOString(),
    });
  }
  return out;
}

/* UK eBay seed queries — high-intent products eBay UK reliably stocks,
   spread across the catalogue's categories. ~1 SerpAPI credit each. */
export const UK_EBAY_QUERIES: EbayQuery[] = [
  // Phones
  { q: "iPhone 15 Pro Max", category: "phones" },
  { q: "iPhone 14", category: "phones" },
  { q: "Samsung Galaxy S24 Ultra", category: "phones" },
  { q: "Google Pixel 8 Pro", category: "phones" },
  // Computing
  { q: "MacBook Pro M3", category: "computing" },
  { q: "MacBook Air M2", category: "computing" },
  { q: "iPad Pro 11", category: "computing" },
  { q: "Dell XPS 13", category: "computing" },
  // Audio
  { q: "AirPods Pro 2", category: "audio" },
  { q: "Sony WH-1000XM5", category: "audio" },
  { q: "Bose QuietComfort Ultra", category: "audio" },
  { q: "JBL Charge 5", category: "audio" },
  // Gaming
  { q: "PlayStation 5 Slim", category: "gaming" },
  { q: "Xbox Series X", category: "gaming" },
  { q: "Nintendo Switch OLED", category: "gaming" },
  { q: "Steam Deck OLED", category: "gaming" },
  // Electronics / TV / camera
  { q: "Samsung 55 inch QLED TV", category: "electronics" },
  { q: "LG OLED C3 TV", category: "electronics" },
  { q: "GoPro Hero 12", category: "electronics" },
  // Appliances
  { q: "Dyson V15 Detect", category: "appliances" },
  { q: "Ninja Air Fryer", category: "appliances" },
  { q: "Nespresso Vertuo", category: "appliances" },
  // Beauty
  { q: "Dyson Airwrap", category: "beauty" },
  { q: "GHD Platinum straighteners", category: "beauty" },
  // Wearables / sports
  { q: "Apple Watch Series 9", category: "sports" },
  { q: "Garmin Forerunner 265", category: "sports" },
  // Fashion
  { q: "Nike Air Force 1", category: "fashion" },
  { q: "adidas Samba OG", category: "fashion" },
];
