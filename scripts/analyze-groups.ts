// Diagnostic for product grouping quality. Run:
//   npx tsx scripts/analyze-groups.ts
// Shows:
//   1. Group count by bucket type + store-count distribution
//   2. Near-miss pairs — deals at different stores with similar titles
//      that did NOT merge. Each pair is a missed grouping opportunity.
//   3. Brand coverage — brands with the most deals and how many buckets
//      they shattered into (signal of model-extraction failure).

import { deals } from "../src/lib/data/deals";
import { buildSignature, tokensOf, tokenJaccard } from "../src/lib/search/normalize";

const ACCESSORY_RE =
  /\b(case|cover|sleeve|adapter|cable|charger|stand|mount|protector|replacement|remote|holster|skin|pouch|bag|strap|band|tempered|glass|screen\s*guard)\b/i;

interface IndexedDeal {
  storeId: string;
  title: string;
  category: string;
  id: string;
  key: string;
  brand: string | null;
  model: string | null;
  tokens: string[];
  isAccessory: boolean;
}

const indexed: IndexedDeal[] = deals.map((d) => {
  const sig = buildSignature(d.title);
  let key = sig.key;
  if (key === "?|?" || key === "?") {
    const fallback = sig.tokens.slice(0, 4).sort().join("-");
    key = `fallback|${d.categorySlug}|${fallback || d.id}`;
  }
  if (ACCESSORY_RE.test(d.title)) key = `${key}|acc`;
  return {
    storeId: d.storeId,
    title: d.title,
    category: d.categorySlug,
    id: d.id,
    key,
    brand: sig.brand,
    model: sig.model,
    tokens: sig.tokens,
    isAccessory: ACCESSORY_RE.test(d.title),
  };
});

const buckets = new Map<string, IndexedDeal[]>();
for (const d of indexed) {
  const arr = buckets.get(d.key) ?? [];
  arr.push(d);
  buckets.set(d.key, arr);
}

// ── Section 1: group stats ─────────────────────────────────────────
let fallback = 0;
let nonFallbackSingle = 0;
let nonFallbackMulti = 0;
const dist: Record<string, number> = {};
for (const [key, items] of buckets) {
  const stores = new Set(items.map((i) => i.storeId));
  const k = stores.size >= 5 ? "5+" : String(stores.size);
  dist[k] = (dist[k] ?? 0) + 1;
  if (key.startsWith("fallback|")) fallback++;
  else if (stores.size === 1) nonFallbackSingle++;
  else nonFallbackMulti++;
}
console.log(`total groups: ${buckets.size}`);
console.log(`fallback groups: ${fallback}`);
console.log(`non-fallback single-store: ${nonFallbackSingle}`);
console.log(`non-fallback multi-store: ${nonFallbackMulti}`);
console.log(`store-count distribution:`, dist);

// ── Section 2: near-miss pairs ─────────────────────────────────────
// Find pairs of deals at DIFFERENT stores with high token overlap that
// did NOT merge. These are the highest-value targets for signature fixes.
console.log("\n=== top near-miss pairs (should merge but didn't) ===");

// Group deals by category + brand first to shrink the comparison space
// (O(n²) over all deals would be millions of comparisons).
const byCatBrand = new Map<string, IndexedDeal[]>();
for (const d of indexed) {
  const k = `${d.category}|${d.brand ?? "_"}`;
  (byCatBrand.get(k) ?? byCatBrand.set(k, []).get(k)!).push(d);
}

interface NearMiss {
  a: IndexedDeal;
  b: IndexedDeal;
  sim: number;
}
const misses: NearMiss[] = [];
for (const items of byCatBrand.values()) {
  if (items.length < 2) continue;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.storeId === b.storeId) continue;
      if (a.key === b.key) continue; // already merged
      if (a.isAccessory !== b.isAccessory) continue;
      const sim = tokenJaccard(a.tokens, b.tokens);
      if (sim >= 0.55) misses.push({ a, b, sim });
    }
  }
}
misses.sort((x, y) => y.sim - x.sim);
for (const m of misses.slice(0, 25)) {
  console.log(`  sim=${m.sim.toFixed(2)} brand=${m.a.brand ?? "_"}`);
  console.log(`    [${m.a.storeId}]  ${m.a.title.slice(0, 80)}  → key=${m.a.key}`);
  console.log(`    [${m.b.storeId}]  ${m.b.title.slice(0, 80)}  → key=${m.b.key}`);
}
console.log(`\ntotal near-miss pairs at sim≥0.55: ${misses.length}`);

// ── Section 2b: same-brand near-misses (lower threshold) ───────────
console.log("\n=== same-brand same-store-different cross-store pairs ===");
const brandMisses: NearMiss[] = [];
for (const items of byCatBrand.values()) {
  if (items.length < 2) continue;
  if (items[0].brand === null) continue; // skip _no_brand_ pairs
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.storeId === b.storeId) continue;
      if (a.key === b.key) continue;
      if (a.isAccessory !== b.isAccessory) continue;
      const sim = tokenJaccard(a.tokens, b.tokens);
      if (sim >= 0.25) brandMisses.push({ a, b, sim });
    }
  }
}
brandMisses.sort((x, y) => y.sim - x.sim);
for (const m of brandMisses.slice(0, 20)) {
  console.log(`  sim=${m.sim.toFixed(2)} brand=${m.a.brand}`);
  console.log(`    [${m.a.storeId.padEnd(10)}] ${m.a.title.slice(0, 80)}`);
  console.log(`           key=${m.a.key}  model=${m.a.model ?? "null"}`);
  console.log(`    [${m.b.storeId.padEnd(10)}] ${m.b.title.slice(0, 80)}`);
  console.log(`           key=${m.b.key}  model=${m.b.model ?? "null"}`);
}
console.log(`\ntotal same-brand near-miss pairs (sim≥0.25): ${brandMisses.length}`);

// ── Section 2c: by-store deal counts ───────────────────────────────
console.log("\n=== deals per store ===");
const byStore = new Map<string, number>();
for (const d of indexed) byStore.set(d.storeId, (byStore.get(d.storeId) ?? 0) + 1);
for (const [s, n] of [...byStore.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s.padEnd(12)} ${n}`);
}

// ── Section 2d: titles that appear at multiple stores (literal substring) ─
// Hunt for actual cross-store same-product opportunities by checking if one
// title is a substring of (or has 6+ identical tokens with) another at a
// different store, ignoring brand requirement.
console.log("\n=== probable same-product cross-store pairs ===");
interface ProbPair { a: IndexedDeal; b: IndexedDeal; sharedTokens: number }
const probs: ProbPair[] = [];
// Bucket by category to keep search tractable
const byCat = new Map<string, IndexedDeal[]>();
for (const d of indexed) (byCat.get(d.category) ?? byCat.set(d.category, []).get(d.category)!).push(d);
for (const items of byCat.values()) {
  if (items.length < 2) continue;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.storeId === b.storeId) continue;
      if (a.key === b.key) continue;
      // Filter by shared tokens count, not Jaccard ratio — this finds long
      // titles that share enough specific words even if one has lots of
      // extra fluff.
      const setB = new Set(b.tokens);
      let shared = 0;
      for (const t of a.tokens) if (setB.has(t)) shared++;
      // Require model-number-ish tokens to be among the shared set so we
      // don't false-positive on two completely different products that
      // share generic words like "phone smart wireless 5g".
      const numericShared = a.tokens.filter((t) => setB.has(t) && /\d/.test(t)).length;
      if (shared >= 5 && numericShared >= 1) {
        probs.push({ a, b, sharedTokens: shared });
      }
    }
  }
}
probs.sort((x, y) => y.sharedTokens - x.sharedTokens);
for (const p of probs.slice(0, 25)) {
  console.log(`  shared=${p.sharedTokens}n=${p.a.tokens.filter((t) => /\d/.test(t) && p.b.tokens.includes(t)).length}`);
  console.log(`    [${p.a.storeId.padEnd(10)}] ${p.a.title.slice(0, 80)}  → ${p.a.key}`);
  console.log(`    [${p.b.storeId.padEnd(10)}] ${p.b.title.slice(0, 80)}  → ${p.b.key}`);
}
console.log(`\ntotal probable pairs: ${probs.length}`);

// ── Section 4: per-brand deal listings (debug) ─────────────────────
console.log("\n=== samsung deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "samsung").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}
console.log("\n=== apple deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "apple").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}
console.log("\n=== oraimo deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "oraimo").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}
console.log("\n=== xiaomi deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "xiaomi").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}
console.log("\n=== infinix deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "infinix").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}
console.log("\n=== tecno deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "tecno").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}
console.log("\n=== hisense deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "hisense").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}
console.log("\n=== jbl deals (all) ===");
for (const d of indexed.filter((d) => d.brand === "jbl").sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`  [${d.storeId.padEnd(10)}] key=${d.key.padEnd(35)} ${d.title.slice(0, 70)}`);
}

// ── Section 3: brand shatter ───────────────────────────────────────
console.log("\n=== top brands by shatter ratio (buckets per store) ===");
interface BrandStat {
  brand: string;
  deals: number;
  buckets: Set<string>;
  stores: Set<string>;
}
const brandStats = new Map<string, BrandStat>();
for (const d of indexed) {
  const b = d.brand ?? "_no_brand_";
  let s = brandStats.get(b);
  if (!s) {
    s = { brand: b, deals: 0, buckets: new Set(), stores: new Set() };
    brandStats.set(b, s);
  }
  s.deals++;
  s.buckets.add(d.key);
  s.stores.add(d.storeId);
}
const top = [...brandStats.values()]
  .filter((s) => s.deals >= 5)
  .sort((a, b) => b.deals - a.deals)
  .slice(0, 20);
for (const s of top) {
  const multiStoreBuckets = [...buckets.entries()].filter(
    ([k, items]) => k.startsWith(s.brand + "|") && new Set(items.map((i) => i.storeId)).size > 1,
  ).length;
  console.log(
    `  ${s.brand.padEnd(14)} deals=${String(s.deals).padStart(4)}  buckets=${String(s.buckets.size).padStart(3)}  multi-store-buckets=${multiStoreBuckets}  stores=${s.stores.size}`,
  );
}
