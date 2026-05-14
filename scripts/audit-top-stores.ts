#!/usr/bin/env -S npx tsx
/* Audit the catalog: top stores per market, ranked by in-stock offer
   count. Output is a markdown table per market suitable for pasting
   into the click-resolver review.

   Usage:
     npx tsx scripts/audit-top-stores.ts
     npx tsx scripts/audit-top-stores.ts --limit 50
     npx tsx scripts/audit-top-stores.ts --json

   The script uses inferStoreCountry to bucket each store into one of
   NG / UK / US / DE / AE / IN / ZA, then sorts within each bucket by
   offer count descending. Stores with no inferred country (truly
   cross-border like AliExpress / Shein) are reported under a
   "Cross-border" bucket so they're not lost.

   Why this exists: the merchant-search-urls.ts table is hand-curated
   and stale entries silently send users to wrong URLs. This script
   tells us which stores actually matter (by click-able offer volume)
   so we can prioritise verification of those merchant search URLs.

   Pairs with: docs/click-resolver-audit-agent.md (which uses the
   stores listed here as the priority retailers for live testing). */

import { createClient } from "@supabase/supabase-js";
import { inferStoreCountry } from "../src/lib/country";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "..", ".env.local") });

interface StoreRow {
  store_id:    string;
  store_name:  string;
  offer_count: number;
}

const LIMIT = (() => {
  const idx = process.argv.indexOf("--limit");
  if (idx > 0 && process.argv[idx + 1]) return Number(process.argv[idx + 1]);
  return 30;
})();
const JSON_OUTPUT = process.argv.includes("--json");

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

async function fetchTopStores(): Promise<StoreRow[]> {
  /* PostgREST aggregate via RPC would be cleanest, but the offers
     table is small enough to pull store_id + join store_name in a
     single query and aggregate in-process. Filter for in_stock=true
     because out-of-stock offers can't drive clicks. */
  const { data, error } = await supa
    .from("offers")
    .select("store_id, in_stock, stores(name)")
    .eq("in_stock", true)
    .limit(500_000);

  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!data) return [];

  const counts = new Map<string, { name: string; count: number }>();
  for (const row of data as Array<{ store_id: string; stores: { name: string } | { name: string }[] | null }>) {
    const storesField = row.stores;
    const store = Array.isArray(storesField) ? storesField[0] : storesField;
    const name  = store?.name ?? row.store_id;
    const key   = row.store_id;
    const cur   = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { name, count: 1 });
  }

  return [...counts.entries()]
    .map(([store_id, { name, count }]) => ({ store_id, store_name: name, offer_count: count }))
    .sort((a, b) => b.offer_count - a.offer_count);
}

function bucketByMarket(rows: StoreRow[]): Record<string, StoreRow[]> {
  const buckets: Record<string, StoreRow[]> = {
    NG: [], UK: [], US: [], DE: [], AE: [], IN: [], ZA: [], CrossBorder: [],
  };
  for (const r of rows) {
    const code = inferStoreCountry(r.store_id, r.store_name);
    const key  = code ?? "CrossBorder";
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(r);
  }
  return buckets;
}

function renderMarkdown(buckets: Record<string, StoreRow[]>): string {
  const order = ["NG", "UK", "US", "DE", "AE", "IN", "ZA", "CrossBorder"];
  const out: string[] = [];
  out.push(`# Top ${LIMIT} stores per market\n`);
  out.push(`_Ranked by count of in-stock offers in the catalog at audit time._\n`);
  for (const market of order) {
    const rows = (buckets[market] ?? []).slice(0, LIMIT);
    if (rows.length === 0) continue;
    out.push(`## ${market === "CrossBorder" ? "Cross-border / global" : market}\n`);
    out.push(`| Rank | store_id | Store name | Offers |`);
    out.push(`|---:|---|---|---:|`);
    rows.forEach((r, i) => {
      out.push(`| ${i + 1} | \`${r.store_id}\` | ${r.store_name} | ${r.offer_count.toLocaleString()} |`);
    });
    out.push("");
  }
  return out.join("\n");
}

async function main() {
  const rows = await fetchTopStores();
  const buckets = bucketByMarket(rows);

  if (JSON_OUTPUT) {
    const trimmed: Record<string, StoreRow[]> = {};
    for (const [k, v] of Object.entries(buckets)) trimmed[k] = v.slice(0, LIMIT);
    console.log(JSON.stringify(trimmed, null, 2));
    return;
  }

  console.log(renderMarkdown(buckets));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
