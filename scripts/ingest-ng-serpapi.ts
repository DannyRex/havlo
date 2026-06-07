#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   NG-merchant SerpAPI ingest orchestrator.

   Runs the search-ng-merchant-serpapi provider against every
   MerchantConfig in NG_MERCHANT_CONFIGS, with the per-merchant
   query list from NG_MERCHANT_QUERIES. Replaces the broken /
   silent Playwright scrapers for Slot, 3C Hub, Jiji, Spar, Kara,
   Obiwezy.

   Cost: ~72 SerpAPI credits per run (Slot 12 + Kara 10 + Konga 14 =
   36 queries, each firing engine=google + a google_images companion).
   Mon/Wed/Fri cadence (~13 runs/mo) = ~940 credits/month, ~19% of the
   Developer plan budget.

   Usage:
     npm run ingest:ng-serpapi                    # all 6 merchants
     npm run ingest:ng-serpapi -- --store=slot    # one merchant only
     npm run ingest:ng-serpapi -- --dry-run       # log only, no writes

   Order of operations:
     1. For each merchant config:
        a. For each query in NG_MERCHANT_QUERIES[storeId]:
           - SerpAPI call (google + site:domain filter)
           - Map organic results → Deal[]
        b. Concatenate the merchant's Deal[] across all queries
        c. ingestDeals(provider, sourceQuery, deals)
           — ingest writer handles store country tag (layer 3
             source_query parse), URL canonicalisation, dedup,
             orphan reconciliation, TTL sweep.
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { fetchMerchantDealsViaSerpapi } from "../src/lib/providers/search-ng-merchant-serpapi";
import { NG_MERCHANT_CONFIGS, NG_MERCHANT_QUERIES } from "../src/lib/providers/ng-merchant-configs";
import { ingestDeals } from "../src/lib/providers/ingestion";

interface Args {
  store?:   string;
  dryRun?:  boolean;
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
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) { console.error("✗ SERPAPI_KEY not set"); process.exit(1); }

  const configs = store
    ? NG_MERCHANT_CONFIGS.filter((c) => c.storeId === store)
    : NG_MERCHANT_CONFIGS;
  if (configs.length === 0) {
    console.error(`✗ no merchant config matches --store=${store}`);
    console.error(`  available: ${NG_MERCHANT_CONFIGS.map((c) => c.storeId).join(", ")}`);
    process.exit(1);
  }

  console.log(`▶ NG-merchant ingest ${dryRun ? "(DRY RUN)" : ""}`);
  console.log(`  merchants: ${configs.map((c) => c.storeId).join(", ")}\n`);

  let totalCredits = 0;
  let totalDeals = 0;
  let totalUpserted = 0;
  const totals: Array<{ store: string; calls: number; deals: number; upserted: number; errors: string[] }> = [];

  for (const config of configs) {
    const queries = NG_MERCHANT_QUERIES[config.storeId] ?? [];
    if (queries.length === 0) {
      console.log(`  ${config.storeId.padEnd(12)} skipped — no queries configured`);
      continue;
    }
    console.log(`\n[${config.storeId}] ${queries.length} queries against site:${config.domain}`);

    const all: ReturnType<typeof Promise.resolve> extends Promise<infer _> ? never : never = undefined as never;
    void all;
    const accumulated: import("../src/types").Deal[] = [];
    const errors: string[] = [];
    let calls = 0;

    /* Serial per-merchant to avoid bursting SerpAPI's rate limit
       (free Developer plan: 5 calls/sec). Inter-merchant remains
       serial too — net wall time ~60 × 0.5s ≈ 30s per full run. */
    for (const q of queries) {
      calls++;
      try {
        const deals = await fetchMerchantDealsViaSerpapi(config, q, apiKey);
        accumulated.push(...deals);
        process.stdout.write(`  · ${q.padEnd(28)} → ${deals.length} deals\n`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${q}: ${msg}`);
        process.stdout.write(`  ✗ ${q.padEnd(28)} → ${msg.slice(0, 80)}\n`);
      }
    }

    /* Dedup by URL within the merchant before ingestion (a query
       can pull the same SKU under different search terms). The
       ingest writer's offer-upsert handles cross-run dedup via
       (store_id, url) uniqueness but in-batch we want the bulk
       insert to start with unique rows. */
    const seenUrls = new Set<string>();
    const uniqueDeals = accumulated.filter((d) => {
      if (seenUrls.has(d.url)) return false;
      seenUrls.add(d.url);
      return true;
    });

    console.log(`  ${calls} calls, ${accumulated.length} raw → ${uniqueDeals.length} unique`);

    let upserted = 0;
    if (uniqueDeals.length > 0 && !dryRun) {
      /* source_query = "<storeId>:ng" — the trailing ":ng" lets the
         ingest writer's layer-3 country fallback set store.country='NG'
         on first ingest if it's not already tagged. */
      const result = await ingestDeals(`serpapi-${config.storeId}`, `${config.storeId}:ng`, uniqueDeals);
      upserted = result.upserted;
      if (result.errors.length > 0) {
        for (const er of result.errors) console.log(`    ! ${er}`);
        errors.push(...result.errors);
      }
      console.log(`  → upserted ${upserted}`);
    }

    totalCredits += calls;
    totalDeals += uniqueDeals.length;
    totalUpserted += upserted;
    totals.push({ store: config.storeId, calls, deals: uniqueDeals.length, upserted, errors });
  }

  console.log("\n" + "─".repeat(60));
  console.log("Summary");
  console.log("─".repeat(60));
  for (const t of totals) {
    const tag = t.errors.length > 0 ? ` (${t.errors.length} errors)` : "";
    console.log(`  ${t.store.padEnd(12)} calls=${String(t.calls).padStart(3)}  deals=${String(t.deals).padStart(4)}  upserted=${String(t.upserted).padStart(4)}${tag}`);
  }
  console.log(`\n  TOTAL: ${totalCredits} SerpAPI credits, ${totalDeals} deals seen, ${totalUpserted} upserted`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
