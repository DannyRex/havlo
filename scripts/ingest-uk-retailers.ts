#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   UK retailer-biased SerpAPI ingest.

   Why this exists: the standard ingest-providers.ts uses category
   names ("Phones", "Laptops") as queries against gl=uk. Google
   Shopping UK ranks Amazon results first for those generic queries,
   so the UK pool ended up dominated by Amazon UK + cross-border
   (AliExpress / Shein / Temu / DHgate / ASOS) with almost no native
   UK retailers (Argos / Currys / John Lewis / Boots / AO.com).

   The QA agent flagged this directly: UK shoppers were seeing
   "Local stores: 0" because the SerpAPI ingest wasn't surfacing UK
   high-street retailers and Havlo had no UK-specific scrapers.

   This script fixes that by querying SerpAPI with retailer + product
   queries ("Argos iPhone 17 Pro Max", "Currys MacBook Pro M4"). The
   retailer-name prefix biases Google Shopping toward listings from
   that retailer specifically. We then filter the response to keep
   only rows whose source matches the target retailer (drops the
   inevitable Amazon spillover Google sneaks into every result set).

   Cost:
     8 retailers × ~6 SKUs = ~48 SerpAPI credits per run. Cheap.
     Twice-weekly cron = ~96/month against a 1,000-credit Starter plan.

   Usage:
     npm run ingest:uk-retailers
     npm run ingest:uk-retailers -- --retailers=argos,currys
     npm run ingest:uk-retailers -- --skus=iphone,macbook
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";
import type { Deal } from "../src/types";

/* UK retailers we want represented in the pool. Each entry is a
   short matcher token used to filter SerpAPI source strings — keep
   it lowercase and substring-friendly. The retailer is also passed
   as a query prefix to bias Google Shopping toward this source.

   Picked for two criteria:
     1. Real UK high-street presence (so users recognise the name)
     2. Sells across electronics + general retail (broad SKU coverage)
   Skipped Amazon UK (already in the curated catalog), Tesco/Sainsbury
   (mostly groceries, low cross-shop overlap with our product types). */
const UK_RETAILERS: Array<{ name: string; matcher: string }> = [
  { name: "Argos",          matcher: "argos"        },
  { name: "Currys",         matcher: "currys"       },
  { name: "John Lewis",     matcher: "john lewis"   },
  { name: "Boots",          matcher: "boots"        },
  { name: "AO.com",         matcher: "ao.com"       },
  { name: "Very",           matcher: "very"         },
  { name: "Selfridges",     matcher: "selfridges"   },
  { name: "Marks & Spencer", matcher: "marks"       },
];

/* SKU queries that match the UK retail mix. Apple flagships +
   Samsung flagships drive the most search volume; PS5 / Xbox /
   Switch are cross-cutting; appliances + audio fill the long tail.
   Each query becomes one SerpAPI call per retailer. */
const TARGET_SKUS: Array<{ q: string; categorySlug: string }> = [
  // Phones — Apple + Samsung flagships
  { q: "iPhone 17 Pro Max",        categorySlug: "phones" },
  { q: "iPhone 17",                categorySlug: "phones" },
  { q: "Samsung Galaxy S26 Ultra", categorySlug: "phones" },
  { q: "Google Pixel 10 Pro",      categorySlug: "phones" },
  // Computing — current Apple silicon
  { q: "MacBook Pro M4",           categorySlug: "computing" },
  { q: "MacBook Air M3",           categorySlug: "computing" },
  { q: "iPad Pro M4",              categorySlug: "computing" },
  // Gaming
  { q: "PlayStation 5 Slim",       categorySlug: "electronics" },
  { q: "Xbox Series X",            categorySlug: "electronics" },
  { q: "Nintendo Switch OLED",     categorySlug: "electronics" },
  // Audio
  { q: "AirPods Pro 2",            categorySlug: "audio" },
  { q: "Sony WH-1000XM5",          categorySlug: "audio" },
  // TV — UK retailers carry strong TV ranges
  { q: "LG OLED TV 55 inch",       categorySlug: "televisions" },
  { q: "Samsung QLED TV 55 inch",  categorySlug: "televisions" },
];

interface CliArgs {
  retailerMatchers?: Set<string>;
  skuTokens?:       string[];
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--retailers=")) {
      args.retailerMatchers = new Set(
        arg.slice("--retailers=".length).split(",").map((s) => s.trim().toLowerCase()),
      );
    } else if (arg.startsWith("--skus=")) {
      args.skuTokens = arg
        .slice("--skus=".length)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const providers = getActiveSearchProviders().filter((p) => p.id === "serpapi-shopping");

  if (providers.length === 0) {
    console.error("✗ SerpAPI provider inactive. Set SERPAPI_KEY in env.");
    process.exit(1);
  }
  const provider = providers[0];

  const retailers = UK_RETAILERS.filter(
    (r) => !args.retailerMatchers || args.retailerMatchers.has(r.matcher),
  );
  const skus = TARGET_SKUS.filter(
    (s) =>
      !args.skuTokens ||
      args.skuTokens.some((t) => s.q.toLowerCase().includes(t)),
  );

  const totalCalls = retailers.length * skus.length;
  console.log(`▶ UK retailer ingest — ${totalCalls} SerpAPI calls`);
  console.log(`  Retailers: ${retailers.map((r) => r.name).join(", ")}`);
  console.log(`  SKUs:      ${skus.length} queries × ${retailers.length} retailers`);
  console.log("");

  const startedAt = Date.now();
  let totalFetched  = 0;
  let totalKept     = 0;
  let totalUpserted = 0;
  let totalErrors   = 0;

  for (const retailer of retailers) {
    let retailerKept = 0;

    for (const sku of skus) {
      const q = `${retailer.name} ${sku.q}`;
      const label = `[${retailer.name.padEnd(15)}] ${sku.q.padEnd(28)}`;
      try {
        const raw = await provider.searchDeals({
          q,
          countryCode: "uk",
          limit: 10,
        });

        /* Filter to ONLY this retailer. Google Shopping returns
           Amazon spillover even on retailer-prefixed queries; we
           match on store substring (case-insensitive) to keep the
           target retailer's rows and drop the rest. */
        const onTarget = raw.filter((d: Deal) => {
          const storeNameLc = d.storeName.toLowerCase();
          const storeIdLc   = d.storeId.toLowerCase();
          return storeNameLc.includes(retailer.matcher) || storeIdLc.includes(retailer.matcher);
        });

        /* Tag with category so /api/deals?category=... groups
           correctly. Same pattern as ingest-providers.ts. */
        onTarget.forEach((d) => {
          d.categorySlug = sku.categorySlug;
        });

        const result = await ingestDeals(provider.id, `${retailer.matcher}:${sku.q}:uk`, onTarget);
        totalFetched  += raw.length;
        totalKept     += onTarget.length;
        totalUpserted += result.upserted;
        totalErrors   += result.errors.length;
        retailerKept  += onTarget.length;

        console.log(
          `${result.errors.length === 0 ? "✓" : "⚠"} ${label} raw=${raw.length} kept=${onTarget.length} upserted=${result.upserted}`,
        );
      } catch (err) {
        totalErrors += 1;
        console.error(`✗ ${label} threw: ${(err as Error).message}`);
      }
    }
    console.log(`  → ${retailer.name}: ${retailerKept} matching rows ingested`);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log(`▶ Done in ${elapsedSec}s`);
  console.log(`  SerpAPI raw rows fetched: ${totalFetched}`);
  console.log(`  Kept (on-target retailer): ${totalKept}`);
  console.log(`  Upserted to DB:           ${totalUpserted}`);
  console.log(`  Errors:                   ${totalErrors}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
