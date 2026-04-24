/**
 * Phase 1.3 — Wire extracted.json into src/lib/search/normalize.ts.
 *
 * What it does:
 *   1. Backs up normalize.ts → normalize.ts.pre-ai.bak
 *   2. Adds an `extractedSignature(dealId)` helper that reads extracted.json
 *   3. Modifies the `IndexedDeal` build path in src/lib/search/index.ts so that
 *      when an extracted entry exists for a deal, its data is preferred over
 *      the heuristic regex extraction.
 *
 * SAFETY:
 *   - Idempotent: running twice is a no-op (detects an existing AI block).
 *   - Reversible: restore the .bak file to revert.
 *   - Does NOT delete the heuristic path (it remains the fallback).
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/replace-signature.ts
 *   # then run: npm run lint && npm run build
 */

import * as fs from "fs";
import * as path from "path";

const NORMALIZE_PATH = path.join(process.cwd(), "src/lib/search/normalize.ts");
const INDEX_PATH     = path.join(process.cwd(), "src/lib/search/index.ts");
const EXTRACTED_PATH = path.join(process.cwd(), "data/ai-search/extracted.json");

const AI_MARKER = "/* ── AI-EXTRACTED SIGNATURES (extracted.json) ── */";

const AI_BLOCK = `
${AI_MARKER}
import _aiExtracted from "../../../data/ai-search/extracted.json";

interface _AiExtracted {
  brand: string | null;
  model: string | null;
  variant: string | null;
  product_type: string | null;
  storage_gb: number | null;
  ram_gb: number | null;
  inches: number | null;
  color: string | null;
  is_accessory: boolean;
  confidence: "high" | "medium" | "low";
  search_terms: string;
}

const _AI_DATA = _aiExtracted as Record<string, _AiExtracted>;

/** Read AI-extracted signature for a given deal id, falling back to regex
 *  extraction. Confidence "low" entries fall through to regex too — they're
 *  not trustworthy enough to override a hand-tuned regex match.
 */
export function extractedSignature(dealId: string, title: string): ProductSignature | null {
  const e = _AI_DATA[dealId];
  if (!e) return null;
  if (e.confidence === "low" && !e.brand) return null;

  const norm = title.toLowerCase()
    .replace(/[^a-z0-9.\\s]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
  const tokens = norm.split(/\\s+/).filter((t) => t.length > 1);

  const parts = [
    e.brand ?? "?",
    e.model ?? "?",
    e.inches ? \`\${Math.round(e.inches)}in\` : null,
  ].filter(Boolean);

  return {
    brand:     e.brand,
    model:     e.model,
    storageGb: e.storage_gb,
    ramGb:     e.ram_gb,
    inches:    e.inches,
    color:     e.color,
    tokens,
    key:       parts.join("|") + (e.is_accessory ? "|acc" : ""),
    norm,
  };
}
${AI_MARKER}
`;

function patchNormalize(): boolean {
  const src = fs.readFileSync(NORMALIZE_PATH, "utf8");

  if (src.includes(AI_MARKER)) {
    console.log("· normalize.ts already patched — skipping");
    return false;
  }

  // Backup
  fs.writeFileSync(NORMALIZE_PATH + ".pre-ai.bak", src);

  // Append AI block at end of file
  fs.writeFileSync(NORMALIZE_PATH, src.trimEnd() + "\n" + AI_BLOCK);
  console.log(`✓ normalize.ts patched (backup: normalize.ts.pre-ai.bak)`);
  return true;
}

function patchIndex(): boolean {
  const src = fs.readFileSync(INDEX_PATH, "utf8");

  if (src.includes("extractedSignature(")) {
    console.log("· index.ts already wired up — skipping");
    return false;
  }

  // Backup
  fs.writeFileSync(INDEX_PATH + ".pre-ai.bak", src);

  // Update the import to include extractedSignature
  let patched = src.replace(
    /from "\\.\\/normalize";/,
    'from "./normalize";\nimport { extractedSignature } from "./normalize";',
  );

  // Modify getIndex() to prefer AI-extracted data
  patched = patched.replace(
    '_index = deals.map((d) => ({ deal: d, sig: buildSignature(d.title) }));',
    '_index = deals.map((d) => ({ deal: d, sig: extractedSignature(d.id, d.title) ?? buildSignature(d.title) }));',
  );

  if (patched === src) {
    console.error("⚠ Could not find expected pattern in index.ts to patch.");
    console.error("  Look for the line: '_index = deals.map(...)' inside getIndex().");
    console.error("  Patch manually:    sig: extractedSignature(d.id, d.title) ?? buildSignature(d.title)");
    return false;
  }

  fs.writeFileSync(INDEX_PATH, patched);
  console.log(`✓ index.ts wired (backup: index.ts.pre-ai.bak)`);
  return true;
}

function main(): void {
  if (!fs.existsSync(EXTRACTED_PATH)) {
    console.error(`❌ ${EXTRACTED_PATH} missing. Run extract-products.ts first.`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(EXTRACTED_PATH, "utf8"));
  console.log(`Found ${Object.keys(data).length} extracted entries.`);

  const a = patchNormalize();
  const b = patchIndex();

  if (a || b) {
    console.log("\n✅ Patch complete. Now run:");
    console.log("   npm run lint");
    console.log("   npm run build");
    console.log("\nIf either fails, restore backups:");
    console.log("   mv src/lib/search/normalize.ts.pre-ai.bak src/lib/search/normalize.ts");
    console.log("   mv src/lib/search/index.ts.pre-ai.bak src/lib/search/index.ts");
  } else {
    console.log("\n· No changes needed.");
  }
}

main();
