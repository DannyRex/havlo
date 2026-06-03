#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Seed a "tracking starts now" price-history point for every offer that
   doesn't have one yet (#24). Runs after each ingest cycle so newly-
   ingested inventory — heaviest in NG, the most-refreshed market —
   always gets a starting point instead of rendering a flat/empty chart.

   The per-row INSERT trigger seeds most offers, but offers added via
   bulk paths (or between one-time backfills) slip through; this closes
   the gap durably. Idempotent: only inserts where no history row exists.

   Calls the seed_missing_price_history() RPC from migration 0067. If
   that migration hasn't been applied yet the call errors — we log and
   exit 0 so a cron run is never failed by it.

   Usage:  npm run seed:price-history
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* env may already be present (CI secrets) */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main(): Promise<void> {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.warn("[seed-history] No Supabase admin client (missing env) — skipping.");
    return;
  }

  const { data, error } = await supa.rpc("seed_missing_price_history");
  if (error) {
    /* Most likely the 0067 migration (which defines the RPC) isn't applied
       yet. Don't fail the cron over a nice-to-have seed. */
    console.warn(`[seed-history] seed_missing_price_history RPC unavailable — skipping. (${error.message})`);
    return;
  }
  console.log(`[seed-history] seeded ${data ?? 0} starting price-history point(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.warn("[seed-history] unexpected error (non-fatal):", (err as Error).message);
    process.exit(0);
  });
