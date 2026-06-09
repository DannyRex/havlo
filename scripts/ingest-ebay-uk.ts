#!/usr/bin/env tsx
/* eBay UK ingest orchestrator (opt-in, standalone).
 *
 *   Pulls real ebay.co.uk listings via SerpAPI's eBay engine and writes
 *   them through the normal ingestDeals() pipeline. Because every URL is
 *   ebay.co.uk, dealToStoreRow's ebayMarketFromUrl tags store_country=UK,
 *   so they surface as UK-local eBay deals. Not wired into the cron scrape
 *   — run it by hand (or add to a workflow later) once validated.
 *
 *   Run:
 *     npm run ingest:ebay-uk -- --dry-run     # fetch + log, NO DB writes
 *     npm run ingest:ebay-uk                  # fetch + upsert
 *     npm run ingest:ebay-uk -- --limit=5     # first 5 queries only (cheap test)
 *
 *   Cost: 1 SerpAPI credit per query (~28 for the full seed list). */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { fetchEbayUkDealsViaSerpapi, UK_EBAY_QUERIES } from "../src/lib/providers/search-ebay-serpapi";
import { ingestDeals } from "../src/lib/providers/ingestion";
import type { Deal } from "../src/types";

function parseArgs(): { dryRun: boolean; limit: number | null } {
  let dryRun = false;
  let limit: number | null = null;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) {
      const n = parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    }
  }
  return { dryRun, limit };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { dryRun, limit } = parseArgs();
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) { console.error("✗ SERPAPI_KEY not set"); process.exit(1); }

  const queries = limit ? UK_EBAY_QUERIES.slice(0, limit) : UK_EBAY_QUERIES;

  console.log(`▶ eBay UK ingest ${dryRun ? "(DRY RUN — no writes)" : ""}`);
  console.log(`  ${queries.length} queries against ebay.co.uk  (~${queries.length} SerpAPI credits)\n`);

  const accumulated: Deal[] = [];
  const errors: string[] = [];
  let calls = 0;

  /* Serial to stay under SerpAPI's rate limit (free Developer plan:
     5 calls/sec). A small inter-call pause keeps us comfortable. */
  for (const q of queries) {
    calls++;
    try {
      const deals = await fetchEbayUkDealsViaSerpapi(q, apiKey);
      accumulated.push(...deals);
      process.stdout.write(`  · ${q.q.padEnd(30)} → ${deals.length} listings\n`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${q.q}: ${msg}`);
      process.stdout.write(`  ✗ ${q.q.padEnd(30)} → ${msg.slice(0, 90)}\n`);
    }
    await sleep(250);
  }

  /* Dedup by URL in-batch (the same item can surface under several
     queries). The offer-upsert handles cross-run dedup via (store_id, url). */
  const seen = new Set<string>();
  const unique = accumulated.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));

  console.log(`\n  ${calls} calls, ${accumulated.length} raw → ${unique.length} unique listings`);

  if (dryRun) {
    console.log("\n  DRY RUN — sample of what would be written:");
    for (const d of unique.slice(0, 8)) {
      console.log(`    ${d.storeName} | $${d.salePrice} | ${d.title.slice(0, 50)} | ${d.url.slice(0, 60)}`);
    }
    console.log(`\n  (${unique.length} listings ready; re-run without --dry-run to upsert.)`);
    if (errors.length) console.log(`  ${errors.length} query error(s).`);
    return;
  }

  let upserted = 0;
  if (unique.length > 0) {
    /* source_query "ebay-uk:uk" — trailing ":uk" lets the ingest writer's
       country resolution confirm UK, agreeing with the domain tag. */
    const result = await ingestDeals("serpapi-ebay-uk", "ebay-uk:uk", unique);
    upserted = result.upserted;
    for (const er of result.errors) console.log(`    ! ${er}`);
  }

  console.log(`\n✓ Done — upserted ${upserted} / ${unique.length} listings`);
  if (errors.length) console.log(`  ${errors.length} query error(s) (see above).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
