#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   One-off cleanup: delete products that have ZERO offers.

   Why this exists: the round-4 dup audit found 26,566 product rows
   but only 11,527 offers — meaning ~15k products were orphans. Root
   cause was a hole in the ingest dedup logic (now fixed in
   ingestion.ts): when AliExpress / SerpAPI re-ingested the same
   merchant URL, the offer would upsert correctly (single offer per
   store+url) but the offer was pointed at a NEW product_id because
   signature lookup failed. The OLD product_id then had zero offers
   pointing at it — an orphan.

   These orphans:
     • Take up space in products + product_best_offers view
     • Pollute the trending-multi-store chip pool computation
       (slower)
     • Don't show up in the UI because the view inner-joins offers
       (no offer → no row in the view)

   Safe to delete because:
     • Nothing references a product_id that has no offer
     • The signature uniqueness across multi-offer products is
       preserved (we keep the product that has the offers)

   Run dry-run first:
     npx tsx scripts/clean-orphan-products.ts
   Apply:
     npx tsx scripts/clean-orphan-products.ts --apply
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const apply = process.argv.includes("--apply");
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase admin client unavailable. Check .env.local");
    process.exit(1);
  }

  console.log(`▶ Orphan-product cleanup (${apply ? "APPLY" : "DRY-RUN"})\n`);

  /* Pull all product_ids that have at least one offer. Paginate
     because PostgREST caps single responses at 1000. */
  const PAGE = 1000;
  const PAGES = 30;
  const offerReqs = Array.from({ length: PAGES }, (_, i) =>
    supa.from("offers").select("product_id").range(i * PAGE, (i + 1) * PAGE - 1),
  );
  const offerResults = await Promise.all(offerReqs);
  const productsWithOffers = new Set<string>();
  for (const r of offerResults) {
    for (const o of (r.data ?? []) as Array<{ product_id: string }>) {
      productsWithOffers.add(o.product_id);
    }
  }
  console.log(`Distinct product_ids referenced by offers: ${productsWithOffers.size}`);

  /* Pull all product ids, paginate. */
  const productReqs = Array.from({ length: PAGES }, (_, i) =>
    supa.from("products").select("id, title").range(i * PAGE, (i + 1) * PAGE - 1),
  );
  const productResults = await Promise.all(productReqs);
  const allProducts: Array<{ id: string; title: string }> = [];
  for (const r of productResults) {
    if (r.data) allProducts.push(...(r.data as Array<{ id: string; title: string }>));
  }
  console.log(`Total products in DB: ${allProducts.length}`);

  const orphans = allProducts.filter((p) => !productsWithOffers.has(p.id));
  console.log(`Orphan products (zero offers): ${orphans.length}\n`);

  if (orphans.length === 0) {
    console.log("✓ No orphans. Nothing to clean.");
    return;
  }

  console.log("Sample orphan titles:");
  for (const p of orphans.slice(0, 10)) {
    console.log(`  ${p.title.slice(0, 80)}`);
  }

  if (!apply) {
    console.log(`\n→ Re-run with --apply to delete ${orphans.length} orphan products.`);
    return;
  }

  /* Batch delete to stay under PostgREST request size limits.
     1000 ids per delete is comfortable. */
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const ids = orphans.slice(i, i + BATCH).map((p) => p.id);
    const { error } = await supa.from("products").delete().in("id", ids);
    if (error) {
      console.error(`✗ Batch ${i / BATCH + 1} failed:`, error.message);
      continue;
    }
    deleted += ids.length;
    if ((i / BATCH) % 10 === 0) console.log(`  Deleted ${deleted}/${orphans.length}...`);
  }

  console.log(`\n✓ Deleted ${deleted} orphan products.`);

  /* Confirm final state. */
  const { count: finalProducts } = await supa.from("products").select("*", { count: "exact", head: true });
  const { count: finalOffers } = await supa.from("offers").select("*", { count: "exact", head: true });
  console.log(`\nFinal: ${finalProducts} products, ${finalOffers} offers.`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
