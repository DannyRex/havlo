#!/usr/bin/env tsx
/* ─────────────────────────────────────────────────────────────────
   Backfill: re-search products users LOOKED FOR but got 0 results.

   The search_query_log table records every search the user made,
   including result_count = 0 ("you typed it, we had nothing").
   That's literally users telling us "this product is missing from
   your catalog." This script:

     1. Pulls the top 100 zero-result queries from the last 7 days
        (deduped + lowercased, ranked by frequency)
     2. For each query, runs SerpAPI Google Shopping in the
        querying user's country (default: NG)
     3. Persists the catch via the standard ingest pipeline
     4. Reports how many queries got filled

   Cost: ~100 SerpAPI credits (1 per query) at ~$0.005/credit ≈ $0.50.
   Expected: 60-80% of queries fill (popular real products that we
   just don't carry yet). The rest are typos / one-off niche items.

   This is the most product-led acquisition signal possible — every
   row in zero-result is a user explicitly asking for a product.

   Usage:
     npx tsx scripts/backfill-zero-result-searches.ts
     npx tsx scripts/backfill-zero-result-searches.ts --country=uk --limit=50
     npx tsx scripts/backfill-zero-result-searches.ts --days=14 --dry-run

   Idempotent — running twice in a row will re-fetch + upsert. The
   ingest writer's URL canonicaliser + signature dedup ensure no
   duplicate offers are created. */

try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";

const argv = process.argv.slice(2);
const arg  = (n: string): string | null => {
  const f = argv.find((a) => a.startsWith(`--${n}=`));
  return f ? f.slice(n.length + 3) : null;
};

const DEFAULT_COUNTRY = arg("country") ?? "ng";
const LIMIT      = arg("limit") ? Number(arg("limit")) : 100;
const DAYS_BACK  = arg("days")  ? Number(arg("days"))  : 7;
const DRY_RUN    = argv.includes("--dry-run");
/* Minimum search-frequency threshold. A query searched only once
   that hit zero results could be a typo / one-off; require ≥ 2
   searches before we burn a SerpAPI credit on it. */
const MIN_OCCURRENCES = arg("min-count") ? Number(arg("min-count")) : 2;

interface ZeroResultRow {
  query:    string;
  country:  string | null;
  count:    number;
}

async function pickZeroResultQueries(): Promise<ZeroResultRow[]> {
  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("Missing Supabase env");
  /* No RPC for this — direct SQL via the standard select pipeline.
     Group by lower(query) + country (so US "iphone 15 pro" and NG
     "iphone 15 pro" are tracked separately — they may pivot to
     different markets). created_at filter uses the configured
     DAYS_BACK window. */
  const cutoff = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supa
    .from("search_query_log")
    .select("query, country")
    .eq("result_count", 0)
    .gte("created_at", cutoff)
    .limit(5000);
  if (error) throw new Error(`search_query_log fetch failed: ${error.message}`);

  /* Group + count in JS — Supabase JS doesn't do GROUP BY without
     RPC. 5000 rows is plenty headroom for the dedup. */
  const counts = new Map<string, ZeroResultRow>();
  for (const r of (data ?? []) as Array<{ query: string; country: string | null }>) {
    const q = (r.query ?? "").trim();
    if (q.length < 3 || q.length > 80) continue;
    const country = (r.country ?? DEFAULT_COUNTRY).toLowerCase();
    const key = `${country}::${q.toLowerCase()}`;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { query: q, country, count: 1 });
  }

  /* Filter by min frequency, sort by frequency desc, take LIMIT. */
  return Array.from(counts.values())
    .filter((r) => r.count >= MIN_OCCURRENCES)
    .sort((a, b) => b.count - a.count)
    .slice(0, LIMIT);
}

async function main() {
  console.log(`Loading zero-result queries (last ${DAYS_BACK}d, min ${MIN_OCCURRENCES} occurrences)...`);
  const queries = await pickZeroResultQueries();
  if (queries.length === 0) {
    console.log("No zero-result queries meeting the threshold. Nothing to do.");
    return;
  }
  console.log(`Found ${queries.length} candidates. Top 10:`);
  for (const q of queries.slice(0, 10)) {
    console.log(`  [${q.country}] x${q.count}  "${q.query.slice(0, 60)}"`);
  }
  if (DRY_RUN) {
    console.log("\nDry-run: not invoking SerpAPI or writing to DB.");
    return;
  }

  /* Activate providers + filter to SerpAPI-shopping only (the only
     provider that can search arbitrary queries across markets). */
  const providers = await getActiveSearchProviders();
  const serpapi = providers.find((p) => p.id === "serpapi-shopping");
  if (!serpapi) {
    console.error("serpapi-shopping provider not active. Check SERPAPI_KEY in .env.");
    process.exit(1);
  }

  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;
  const startMs = Date.now();

  /* SerpAPI's google_shopping engine doesn't support 'ng' as a
     country (returns "Country 'ng' not supported - falling back to
     us"). NG zero-result queries get routed through the dedicated
     search-ng-merchant-serpapi provider on the regular cron path,
     so we skip them here to avoid double-fetching with wrong
     country tagging.

     DE removed May 2026 - Germany is deferred from first launch
     until the Impressum lands. No point burning SerpAPI credits on
     a market we're not serving. */
  const SHOPPING_SUPPORTED = new Set(["us", "uk", "in", "ae", "za"]);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const country = q.country ?? DEFAULT_COUNTRY;
    if (!SHOPPING_SUPPORTED.has(country)) {
      console.log(`  ${i + 1}/${queries.length} [${country}] SKIP "${q.query.slice(0, 40)}" — google_shopping doesn't support this market`);
      continue;
    }
    const sourceQuery = `zero-result-backfill:${country}:${q.query}`;
    try {
      const deals = await serpapi.searchDeals({
        q:           q.query,
        countryCode: country,
        /* 20 results per query is the sweet spot — enough to surface
           the product at multiple stores; not so many that we burn
           extra processing time on long-tail rows from the same SERP. */
        limit:       20,
        /* "market" drops the "deals" suffix — we want any matching
           product, not just promoted/discounted ones. The user was
           searching for the product itself, not a deal. */
        mode:        "market",
      });
      /* ingestDeals signature: (sourceProvider, sourceQuery, deals). */
      const result = await ingestDeals(serpapi.id, sourceQuery, deals);
      totalFetched += result.fetched;
      totalUpserted += result.upserted;
      totalErrors += result.errors.length;
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      const rate = ((i + 1) / ((Date.now() - startMs) / 1000)).toFixed(1);
      console.log(`  ${i + 1}/${queries.length} [${country}] "${q.query.slice(0, 40)}" → fetched=${result.fetched} upserted=${result.upserted} (${elapsed}s, ${rate}/s)`);
    } catch (err) {
      console.warn(`  ${i + 1}/${queries.length} [${country}] FAIL: ${(err as Error).message}`);
      totalErrors++;
    }
  }

  console.log(`\nDone in ${((Date.now() - startMs) / 1000).toFixed(1)}s.`);
  console.log(`  Total fetched:  ${totalFetched}`);
  console.log(`  Total upserted: ${totalUpserted}`);
  console.log(`  Total errors:   ${totalErrors}`);
  /* Re-check: how many of the original queries are now non-empty? */
  const supa = getSupabaseAdmin()!;
  let nowCovered = 0;
  for (const q of queries.slice(0, 20)) {
    /* Approximate check via FTS — search_products_fts isn't the same
       as our user-facing search pipeline but is a fast proxy. */
    const { data } = await supa.rpc("search_products_fts", {
      query_text:  q.query.slice(0, 60),
      max_results: 1,
    });
    if (data && (data as unknown[]).length > 0) nowCovered++;
  }
  console.log(`\nSampled coverage check: ${nowCovered}/20 of the previously-zero queries now return at least one result.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
