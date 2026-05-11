#!/usr/bin/env tsx
/* Wipes every row from the three signup tables so the user can run
   a clean test cycle:
     - newsletter_subscribers
     - cashback_waitlist
     - product_requests

   USE WITH CARE. This is a destructive operation against production.
   The script reports before/after row counts so the deltas are
   visible in the output.

   Defaults to dry-run mode — pass --confirm to actually delete.

   Usage:
     # See what would be deleted (no rows touched):
     npx tsx --tsconfig tsconfig.scripts.json scripts/clear-test-subscriptions.ts

     # Actually delete:
     npx tsx --tsconfig tsconfig.scripts.json scripts/clear-test-subscriptions.ts --confirm

     # Limit to a specific source tag (e.g. wipe only the rows
     # from a verification script, leave real signups alone):
     npx tsx --tsconfig tsconfig.scripts.json scripts/clear-test-subscriptions.ts --confirm --source=verify-content
*/

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

interface Args {
  confirm: boolean;
  source:  string | null;
}

function parseArgs(): Args {
  const args: Args = { confirm: false, source: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--confirm") args.confirm = true;
    else if (arg.startsWith("--source=")) args.source = arg.slice("--source=".length);
  }
  return args;
}

const TABLES = [
  "newsletter_subscribers",
  "cashback_waitlist",
  "product_requests",
] as const;

async function main() {
  const args = parseArgs();
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no Supabase admin client"); process.exit(1); }

  console.log(`▶ ${args.confirm ? "WIPING" : "DRY RUN — counting only"}`);
  console.log(`  source filter: ${args.source ?? "(none — every row)"}\n`);

  for (const table of TABLES) {
    /* Count first so the user sees what's about to disappear. */
    let countQuery = supa.from(table).select("*", { count: "exact", head: true });
    if (args.source) countQuery = countQuery.eq("source", args.source);
    const { count: before, error: countErr } = await countQuery;

    if (countErr) {
      console.log(`── ${table.padEnd(24)} ── ERROR (${countErr.message})`);
      continue;
    }

    if (!args.confirm) {
      console.log(`── ${table.padEnd(24)} ── would delete ${before ?? 0} row(s)`);
      continue;
    }

    /* Delete. PostgREST requires a filter. Use `email IS NOT NULL`
       since email is required in all three tables — matches every
       row regardless of whether the table's PK is bigserial (newsletter
       / cashback) or UUID (product_requests). The previous `.neq("id",
       -1)` worked for bigserial PKs but blew up on the UUID column
       with "invalid input syntax for type uuid". */
    let delQuery = supa.from(table).delete({ count: "exact" });
    if (args.source) {
      delQuery = delQuery.eq("source", args.source);
    } else {
      delQuery = delQuery.not("email", "is", null);
    }
    const { count: deleted, error: delErr } = await delQuery;

    if (delErr) {
      console.log(`── ${table.padEnd(24)} ── DELETE FAILED (${delErr.message})`);
      continue;
    }

    /* Post-count to confirm. */
    let afterQuery = supa.from(table).select("*", { count: "exact", head: true });
    if (args.source) afterQuery = afterQuery.eq("source", args.source);
    const { count: after } = await afterQuery;

    console.log(`── ${table.padEnd(24)} ── deleted ${deleted ?? 0} row(s), ${after ?? 0} remaining`);
  }

  console.log();
  if (!args.confirm) {
    console.log(`Dry run complete. Re-run with --confirm to actually delete.`);
  } else {
    console.log(`✓ All three tables wiped. Send fresh signups to verify clean state.`);
  }
}
main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
