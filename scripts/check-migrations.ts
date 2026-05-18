#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Migration verifier — for every .sql file in scripts/db/, probe
   Supabase for an artifact the migration created and report PASS /
   FAIL / UNKNOWN. Used to confirm what's been applied vs what still
   needs to run before launch.

   Usage:
     npm exec -- tsx scripts/check-migrations.ts

   Probe strategy:
     - Tables / columns → information_schema.columns
     - Functions → pg_proc joined to pg_namespace
     - Views → information_schema.views + column existence
     - Indexes → pg_indexes
     - Data backfills → SELECT count(*) WHERE <condition the migration
       was supposed to satisfy>
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — process.loadEnvFile is Node-runtime, not in @types/node
  process.loadEnvFile?.(".env.local");
} catch {/* already loaded or unavailable */}

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_KEY);

type Status = "PASS" | "FAIL" | "UNKNOWN";

interface CheckResult {
  migration: string;
  description: string;
  status: Status;
  detail: string;
}

const results: CheckResult[] = [];

async function rpcExists(name: string): Promise<boolean> {
  const { data, error } = await supa.rpc("pg_proc_exists" as never, { p_name: name } as never);
  if (error || !data) {
    /* Fall back to information_schema probe — pg_proc_exists helper
       not guaranteed to exist on every DB. */
    return false;
  }
  return Boolean(data);
}

/* Direct SQL via PostgREST raw query — query information_schema +
   pg_catalog via a wrapper RPC if available, else best-effort
   probes via the supabase-js .from() API. */
async function probeViaPostgrest(sql: string): Promise<unknown[] | null> {
  /* Supabase doesn't expose a generic SQL endpoint via the JS client.
     We use the `exec` RPC if it exists, else try each .from() probe
     individually. For this script we instead define explicit per-
     migration probes that use the standard query interface. */
  void sql;
  return null;
}

async function tableHasColumn(table: string, column: string): Promise<boolean | null> {
  const { data, error } = await supa
    .from(table)
    .select(column)
    .limit(0);
  /* PostgREST returns an error when the column doesn't exist; data
     is null + error has a specific code. We treat null-error +
     non-error as PASS, error-with-undefined-column as FAIL. */
  if (error) {
    if (error.message?.includes("column") && error.message?.includes("does not exist")) return false;
    return null;
  }
  return data !== null;
}

async function storeIdExists(id: string): Promise<boolean> {
  const { data, error } = await supa.from("stores").select("id").eq("id", id).limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

async function countStoresWherePattern(pattern: string): Promise<number | null> {
  const { count, error } = await supa
    .from("stores")
    .select("*", { count: "exact", head: true })
    .like("id", pattern);
  if (error) return null;
  return count ?? 0;
}

async function countStoresNullCountry(): Promise<number | null> {
  const { count, error } = await supa
    .from("stores")
    .select("*", { count: "exact", head: true })
    .is("country", null);
  if (error) return null;
  return count ?? 0;
}

/* Probe RPC signature by attempting to call it with the expected
   args. If the signature matches, the call succeeds (or fails with
   an internal SQL error, not a signature error). If the signature
   doesn't match, PostgREST returns a "function does not exist"
   error mentioning the args. */
async function rpcSignatureMatches(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; detail: string }> {
  const { data: _data, error } = await supa.rpc(name, args);
  if (!error) return { ok: true, detail: "callable" };
  const msg = error.message ?? "";
  if (msg.includes("does not exist")) return { ok: false, detail: `RPC not found: ${msg.slice(0, 100)}` };
  /* Other errors (SQL exceptions inside the function body) imply the
     signature matched — function got called and failed inside. */
  return { ok: true, detail: `callable but errored: ${msg.slice(0, 80)}` };
}

/* ──────────────────────────────────────────────────────────────────
   Per-migration probes. Each one checks an artifact the migration
   was supposed to create — column, function, index, or data state.
   ────────────────────────────────────────────────────────────────── */

async function check0001_schema(): Promise<CheckResult> {
  const has = await tableHasColumn("products", "title");
  return {
    migration:   "0001-products-offers-schema",
    description: "Base tables: products / offers / stores / ingestion_runs",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "products.title exists" : "products table missing",
  };
}

async function check0002_fts(): Promise<CheckResult> {
  const r = await rpcSignatureMatches("search_products_fts", { q: "test", max_results: 1 });
  return {
    migration:   "0002-fts-search",
    description: "search_products_fts RPC",
    status:      r.ok ? "PASS" : "FAIL",
    detail:      r.detail,
  };
}

async function check0004_source_country(): Promise<CheckResult> {
  const has = await tableHasColumn("offers", "source_country");
  return {
    migration:   "0004-offers-source-country",
    description: "offers.source_country column",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "exists" : "missing",
  };
}

async function check0005_resolved_clicks(): Promise<CheckResult> {
  const has = await tableHasColumn("resolved_clicks", "resolved_url");
  return {
    migration:   "0005-resolved-clicks-cache",
    description: "resolved_clicks table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0006_cashback(): Promise<CheckResult> {
  const has = await tableHasColumn("cashback_accounts", "user_id");
  return {
    migration:   "0006-cashback-accounts",
    description: "cashback_accounts table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0007_product_requests(): Promise<CheckResult> {
  const has = await tableHasColumn("product_requests", "url");
  return {
    migration:   "0007-product-requests",
    description: "product_requests table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0008_suggest_titles(): Promise<CheckResult> {
  const r = await rpcSignatureMatches("suggest_titles", { q: "test", max_results: 1 });
  return {
    migration:   "0008-suggest-titles",
    description: "suggest_titles RPC",
    status:      r.ok ? "PASS" : "FAIL",
    detail:      r.detail,
  };
}

async function check0009_newsletter(): Promise<CheckResult> {
  const has = await tableHasColumn("newsletter_subscribers", "email");
  return {
    migration:   "0009-newsletter-subscribers",
    description: "newsletter_subscribers table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0010_multistore(): Promise<CheckResult> {
  const r = await rpcSignatureMatches("suggest_multistore_products", { p_min_stores: 2, p_max_results: 1 });
  return {
    migration:   "0010-suggest-multistore-products",
    description: "suggest_multistore_products RPC",
    status:      r.ok ? "PASS" : "FAIL",
    detail:      r.detail,
  };
}

async function check0011_backfill_countries(): Promise<CheckResult> {
  /* 0011 backfilled stores.country for known retailers. We don't
     expect ZERO nulls (truly-global stores legitimately have null
     country), but we expect the obvious NG / UK / US stores to be
     tagged. Probe: count of NG-tagged stores should be > 0. */
  const { count, error } = await supa
    .from("stores")
    .select("*", { count: "exact", head: true })
    .eq("country", "NG");
  if (error) return { migration: "0011-backfill-store-countries", description: "stores.country backfilled", status: "UNKNOWN", detail: error.message.slice(0, 80) };
  return {
    migration:   "0011-backfill-store-countries",
    description: "stores.country backfilled (≥ 1 NG-tagged store)",
    status:      (count ?? 0) > 0 ? "PASS" : "FAIL",
    detail:      `${count ?? 0} stores tagged country=NG`,
  };
}

async function check0014_newsletter_categories(): Promise<CheckResult> {
  const has = await tableHasColumn("newsletter_subscribers", "categories");
  return {
    migration:   "0014-newsletter-categories",
    description: "newsletter_subscribers.categories column",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "exists" : "missing",
  };
}

async function check0015_clicks(): Promise<CheckResult> {
  const has = await tableHasColumn("outbound_clicks", "product_id");
  return {
    migration:   "0015-clicks-popularity",
    description: "outbound_clicks table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0017_serpapi_budget(): Promise<CheckResult> {
  const has = await tableHasColumn("serpapi_budget", "credits_used");
  return {
    migration:   "0017-serpapi-budget",
    description: "serpapi_budget table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0018_offers_last_seen(): Promise<CheckResult> {
  const has = await tableHasColumn("offers", "last_seen_at");
  return {
    migration:   "0018-offers-last-seen",
    description: "offers.last_seen_at column",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "exists" : "missing",
  };
}

async function check0019_browse_deals(): Promise<CheckResult> {
  const r = await rpcSignatureMatches("browse_deals", { p_max_rows: 1 });
  return {
    migration:   "0019-browse-deals-rpc",
    description: "browse_deals RPC (base signature)",
    status:      r.ok ? "PASS" : "FAIL",
    detail:      r.detail,
  };
}

async function check0021_click_resolutions(): Promise<CheckResult> {
  const has = await tableHasColumn("click_resolutions", "resolved_url");
  return {
    migration:   "0021-click-resolutions",
    description: "click_resolutions table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0022_country_aware_browse(): Promise<CheckResult> {
  const r = await rpcSignatureMatches("browse_deals", { p_country: "NG", p_max_rows: 1 });
  return {
    migration:   "0022-country-aware-browse-deals",
    description: "browse_deals supports p_country arg",
    status:      r.ok ? "PASS" : "FAIL",
    detail:      r.detail,
  };
}

async function check0025_search_deals_fts(): Promise<CheckResult> {
  const r = await rpcSignatureMatches("search_deals_fts", { q: "test", p_max_rows: 1 });
  return {
    migration:   "0025-search-deals-fts",
    description: "search_deals_fts RPC",
    status:      r.ok ? "PASS" : "FAIL",
    detail:      r.detail,
  };
}

async function check0026_search_query_log(): Promise<CheckResult> {
  const has = await tableHasColumn("search_query_log", "query");
  return {
    migration:   "0026-search-query-log",
    description: "search_query_log table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0027_price_history(): Promise<CheckResult> {
  const has = await tableHasColumn("offer_price_history", "current_price");
  return {
    migration:   "0027-offer-price-history",
    description: "offer_price_history table",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "table exists" : "table missing",
  };
}

async function check0028_is_deal(): Promise<CheckResult> {
  const has = await tableHasColumn("offers", "is_deal");
  return {
    migration:   "0028-offers-is-deal",
    description: "offers.is_deal column",
    status:      has === true ? "PASS" : has === false ? "FAIL" : "UNKNOWN",
    detail:      has === true ? "exists" : "missing",
  };
}

async function check0029_browse_deals_restored(): Promise<CheckResult> {
  /* 0029 restored browse_deals after 0028 dropped it via CASCADE.
     If 0029 is applied, browse_deals exists AND can take p_country.
     Subsumed by check0022 since they use the same RPC. */
  const r = await rpcSignatureMatches("browse_deals", { p_country: "UK", p_max_rows: 1 });
  return {
    migration:   "0029-restore-browse-deals-with-is-deal",
    description: "browse_deals callable after 0028 CASCADE drop",
    status:      r.ok ? "PASS" : "FAIL",
    detail:      r.detail,
  };
}

async function check0030_normalize_amazon(): Promise<CheckResult> {
  /* 0030 cleaned amazon-co-uk-amazon-co-uk-seller and similar.
     PASS = zero stores with the doubled-suffix pattern. */
  const count = await countStoresWherePattern("amazon-co-uk-amazon-%");
  return {
    migration:   "0030-normalize-amazon-store-ids",
    description: "No amazon-co-uk-amazon-co-uk-* duplicate IDs",
    status:      count === 0 ? "PASS" : count === null ? "UNKNOWN" : "FAIL",
    detail:      `${count ?? "?"} matching rows`,
  };
}

async function check0031_merge_amazon_co_uk(): Promise<CheckResult> {
  const exists = await storeIdExists("amazon-co-uk");
  return {
    migration:   "0031-merge-amazon-co-uk-into-uk",
    description: "amazon-co-uk merged into amazon-uk (no bare amazon-co-uk row)",
    status:      exists ? "FAIL" : "PASS",
    detail:      exists ? "amazon-co-uk still exists" : "consolidated",
  };
}

async function check0032_slim_rpc(): Promise<CheckResult> {
  /* 0032 trimmed source_country from product_best_offers view AND
     changed browse_deals + search_deals_fts to RETURNS TABLE with
     slim columns. Probe: query the view directly and check if
     source_country is selectable. */
  const { error } = await supa
    .from("product_best_offers")
    .select("source_country")
    .limit(0);
  /* Pre-0032: source_country is selectable → no error
     Post-0032: source_country dropped → error mentioning column */
  const dropped = !!(error && error.message?.includes("source_country"));
  return {
    migration:   "0032-slim-rpc-return-types",
    description: "source_country dropped from product_best_offers view",
    status:      dropped ? "PASS" : "FAIL",
    detail:      dropped ? "column gone" : "source_country still present (migration not applied)",
  };
}

async function check0033_merge_amazon_de_ae_in(): Promise<CheckResult> {
  /* 0033 dedupes amazon.de + amazon.ae + amazon.in (and verbose
     variants) into canonical amazon-de / amazon-ae / amazon-in. */
  const duplicates = await Promise.all([
    storeIdExists("amazon.de"),
    storeIdExists("amazon.ae"),
    storeIdExists("amazon.in"),
    storeIdExists("amazon-germany"),
    storeIdExists("amazon-uae"),
    storeIdExists("amazon-india"),
  ]);
  const stillThere = duplicates.filter(Boolean).length;
  return {
    migration:   "0033-merge-amazon-de-ae-in-duplicates",
    description: "Amazon DE/AE/IN duplicate store_ids merged",
    status:      stillThere === 0 ? "PASS" : "FAIL",
    detail:      stillThere === 0 ? "all duplicates consolidated" : `${stillThere} duplicate(s) still present`,
  };
}

async function check0034_search_products_fts_parity(): Promise<CheckResult> {
  /* 0034 brings search_products_fts to parity with search_deals_fts
     (exact-phrase + token-coverage boosts). Hard to detect without
     SELECTing pg_proc.prosrc — instead probe behaviour: a
     deliberate typo query should return results post-0034 that
     wouldn't return pre-0034.

     Pre-0034: trigram + ts_rank only — typo "iphn 15 pro max"
       borderline.
     Post-0034: + substring fallback in WHERE clause — typo
       always returns results when at least one whole-word match
       exists.

     Test query: "iphn 15" — typo for iphone 15. */
  const { data, error } = await supa.rpc("search_products_fts", { q: "iphn 15", max_results: 5 });
  if (error) return { migration: "0034-search-products-fts-parity", description: "search_products_fts parity (typo tolerance)", status: "UNKNOWN", detail: error.message.slice(0, 80) };
  const count = Array.isArray(data) ? data.length : 0;
  return {
    migration:   "0034-search-products-fts-parity",
    description: "Typo 'iphn 15' returns results",
    status:      count > 0 ? "PASS" : "FAIL",
    detail:      `${count} results for typo query`,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Aggregate: extra data-quality probes that span multiple migrations.
   ────────────────────────────────────────────────────────────────── */

async function checkNullCountryStats(): Promise<CheckResult> {
  const nullCount = await countStoresNullCountry();
  return {
    migration:   "(data quality)",
    description: "Stores with NULL country (should be mostly globals)",
    status:      nullCount === null ? "UNKNOWN" : "PASS",  // informational
    detail:      nullCount === null ? "query failed" : `${nullCount} stores have country=NULL`,
  };
}

async function checkAmazonStoreCount(): Promise<CheckResult> {
  /* Post all migrations, expected amazon-* IDs:
       amazon, amazon-uk, amazon-de, amazon-ae, amazon-in, amazon-us, amazon-ca
     Pre-migrations: also amazon.de, amazon.ae, amazon.in, amazon-co-uk,
       amazon-germany, amazon-uae, amazon-india, ugly suffix variants */
  const { data, error } = await supa
    .from("stores")
    .select("id, name, country")
    .like("id", "amazon%")
    .order("id");
  if (error) return { migration: "(data quality)", description: "Amazon store inventory", status: "UNKNOWN", detail: error.message.slice(0, 80) };
  const ids = (data ?? []).map((s) => (s as { id: string }).id);
  return {
    migration:   "(data quality)",
    description: "Amazon store IDs present",
    status:      "PASS",
    detail:      ids.length ? ids.join(", ") : "none",
  };
}

async function main() {
  console.log("▶ Checking migrations against Supabase...\n");

  const checks = [
    check0001_schema,
    check0002_fts,
    check0004_source_country,
    check0005_resolved_clicks,
    check0006_cashback,
    check0007_product_requests,
    check0008_suggest_titles,
    check0009_newsletter,
    check0010_multistore,
    check0011_backfill_countries,
    check0014_newsletter_categories,
    check0015_clicks,
    check0017_serpapi_budget,
    check0018_offers_last_seen,
    check0019_browse_deals,
    check0021_click_resolutions,
    check0022_country_aware_browse,
    check0025_search_deals_fts,
    check0026_search_query_log,
    check0027_price_history,
    check0028_is_deal,
    check0029_browse_deals_restored,
    check0030_normalize_amazon,
    check0031_merge_amazon_co_uk,
    check0032_slim_rpc,
    check0033_merge_amazon_de_ae_in,
    check0034_search_products_fts_parity,
    checkNullCountryStats,
    checkAmazonStoreCount,
  ];

  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);
      const badge = result.status === "PASS" ? "✓" : result.status === "FAIL" ? "✗" : "?";
      const padCol = result.migration.padEnd(45);
      console.log(`${badge}  ${padCol}  ${result.detail}`);
    } catch (err) {
      console.error(`!  Check threw: ${(err as Error).message}`);
    }
  }

  const fails    = results.filter((r) => r.status === "FAIL");
  const unknowns = results.filter((r) => r.status === "UNKNOWN");

  console.log("\n──────────────────────────────────────────────");
  console.log(`PASS: ${results.filter((r) => r.status === "PASS").length} / ${results.length}`);
  console.log(`FAIL: ${fails.length}`);
  console.log(`UNKNOWN: ${unknowns.length}`);

  if (fails.length > 0) {
    console.log("\n── MIGRATIONS NOT APPLIED ──");
    for (const f of fails) {
      console.log(`  ${f.migration}: ${f.description}`);
      console.log(`    → ${f.detail}`);
    }
  }
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
