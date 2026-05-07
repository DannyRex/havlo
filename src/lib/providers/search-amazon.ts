/* ──────────────────────────────────────────────────────────────────
   Amazon Product Advertising API v5 — search provider.

   STATUS: Active when AMAZON_PAAPI_ACCESS_KEY + AMAZON_PAAPI_SECRET
   AND at least one AMAZON_ASSOC_TAG_<region> are set in env.

   Why this exists:
     SerpAPI's Google Shopping is the only other path to multi-store
     comparison data on Walmart / Best Buy / Currys / etc., and it's
     metered. Amazon PAAPI is FREE for approved Associates accounts
     and covers the largest cross-border retailer per region. Adding
     Amazon as a first-class provider gives every curated target a
     guaranteed multi-marketplace ingest (US / UK / DE / AE / IN)
     without burning SerpAPI credit.

   Auth:
     AWS Signature v4. The endpoint requires the canonical signing
     dance (canonical request → string-to-sign → signing key →
     signature). Implemented inline rather than pulling in the
     official paapi5-nodejs-sdk because the SDK is callback-based
     and ships without first-class TypeScript types.

   Rate limits:
     PAAPI defaults 1 TPS for new Associates accounts. Curated
     ingest is sequential (one await per call) so we naturally
     stay under that. Burst protection via per-call try/catch +
     ProviderError so one rate-limited call doesn't kill the run.

   Currency normalisation:
     Each marketplace returns prices in its native currency (USD /
     GBP / EUR / AED / INR). We convert to USD at ingest time using
     a rough FX table — same approach the AliExpress provider
     takes. The Deal type only supports NGN | USD; non-USD
     marketplaces flow through as USD with the conversion applied.
     Refresh FX rates monthly or wire to a live source later.

   Used by:
     - npm run ingest:curated (cross-retailer fan-out)
     - npm run ingest          (regular cron, joins the global pool)
     - /api/live-search        (live grid on /compare)
   ────────────────────────────────────────────────────────────────── */

import crypto from "crypto";
import type { SearchProvider, SearchQuery } from "./types";
import { ProviderError } from "./types";
import type { Deal } from "@/types";

interface MarketplaceConfig {
  host:        string;
  region:      string;
  marketplace: string;
  currency:    "USD" | "GBP" | "EUR" | "AED" | "INR";
  storeId:     string;
  storeName:   string;
  envVarTag:   string;
}

const MARKETPLACES: Record<string, MarketplaceConfig> = {
  us: { host: "webservices.amazon.com",     region: "us-east-1",      marketplace: "www.amazon.com",   currency: "USD", storeId: "amazon",       storeName: "Amazon",    envVarTag: "AMAZON_ASSOC_TAG_US" },
  uk: { host: "webservices.amazon.co.uk",   region: "eu-west-1",      marketplace: "www.amazon.co.uk", currency: "GBP", storeId: "amazon-co-uk", storeName: "Amazon UK", envVarTag: "AMAZON_ASSOC_TAG_UK" },
  de: { host: "webservices.amazon.de",      region: "eu-west-1",      marketplace: "www.amazon.de",    currency: "EUR", storeId: "amazon-de",    storeName: "Amazon DE", envVarTag: "AMAZON_ASSOC_TAG_DE" },
  ae: { host: "webservices.amazon.ae",      region: "eu-west-1",      marketplace: "www.amazon.ae",    currency: "AED", storeId: "amazon-ae",    storeName: "Amazon AE", envVarTag: "AMAZON_ASSOC_TAG_AE" },
  in: { host: "webservices.amazon.in",      region: "eu-west-1",      marketplace: "www.amazon.in",    currency: "INR", storeId: "amazon-in",    storeName: "Amazon IN", envVarTag: "AMAZON_ASSOC_TAG_IN" },
};

/* For NG / ZA users — countries without a dedicated Amazon
   marketplace — fall back to amazon.com. They can still order
   cross-border. */
const FALLBACK_COUNTRY = "us";

/* Rough USD conversion. Refresh quarterly or wire to a live FX
   source. Keeps Deal.currency = "USD" across all marketplaces so
   downstream code (filterDealsForCountry, currency display) stays
   stable. */
const FX_TO_USD: Record<string, number> = {
  USD: 1.00,
  GBP: 1.27,
  EUR: 1.09,
  AED: 0.272,
  INR: 0.012,
};

const SERVICE      = "ProductAdvertisingAPI";
const TARGET       = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
const URI          = "/paapi5/searchitems";

interface PaapiItem {
  ASIN?:          string;
  DetailPageURL?: string;
  ItemInfo?: {
    Title?: { DisplayValue?: string };
  };
  Images?: {
    Primary?: { Large?: { URL?: string } };
  };
  Offers?: {
    Listings?: Array<{
      Price?:        { Amount?: number; Currency?: string };
      SavingBasis?:  { Amount?: number };
    }>;
  };
}

interface PaapiResponse {
  SearchResult?: { Items?: PaapiItem[] };
  Errors?:       Array<{ Code?: string; Message?: string }>;
}

/* ── SigV4 helpers ─────────────────────────────────────────────── */

function sha256(s: string | Buffer): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function hmac(key: string | Buffer, s: string): Buffer {
  return crypto.createHmac("sha256", key).update(s).digest();
}

function deriveSigningKey(secret: string, date: string, region: string): Buffer {
  const kDate    = hmac(`AWS4${secret}`, date);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

/* ── Provider ──────────────────────────────────────────────────── */

export const amazonSearchProvider: SearchProvider = {
  id:   "amazon-paapi",
  name: "Amazon Product Advertising API",

  isActive() {
    if (!process.env.AMAZON_PAAPI_ACCESS_KEY?.trim()) return false;
    if (!process.env.AMAZON_PAAPI_SECRET?.trim())     return false;
    /* At least one region tag must be set, otherwise we have no
       way to attribute clicks. Without a tag the provider would
       silently 'work' but not earn commission — which defeats the
       point of using PAAPI over scraping. */
    for (const cfg of Object.values(MARKETPLACES)) {
      if (process.env[cfg.envVarTag]?.trim()) return true;
    }
    return false;
  },

  async searchDeals(query: SearchQuery): Promise<Deal[]> {
    const accessKey = process.env.AMAZON_PAAPI_ACCESS_KEY?.trim();
    const secret    = process.env.AMAZON_PAAPI_SECRET?.trim();
    if (!accessKey || !secret) return [];

    const country  = (query.countryCode ?? FALLBACK_COUNTRY).toLowerCase();
    const cfg      = MARKETPLACES[country] ?? MARKETPLACES[FALLBACK_COUNTRY];
    const partner  = process.env[cfg.envVarTag]?.trim();
    /* No tag for this region → skip rather than degrade attribution.
       Returning [] lets the rest of the multi-provider fan-out keep
       running. */
    if (!partner) return [];

    const q = query.q.trim();
    if (!q) return [];

    const body = JSON.stringify({
      Keywords:     q,
      PartnerTag:   partner,
      PartnerType:  "Associates",
      Marketplace:  cfg.marketplace,
      ItemCount:    Math.min(query.limit ?? 10, 10),  // PAAPI hard cap = 10
      Resources: [
        "Images.Primary.Large",
        "ItemInfo.Title",
        "Offers.Listings.Price",
        "Offers.Listings.SavingBasis",
      ],
    });

    /* SigV4 signing */
    const now       = new Date();
    const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const headers: Record<string, string> = {
      "host":             cfg.host,
      "content-encoding": "amz-1.0",
      "content-type":     "application/json; charset=utf-8",
      "x-amz-target":     TARGET,
      "x-amz-date":       amzDate,
    };

    const headerKeys       = Object.keys(headers).sort();
    const canonicalHeaders = headerKeys.map((k) => `${k}:${headers[k].trim()}`).join("\n") + "\n";
    const signedHeaders    = headerKeys.join(";");

    const canonicalRequest = [
      "POST",
      URI,
      "",                    // canonical query string (none)
      canonicalHeaders,
      signedHeaders,
      sha256(body),
    ].join("\n");

    const credentialScope = `${dateStamp}/${cfg.region}/${SERVICE}/aws4_request`;
    const stringToSign    = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join("\n");

    const signingKey = deriveSigningKey(secret, dateStamp, cfg.region);
    const signature  = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    let res: Response;
    try {
      res = await fetch(`https://${cfg.host}${URI}`, {
        method:  "POST",
        headers: { ...headers, Authorization: authorization },
        body,
      });
    } catch (err) {
      throw new ProviderError(this.id, "Network error contacting Amazon PAAPI", err);
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "<no body>");
      throw new ProviderError(
        this.id,
        `Amazon PAAPI HTTP ${res.status}: ${txt.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as PaapiResponse;

    if (data.Errors && data.Errors.length > 0) {
      const e = data.Errors[0];
      throw new ProviderError(this.id, `${e.Code ?? "PAAPIError"}: ${e.Message ?? ""}`);
    }

    const items = data.SearchResult?.Items ?? [];
    return items
      .map((item, i) => mapToDeal(item, i, country, cfg))
      .filter((d): d is Deal => d !== null);
  },
};

function mapToDeal(
  item: PaapiItem,
  i: number,
  country: string,
  cfg: MarketplaceConfig,
): Deal | null {
  const title = item.ItemInfo?.Title?.DisplayValue?.trim();
  const url   = item.DetailPageURL?.trim();
  const asin  = item.ASIN;
  const native = item.Offers?.Listings?.[0]?.Price?.Amount;
  if (!title || !url || native == null) return null;

  /* Convert to USD using the per-marketplace rate. AliExpress's
     provider uses the same canonical-USD pattern so downstream
     filters / display logic is consistent across cross-border
     sources. */
  const fx        = FX_TO_USD[cfg.currency] ?? 1;
  const sale      = Math.round(native * fx * 100) / 100;
  const nativeOrig = item.Offers?.Listings?.[0]?.SavingBasis?.Amount ?? native;
  const original  = Math.round(nativeOrig * fx * 100) / 100;
  const discountPercent = original > sale
    ? Math.round(((original - sale) / original) * 100)
    : 0;

  return {
    id:              `paapi-${asin ?? `i${i}`}`,
    title,
    description:     title,
    category:        "general",
    categorySlug:    "all",
    storeId:         cfg.storeId,
    storeName:       cfg.storeName,
    originalPrice:   original,
    salePrice:       sale,
    discountPercent,
    currency:        "USD",
    imageUrl:        item.Images?.Primary?.Large?.URL,
    imageGradient:   "linear-gradient(135deg, #FF9900 0%, #232F3E 100%)",
    imageEmoji:      "🛍️",
    url,
    expiresAt:       null,
    isHot:           discountPercent >= 30,
    isFeatured:      false,
    tags:            ["Amazon", `country:${country}`, "live"],
    saves:           0,
    clicks:          0,
    postedAt:        new Date().toISOString().slice(0, 10),
  };
}
