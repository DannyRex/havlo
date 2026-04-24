/**
 * Phase 1 — Validate that extracted.json improves matching vs the heuristic baseline.
 *
 * For each golden query, runs both:
 *   1. Current heuristic engine (from baseline.json)
 *   2. A "shadow" run using extracted.json data
 *
 * Reports per-query pass/regress/improve/unchanged and writes a JSON report.
 *
 * Exit codes:
 *   0  → ≥80% pass AND regressions ≤2
 *   1  → quality bar not met (do not proceed to Phase 1.3)
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/validate-extraction.ts
 */

import * as fs from "fs";
import * as path from "path";
import { deals } from "../../src/lib/data/deals";

interface GoldenQuery {
  query: string;
  expect: {
    mode?: string;
    brand?: string;
    model_contains?: string;
    storage_gb?: number;
    inches?: number;
    product_type?: string;
    is_accessory?: boolean;
    [k: string]: unknown;
  };
  notes?: string;
}

interface Extracted {
  brand: string | null;
  model: string | null;
  product_type: string | null;
  storage_gb: number | null;
  inches: number | null;
  is_accessory: boolean;
  confidence: string;
  search_terms: string;
  [k: string]: unknown;
}

const GOLDEN_PATH    = path.join(process.cwd(), "data/ai-search/golden-queries.json");
const BASELINE_PATH  = path.join(process.cwd(), "data/ai-search/baseline.json");
const EXTRACTED_PATH = path.join(process.cwd(), "data/ai-search/extracted.json");
const REPORT_PATH    = path.join(process.cwd(), "data/ai-search/validation-report.json");

interface ShadowResult {
  query: string;
  topTitle: string | null;
  topBrand: string | null;
  topModel: string | null;
  topProductType: string | null;
  candidatesConsidered: number;
}

// Category keyword → allowed product_types. Prevents "phone" matching dresses.
const CATEGORY_GUARD: Record<string, string[]> = {
  phone:     ["flagship-phone", "budget-phone", "tablet"],
  phones:    ["flagship-phone", "budget-phone", "tablet"],
  smartphone:["flagship-phone", "budget-phone"],
  laptop:    ["laptop", "premium-laptop"],
  macbook:   ["laptop", "premium-laptop"],
  tv:        ["tv"],
  television:["tv"],
  earbuds:   ["earbuds", "premium-earbuds"],
  earphones: ["earbuds", "premium-earbuds"],
  headphone: ["headphones"],
  headphones:["headphones"],
  speaker:   ["speaker", "soundbar"],
  fridge:    ["fridge"],
  washer:    ["washer"],
  console:   ["console"],
  playstation:["console"],
  xbox:      ["console"],
  watch:     ["watch", "smartwatch"],
  smartwatch:["smartwatch"],
};

/**
 * Naive shadow matcher using extracted.json — proves the LLM data is good
 * enough to drive matching. NOT the production matcher; this is a regression
 * harness only.
 */
function shadowMatch(query: string, extracted: Record<string, Extracted>): ShadowResult {
  const q = query.toLowerCase().trim();
  const qTokens = q.split(/\s+/).filter((t) => t.length > 1);

  // Determine if query implies a specific category — if so, exclude other types
  const requiredTypes: string[] = [];
  for (const token of qTokens) {
    if (CATEGORY_GUARD[token]) { requiredTypes.push(...CATEGORY_GUARD[token]); break; }
  }

  type Scored = { dealId: string; score: number; ext: Extracted };
  const scored: Scored[] = [];

  for (const d of deals) {
    const ext = extracted[d.id];
    if (!ext) continue;
    let s = 0;

    // Category alignment guard — if query implies a type, reject mismatches hard
    if (requiredTypes.length > 0 && ext.product_type) {
      if (!requiredTypes.includes(ext.product_type)) continue;
    }

    // Exact brand mention
    if (ext.brand && q.includes(ext.brand)) s += 30;
    // Model overlap
    if (ext.model) {
      const modelTokens = ext.model.split(/\s+/);
      for (const mt of modelTokens) if (mt.length > 1 && q.includes(mt)) s += 20;
    }
    // Search-terms overlap (tells us how shoppers find this)
    const stTokens = (ext.search_terms || "").split(/\s+/);
    for (const t of stTokens) if (qTokens.includes(t)) s += 5;
    // Storage / inches exact match boost
    const storageMatch = q.match(/(\d+)\s*gb/);
    if (storageMatch && ext.storage_gb === parseInt(storageMatch[1], 10)) s += 15;
    const inchMatch = q.match(/(\d+)\s*(?:inch|in|")/);
    if (inchMatch && ext.inches === parseInt(inchMatch[1], 10)) s += 15;
    // Accessory penalty unless query asks for one
    if (ext.is_accessory && !/case|cover|charger|cable|stand|protector/.test(q)) s -= 40;
    // Confidence weight
    if (ext.confidence === "high") s += 3;
    else if (ext.confidence === "low") s -= 5;

    if (s > 5) scored.push({ dealId: d.id, score: s, ext });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) {
    return { query, topTitle: null, topBrand: null, topModel: null, topProductType: null, candidatesConsidered: 0 };
  }
  const deal = deals.find((d) => d.id === top.dealId)!;
  return {
    query,
    topTitle: deal.title,
    topBrand: top.ext.brand,
    topModel: top.ext.model,
    topProductType: top.ext.product_type,
    candidatesConsidered: scored.length,
  };
}

function checkExpectations(shadow: ShadowResult, expect: GoldenQuery["expect"]): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let passed = true;

  // "empty_or_list" / "skip_if_not_in_catalog" — empty is a valid pass
  const emptyOk = (expect.mode as string)?.includes("empty") || expect.skip_if_not_in_catalog;

  if (expect.mode === "empty") {
    if (shadow.topTitle !== null) {
      passed = false;
      reasons.push(`expected empty, got "${shadow.topTitle?.slice(0, 50)}"`);
    }
    return { passed, reasons };
  }

  if (!shadow.topTitle) {
    if (emptyOk) return { passed: true, reasons: ["empty — acceptable (not in catalog)"] };
    passed = false;
    reasons.push("no top result");
    return { passed, reasons };
  }

  // If result is an accessory and query doesn't want one, that's always wrong
  if (shadow.topProductType === "accessory" && !/case|cover|charger|cable|stand|protector/.test(
    Object.keys(expect).join(" ") + " " + (expect.product_type ?? "")
  )) {
    // only flag if brand/type expectations exist
    if (expect.brand || expect.product_type || (expect as any).product_type_any) {
      passed = false;
      reasons.push(`got an accessory result, not a product`);
      return { passed, reasons };
    }
  }

  if (expect.brand && shadow.topBrand !== expect.brand) {
    passed = false;
    reasons.push(`brand: expected ${expect.brand}, got ${shadow.topBrand}`);
  }
  if (expect.model_contains && (!shadow.topModel || !shadow.topModel.includes(expect.model_contains))) {
    passed = false;
    reasons.push(`model: expected to contain "${expect.model_contains}", got "${shadow.topModel}"`);
  }
  if (expect.product_type && shadow.topProductType !== expect.product_type) {
    passed = false;
    reasons.push(`type: expected ${expect.product_type}, got ${shadow.topProductType}`);
  }
  // product_type_any — pass if result matches any of the listed types
  const typeAny = (expect as any).product_type_any as string[] | undefined;
  if (typeAny && shadow.topProductType && !typeAny.includes(shadow.topProductType)) {
    passed = false;
    reasons.push(`type: expected one of [${typeAny.join(",")}], got ${shadow.topProductType}`);
  }

  return { passed, reasons };
}

function main(): void {
  for (const p of [GOLDEN_PATH, EXTRACTED_PATH]) {
    if (!fs.existsSync(p)) {
      console.error(`❌ Missing ${p}. See ROADMAP §1.1`);
      process.exit(1);
    }
  }

  const queries: GoldenQuery[]            = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));
  const extracted: Record<string, Extracted> = JSON.parse(fs.readFileSync(EXTRACTED_PATH, "utf8"));
  const baseline: any[]                   = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : [];

  console.log(`🔍 Validating ${queries.length} golden queries against extracted.json (${Object.keys(extracted).length} entries)\n`);

  let passed = 0;
  let regressed = 0;
  let improved = 0;
  let unchanged = 0;
  const details: any[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const shadow = shadowMatch(q.query, extracted);
    const { passed: ok, reasons } = checkExpectations(shadow, q.expect);

    const baseEntry = baseline.find((b) => b.query === q.query);
    const baselineHadResult = !!baseEntry?.topResultTitle;
    const baselineMatched = baseEntry && q.expect.brand
      ? baseEntry.topResultBrand === q.expect.brand
      : baselineHadResult;

    let outcome: "pass" | "regress" | "improve" | "unchanged";
    if (ok && !baselineMatched) outcome = "improve";
    else if (!ok && baselineMatched) outcome = "regress";
    else if (ok) outcome = "pass";
    else outcome = "unchanged"; // both failed (or unknown baseline)

    if (ok) passed++;
    if (outcome === "regress") regressed++;
    if (outcome === "improve") improved++;
    if (outcome === "unchanged") unchanged++;

    const icon =
      outcome === "improve" ? "✨" :
      outcome === "regress" ? "⚠️ " :
      outcome === "pass"    ? "✅" : "·· ";

    console.log(`${icon} [${(i + 1).toString().padStart(2)}/${queries.length}] "${q.query}"`);
    console.log(`     → ${shadow.topTitle ?? "(empty)"}`);
    if (!ok) console.log(`     ⚠ ${reasons.join("; ")}`);

    details.push({ query: q.query, outcome, ok, shadow, expected: q.expect, reasons });
  }

  const passRate = (passed / queries.length) * 100;
  const summary = {
    total: queries.length,
    passed,
    failed: queries.length - passed,
    regressed,
    improved,
    unchanged,
    passRate: Math.round(passRate * 10) / 10,
  };

  console.log("\n────────────────────────────────────────");
  console.log(`📊 Validation summary:`);
  console.log(`   Pass rate:     ${summary.passRate}% (${passed}/${queries.length})`);
  console.log(`   Improvements:  ${improved}`);
  console.log(`   Regressions:   ${regressed}`);
  console.log(`   Unchanged:     ${unchanged}`);
  console.log(`────────────────────────────────────────`);

  fs.writeFileSync(REPORT_PATH, JSON.stringify({ summary, details }, null, 2));
  console.log(`Report: ${REPORT_PATH}`);

  if (passRate < 80 || regressed > 2) {
    console.log(`\n❌ Quality bar not met (need ≥80% pass AND ≤2 regressions).`);
    console.log(`   Tune the prompt in docs/ai-search/PROMPTS.md, bump to extract-v2,`);
    console.log(`   and re-run extract-products.ts.`);
    process.exit(1);
  }

  console.log(`\n✅ Quality bar met. Proceed to ROADMAP §1.3 (replace-signature.ts).`);
}

main();
