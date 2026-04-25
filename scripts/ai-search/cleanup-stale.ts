/**
 * Remove stale rows from deals_index — deals that no longer exist in deals.ts.
 * Run this after any scraper refresh that removes or replaces deals.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/cleanup-stale.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = "/Users/admin/Dealesty/.env.local";
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { deals } = await import("../../src/lib/data/deals");
  const liveIds = new Set(deals.map((d) => d.id));

  console.log(`📦 Live catalog: ${liveIds.size} deals`);

  // Fetch all IDs currently in the index
  const { data: rows, error } = await supa.from("deals_index").select("id");
  if (error) throw error;
  const indexIds = (rows ?? []).map((r: any) => r.id as string);
  console.log(`🗄  Supabase index: ${indexIds.length} rows`);

  const stale = indexIds.filter((id) => !liveIds.has(id));
  console.log(`🗑  Stale rows to delete: ${stale.length}`);

  if (stale.length === 0) {
    console.log("✅ Index is clean — nothing to delete.");
    return;
  }

  // Delete in batches of 100
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < stale.length; i += BATCH) {
    const batch = stale.slice(i, i + BATCH);
    const { error: delErr } = await supa
      .from("deals_index")
      .delete()
      .in("id", batch);
    if (delErr) throw delErr;
    deleted += batch.length;
    console.log(`  🗑  Deleted ${deleted}/${stale.length}`);
  }

  const missing = deals.filter((d) => !indexIds.includes(d.id));
  console.log(`\n✅ Cleanup done. ${missing.length} new deals need embedding → run: npm run ai:reindex`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
