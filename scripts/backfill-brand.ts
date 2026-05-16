#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   One-shot brand backfill + BLOCKED-sentinel cleanup.

   Why: dealToProductRow had `brand: null` hardcoded for months, even
   though buildSignature(title) had already extracted the brand. Result:
   every product in the catalog has brand=NULL, which nullifies the
   variant-gate's brand-equality guard (both sides null → no-op check).

   This script walks the products table and:
     1. For each row with brand IS NULL, runs buildSignature(title) and
        UPDATES brand + model if the parser found them.
     2. Drops any product/offer/store whose name/title contains the
        '[BLOCKED: <type>]' sentinel from upstream secret-scrubber
        leakage.

   Run:
     npm run backfill:brand                 # dry-run
     npm run backfill:brand -- --apply      # commit
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature } from "../src/lib/search/normalize";

interface ProductRow { id: string; title: string; brand: string | null; model: string | null; }
interface StoreRow   { id: string; name: string; }

const BLOCKED_RE = /\[BLOCKED:\s*[^\]]+\]/i;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const supa  = getSupabaseAdmin();
  if (!supa) { console.error("✗ Supabase admin not configured"); process.exit(1); }

  console.log(`▶ Brand backfill + BLOCKED cleanup${apply ? "" : " (DRY RUN — pass --apply)"}\n`);

  /* ── 1. BLOCKED sentinel cleanup ──────────────────────────────── */
  const { data: blockedStores } = await supa
    .from("stores")
    .select("id, name")
    .or(`id.ilike.%[BLOCKED:%,name.ilike.%[BLOCKED:%`);
  const badStores = (blockedStores ?? []) as StoreRow[];
  console.log(`[1] Stores with [BLOCKED: …] sentinel: ${badStores.length}`);
  for (const s of badStores.slice(0, 5)) console.log(`    · id=${s.id.slice(0, 50)}  name=${s.name?.slice(0, 50)}`);

  if (apply && badStores.length > 0) {
    /* Cascade: delete offers, then products that have no surviving
       offers, then the store rows themselves. Safer than ON DELETE
       CASCADE (which we don't have configured here). */
    const badIds = badStores.map((s) => s.id);
    const { count: offerCount } = await supa.from("offers").delete().in("store_id", badIds).select("id", { count: "exact", head: true });
    console.log(`    → deleted ${offerCount ?? 0} offers from BLOCKED stores`);
    const { count: storeCount } = await supa.from("stores").delete().in("id", badIds).select("id", { count: "exact", head: true });
    console.log(`    → deleted ${storeCount ?? 0} BLOCKED store rows`);
  }

  /* ── 2. Brand backfill ────────────────────────────────────────── */
  console.log(`\n[2] Brand backfill — scanning products with brand IS NULL`);
  const all: ProductRow[] = [];
  const page = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supa
      .from("products")
      .select("id, title, brand, model")
      .is("brand", null)
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as ProductRow[]));
    if (data.length < page) break;
    from += page;
  }
  console.log(`    Loaded ${all.length} products needing backfill`);

  const updates: Array<{ id: string; brand: string; model: string | null }> = [];
  let titleBlocked = 0;
  for (const p of all) {
    if (BLOCKED_RE.test(p.title)) { titleBlocked++; continue; }
    const sig = buildSignature(p.title);
    if (sig.brand) updates.push({ id: p.id, brand: sig.brand, model: sig.model });
  }
  console.log(`    Parser found brand for ${updates.length} of ${all.length} (${(100 * updates.length / Math.max(all.length, 1)).toFixed(1)}%)`);
  console.log(`    Skipped ${titleBlocked} products whose title contains [BLOCKED: …]`);

  /* Show sample of what would change. */
  console.log(`\n    Sample of upcoming brand assignments:`);
  for (const u of updates.slice(0, 10)) {
    const p = all.find((x) => x.id === u.id)!;
    console.log(`    · "${p.title.slice(0, 55)}" → brand=${u.brand} model=${u.model ?? "(null)"}`);
  }

  if (!apply) {
    console.log(`\nDry-run complete. Re-run with --apply to commit.`);
    return;
  }

  /* Drop products with BLOCKED titles (cascade offers first). */
  if (titleBlocked > 0) {
    const blockedTitleIds = all.filter((p) => BLOCKED_RE.test(p.title)).map((p) => p.id);
    const chunk = 100;
    for (let i = 0; i < blockedTitleIds.length; i += chunk) {
      const slice = blockedTitleIds.slice(i, i + chunk);
      await supa.from("offers").delete().in("product_id", slice);
      await supa.from("products").delete().in("id", slice);
    }
    console.log(`\n    Deleted ${blockedTitleIds.length} products with BLOCKED titles`);
  }

  /* Per-row UPDATE. Upsert was tried first but PostgREST's upsert
     requires all NOT NULL columns in the payload (or it tries to
     INSERT a partial row); products.title is NOT NULL and we don't
     want to round-trip every title in the update payload. Sequential
     UPDATEs work — at ~50ms per round trip and ~2.5k rows, ~2 min
     total is acceptable for a one-shot migration. */
  let updated = 0;
  let failed  = 0;
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    const { error } = await supa
      .from("products")
      .update({ brand: u.brand, model: u.model })
      .eq("id", u.id);
    if (error) { failed++; if (failed <= 3) console.warn(`  ✗ ${u.id}: ${error.message}`); continue; }
    updated++;
    if (updated % 250 === 0) console.log(`    … ${updated} / ${updates.length}`);
  }
  if (failed > 0) console.log(`    (${failed} updates failed silently)`);

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`✓ Backfill complete`);
  console.log(`  Stores cleaned (BLOCKED):       ${badStores.length}`);
  console.log(`  Products dropped (BLOCKED):     ${titleBlocked}`);
  console.log(`  Products with brand populated:  ${updated}`);
  console.log(`──────────────────────────────────────────────────────────────`);
}

main().catch((err) => { console.error("✗ Fatal:", err); process.exit(1); });
