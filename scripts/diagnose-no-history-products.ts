#!/usr/bin/env tsx
/* Diagnostic — categorise the ~32.7% of tracked products whose
   `offer_price_history` table has zero rows. Migration 0027 was
   supposed to seed every existing offer's first history row, and the
   `record_offer_price_change` trigger should fire for every INSERT
   and price-changing UPDATE since. So a no-history product points
   at one of these conditions:

     A) Product has no rows in `offers` at all
        → Trigger has nothing to fire on. PDP should suppress the
          chart entirely (curated empty state). Check whether the
          PDP currently handles this gracefully.

     B) Product has offers but none of them have history rows
        → 0027 backfill missed them, OR offers were re-inserted via
          a raw-SQL bulk path that bypassed the trigger. Real bug.
          The backfill `where not exists` clause should be re-run.

     C) Product has offers AND some of those offers have history,
        but other offers under the same product don't
        → Mostly fine — the chart aggregates across all offers per
          product, so any one offer's history is enough. Worth
          counting to know how rare this case is.

   Reports counts per bucket plus a sample of 5 product_ids per
   bucket so you can verify on the live site. */

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

async function pageAll<T>(
  fetcher: (offset: number, limit: number) => Promise<T[]>,
  label: string,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const batch = await fetcher(offset, pageSize);
    out.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset % 10000 === 0) process.stderr.write(`  …${label} scanned ${offset.toLocaleString()}\n`);
  }
  return out;
}

async function main() {
  process.stderr.write("Loading products…\n");
  const productIds = (await pageAll(
    async (off, lim) => {
      const { data, error } = await supa.from("products").select("id").range(off, off + lim - 1);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string }>;
    },
    "products",
  )).map((r) => r.id);

  process.stderr.write("Loading offer→product mapping…\n");
  const offers = await pageAll<{ id: string; product_id: string }>(
    async (off, lim) => {
      const { data, error } = await supa.from("offers").select("id, product_id").range(off, off + lim - 1);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; product_id: string }>;
    },
    "offers",
  );

  process.stderr.write("Loading history rows (product+offer ids only)…\n");
  const histRows = await pageAll<{ product_id: string; offer_id: string }>(
    async (off, lim) => {
      const { data, error } = await supa
        .from("offer_price_history")
        .select("product_id, offer_id")
        .range(off, off + lim - 1);
      if (error) throw error;
      return (data ?? []) as Array<{ product_id: string; offer_id: string }>;
    },
    "history",
  );

  /* Build indexes. */
  const offersByProduct  = new Map<string, string[]>();
  for (const o of offers) {
    let list = offersByProduct.get(o.product_id);
    if (!list) { list = []; offersByProduct.set(o.product_id, list); }
    list.push(o.id);
  }
  const productsWithHistory = new Set<string>();
  const offersWithHistory   = new Set<string>();
  for (const h of histRows) {
    productsWithHistory.add(h.product_id);
    offersWithHistory.add(h.offer_id);
  }

  /* Classify each product. */
  const bucketA: string[] = [];   // no offers at all
  const bucketB: string[] = [];   // has offers, none with history
  const bucketC: string[] = [];   // has offers, partial history
  const bucketOk: string[] = [];  // has offers, all of them with history

  for (const pid of productIds) {
    const productOffers = offersByProduct.get(pid) ?? [];
    if (productOffers.length === 0) {
      bucketA.push(pid);
      continue;
    }
    const withHist = productOffers.filter((oid) => offersWithHistory.has(oid));
    if (withHist.length === 0) bucketB.push(pid);
    else if (withHist.length < productOffers.length) bucketC.push(pid);
    else bucketOk.push(pid);
  }

  const total = productIds.length;
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";
  const sample = (arr: string[]) => arr.slice(0, 5).join(", ") || "(none)";

  console.log("");
  console.log("Havlo · no-history-products diagnosis");
  console.log("─".repeat(60));
  console.log(`Total products:                              ${total.toLocaleString()}`);
  console.log(`Products with history rows (any offer):     ${productsWithHistory.size.toLocaleString()}   (${pct(productsWithHistory.size)})`);
  console.log(`Products with ZERO history rows:            ${(bucketA.length + bucketB.length).toLocaleString()}   (${pct(bucketA.length + bucketB.length)})`);
  console.log("");
  console.log("Breakdown of products with zero history:");
  console.log(`  A. No offers at all              ${bucketA.length.toLocaleString().padStart(6)}   (${pct(bucketA.length)})`);
  console.log(`     sample ids: ${sample(bucketA)}`);
  console.log("");
  console.log(`  B. Has offers, none with history ${bucketB.length.toLocaleString().padStart(6)}   (${pct(bucketB.length)})  ← trigger / backfill miss`);
  console.log(`     sample ids: ${sample(bucketB)}`);
  console.log("");
  console.log("Other classes (sanity):");
  console.log(`  C. Has offers, partial history   ${bucketC.length.toLocaleString().padStart(6)}   (${pct(bucketC.length)})  (mostly fine)`);
  console.log(`  ✓ Has offers, all with history   ${bucketOk.length.toLocaleString().padStart(6)}   (${pct(bucketOk.length)})`);
  console.log("");
  if (bucketB.length > 0) {
    console.log("Recommended next step: re-run the 0027 backfill clause for");
    console.log("the offers under bucket B. The query is idempotent — it only");
    console.log("inserts where no row exists for the (offer_id, current_price)");
    console.log("pair, so running it twice is safe.");
    console.log("");
  }
}

main().catch((e) => {
  console.error("diagnosis failed:", e);
  process.exit(1);
});
