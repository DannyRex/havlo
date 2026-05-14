#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Ingest the scraped static `deals.ts` file into the live DB tables.

   Workflow:
     npm run scrape           # Playwright → src/lib/data/deals.ts
     npm run ingest:scraped   # deals.ts   → products + offers in Supabase

   This unifies the NG-local Playwright corpus with the SerpAPI
   international corpus in the same schema, so /api/deals serves a
   single combined feed.

   Usage:
     npm run ingest:scraped                 # all stores
     npm run ingest:scraped -- --store=jumia,konga
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — process.loadEnvFile is Node-runtime, not in @types/node
  process.loadEnvFile?.(".env.local");
} catch {/* fine */}

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { deals as seedDeals } from "../src/lib/data/deals";
import { ingestDeals } from "../src/lib/providers/ingestion";
import type { Deal } from "../src/types";

/* Read scrape output from scripts/data-cache/latest.json (May 2026
   refactor — used to be src/lib/data/deals.ts but that file was
   3.3MB and bloated the server bundle by ~2.5MB).

   Falls back to the in-source seed when the runtime cache hasn't
   been generated yet (e.g. a clean clone running ingest:scraped
   without a prior `npm run scrape`). The seed only has ~15 entries
   so this fallback ingests almost nothing — log a warning so the
   operator notices. */
function loadScrapedDeals(): Deal[] {
  const cachePath = resolve(__dirname, "data-cache", "latest.json");
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf-8")) as Deal[];
  }
  console.warn(`⚠ scripts/data-cache/latest.json not found — ingesting from the in-source seed (${seedDeals.length} entries). Run \`npm run scrape\` first to populate the runtime cache.`);
  return seedDeals;
}
const deals = loadScrapedDeals();

interface CliArgs {
  storeIds?: string[];
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--store=")) {
      args.storeIds = arg.slice("--store=".length).split(",").map((s) => s.trim().toLowerCase());
    }
  }
  return args;
}

function groupByStore(items: Deal[]): Map<string, Deal[]> {
  const map = new Map<string, Deal[]>();
  for (const d of items) {
    if (!map.has(d.storeId)) map.set(d.storeId, []);
    map.get(d.storeId)!.push(d);
  }
  return map;
}

async function main() {
  const args = parseArgs();
  const storeFiltered = args.storeIds
    ? deals.filter((d) => args.storeIds!.includes(d.storeId))
    : deals;

  /* Ingest everything — let the API surface decide what to display.
     The previous `discountPercent > 0` filter was the same trap we
     fixed earlier in /api/deals: pre-filtering at ingest meant the
     API's "show all" floor was meaningless for stores that don't
     publish compare_at_price. Symptom: Shopify scrapers (HealthPlus,
     Essenza, most of Supermart) pulled full-price catalogs that
     got 100% stripped before reaching Supabase. With the filter
     removed those rows ingest cleanly and the existing /api/deals
     `minDiscount=0` default surfaces them. Discounted-only views
     are a UI tier choice on /deals, not a data-layer cull. */
  const dealsOnly = storeFiltered;
  const skipped = 0;

  if (dealsOnly.length === 0) {
    console.error("✗ No deals matched the filter.");
    process.exit(1);
  }

  const byStore = groupByStore(dealsOnly);

  console.log(`▶ Ingesting scraped deals into DB`);
  console.log(`  In file:       ${storeFiltered.length}`);
  console.log(`  Will ingest:   ${dealsOnly.length}`);
  console.log(`  Skipped (0%):  ${skipped}`);
  console.log(`  Stores:        ${Array.from(byStore.keys()).join(", ")}`);
  console.log("");

  const startedAt = Date.now();
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;

  for (const [storeId, batch] of byStore) {
    const label = `[${storeId.padEnd(12)}]`;
    try {
      /* Pass `sweepScope: { store: storeId }` — these scrapers walk
         each store's full public catalog, so any offer in the DB
         that wasn't re-seen this run is stale and should be marked
         out-of-stock. ingestDeals has its own safety guards (skips
         sweep if batch is suspiciously small or shrinks too much
         vs the existing in-stock count) so partial scrape failures
         won't accidentally zero out a healthy catalog. */
      const result = await ingestDeals(
        "playwright-scraper",
        storeId,
        batch,
        { sweepScope: { store: storeId } },
      );
      totalFetched += result.fetched;
      totalUpserted += result.upserted;
      totalErrors += result.errors.length;

      const discounts = batch.map((d) => d.discountPercent);
      const avg = Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length);
      const min = Math.min(...discounts);
      const max = Math.max(...discounts);

      const flag = result.errors.length === 0 ? "✓" : "⚠";
      console.log(
        `${flag} ${label}  fetched=${result.fetched} upserted=${result.upserted} (avg ${avg}%, range ${min}-${max}%) errors=${result.errors.length}`,
      );
      if (result.errors.length > 0) {
        for (const e of result.errors.slice(0, 2)) console.log(`    · ${e}`);
        if (result.errors.length > 2) console.log(`    · …and ${result.errors.length - 2} more`);
      }
    } catch (err) {
      totalErrors += 1;
      console.error(`✗ ${label} threw: ${(err as Error).message}`);
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log(`▶ Done in ${elapsedSec}s`);
  console.log(`  Fetched:  ${totalFetched}`);
  console.log(`  Upserted: ${totalUpserted}`);
  console.log(`  Errors:   ${totalErrors}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
