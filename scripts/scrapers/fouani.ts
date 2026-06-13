/* Fouani Store (fouanistore.com) — major Nigerian electronics +
   appliances retailer (LG, Hisense, Samsung TVs, fridges, washing
   machines, ACs). Carries genuinely comparable inventory against Slot,
   Kara, 3CHub, Konga — high-value addition to the NG comparison pool.

   Site is a custom Next.js SPA, NOT Shopify, so the _shopify-json
   helper doesn't apply. Strategy:
     1. Fetch /sitemap-products.xml — lists every product page URL.
     2. For each URL, fetch the SSR'd HTML and parse the <script
        id="__NEXT_DATA__"> blob. The product is at
        props.pageProps.data.data with the shape verified in recon
        (name, display_price, display_discounted_price, discount_per,
        brand_name, image.origin, product_categories[0].name).
     3. Map each product to a RawDeal in NGN.

   No Playwright — every product page is server-rendered, so plain
   fetch is enough. Concurrency-limited at 6 to be polite to the
   origin. (Awin 5 ingest, June 2026.) */

import type { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

const BASE = "https://fouanistore.com";
const UA   = "Mozilla/5.0 (compatible; HavloBot/1.0; +https://havlo.io)";
const MAX_PRODUCTS = 600; // bound the scrape — Fouani catalog ~hundreds of SKUs

/** Fetch with a real UA + 20s timeout. Returns null on any failure
    (network, non-2xx, parse error) so the caller can skip cleanly. */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20_000);
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Pull <loc>…</loc> entries from an XML sitemap. */
function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

interface FouaniProduct {
  id?:                       number;
  name?:                     string;
  description?:              string;
  display_price?:            number | string;
  display_discounted_price?: number | string;
  discount_per?:             number;
  brand_name?:               string;
  /* Fouani splits the image into a CDN base_url + relative filenames.
     The full URL is base_url + "/" + (webp_image | origin). Storing
     `origin` alone ("image.jpg?_dc=...") yields a broken path. */
  image?:                    { base_url?: string; origin?: string; thumbnail?: string; webp_image?: string; webp_thumbnail?: string };
  product_categories?:       Array<{ name?: string }>;
  tags?:                     Array<{ name?: string } | string>;
}

/** Parse the page's __NEXT_DATA__ blob and pull the product object. */
function parseProduct(html: string): FouaniProduct | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{.+?\})<\/script>/s);
  if (!m) return null;
  try {
    const nd = JSON.parse(m[1]);
    return nd?.props?.pageProps?.data?.data ?? null;
  } catch {
    return null;
  }
}

/** Build the absolute Fouani CDN image URL. The product JSON gives a
    base_url plus relative filenames (webp_image / origin); joining them
    yields e.g. https://salva.ams3.cdn.digitaloceanspaces.com/.../image.webp?_dc=…
    Prefer the webp (smaller) and fall back to the jpg origin. */
function fouaniImageUrl(img?: FouaniProduct["image"]): string | undefined {
  if (!img) return undefined;
  const file = img.webp_image || img.origin || img.webp_thumbnail || img.thumbnail;
  if (!file) return undefined;
  if (/^https?:\/\//i.test(file)) return file; // already absolute (defensive)
  if (!img.base_url) return undefined;
  return `${img.base_url.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v.replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; }
  return 0;
}

function productToDeal(p: FouaniProduct, url: string): RawDeal | null {
  const title = p.name?.trim();
  if (!title) return null;

  /* display_discounted_price > 0 means there's a real sale: that's the
     sale price and display_price is the original. When discounted is 0
     or missing, display_price IS the sale price. */
  const display    = toNumber(p.display_price);
  const discounted = toNumber(p.display_discounted_price);
  const salePrice     = discounted > 0 ? discounted : display;
  const originalPrice = discounted > 0 ? display    : display;
  if (salePrice <= 0) return null;

  const discountPercent = p.discount_per && p.discount_per > 0
    ? Math.round(p.discount_per)
    : originalPrice > salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 0;

  /* Category from product_categories[0].name with the standard
     resolver. Falls back to "electronics" via resolveCategory's default
     (matches Fouani's actual catalogue weight). */
  const catName = p.product_categories?.[0]?.name || "electronics";
  const resolved = resolveCategory(catName);

  /* Description: strip the merchant's markdown headings so the JSON-LD
     and search-doc see clean prose. Cap at 200 chars (same as Shopify). */
  const desc = (p.description || "")
    .replace(/#+\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200) || `${title} - shop on Fouani.`;

  /* Tags: feed brand + category in (consistent with the Shopify
     helper). brand_name is the cross-store match anchor. */
  const tagList = Array.isArray(p.tags)
    ? p.tags.map((t) => (typeof t === "string" ? t : (t?.name ?? ""))).filter(Boolean)
    : [];

  return {
    title,
    description:     desc,
    category:        resolved.category,
    categorySlug:    resolved.slug,
    storeId:         "fouani",
    storeName:       "Fouani Store",
    originalPrice,
    salePrice,
    discountPercent,
    currency:        "NGN",
    imageUrl:        fouaniImageUrl(p.image),
    imageEmoji:      resolved.emoji,
    imageGradient:   resolved.gradient,
    url,
    tags:            ["Fouani", resolved.category, p.brand_name ?? "", ...tagList].filter(Boolean),
  };
}

/** Run a bounded-concurrency map over the URL list. */
async function mapConcurrent<T, U>(items: T[], limit: number, fn: (item: T) => Promise<U>): Promise<U[]> {
  const out: U[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

/* Page param unused — Fouani path is fetch-only, no browser needed
   (server-rendered HTML carries the full product blob). */
export async function scrapeFouani(_page: Page): Promise<RawDeal[]> {
  console.log("  → Fouani Store (sitemap-driven, SSR parse)...");

  /* 1. sitemap index — walk every sub-sitemap and collect product URLs.
     Currently sitemap-products.xml is the only one with /product/... but
     iterating defends against the merchant adding more files later. */
  const indexXml = await fetchHtml(`${BASE}/sitemap.xml`);
  if (!indexXml) { console.warn("  ✗ Fouani: sitemap.xml unreachable"); return []; }
  const subSitemaps = extractLocs(indexXml).filter((u) => /sitemap-products/i.test(u));
  if (subSitemaps.length === 0) {
    /* Single-file fallback: try the conventional path directly. */
    subSitemaps.push(`${BASE}/sitemap-products.xml`);
  }

  const productUrls: string[] = [];
  for (const sm of subSitemaps) {
    const xml = await fetchHtml(sm);
    if (!xml) continue;
    for (const u of extractLocs(xml)) {
      if (/\/product\//.test(u)) productUrls.push(u);
      if (productUrls.length >= MAX_PRODUCTS) break;
    }
    if (productUrls.length >= MAX_PRODUCTS) break;
  }
  console.log(`    found ${productUrls.length} product URLs`);

  /* 2. Concurrency-limited fetch+parse pass. 6 in flight is polite
     for a small merchant; 600 products × ~100ms per fetch = ~10s total
     wall-clock. */
  const deals = await mapConcurrent(productUrls, 6, async (url) => {
    const html = await fetchHtml(url);
    if (!html) return null;
    const product = parseProduct(html);
    if (!product) return null;
    return productToDeal(product, url);
  });

  const ok = deals.filter((d): d is RawDeal => d !== null);
  console.log(`    ✓ Fouani: ${ok.length} deals (${productUrls.length - ok.length} skipped/failed)`);
  return ok;
}
