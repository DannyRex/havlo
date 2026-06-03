#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Brand DTC scraper — pulls MSRP from manufacturer direct sites
   (Apple, Samsung, Sony, Dyson, Bose) to anchor the upper end of
   the spectrum on flagship products.

   Why this matters: Google Shopping's algorithm down-ranks DTC
   listings in favor of retailer promos. Even market-mode ingest
   (which drops the "deals" suffix) rarely surfaces apple.com,
   sony.com etc. So the spectrum's "highest price" tick reads as
   the most-discounted-retailer price rather than the real MSRP,
   which makes the spectrum read narrower than reality.

   This script bridges that gap. Free (no SerpAPI), uses fetch
   against the brand's product detail pages (or sitemaps). Targets
   only the 5-10 flagship products per brand — not full catalogue.

   Run:
     npm run scrape:brand-dtc                   # all brands
     npm run scrape:brand-dtc -- --brand=apple  # one brand

   Cadence (when wired into a cron): weekly Sunday. MSRPs on
   flagship products don't move week-over-week, so weekly is plenty.
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { ingestDeals } from "../src/lib/providers/ingestion";
import type { Deal } from "../src/types";

/* ── Per-brand SKU registry ─────────────────────────────────────────
   Each entry knows how to reach the brand's product page + extract
   price/title/image. Kept as a flat data structure so adding a new
   SKU is a one-line change rather than a code change. */

interface BrandSku {
  brand: string;           // canonical brand id (matches BRANDS in normalize.ts)
  brandName: string;       // display name
  storeId: string;         // e.g. "apple-uk"
  storeName: string;       // e.g. "Apple"
  country: string;         // ISO-2 lowercase
  currency: "USD" | "NGN"; // store currency (will normalise to USD for non-NG)
  url: string;             // product detail page URL
  title: string;           // canonical title
  category: string;        // category display name
  categorySlug: string;    // category slug for /deals filter
  /* Optional price hint — when a brand consistently lists a model's
     MSRP at a known number AND we can't reliably scrape it (anti-bot,
     JS rendering), we fall back to this. Keeps the lane reliable
     without going dark on anti-bot blocks. */
  fallbackPrice?: number;
}

const BRAND_SKUS: BrandSku[] = [
  /* ── Apple ───────────────────────────────────────────────────────
     Apple.com pages are heavily JS-rendered. Fetch-based scrape
     gets the OpenGraph meta tags reliably, but price extraction
     needs JSON-LD parsing or Playwright. For the proof-of-concept
     we use fallback prices anchored to MSRP at launch — accurate
     within 5% for the first 12 months of any SKU's life. ─── */
  { brand: "apple", brandName: "Apple", storeId: "apple-us", storeName: "Apple", country: "us", currency: "USD",
    url: "https://www.apple.com/shop/buy-iphone/iphone-17-pro",
    title: "Apple iPhone 17 Pro 256GB",
    category: "Phones", categorySlug: "phones",
    fallbackPrice: 1099 },
  { brand: "apple", brandName: "Apple", storeId: "apple-us", storeName: "Apple", country: "us", currency: "USD",
    url: "https://www.apple.com/shop/buy-iphone/iphone-17",
    title: "Apple iPhone 17 128GB",
    category: "Phones", categorySlug: "phones",
    fallbackPrice: 799 },
  { brand: "apple", brandName: "Apple", storeId: "apple-us", storeName: "Apple", country: "us", currency: "USD",
    url: "https://www.apple.com/shop/buy-mac/macbook-pro/14-inch",
    title: "Apple MacBook Pro 14 M4 512GB",
    category: "Computing", categorySlug: "computing",
    fallbackPrice: 1599 },
  { brand: "apple", brandName: "Apple", storeId: "apple-us", storeName: "Apple", country: "us", currency: "USD",
    url: "https://www.apple.com/shop/buy-airpods/airpods-pro",
    title: "Apple AirPods Pro 2",
    category: "Audio", categorySlug: "audio",
    fallbackPrice: 249 },
  { brand: "apple", brandName: "Apple", storeId: "apple-us", storeName: "Apple", country: "us", currency: "USD",
    url: "https://www.apple.com/shop/buy-watch/apple-watch",
    title: "Apple Watch Series 10",
    category: "Wearables", categorySlug: "electronics",
    fallbackPrice: 399 },

  /* ── Sony ─── */
  { brand: "sony", brandName: "Sony", storeId: "sony-us", storeName: "Sony", country: "us", currency: "USD",
    url: "https://electronics.sony.com/audio/headphones/all-headphones/p/wh1000xm5-b",
    title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    category: "Audio", categorySlug: "audio",
    fallbackPrice: 399 },
  { brand: "sony", brandName: "Sony", storeId: "sony-us", storeName: "Sony", country: "us", currency: "USD",
    url: "https://electronics.sony.com/audio/headphones/all-headphones/p/wf1000xm5",
    title: "Sony WF-1000XM5 Wireless Earbuds",
    category: "Audio", categorySlug: "audio",
    fallbackPrice: 299 },

  /* ── Dyson ─── */
  { brand: "dyson", brandName: "Dyson", storeId: "dyson-uk", storeName: "Dyson", country: "uk", currency: "USD",
    url: "https://www.dyson.co.uk/vacuum-cleaners/sticks/dyson-v15/detect-absolute-new",
    title: "Dyson V15 Detect Absolute Cordless Vacuum",
    category: "Appliances", categorySlug: "appliances", // vacuum → appliances (split back out June 2026)
    fallbackPrice: 749 },
  { brand: "dyson", brandName: "Dyson", storeId: "dyson-uk", storeName: "Dyson", country: "uk", currency: "USD",
    url: "https://www.dyson.co.uk/hair-care/stylers/airwrap/multi-styler-complete-long",
    title: "Dyson Airwrap Complete Long",
    category: "Beauty", categorySlug: "beauty",
    fallbackPrice: 599 },

  /* ── Bose ─── */
  { brand: "bose", brandName: "Bose", storeId: "bose-us", storeName: "Bose", country: "us", currency: "USD",
    url: "https://www.bose.com/p/headphones/bose-quietcomfort-ultra-headphones/QCUH-HEADPHONEARN.html",
    title: "Bose QuietComfort Ultra Headphones",
    category: "Audio", categorySlug: "audio",
    fallbackPrice: 429 },

  /* ── Samsung ─── */
  { brand: "samsung", brandName: "Samsung", storeId: "samsung-us", storeName: "Samsung", country: "us", currency: "USD",
    url: "https://www.samsung.com/us/smartphones/galaxy-s26/buy/galaxy-s26-ultra/",
    title: "Samsung Galaxy S26 Ultra 256GB",
    category: "Phones", categorySlug: "phones",
    fallbackPrice: 1299 },
];

interface CliArgs {
  brand?: string;
  apply?: boolean;
}

function parseArgs(): CliArgs {
  const out: CliArgs = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--brand=")) out.brand = a.slice("--brand=".length).toLowerCase();
    else if (a === "--dry-run") out.apply = false;
  }
  /* Default = apply. Most callers (cron, manual top-up) want the
     scraper to actually write. --dry-run is the opt-out. */
  if (out.apply === undefined) out.apply = true;
  return out;
}

/* Fetch a product page and extract OpenGraph price if present.
   Returns null on any failure — caller falls back to the SKU's
   fallbackPrice. Resilient by design: brand sites change layouts
   often and we'd rather have stale-but-correct MSRP than ingest
   broken data. */
async function fetchOgPrice(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: {
        /* Real-browser UA — most brand sites 403 the default Node
           fetch UA. This Mac Chrome string is the lowest-friction
           and matches what most CDNs let through. */
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    /* OpenGraph product:price:amount is the cleanest source when
       brands set it (Apple, Sony, Dyson all do). Bose uses a
       different schema; the fallback covers that. */
    const ogPrice = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.]+)["']/i)
                 ?? html.match(/<meta[^>]+content=["']([\d.]+)["'][^>]+property=["']product:price:amount["']/i);
    if (ogPrice) return parseFloat(ogPrice[1]);
    /* JSON-LD price (Apple uses Product schema). Grep for the first
       "price" inside an embedded JSON block. */
    const jsonLd = html.match(/"price"\s*:\s*"?([\d.]+)"?/);
    if (jsonLd) return parseFloat(jsonLd[1]);
    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const target = args.brand
    ? BRAND_SKUS.filter((s) => s.brand === args.brand)
    : BRAND_SKUS;

  console.log(`▶ Scraping ${target.length} brand DTC SKUs${args.brand ? ` (${args.brand})` : ""}\n`);

  /* Group by store so we can ingest one batch per store. ingestDeals
     handles the store upsert + per-deal product+offer writes. */
  const byStore = new Map<string, Deal[]>();

  for (const sku of target) {
    process.stdout.write(`  ${sku.storeId}  ${sku.title.padEnd(45)} `);
    const scraped = await fetchOgPrice(sku.url);
    const price = scraped ?? sku.fallbackPrice;
    if (!price) {
      console.log("✗ no price available");
      continue;
    }
    const deal: Deal = {
      id: `dtc-${sku.storeId}-${encodeURIComponent(sku.title).slice(0, 50)}`,
      title: sku.title,
      description: null,
      category: sku.category,
      categorySlug: sku.categorySlug,
      storeId: sku.storeId,
      storeName: sku.storeName,
      originalPrice: price,
      salePrice: price,
      /* DTC scrape = brand selling at MSRP. discountPercent=0 makes
         this row land as is_deal=false in the products table, which
         is the right semantic — DTC anchors the upper end of the
         spectrum without polluting the deal feed. */
      discountPercent: 0,
      currency: sku.currency,
      imageUrl: undefined,
      url: sku.url,
      expiresAt: null,
      isHot: false,
      isFeatured: false,
      tags: ["dtc", sku.brand, `country:${sku.country}`],
      saves: 0,
      clicks: 0,
      postedAt: new Date().toISOString().slice(0, 10),
    };
    const list = byStore.get(sku.storeId) ?? [];
    list.push(deal);
    byStore.set(sku.storeId, list);
    console.log(scraped ? `✓ scraped $${price}` : `✓ fallback $${price}`);
  }

  if (!args.apply) {
    console.log(`\nDry-run complete. Re-run without --dry-run to ingest.`);
    return;
  }

  console.log(`\n▶ Ingesting ${byStore.size} stores → Supabase`);
  let totalUpserted = 0;
  for (const [storeId, deals] of byStore) {
    const result = await ingestDeals("brand-dtc", `dtc:${storeId}`, deals);
    totalUpserted += result.upserted;
    console.log(`  ${storeId}  fetched=${result.fetched} upserted=${result.upserted} errors=${result.errors.length}`);
    if (result.errors.length > 0) {
      for (const e of result.errors.slice(0, 2)) console.log(`    · ${e}`);
    }
  }

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`✓ Brand DTC ingest complete — upserted=${totalUpserted}`);
  console.log(`──────────────────────────────────────────────────────────────`);
}

main().catch((err) => { console.error("✗ Fatal:", err); process.exit(1); });
