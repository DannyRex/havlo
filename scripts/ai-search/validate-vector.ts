/**
 * Phase 2.7 — Validate vector engine against golden queries.
 *
 * Runs each golden query through vectorSearch / vectorFindSimilar and checks
 * the same expectations used in validate-extraction.ts. Reports pass rate and
 * writes a report JSON.
 *
 * Exit codes:
 *   0 → pass rate ≥ 80% (proceed to Phase 2.8 commit)
 *   1 → quality bar not met
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs) && \
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/validate-vector.ts
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
import type { SearchOutput, ProductGroup } from "../../src/lib/search/index";

const GOLDEN_PATH = path.join(process.cwd(), "data/ai-search/golden-queries.json");
const REPORT_PATH = path.join(process.cwd(), "data/ai-search/vector-validation-report.json");

interface GoldenQuery {
  query: string;
  expect: {
    mode?: string;
    brand?: string;
    model_contains?: string;
    product_type?: string;
    product_type_any?: string[];
    is_accessory?: boolean;
    from_url?: boolean;
    skip_if_not_in_catalog?: boolean;
    anchor_brand?: string;
    [k: string]: unknown;
  };
  notes?: string;
}

function extractedBrand(g: ProductGroup): string | null {
  return g.brand;
}

function checkResult(
  result: SearchOutput,
  expect: GoldenQuery["expect"],
): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const emptyOk =
    (expect.mode as string)?.includes("empty") || expect.skip_if_not_in_catalog;

  // Must return empty
  if (expect.mode === "empty") {
    const hasResult =
      result.mode === "single" ||
      (result.mode === "list" && result.groups.length > 0) ||
      (result.mode === "similar" && result.dupes.length > 0);
    if (hasResult) {
      const title =
        result.mode === "single"
          ? result.group.title
          : result.mode === "list"
          ? result.groups[0]?.title
          : null;
      reasons.push(`expected empty, got "${title?.slice(0, 50)}"`);
      return { passed: false, reasons };
    }
    return { passed: true, reasons };
  }

  // Get top group
  let topGroup: ProductGroup | null = null;
  if (result.mode === "single") topGroup = result.group;
  else if (result.mode === "list") topGroup = result.groups[0] ?? null;
  else if (result.mode === "similar") topGroup = result.anchor;
  // empty mode: topGroup stays null

  if (!topGroup) {
    if (emptyOk) return { passed: true, reasons: ["empty — ok (not in catalog)"] };
    reasons.push("no top result");
    return { passed: false, reasons };
  }

  // from_url / similar mode: check anchor brand
  if (expect.from_url && expect.anchor_brand) {
    const b = extractedBrand(topGroup);
    if (b !== expect.anchor_brand) {
      reasons.push(`anchor brand: expected ${expect.anchor_brand}, got ${b}`);
      return { passed: false, reasons };
    }
    return { passed: true, reasons };
  }

  // from_url without brand constraint = any result or empty
  if (expect.from_url) return { passed: true, reasons: ["url query — any result ok"] };

  // Brand check
  if (expect.brand) {
    const b = extractedBrand(topGroup);
    if (b !== expect.brand) {
      reasons.push(`brand: expected ${expect.brand}, got ${b}`);
      return { passed: false, reasons };
    }
  }

  // model_contains
  if (expect.model_contains) {
    const m = topGroup.model ?? topGroup.title.toLowerCase();
    if (!m.toLowerCase().includes(expect.model_contains)) {
      reasons.push(
        `model: expected to contain "${expect.model_contains}", title="${topGroup.title.slice(0, 50)}"`,
      );
      return { passed: false, reasons };
    }
  }

  // product_type (strict single)
  if (expect.product_type) {
    // We don't have product_type on ProductGroup directly — extract from
    // extracted.json using the best-matching deal.
    // Approximate: check group title using the same classifyProductType logic.
    const titles = [topGroup.title, ...topGroup.offers.map((o) => o.url)];
    // Simple heuristic check based on group title
    const pt = inferProductType(topGroup.title);
    if (pt !== expect.product_type) {
      reasons.push(`type: expected ${expect.product_type}, inferred ${pt} from "${topGroup.title.slice(0, 50)}"`);
      return { passed: false, reasons };
    }
  }

  // product_type_any
  if (expect.product_type_any) {
    const pt = inferProductType(topGroup.title);
    if (pt && !expect.product_type_any.includes(pt)) {
      reasons.push(
        `type: expected [${expect.product_type_any.join(",")}], inferred ${pt}`,
      );
      return { passed: false, reasons };
    }
  }

  // is_accessory — check group title contains an accessory keyword
  if (expect.is_accessory === true) {
    const accRe =
      /\b(case|cover|sleeve|adapter|cable|charger|stand|mount|protector|replacement|remote|holster|skin|pouch|bag|strap|band|tempered|glass|screen\s*guard|earphone|earphones|headphone|headphones|earbuds|earbud|tws)\b/i;
    if (!accRe.test(topGroup.title)) {
      reasons.push(`expected accessory result, got "${topGroup.title.slice(0, 50)}"`);
      return { passed: false, reasons };
    }
  }

  return { passed: true, reasons };
}

// Same product-type regex classifier used in index.ts
const PRODUCT_TYPES: { re: RegExp; type: string }[] = [
  { re: /\b(iphone|galaxy\s*s\d|pixel\s*\d|oneplus|phantom|zero|note\s*\d+\s*pro)\b/i, type: "flagship-phone" },
  { re: /\b(galaxy\s*a\d|spark|hot\s*\d|smart\s*\d|pop\s*\d|camon|pova|a0\d|a1\d|redmi|poco)\b/i, type: "budget-phone" },
  { re: /\b(ipad|tab\s*[as]|tablet|mediapad)\b/i, type: "tablet" },
  { re: /\b(macbook|thinkpad|zenbook|xps|swift|spectre|gram)\b/i, type: "premium-laptop" },
  { re: /\b(laptop|notebook|chromebook|ideapad|aspire|pavilion|inspiron)\b/i, type: "laptop" },
  { re: /\b(airpods|buds\s*pro|wf-|galaxy\s*buds|freebuds)\b/i, type: "premium-earbuds" },
  { re: /\b(earbuds|earphones|earphone|wireless\s*ear|tws|earpods)\b/i, type: "earbuds" },
  { re: /\b(headphone|headphones|wh-|headset|over[\s-]*ear)\b/i, type: "headphones" },
  { re: /\b(speaker|soundbar|boombox|portable\s*speaker|clip\s*\d)\b/i, type: "speaker" },
  { re: /\b(tv|television|smart\s*tv|\d{2,3}\s*inch|\d{2,3}")\b/i, type: "tv" },
  { re: /\b(playstation|ps[45]|xbox|nintendo|switch|console|gaming\s*console)\b/i, type: "console" },
  { re: /\b(watch|smartwatch|smart\s*watch|band|fitness\s*tracker)\b/i, type: "smartwatch" },
  { re: /\b(sneaker|sneakers|trainer|running\s*shoe|air\s*max|air\s*force|air\s*zoom|air\s*superfly|air\s*super\b|jordan|yeezy|boost|rnr|pegasus)\b/i, type: "sneakers" },
];

function inferProductType(title: string): string | null {
  for (const pt of PRODUCT_TYPES) {
    if (pt.re.test(title)) return pt.type;
  }
  return null;
}

async function main() {
  const queries: GoldenQuery[] = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));
  console.log(`🔍 Validating ${queries.length} golden queries against vector engine\n`);

  let passed = 0;
  const details: unknown[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    let result: SearchOutput;

    try {
      if (q.expect.from_url) {
        // URL queries — use vectorSearch on the URL (it will parse it internally)
        result = await vectorSearch(q.query);
      } else if ((q.expect.mode as string)?.includes("similar")) {
        result = await vectorFindSimilar(q.query);
      } else {
        result = await vectorSearch(q.query);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ [${i + 1}/${queries.length}] "${q.query}" — ERROR: ${msg}`);
      details.push({ query: q.query, outcome: "error", error: msg });
      continue;
    }

    const { passed: ok, reasons } = checkResult(result, q.expect);
    if (ok) passed++;

    const icon = ok ? "✅" : "⚠️ ";
    console.log(`${icon} [${String(i + 1).padStart(2)}/${queries.length}] "${q.query}"`);
    const topTitle =
      result.mode === "single"
        ? result.group.title
        : result.mode === "list"
        ? result.groups[0]?.title
        : result.mode === "similar"
        ? result.anchor.title
        : "(empty)";
    console.log(`     → ${(topTitle ?? "(empty)").slice(0, 70)}  [mode=${result.mode}]`);
    if (!ok) console.log(`     ⚠ ${reasons.join("; ")}`);

    details.push({ query: q.query, outcome: ok ? "pass" : "fail", reasons, topTitle, mode: result.mode });
  }

  const passRate = Math.round((passed / queries.length) * 1000) / 10;
  const summary = { total: queries.length, passed, failed: queries.length - passed, passRate };

  console.log("\n────────────────────────────────────────");
  console.log(`📊 Vector validation summary:`);
  console.log(`   Pass rate: ${passRate}% (${passed}/${queries.length})`);
  console.log("────────────────────────────────────────");

  fs.writeFileSync(REPORT_PATH, JSON.stringify({ summary, details }, null, 2));
  console.log(`Report: ${REPORT_PATH}`);

  if (passRate < 80) {
    console.log(`\n❌ Quality bar not met (need ≥80%). See report for failing queries.`);
    process.exit(1);
  }
  console.log(`\n✅ Quality bar met. Proceed to Phase 2.8 (commit + PR).`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
