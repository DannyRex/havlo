#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Amazon-marketplace ingest via SerpAPI's dedicated `engine=amazon`.

   Why this exists: the standard ingest (engine=google_shopping) only
   surfaces Amazon when Google Shopping happens to rank an Amazon listing
   for a category query — so our Amazon catalogue was thin and lopsided
   (amazon-us had ~5 offers, while amazon-uk rode google.co.uk's Amazon
   bias to ~600). The engine=amazon lane queries each marketplace's own
   catalogue directly, so every flagship query returns a full page of
   real Amazon offers per market — the depth that powers cross-store
   comparison on the PDP spectrum + /compare.

   Replaces the retired PA-API path (Amazon Product Advertising API was
   retired May 2026; the engine=amazon SerpAPI lane is the live route).

   For each marketplace × each flagship SKU we fire ONE engine=amazon
   search (1 credit) and keep full-price rows too (enrichment), so the
   spectrum reflects honest Amazon pricing, not just promos.

   Cost:
     4 marketplaces (US/UK/AE/IN) × 16 flagship SKUs = 64 SerpAPI calls
     per run. Wired to run on WEDNESDAYS ONLY (the enrichment day) →
     ~64 × ~4.3 runs/mo = ~275 credits/month, well inside the 5,000-credit
     Developer plan and leaving the live-search headroom intact.
     ZA omitted (SerpAPI has no amazon.co.za engine); DE omitted
     (deferred launch); NG has no Amazon marketplace.

   Usage:
     npm run ingest:amazon
     npm run ingest:amazon -- --markets=us,uk
     npm run ingest:amazon -- --skus=iphone,macbook
     npm run ingest:amazon -- --deals-only      # drop full-price rows
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import {
  serpapiAmazonProvider,
  AMAZON_MARKETPLACES,
  AMAZON_MARKETPLACE_CODES,
} from "../src/lib/providers/search-amazon-serpapi";
import { ingestDeals } from "../src/lib/providers/ingestion";

/* ── Flagship SKUs ───────────────────────────────────────────────────
   Model-numbered, high-value products that (a) Amazon stocks across all
   four marketplaces and (b) we likely already carry from other stores —
   so the Amazon offers POOL into existing products and deepen cross-store
   comparison instead of landing as orphans. Aligned with the UK-retailer
   FLAGSHIP_SKUS where they overlap, plus a few Amazon-native staples
   (Kindle, Echo). Tune via --skus=. */
type SkuQuery = { q: string; categorySlug: string };

const FLAGSHIP_SKUS: SkuQuery[] = [
  { q: "iPhone 17 Pro Max",        categorySlug: "phones" },
  { q: "Samsung Galaxy S26 Ultra", categorySlug: "phones" },
  { q: "MacBook Pro M4",           categorySlug: "computing" },
  { q: "iPad Air",                 categorySlug: "computing" },
  { q: "Dell XPS 15",              categorySlug: "computing" },
  { q: "Logitech MX Master 3S",    categorySlug: "computing" },
  { q: "Sony WH-1000XM5",          categorySlug: "audio" },
  { q: "AirPods Pro 2",            categorySlug: "audio" },
  { q: "Bose QuietComfort Ultra",  categorySlug: "audio" },
  { q: "PlayStation 5 Slim",       categorySlug: "gaming" },
  { q: "Xbox Series X",            categorySlug: "gaming" },
  { q: "Nintendo Switch 2",        categorySlug: "gaming" },
  { q: "Samsung 65 inch OLED TV",  categorySlug: "electronics" },
  { q: "Apple Watch Series 10",    categorySlug: "electronics" },
  { q: "Kindle Paperwhite",        categorySlug: "electronics" },
  { q: "Dyson V15 Detect",         categorySlug: "appliances" },
];

interface CliArgs {
  marketKeys?: Set<string>;
  skuTokens?:  string[];
  dealsOnly:   boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { dealsOnly: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--markets=")) {
      args.marketKeys = new Set(
        arg.slice("--markets=".length).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      );
    } else if (arg.startsWith("--skus=")) {
      args.skuTokens = arg
        .slice("--skus=".length)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg === "--deals-only") {
      args.dealsOnly = true;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (!serpapiAmazonProvider.isActive()) {
    console.error("✗ SerpAPI Amazon provider inactive. Set SERPAPI_KEY in env (and ensure SERPAPI_DISABLED is not 'true').");
    process.exit(1);
  }

  const markets = AMAZON_MARKETPLACE_CODES.filter(
    (cc) => !args.marketKeys || args.marketKeys.has(cc),
  );
  const skus = FLAGSHIP_SKUS.filter(
    (s) => !args.skuTokens || args.skuTokens.some((t) => s.q.toLowerCase().includes(t)),
  );

  if (markets.length === 0 || skus.length === 0) {
    console.error("✗ Nothing to ingest after --markets / --skus filters.");
    process.exit(1);
  }

  // Enrichment by default: keep full-price Amazon rows so the PDP spectrum +
  // /compare see honest market range, not just promos. --deals-only flips it.
  const keepFullPrice = !args.dealsOnly;
  const totalCalls = markets.length * skus.length;

  console.log(`▶ Amazon (engine=amazon) ingest — ${totalCalls} SerpAPI calls planned`);
  console.log(`  Markets: ${markets.map((m) => AMAZON_MARKETPLACES[m].storeName).join(", ")}`);
  console.log(`  SKUs:    ${skus.length} | mode: ${keepFullPrice ? "enrichment (keep full-price)" : "deals-only"}`);
  console.log("");

  const startedAt = Date.now();
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;

  for (const cc of markets) {
    const mk = AMAZON_MARKETPLACES[cc];
    let marketUpserted = 0;

    for (const sku of skus) {
      const label = `[${mk.storeName.padEnd(13)}] ${sku.q.padEnd(26)}`;
      try {
        const deals = await serpapiAmazonProvider.searchDeals({
          q: sku.q,
          countryCode: cc,
          limit: 12,
          keepFullPrice,
        });

        // Stamp the seed query's category so /api/deals?category=… groups
        // correctly (the provider returns category="all"; ingestion's
        // categorize.ts refines further from the title).
        deals.forEach((d) => { d.categorySlug = sku.categorySlug; });

        const result = await ingestDeals(serpapiAmazonProvider.id, `${cc}:${sku.q}`, deals);
        totalFetched += deals.length;
        totalUpserted += result.upserted;
        totalErrors += result.errors.length;
        marketUpserted += result.upserted;

        console.log(
          `${result.errors.length === 0 ? "✓" : "⚠"} ${label} kept=${deals.length} upserted=${result.upserted}`,
        );
      } catch (err) {
        totalErrors += 1;
        console.error(`✗ ${label} threw: ${(err as Error).message}`);
      }
    }
    console.log(`  → ${mk.storeName}: ${marketUpserted} offers ingested`);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log(`▶ Done in ${elapsedSec}s`);
  console.log(`  Amazon rows fetched:  ${totalFetched}`);
  console.log(`  Upserted to DB:       ${totalUpserted}`);
  console.log(`  Errors:               ${totalErrors}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
