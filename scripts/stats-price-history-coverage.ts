#!/usr/bin/env tsx
/* One-shot stats query — what % of products in the DB have enough
   price_history data to render a meaningful chart? Splits the answer
   into the bands that actually matter for UX:

     - any (≥ 1 row)        → single-point chart renders (post-May 2026)
     - ≥ 2 distinct days    → real line segment, not a dot
     - ≥ 7 distinct days    → a week of trend, charts feel "alive"
     - ≥ 30 distinct days   → a month — what the 30D toggle wants
     - ≥ 90 distinct days   → full 90D window populated

   Curated products (the non-UUID-id catalogue) are excluded from the
   tracked-product universe — they live outside `offers` so this query
   doesn't see them, and that's correct. */

try {
  // @ts-expect-error — process.loadEnvFile is Node-runtime
  process.loadEnvFile?.(".env.local");
} catch { /* noop */ }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* Paginated count — Supabase HEAD count is exact but the table-level
   count(*) needs no rows fetched. */
async function countWhere(table: string, build?: (q: ReturnType<typeof supa.from>) => unknown): Promise<number> {
  let q = supa.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q) as typeof q;
  const { count, error } = await q;
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

/* Pull all (product_id, day) tuples in chunks, then aggregate in JS.
   Supabase row cap per request defaults to 1000; we page until empty. */
async function distinctDaysPerProduct(): Promise<Map<string, number>> {
  const days = new Map<string, Set<string>>();
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supa
      .from("offer_price_history")
      .select("product_id, recorded_at")
      .order("product_id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`history page: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ product_id: string; recorded_at: string }>) {
      const day = row.recorded_at.slice(0, 10); // YYYY-MM-DD
      let s = days.get(row.product_id);
      if (!s) { s = new Set(); days.set(row.product_id, s); }
      s.add(day);
    }
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset % 50000 === 0) process.stderr.write(`  …scanned ${offset.toLocaleString()} rows\n`);
  }
  const counts = new Map<string, number>();
  for (const [pid, set] of days) counts.set(pid, set.size);
  return counts;
}

async function main() {
  process.stderr.write("Fetching counts…\n");
  const totalProducts    = await countWhere("products");
  const totalHistoryRows = await countWhere("offer_price_history");

  process.stderr.write(`Scanning ${totalHistoryRows.toLocaleString()} history rows for per-product distinct days…\n`);
  const dayCounts = await distinctDaysPerProduct();

  const productsWithAny  = dayCounts.size;
  let ge2  = 0, ge7 = 0, ge30 = 0, ge90 = 0;
  let sumDays = 0, maxDays = 0;
  for (const v of dayCounts.values()) {
    if (v >= 2)  ge2++;
    if (v >= 7)  ge7++;
    if (v >= 30) ge30++;
    if (v >= 90) ge90++;
    sumDays += v;
    if (v > maxDays) maxDays = v;
  }
  const avgDays = productsWithAny > 0 ? (sumDays / productsWithAny).toFixed(1) : "0";

  const r: Record<string, number | string> = {
    total_products:             totalProducts,
    products_with_any_history:  productsWithAny,
    products_with_ge2_days:     ge2,
    products_with_ge7_days:     ge7,
    products_with_ge30_days:    ge30,
    products_with_ge90_days:    ge90,
    avg_distinct_days:          avgDays,
    max_distinct_days:          maxDays,
    total_history_rows:         totalHistoryRows,
  };

  const total = Number(r.total_products ?? 0);
  const pct   = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";

  console.log("");
  console.log("Havlo · price history coverage stats");
  console.log("─".repeat(56));
  console.log(`Total tracked products:                     ${total.toLocaleString()}`);
  console.log("");
  console.log(`Products with ≥ 1 history row:              ${Number(r.products_with_any_history).toLocaleString().padStart(7)}   (${pct(Number(r.products_with_any_history))})`);
  console.log(`Products with ≥ 2 distinct days:            ${Number(r.products_with_ge2_days).toLocaleString().padStart(7)}   (${pct(Number(r.products_with_ge2_days))})`);
  console.log(`Products with ≥ 7 distinct days:            ${Number(r.products_with_ge7_days).toLocaleString().padStart(7)}   (${pct(Number(r.products_with_ge7_days))})`);
  console.log(`Products with ≥ 30 distinct days:           ${Number(r.products_with_ge30_days).toLocaleString().padStart(7)}   (${pct(Number(r.products_with_ge30_days))})`);
  console.log(`Products with ≥ 90 distinct days:           ${Number(r.products_with_ge90_days).toLocaleString().padStart(7)}   (${pct(Number(r.products_with_ge90_days))})`);
  console.log("");
  console.log(`Avg distinct days per tracked product:      ${Number(r.avg_distinct_days)}`);
  console.log(`Max distinct days seen on any product:      ${Number(r.max_distinct_days)}`);
  console.log(`Total offer_price_history rows in DB:       ${Number(r.total_history_rows).toLocaleString()}`);
  console.log("");
}

main().catch((e) => {
  console.error("query failed:", e);
  process.exit(1);
});
