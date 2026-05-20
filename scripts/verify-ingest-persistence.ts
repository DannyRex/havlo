#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Verification: live-deals persistence is orphan-proof + idempotent.

   Exercises ingestDeals() directly with a synthetic batch and checks
   the two failure modes the May 2026 audit found:

     1. ORPHANS — products inserted without an offer pointing at them.
        product_best_offers inner-joins offers, so an offer-less
        product is invisible to every search surface. 63% of the
        catalog was orphaned this way before the Step 5b fix.

     2. DUPLICATES on re-search — re-ingesting the same deal inserting
        a fresh product row instead of resolving the existing one.

   Run 1 ingests a fresh 3-deal batch. Run 2 re-ingests the IDENTICAL
   batch (this is the "user searches the same thing again" path). A
   correct ingestDeals leaves exactly 3 products + 3 offers after
   both runs, with zero orphans.

   All data is synthetic (a dedicated test store) and cleaned up in
   the finally block, including on assertion failure.

   Run:  npx tsx --tsconfig tsconfig.scripts.json scripts/verify-ingest-persistence.ts
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { ingestDeals } from "../src/lib/providers/ingestion";
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import type { Deal } from "../src/types";

const STORE = "havlo-verify-store";
const STAMP = Date.now();
const TITLE_PREFIX = `Havlo Verify Widget ${STAMP}`;

/* Synthetic deal — only the fields ingestDeals actually reads need
   to be real; the rest satisfy the Deal shape. Each unit gets a
   unique title + url so dedup treats them as 3 distinct products. */
function mkDeal(n: number): Deal {
  return {
    id:              `verify-${STAMP}-${n}`,
    title:           `${TITLE_PREFIX} Unit ${n}`,
    description:     "synthetic verification product",
    category:        "Electronics",
    categorySlug:    "electronics",
    storeId:         STORE,
    storeName:       "Havlo Verify Store",
    originalPrice:   100000,
    salePrice:       80000,
    discountPercent: 20,
    currency:        "NGN",
    imageUrl:        null,
    url:             `https://havlo-verify.test/p/${STAMP}/${n}`,
    expiresAt:       null,
    isHot:           false,
    isFeatured:      false,
    tags:            ["country:ng"],
    saves:           0,
    clicks:          0,
    postedAt:        new Date().toISOString(),
  } as Deal;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase admin client unavailable. Check .env.local");
    process.exit(1);
  }

  const deals = [mkDeal(1), mkDeal(2), mkDeal(3)];
  let pass = false;

  try {
    console.log("▶ Verifying ingestDeals persistence\n");

    const r1 = await ingestDeals("verify", "verify:ng", deals);
    console.log(`Run 1 (fresh ingest):   fetched=${r1.fetched} upserted=${r1.upserted} errors=${r1.errors.length}`);
    if (r1.errors.length) console.log("  errors:", r1.errors);

    const r2 = await ingestDeals("verify", "verify:ng", deals);
    console.log(`Run 2 (re-ingest same): fetched=${r2.fetched} upserted=${r2.upserted} errors=${r2.errors.length}`);
    if (r2.errors.length) console.log("  errors:", r2.errors);

    /* Inspect the resulting rows. */
    const { data: prods } = await supa
      .from("products")
      .select("id, title")
      .like("title", `${TITLE_PREFIX}%`);
    const { data: offers } = await supa
      .from("offers")
      .select("id, product_id")
      .eq("store_id", STORE);

    const productCount = prods?.length ?? 0;
    const offerCount   = offers?.length ?? 0;
    const offerProdIds = new Set((offers ?? []).map((o) => (o as { product_id: string }).product_id));
    const orphans      = (prods ?? []).filter((p) => !offerProdIds.has((p as { id: string }).id));

    console.log("");
    console.log(`Products after both runs: ${productCount}   (expect 3 — no duplicates from Run 2)`);
    console.log(`Offers   after both runs: ${offerCount}   (expect 3 — one per product)`);
    console.log(`Orphan products (no offer): ${orphans.length}   (expect 0)`);

    pass =
      productCount === 3 &&
      offerCount === 3 &&
      orphans.length === 0 &&
      r1.errors.length === 0 &&
      r2.errors.length === 0;

    console.log(pass
      ? "\n✅ PASS — re-ingest is idempotent and leaves zero orphans."
      : "\n❌ FAIL — see counts above.");
  } finally {
    /* Clean up synthetic data — runs even if an assertion failed. */
    const { data: prods } = await supa
      .from("products").select("id").like("title", `${TITLE_PREFIX}%`);
    await supa.from("offers").delete().eq("store_id", STORE);
    if (prods?.length) {
      await supa.from("products").delete().in("id", prods.map((p) => (p as { id: string }).id));
    }
    await supa.from("stores").delete().eq("id", STORE);
    await supa.from("ingestion_runs").delete().eq("provider", "verify").eq("query", "verify:ng");
    console.log("\n· cleaned up synthetic test data");
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
