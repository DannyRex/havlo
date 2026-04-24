/**
 * Phase 2.5 smoke test — calls vectorSearch directly (no Next.js server needed)
 * against 6 representative golden queries and prints the top 3 hits.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs) && \
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/smoke-test-vector.ts
 */

import * as fs from "fs";
import * as path from "path";

const envPath = "/Users/admin/Dealesty/.env.local";
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import { vectorSearch, vectorFindSimilar } from "../../src/lib/search/vector";

const QUERIES = [
  { q: "iPhone", mode: "search" },
  { q: "Galaxy A06", mode: "search" },
  { q: "earbuds", mode: "search" },
  { q: "phone", mode: "search" },
  { q: "iphone case", mode: "search" },
  { q: "MacBook Pro M3", mode: "search" },
  { q: "Hisense 50 inch TV", mode: "search" },
  { q: "Tecno Spark", mode: "similar" },
];

(async () => {
  for (const { q, mode } of QUERIES) {
    process.stdout.write(`\n🔎 [${mode}] "${q}"\n`);
    try {
      const t0 = Date.now();
      const r = mode === "similar" ? await vectorFindSimilar(q) : await vectorSearch(q);
      const ms = Date.now() - t0;
      console.log(`   mode=${r.mode}  ${ms}ms`);
      if (r.mode === "single") {
        console.log(`   → ${r.group.title.slice(0, 70)}  [${r.group.brand}/${r.group.storeCount} stores]`);
        for (const a of r.alternatives.slice(0, 2)) console.log(`     · ${a.title.slice(0, 65)}`);
      } else if (r.mode === "list") {
        for (const g of r.groups.slice(0, 3)) console.log(`   · ${g.title.slice(0, 70)}  [${g.brand}/${g.storeCount}st]`);
      } else if (r.mode === "similar") {
        console.log(`   anchor: ${r.anchor.title.slice(0, 70)}`);
        for (const d of r.dupes.slice(0, 3)) console.log(`     · ${d.title.slice(0, 60)}  sim=${d.similarityScore} sav=${d.savingsPercent}%`);
      } else {
        console.log(`   (empty)  suggestions: ${r.suggestions.length}`);
      }
    } catch (e: any) {
      console.log(`   ❌ ${e.message}`);
    }
  }
})();
