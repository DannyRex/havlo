/**
 * Phase 3.3 — Weekly reindex
 *
 * Re-runs extraction + embedding for any deals whose title/image has changed
 * since the last run. Safe to run on a cron (new deals get picked up; changed
 * titles get re-extracted and re-embedded; unchanged deals are skipped cheaply
 * via content hashing in both scripts).
 *
 * Usage (manual):
 *   npm run ai:reindex
 *
 * Cron (add to crontab or Vercel cron):
 *   0 3 * * 1  cd /Users/admin/Dealesty && npm run ai:reindex >> /tmp/dealesty-reindex.log 2>&1
 *   (Every Monday at 03:00 — after the scraper runs on Sunday night)
 *
 * What it does:
 *   1. extract-products.ts  — re-extracts any deal with a changed title hash
 *   2. embed-deals.ts --all — re-embeds any deal with a changed text/image hash
 *
 * Cost estimate per weekly run (assuming ~5% catalog churn):
 *   ~60 deals × Haiku extraction  ≈ $0.07
 *   ~60 deals × text embedding    ≈ $0.000002
 *   ~60 deals × image embedding   ≈ $0.006
 *   Total ≈ ~$0.08 / week
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = "/Users/admin/Dealesty";
const envPath = path.join(PROJECT_ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const TSX = "npx tsx --tsconfig tsconfig.scripts.json";
const run = (cmd: string) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: PROJECT_ROOT });
};

console.log(`\n🔄 Dealesty weekly reindex — ${new Date().toISOString()}`);
console.log("   Step 1/2: Re-extract changed deals (Haiku)...");
run(`${TSX} scripts/ai-search/extract-products.ts`);

console.log("\n   Step 2/2: Re-embed changed deals (OpenAI + Cohere)...");
run(`${TSX} scripts/ai-search/embed-deals.ts --all`);

console.log("\n✅ Reindex complete.");
