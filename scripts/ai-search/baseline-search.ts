/**
 * Phase 0 — Capture current heuristic-engine results for each golden query.
 * Output is the "before" snapshot we compare against in Phase 1 validation.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/baseline-search.ts
 *
 * Output: data/ai-search/baseline.json
 */

import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}

import { search, findSimilar, findSimilarByUrl, isUrl } from "../../src/lib/search";

interface GoldenQuery {
  query: string;
  expect: Record<string, unknown>;
  notes?: string;
}

interface BaselineEntry {
  query: string;
  mode: string;
  topResultTitle?: string;
  topResultBrand?: string | null;
  topResultStoreCount?: number;
  resultCount?: number;
  notes?: string;
}

const GOLDEN_PATH   = path.join(process.cwd(), "data/ai-search/golden-queries.json");
const BASELINE_PATH = path.join(process.cwd(), "data/ai-search/baseline.json");

function describe(query: GoldenQuery): BaselineEntry {
  const q = query.query;
  let result: any;
  if (isUrl(q)) {
    result = findSimilarByUrl(q);
  } else if ((query.expect as any).mode === "similar") {
    result = findSimilar(q);
  } else {
    result = search(q);
  }

  const entry: BaselineEntry = { query: q, mode: result.mode, notes: query.notes };

  if (result.mode === "single") {
    entry.topResultTitle      = result.group.title;
    entry.topResultBrand      = result.group.brand;
    entry.topResultStoreCount = result.group.storeCount;
  } else if (result.mode === "list") {
    entry.topResultTitle      = result.groups[0]?.title;
    entry.topResultBrand      = result.groups[0]?.brand ?? null;
    entry.topResultStoreCount = result.groups[0]?.storeCount;
    entry.resultCount         = result.groups.length;
  } else if (result.mode === "similar") {
    entry.topResultTitle      = result.anchor.title;
    entry.topResultBrand      = result.anchor.brand;
    entry.topResultStoreCount = result.anchor.storeCount;
    entry.resultCount         = result.dupes.length;
  } else {
    entry.resultCount = (result.suggestions || []).length;
  }

  return entry;
}

function main(): void {
  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error(`❌ ${GOLDEN_PATH} missing. See ROADMAP §0.3`);
    process.exit(1);
  }
  const queries: GoldenQuery[] = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));
  console.log(`Capturing baseline for ${queries.length} golden queries...`);

  const baseline = queries.map((q, i) => {
    const entry = describe(q);
    const status = entry.topResultTitle ? "✓" : "·";
    console.log(`  ${status} [${i + 1}/${queries.length}] ${entry.mode.padEnd(7)} "${q.query}" → ${entry.topResultTitle ?? "(empty)"}`);
    return entry;
  });

  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`\n✅ Baseline written to ${BASELINE_PATH}`);
}

main();
