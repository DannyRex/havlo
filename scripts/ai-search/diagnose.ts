/**
 * Quick diagnostic — run after validate-extraction.ts fails.
 * Checks: catalog gaps, shadow matcher bugs, extraction quality.
 */
import { deals } from "../../src/lib/data/deals";
import * as fs from "fs";

const extracted = JSON.parse(fs.readFileSync("/Users/admin/Dealesty/data/ai-search/extracted.json", "utf8"));

// 1. Catalog coverage for failing queries
console.log("── Catalog coverage ───────────────────────");
const checks = ["macbook", "playstation", "xbox", "fridge", "dell", "spark 30", "smartwatch", "watch"];
for (const term of checks) {
  const found = deals.filter(d => d.title.toLowerCase().includes(term));
  console.log(`  ${term.padEnd(15)}: ${found.length} deals ${found.length ? "→ " + found[0].title.slice(0, 55) : "(NOT IN CATALOG)"}`);
}

// 2. Extraction quality for key brands
console.log("\n── Extraction quality for key brands ──────");
const brands = ["apple", "samsung", "tecno", "infinix", "hisense", "jbl", "nike"];
for (const brand of brands) {
  const brandDeals = deals.filter(d => {
    const ext = extracted[d.id];
    return ext?.brand === brand;
  });
  console.log(`  ${brand.padEnd(10)}: ${brandDeals.length} deals extracted`);
}

// 3. MacBook specifically — what's in catalog and how extracted
console.log("\n── MacBook extraction ──────────────────────");
const macDeals = deals.filter(d => /macbook/i.test(d.title));
for (const d of macDeals.slice(0, 5)) {
  const ext = extracted[d.id];
  console.log(`  "${d.title.slice(0, 55)}"`);
  console.log(`    → brand:${ext?.brand} model:${ext?.model} type:${ext?.product_type} conf:${ext?.confidence}`);
}

// 4. "phone" query — what's the top scorer issue
console.log("\n── Sample extracted product_types ─────────");
const typeCounts: Record<string, number> = {};
for (const ext of Object.values(extracted) as any[]) {
  typeCounts[ext.product_type ?? "null"] = (typeCounts[ext.product_type ?? "null"] ?? 0) + 1;
}
Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).forEach(([t,n]) => console.log(`  ${String(n).padStart(4)}  ${t}`));
