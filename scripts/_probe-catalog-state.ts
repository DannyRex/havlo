/* Post-sweep catalog state probe.

   Answers two questions in one pass:
     1. Per-store in_stock vs out_of_stock breakdown after the first
        freshness sweep ran.
     2. "Why don't products from stores without deals show up?" —
        cross-check the per-store offer counts in the DB against
        the per-store counts /api/deals actually surfaces. A gap
        means something is filtering those rows out between the
        DB and the API response. */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no supabase"); process.exit(1); }

  /* ── Q1: in_stock vs out_of_stock per store ─────────────────────── */
  console.log("\n=== Per-store in_stock / out_of_stock (post-sweep) ===\n");

  /* Pull all offers in pages to avoid the 1000-row cap. We only need
     store_id + in_stock so the payload stays tiny. */
  type Row = { store_id: string; in_stock: boolean };
  const allRows: Row[] = [];
  const PAGE = 1000;
  for (let i = 0; i < 50; i++) {
    const { data } = await supa
      .from("offers")
      .select("store_id, in_stock")
      .range(i * PAGE, (i + 1) * PAGE - 1);
    if (!data || data.length === 0) break;
    allRows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }

  const byStore = new Map<string, { in: number; out: number }>();
  for (const r of allRows) {
    const acc = byStore.get(r.store_id) ?? { in: 0, out: 0 };
    if (r.in_stock) acc.in++; else acc.out++;
    byStore.set(r.store_id, acc);
  }

  const sorted = Array.from(byStore.entries())
    .map(([id, c]) => ({ id, in: c.in, out: c.out, total: c.in + c.out }))
    .sort((a, b) => b.total - a.total);

  console.log("  store_id".padEnd(22) + " | in_stock | out_of | total");
  console.log("  " + "-".repeat(20) + " | -------- | ------ | -----");
  for (const s of sorted) {
    console.log(
      "  " + s.id.padEnd(20) +
      " | " + String(s.in).padStart(8) +
      " | " + String(s.out).padStart(6) +
      " | " + String(s.total).padStart(5),
    );
  }
  const totalIn  = sorted.reduce((a, s) => a + s.in,  0);
  const totalOut = sorted.reduce((a, s) => a + s.out, 0);
  console.log("  " + "TOTAL".padEnd(20) + " | " + String(totalIn).padStart(8) + " | " + String(totalOut).padStart(6) + " | " + String(totalIn + totalOut).padStart(5));

  /* ── Q2: gap analysis ──────────────────────────────────────────────
     The product_best_offers view filters in_stock=true via a lateral
     join, AND keeps only the cheapest offer per product. So a store
     with 554 in-stock offers may show fewer cards on /deals because
     other stores are cheaper for the same product. Probe both. */
  console.log("\n=== product_best_offers view counts (drives /api/deals) ===\n");

  const viewCounts = new Map<string, number>();
  for (let i = 0; i < 50; i++) {
    const { data } = await supa
      .from("product_best_offers")
      .select("store_id")
      .range(i * PAGE, (i + 1) * PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data as { store_id: string }[]) {
      viewCounts.set(r.store_id, (viewCounts.get(r.store_id) ?? 0) + 1);
    }
    if (data.length < PAGE) break;
  }

  console.log("  store_id".padEnd(22) + " | in_stock_offers | best_offer_rows | gap");
  console.log("  " + "-".repeat(20) + " | --------------- | --------------- | ---");
  for (const s of sorted) {
    const view = viewCounts.get(s.id) ?? 0;
    const gap  = s.in - view;
    const flag = gap > 0 ? `  -${gap} (best-offer dedup OR product orphan)` : "  ok";
    console.log(
      "  " + s.id.padEnd(20) +
      " | " + String(s.in).padStart(15) +
      " | " + String(view).padStart(15) +
      " | " + flag,
    );
  }
  const totalView = Array.from(viewCounts.values()).reduce((a, b) => a + b, 0);
  console.log("  " + "TOTAL".padEnd(20) + " | " + String(totalIn).padStart(15) + " | " + String(totalView).padStart(15));

  /* Stores that are in offers but NOT in the view — these are 100%
     "sitting in the DB but not surfaced anywhere on the site". */
  const sittingOnly: string[] = [];
  for (const s of sorted) {
    if (s.in > 0 && !viewCounts.has(s.id)) sittingOnly.push(s.id);
  }
  if (sittingOnly.length > 0) {
    console.log("\n  ⚠ Stores with in-stock offers that DON'T appear in product_best_offers at all:");
    for (const id of sittingOnly) console.log("    · " + id);
    console.log("\n    These are the 'sitting in DB' stores. Likely a product_id mismatch — offers ");
    console.log("    point at product_ids that have been deleted, OR the view's join condition");
    console.log("    drops them. Probe deeper if so.");
  }
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
