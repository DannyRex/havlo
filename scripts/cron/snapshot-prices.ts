#!/usr/bin/env tsx
/* Weekly price snapshot — gives the PDP price-history chart depth.

   offer_price_history is only written by the on-change trigger
   (0081 record_offer_price_change), so an offer whose price holds steady
   leaves a single history row and the chart has nothing to draw. This job
   snapshots every active offer's current price ONCE A WEEK (skipping any
   offer that already has a history row in the last 6 days, so price
   changes aren't double-counted), giving a regular weekly cadence of
   points. All the work is one server-side statement — snapshot_offer_prices()
   (migration 0082) — so this script is just the trigger + logging.

   Cadence: called from .github/workflows/maintenance.yml on the weekly
   Sunday run. Weekly (not daily) keeps offer_price_history Micro-friendly:
   worst case ~1 row per active offer per week.

   Usage:
     # Count what WOULD be snapshotted, write nothing:
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/snapshot-prices.ts --dry-run

     # Do it (returns rows inserted):
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/snapshot-prices.ts

   CI invocation relies on SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY being
   present as workflow secrets. Migration 0082 must be applied first; until
   then the RPC is missing and the script exits non-zero (loud-fail, so a
   missing migration is visible in the Actions log rather than silent). */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { getSupabaseAdmin } from "../../src/lib/providers/db-client";

const dryRun = process.argv.slice(2).includes("--dry-run");

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no Supabase admin client (SUPABASE_URL / SERVICE_ROLE_KEY unset)"); process.exit(1); }

  console.log(`▶ Weekly price snapshot${dryRun ? " (dry run)" : ""}`);

  const { data, error } = await supa.rpc("snapshot_offer_prices", { p_dry_run: dryRun });
  if (error) {
    /* The most likely error pre-migration is "function ... does not exist".
       Surface it plainly so the fix (apply 0082) is obvious. */
    console.error("✗ snapshot_offer_prices failed:", error.message);
    process.exit(1);
  }

  const count = typeof data === "number" ? data : Number(data ?? 0);
  console.log(
    dryRun
      ? `  ${count} active offer(s) would be snapshotted (none had a history row in the last 6 days).`
      : `✓ snapshotted ${count} offer price(s) into offer_price_history.`,
  );
}

main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
