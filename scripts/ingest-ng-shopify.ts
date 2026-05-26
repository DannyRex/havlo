#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   NG Shopify-JSON ingest orchestrator.

   Bypasses the Playwright cron orchestrator for NG retailers that
   run on Shopify. Shopify exposes /collections/<handle>/products.json
   as a public no-auth JSON endpoint with the full structured catalog
   — no DOM scraping, no Cloudflare wall, no theme-render timing.

   Why a separate path from scripts/scrape.ts:
     The Playwright orchestrator launches a browser per store, and
     when ANY scraper in that chain times out / errors / hangs,
     stores downstream in the chain don't run. Phase 5 audit (May
     2026) found 3CHub producing ~73 in-stock offers even though
     its Shopify catalog has ~93 — the gap was the orchestrator
     missing the /collections/all bucket because earlier scrapers
     burned through the per-job time budget.

     This standalone path runs the same _shopify-json helper
     directly (no Playwright, ~3s per store) so 3CHub (and any
     future NG Shopify store) gets a guaranteed clean ingest.

   Cost: zero external API credits. Pure HTTPS fetch to the
   retailer's own JSON endpoint.

   Usage:
     npm run ingest:ng-shopify                  # all configured stores
     npm run ingest:ng-shopify -- --store=threechub --dry-run
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { scrapeShopifyCatalog, type ShopifyConfig } from "./scrapers/_shopify-json.js";
import type { RawDeal } from "./scrapers/types.js";
import { ingestDeals } from "../src/lib/providers/ingestion.js";
import type { Deal } from "../src/types/index.js";

/* ── Shopify configs per store ───────────────────────────────────
   New store = new block here. Each config lists the collection
   handles to walk. `/collections/all` is the catch-all every Shopify
   store auto-generates; pair it with brand-specific handles so the
   per-page-cap doesn't truncate flagship coverage. */
const SHOPIFY_CONFIGS: ShopifyConfig[] = [
  /* ── 3C Hub — major NG phones + electronics retailer ────────── */
  {
    name:    "3C Hub",
    storeId: "threechub",
    baseUrl: "https://www.3chub.com",
    collections: [
      /* Catch-all FIRST so we don't miss any product Shopify exposes
         in /collections/all but not in a brand-specific collection.
         The dedup-by-handle inside scrapeShopifyCatalog means
         products that appear in both buckets only get one row. */
      { handle: "all",                    cat: "phones" },
      /* Brand-specific buckets in priority order. iPhone-17 / -16
         flagship coverage first so they're guaranteed even if the
         per-collection page cap clips the long tail. */
      { handle: "iphone-17-series",       cat: "phones" },
      { handle: "iphone-16-series",       cat: "phones" },
      { handle: "iphone",                 cat: "phones" },
      { handle: "samsung-mobile-phone",   cat: "phones" },
      { handle: "tecno-mobile-phone",     cat: "phones" },
      { handle: "infinix-mobile-phone",   cat: "phones" },
      { handle: "itel-mobile-phone",      cat: "phones" },
      { handle: "xiaomi-mobile-phone",    cat: "phones" },
      { handle: "oppo",                   cat: "phones" },
      { handle: "vivo",                   cat: "phones" },
      { handle: "honor",                  cat: "phones" },
      /* Adjacent categories */
      { handle: "tablets",                cat: "phones" },
      { handle: "tvs",                    cat: "electronics" },
      { handle: "earphone",               cat: "audio" },
    ],
    /* /collections/all + 14 brand handles × 1 page × 250 products
       caps per-store work at ~15 fetches. Each product is unique-by-
       handle inside scrapeShopifyCatalog so the math is "at most 250
       deals × 15 collections = 3,750 deals" but in practice the catalog
       is much smaller (3CHub ~120 active SKUs total). */
    pageLimit: 1,
  },

  /* Future NG Shopify stores append here. Examples to investigate
     if their /products.json is publicly reachable:
       - pointek.com.ng     (electronics)
       - hayathub.com       (gadgets)
       - mobinex.ng         (phones)
     Each one is a 1-block addition. */
];

/* RawDeal → Deal adapter. The Shopify helper returns the scraper
   shape (RawDeal); ingestDeals wants the app shape (Deal). The two
   are 95% the same — Deal adds id, expiresAt, isHot/isFeatured,
   postedAt, saves, clicks, and uses categorySlug from category. */
function rawToDeal(r: RawDeal, idx: number, sourceQuery: string): Deal {
  return {
    id:              `shopify-${r.storeId}-${Date.now().toString(36)}-${idx}`,
    title:           r.title,
    description:     r.description || r.title,
    category:        r.category,
    categorySlug:    r.categorySlug,
    storeId:         r.storeId,
    storeName:       r.storeName,
    originalPrice:   r.originalPrice,
    salePrice:       r.salePrice,
    discountPercent: r.discountPercent,
    currency:        r.currency ?? "NGN",
    imageUrl:        r.imageUrl,
    url:             r.url,
    expiresAt:       null,
    isHot:           r.discountPercent >= 30,
    isFeatured:      false,
    tags:            [...r.tags, "country:ng"],
    saves:           0,
    clicks:          0,
    postedAt:        new Date().toISOString().slice(0, 10),
    /* sourceQuery hint embedded for ingestDeals's three-layer
       country resolution. The trailing `:ng` lets layer 3 set
       stores.country='NG' on first ingest if it isn't already
       tagged. Threaded through via the source_query arg below. */
    storeCountry:    "NG",
  };
  void sourceQuery;  // unused here; consumed by ingestDeals
}

interface Args {
  store?:  string;
  dryRun?: boolean;
}

function parseArgs(): Args {
  const a: Args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--store=")) a.store = arg.slice("--store=".length).toLowerCase();
    else if (arg === "--dry-run")   a.dryRun = true;
  }
  return a;
}

async function main() {
  const { store, dryRun } = parseArgs();
  const configs = store
    ? SHOPIFY_CONFIGS.filter((c) => c.storeId === store)
    : SHOPIFY_CONFIGS;
  if (configs.length === 0) {
    console.error(`✗ no Shopify config matches --store=${store}`);
    console.error(`  available: ${SHOPIFY_CONFIGS.map((c) => c.storeId).join(", ")}`);
    process.exit(1);
  }
  console.log(`▶ NG Shopify-JSON ingest ${dryRun ? "(DRY RUN)" : ""}`);
  console.log(`  stores: ${configs.map((c) => c.storeId).join(", ")}\n`);

  let totalDeals = 0;
  let totalUpserted = 0;
  const errors: string[] = [];

  for (const cfg of configs) {
    const raw = await scrapeShopifyCatalog(cfg);
    /* Dedup by URL inside the batch — scrapeShopifyCatalog already
       dedups by handle but two different collections can technically
       resolve the same handle (rare); the URL check is the safety
       net. */
    const seenUrls = new Set<string>();
    const dealsBatch: Deal[] = [];
    const sourceQuery = `${cfg.storeId}:ng`;
    raw.forEach((r, i) => {
      if (seenUrls.has(r.url)) return;
      seenUrls.add(r.url);
      dealsBatch.push(rawToDeal(r, i, sourceQuery));
    });

    console.log(`  → ${cfg.storeId}: ${raw.length} raw → ${dealsBatch.length} unique`);
    totalDeals += dealsBatch.length;

    if (dryRun || dealsBatch.length === 0) continue;

    /* sweepScope per store so offers absent from this run get
       flipped in_stock=false. Shopify ingest is a FULL-catalog walk
       (we hit /collections/all), so a sweep is safe — anything
       not in the live response is genuinely not in the catalog
       anymore.

       ingestDeals's MIN_DEALS_FOR_SWEEP (10) + the 40%-of-existing
       guard prevent the worst case where a transient HTTP error
       returns near-empty and would otherwise nuke the whole catalog. */
    const result = await ingestDeals(`shopify-json-${cfg.storeId}`, sourceQuery, dealsBatch, {
      sweepScope: { store: cfg.storeId },
    });
    totalUpserted += result.upserted;
    if (result.errors.length > 0) {
      for (const e of result.errors) {
        console.log(`    ! ${e}`);
        errors.push(`${cfg.storeId}: ${e}`);
      }
    }
    console.log(`    upserted ${result.upserted}`);
  }

  console.log("\n" + "─".repeat(60));
  console.log(`Summary: ${totalDeals} deals seen, ${totalUpserted} upserted${errors.length > 0 ? `, ${errors.length} errors` : ""}`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
