#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Prune price_history rows older than 90 days.

   The PDP spectrum's "lowest tracked / Verified Nd ago" feature reads
   from the last 90 days only. Rows older than that are dead storage
   that bloat the table without serving any read path.

   Run:
     npm run prune:price-history             # dry-run, report row count
     npm run prune:price-history -- --apply  # actually delete
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ Supabase admin not configured"); process.exit(1); }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`▶ Pruning price_history rows older than ${cutoff}${apply ? "" : " (DRY RUN — pass --apply)"}\n`);

  /* Count first so the dry-run can report scope. */
  const { count } = await supa
    .from("price_history")
    .select("id", { count: "exact", head: true })
    .lt("recorded_at", cutoff);

  console.log(`  Rows ≥ 90d old: ${count ?? 0}`);

  if (!apply) {
    console.log(`\nDry-run complete. Re-run with --apply to delete.`);
    return;
  }

  if ((count ?? 0) === 0) {
    console.log(`✓ Nothing to delete.`);
    return;
  }

  /* DELETE in 5000-row chunks so a multi-hundred-thousand-row sweep
     doesn't lock the table for the full duration of one query.
     Postgres release locks at statement boundaries — small chunks
     mean autovacuum can interleave. */
  let deleted = 0;
  const CHUNK = 5000;
  while (true) {
    /* Select a chunk of ids that match the predicate, then delete by
       id. select-then-delete-by-id is faster than delete-where-cond
       on this table because (recorded_at) doesn't have an index but
       (id) is the primary key. */
    const { data: rows } = await supa
      .from("price_history")
      .select("id")
      .lt("recorded_at", cutoff)
      .limit(CHUNK);
    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    if (ids.length === 0) break;
    const { error } = await supa.from("price_history").delete().in("id", ids);
    if (error) { console.warn(`  ✗ chunk: ${error.message}`); break; }
    deleted += ids.length;
    console.log(`    … ${deleted} / ${count}`);
    if (ids.length < CHUNK) break;
  }

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`✓ Pruned ${deleted} price_history rows`);
  console.log(`──────────────────────────────────────────────────────────────`);
}

main().catch((err) => { console.error("✗ Fatal:", err); process.exit(1); });
