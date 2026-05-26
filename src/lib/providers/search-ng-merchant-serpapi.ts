/* ──────────────────────────────────────────────────────────────────
   NG-merchant ingest via SerpAPI's Google engine (site-filtered).

   STATUS: Active when SERPAPI_KEY is set in env.

   Why this approach:
     Several NG retailers (Slot, 3C Hub, Jiji, Spar, Kara, Obiwezy)
     have Playwright scrapers that don't reliably produce data —
     selector drift, Cloudflare walls, dynamic SPA pages, etc. The
     Jumia SerpAPI route (search-jumia-serpapi.ts) was the proof
     that a `engine=google` + `site:domain.com` query works as a
     reliable substitute: Google's rich-snippet parser extracts
     `(price, currency)` from the merchant's own structured data,
     and SerpAPI handles the bot wall server-side.

     This file generalises that pattern across N merchants via a
     MerchantConfig per store. New merchant = new config block —
     no copy/paste of the fetch + parse boilerplate.

   API ref: https://serpapi.com/search-api
     engine=google
     q=<query> site:<merchant-domain>
     gl=ng
     hl=en
     num=30
     api_key=<key>

   Cost: 1 SerpAPI credit per call (no google_images companion call
   for now — UI gradient/emoji placeholder is the fallback when
   image_url is null). Per-merchant ingest: ~10 queries × 1 credit
   = ~10 credits per run.

   Used by:
     - scripts/ingest-ng-serpapi.ts (offline ingest into products + offers)
   ────────────────────────────────────────────────────────────────── */

import type { Deal } from "@/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

/* ── Per-merchant config ─────────────────────────────────────────── */

export interface MerchantConfig {
  /** Stable store_id matching scripts/scrapers/<store>.ts naming. */
  storeId:   string;
  /** Human display name. */
  storeName: string;
  /** Domain used in the `site:` operator (no protocol). */
  domain:    string;
  /** Predicate: is this URL a product DETAIL page, not a category
      / search / about / privacy page? Each merchant has a
      distinguishing URL pattern. */
  isProductUrl: (parsed: URL) => boolean;
  /** Optional category mapping — when supplied, the row is tagged
      with this category slug regardless of title-inference. Useful
      for verticals (Spar = groceries, MedPlus = health). */
  forcedCategory?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const NGN_PER_USD = 1600;

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

const CATEGORY_NGN_FLOOR: Record<string, number> = {
  phones:      30 * NGN_PER_USD,
  computing:   60 * NGN_PER_USD,
  electronics: 12 * NGN_PER_USD,
  audio:        4 * NGN_PER_USD,
  appliances:  15 * NGN_PER_USD,
  gaming:      12 * NGN_PER_USD,
  fashion:      2 * NGN_PER_USD,
  beauty:       1 * NGN_PER_USD,
  home:         2 * NGN_PER_USD,
  sports:       2 * NGN_PER_USD,
  groceries:    0.5 * NGN_PER_USD,   // Spar groceries: rice, milk, etc. — low floor
  health:       1 * NGN_PER_USD,
};

/* Strip Google tracking params so (store_id, url) stays stable
   across runs. Same set the ingest writer's canonicaliseOfferUrl
   strips, kept local here to keep this provider self-contained
   and parsable on its own. */
function canonicaliseMerchantUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const drop = ["srsltid", "gclid", "gad_source", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "msclkid"];
    for (const k of drop) u.searchParams.delete(k);
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

function isNgnCurrency(c: string | undefined): boolean {
  if (!c) return false;
  const v = c.trim();
  return v === "₦" || v.toUpperCase() === "NGN" || v === "N";
}

/* ── Google response shapes (subset we need) ─────────────────────── */

interface DetectedExtensions {
  price?:    number;
  currency?: string;
}

interface RichSnippet {
  bottom?: {
    detected_extensions?: DetectedExtensions;
    extensions?:           string[];
  };
}

interface GoogleOrganicResult {
  title?:        string;
  link?:         string;
  snippet?:      string;
  rich_snippet?: RichSnippet;
  thumbnail?:    string;
}

interface GoogleSearchResponse {
  organic_results?: GoogleOrganicResult[];
  error?:           string;
}

/* ── Map an organic result → Deal under a merchant config ───────── */

function mapToDeal(r: GoogleOrganicResult, idx: number, config: MerchantConfig): Deal | null {
  const url   = r.link;
  const title = r.title?.trim();
  if (!url || !title) return null;

  /* Drop URLs that don't look like product pages — search results,
     category pages, FAQ, privacy, etc. The per-merchant predicate
     knows the actual pattern (slot.ng has /product/X-id while jiji
     has /<category>/<slug>-<id>.html, etc.). */
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (!parsed.hostname.endsWith(config.domain)) return null;
  if (!config.isProductUrl(parsed)) return null;

  /* Price + currency from Google's rich snippet. Most NG merchants
     publish structured-data markup; some only on detail pages, hence
     the product-URL gate above. */
  const ext = r.rich_snippet?.bottom?.detected_extensions ?? {};
  const sale = ext.price;
  if (typeof sale !== "number" || sale <= 0) return null;
  if (!isNgnCurrency(ext.currency)) return null;

  /* Category inference + plausibility floor. forcedCategory wins
     when the merchant config sets it (e.g. Spar = groceries). */
  const inferredCat = config.forcedCategory ?? inferCategoryFromTitle(title);
  const floor = inferredCat ? (CATEGORY_NGN_FLOOR[inferredCat] ?? 500) : 500;
  if (sale < floor) return null;

  /* Out-of-stock signal from Google's extension strings. */
  const exts = r.rich_snippet?.bottom?.extensions ?? [];
  const stockText = exts.join(" ").toLowerCase();
  if (stockText.includes("out of stock") || stockText.includes("sold out")) return null;

  return {
    id:              `serp-${config.storeId}-${Date.now().toString(36)}-${idx}`,
    title,
    description:     title,
    category:        inferredCat ?? "general",
    categorySlug:    inferredCat ?? "all",
    storeId:         config.storeId,
    storeName:       config.storeName,
    originalPrice:   sale,          // Google rich snippet doesn't carry MSRP
    salePrice:       sale,
    discountPercent: 0,
    currency:        "NGN",
    /* Google organic-results doesn't carry images via this engine.
       UI falls back to category gradient + emoji. A future enhancement
       could fire a parallel google_images call (Jumia ingest does this);
       skipped here to keep per-run credit cost ~half. */
    imageUrl:        undefined,
    url:             canonicaliseMerchantUrl(url),
    expiresAt:       null,
    isHot:           false,
    isFeatured:      false,
    /* country:ng tag so the ingest writer's three-layer country
       resolution lands the store row with stores.country='NG' on
       first ingest — no manual backfill needed. */
    tags:            [config.storeName, "country:ng"],
    saves:           0,
    clicks:          0,
    postedAt:        new Date().toISOString().slice(0, 10),
  };
}

/* ── Public: fetch deals for one merchant + one query ───────────── */

export async function fetchMerchantDealsViaSerpapi(
  config:  MerchantConfig,
  userQuery: string,
  apiKey:  string,
): Promise<Deal[]> {
  const trimmed = userQuery.trim();
  if (!trimmed) return [];

  const siteFilteredQuery = `${trimmed} site:${config.domain}`;
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q",      siteFilteredQuery);
  url.searchParams.set("gl",     "ng");
  url.searchParams.set("hl",     "en");
  url.searchParams.set("num",    "30");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`SerpAPI HTTP ${res.status} for ${config.storeId}/${trimmed.slice(0, 30)}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as GoogleSearchResponse;
  if (data.error) {
    if (/hasn't returned any results/i.test(data.error)) return [];
    throw new Error(`SerpAPI error for ${config.storeId}: ${data.error}`);
  }
  const results = data.organic_results ?? [];
  const deals: Deal[] = [];
  for (let i = 0; i < results.length; i++) {
    const d = mapToDeal(results[i], i, config);
    if (d) deals.push(d);
  }
  return deals;
}
