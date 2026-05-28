#!/usr/bin/env tsx
/* Pull real duplicate-pair examples from the DB to surface the
   exact signature-drift patterns that cause orphan creation.

   Strategy: find pairs of products with DIFFERENT signatures but
   HIGH-similarity titles, where both have offers from the SAME
   store. Such pairs are the live evidence of "the matcher missed,
   so a duplicate product was created." Categorise the title
   differences (casing, punctuation, word order, extra word,
   embedded store brand, embedded promo copy) so the patches can
   target them directly.

   Read-only. Outputs to console + CSV. */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* noop */ }

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface ProductRow {
  id:        string;
  title:     string;
  brand:     string | null;
  category:  string | null;
  signature: string | null;
  created_at: string;
}

interface OfferRow {
  product_id: string;
  store_id:   string;
}

async function pageAll<T>(
  fetcher: (off: number, lim: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let off = 0;
  for (;;) {
    const b = await fetcher(off, pageSize);
    out.push(...b);
    if (b.length < pageSize) break;
    off += pageSize;
  }
  return out;
}

/* Strip all whitespace, lowercase, drop punctuation. The crudest
   possible normaliser. If two products map to the same crude form
   but DIFFERENT live signatures, the signature normaliser is
   clearly missing something this picks up. */
function crudeKey(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/* Classify the difference between two titles into categories so
   we can count which patches matter most. */
function classifyDiff(a: string, b: string): string[] {
  const tags: string[] = [];
  if (a === b) return ["identical"];

  /* Case-only */
  if (a.toLowerCase() === b.toLowerCase()) tags.push("case-only");

  /* Single-character difference (& vs and, em-dash vs hyphen) */
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA.replace(/&/g, "and") === lowerB.replace(/&/g, "and")) tags.push("ampersand");
  if (lowerA.replace(/[—–-]/g, "") === lowerB.replace(/[—–-]/g, "")) tags.push("dash");
  if (lowerA.replace(/\s+/g, " ").trim() === lowerB.replace(/\s+/g, " ").trim()) tags.push("whitespace");

  /* Substring / extension (one is a prefix of the other + extra) */
  if (lowerB.startsWith(lowerA + " ") || lowerB.startsWith(lowerA + ".")) tags.push("trailing-extra-words");
  if (lowerA.startsWith(lowerB + " ") || lowerA.startsWith(lowerB + ".")) tags.push("trailing-extra-words");
  if (lowerB.endsWith(" " + lowerA) || lowerB.endsWith("." + lowerA))   tags.push("leading-extra-words");
  if (lowerA.endsWith(" " + lowerB) || lowerA.endsWith("." + lowerB))   tags.push("leading-extra-words");

  /* Word-order swap (sort tokens compare) */
  const tokA = lowerA.split(/\s+/).sort().join(" ");
  const tokB = lowerB.split(/\s+/).sort().join(" ");
  if (tokA === tokB && lowerA !== lowerB) tags.push("word-order");

  /* Embedded store name / brand */
  const storeNames = ["payporte", "konga", "jumia", "amazon", "walmart", "ebay", "3chub", "slot"];
  for (const s of storeNames) {
    if (lowerA.includes(s) !== lowerB.includes(s)) tags.push(`brand-${s}-in-title`);
  }

  /* Embedded promo copy */
  const promo = ["buy now", "best price", "free shipping", "deal", "official store", "lowest price"];
  for (const p of promo) {
    if (lowerA.includes(p) !== lowerB.includes(p)) tags.push("promo-copy");
  }

  /* Punctuation differences */
  const stripP = (s: string) => s.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (stripP(lowerA) === stripP(lowerB) && lowerA !== lowerB) tags.push("punctuation");

  /* Embedded numeric/unit drift (e.g. "8GB" vs "8 GB") */
  if (lowerA.replace(/\s+/g, "") === lowerB.replace(/\s+/g, "")) tags.push("nospace");

  if (tags.length === 0) tags.push("other");
  return tags;
}

async function main() {
  process.stderr.write("Loading products + signatures…\n");
  const products = await pageAll<ProductRow>(async (off, lim) => {
    const { data, error } = await supa.from("products")
      .select("id, title, brand, category, signature, created_at")
      .range(off, off + lim - 1);
    if (error) throw error;
    return (data ?? []) as ProductRow[];
  });

  process.stderr.write(`Loaded ${products.length} products. Loading offers store ids…\n`);
  const offers = await pageAll<OfferRow>(async (off, lim) => {
    const { data, error } = await supa.from("offers")
      .select("product_id, store_id")
      .range(off, off + lim - 1);
    if (error) throw error;
    return (data ?? []) as OfferRow[];
  });

  /* For each product, find ALL its stores. */
  const storesByProduct = new Map<string, Set<string>>();
  for (const o of offers) {
    let s = storesByProduct.get(o.product_id);
    if (!s) { s = new Set(); storesByProduct.set(o.product_id, s); }
    s.add(o.store_id);
  }

  /* Group products by crude-key. Any group with >1 product is a
     candidate duplicate cluster the signature matcher missed. */
  process.stderr.write("Bucketing products by crude-key…\n");
  const byCrude = new Map<string, ProductRow[]>();
  for (const p of products) {
    const k = crudeKey(p.title);
    if (!k) continue;
    let arr = byCrude.get(k);
    if (!arr) { arr = []; byCrude.set(k, arr); }
    arr.push(p);
  }

  /* Find dup pairs: same crude-key, different signatures. */
  process.stderr.write("Finding duplicate pairs with mismatched signatures…\n");
  const dupPairs: Array<{ a: ProductRow; b: ProductRow; tags: string[]; sharedStore: boolean }> = [];
  for (const [, group] of byCrude) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.signature && b.signature && a.signature === b.signature) continue;
        const sa = storesByProduct.get(a.id) ?? new Set();
        const sb = storesByProduct.get(b.id) ?? new Set();
        let sharedStore = false;
        for (const s of sa) if (sb.has(s)) { sharedStore = true; break; }
        dupPairs.push({ a, b, tags: classifyDiff(a.title, b.title), sharedStore });
      }
    }
  }

  /* Tag histogram. */
  const tagHist = new Map<string, number>();
  for (const dp of dupPairs) {
    for (const t of dp.tags) tagHist.set(t, (tagHist.get(t) ?? 0) + 1);
  }
  const sharedCount = dupPairs.filter((d) => d.sharedStore).length;

  console.log("");
  console.log("Havlo · signature-leak diagnosis");
  console.log("─".repeat(60));
  console.log(`Total products:                     ${products.length.toLocaleString()}`);
  console.log(`Duplicate pairs (same crude-key,    ${dupPairs.length.toLocaleString()}`);
  console.log(`  different signatures):`);
  console.log(`Pairs that share a STORE            ${sharedCount.toLocaleString()}`);
  console.log(`  (≈ same store created dup):`);
  console.log("");
  console.log("Top difference patterns (one pair counts for each tag it matches):");
  const sortedTags = [...tagHist.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tag, n] of sortedTags) {
    console.log(`  ${tag.padEnd(28)} ${n.toLocaleString().padStart(7)}   (${((n / Math.max(1, dupPairs.length)) * 100).toFixed(1)}%)`);
  }
  console.log("");

  /* Print 10 concrete examples to show the user what the leak looks like. */
  console.log("10 random examples (you can verify any pair shouldn't be split):");
  const sample = [...dupPairs].sort(() => Math.random() - 0.5).slice(0, 10);
  for (const { a, b, tags, sharedStore } of sample) {
    console.log(`  · tags=[${tags.join(",")}] ${sharedStore ? "(SAME STORE)" : ""}`);
    console.log(`    A "${a.title.slice(0, 80)}"  sig="${a.signature?.slice(0, 40) ?? "(null)"}"`);
    console.log(`    B "${b.title.slice(0, 80)}"  sig="${b.signature?.slice(0, 40) ?? "(null)"}"`);
    console.log("");
  }

  /* CSV export — all pairs with tags. */
  const outDir = join(process.cwd(), "outputs");
  try { mkdirSync(outDir, { recursive: true }); } catch { /* exists */ }
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = join(outDir, `signature-leak-pairs-${stamp}.csv`);
  const lines: string[] = ["id_a,title_a,sig_a,id_b,title_b,sig_b,tags,shared_store"];
  for (const { a, b, tags, sharedStore } of dupPairs) {
    const esc = (s: string | null) => s ? `"${s.replace(/"/g, '""')}"` : "";
    lines.push([
      a.id, esc(a.title), esc(a.signature),
      b.id, esc(b.title), esc(b.signature),
      tags.join("|"),
      String(sharedStore),
    ].join(","));
  }
  writeFileSync(csvPath, lines.join("\n") + "\n", "utf8");
  console.log(`CSV exported: ${csvPath}`);
}

main().catch((e) => { console.error("diagnose failed:", e); process.exit(1); });
