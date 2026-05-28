#!/usr/bin/env tsx
/* v2 of the signature-leak diagnostic. v1 used a too-aggressive
   crude-key bucketer and found 0 pairs (everything's unique once
   you strip all non-alphanumeric). v2 takes a different angle:

     1. Pull all products created in the last 48 hours (the active
        ingest window where new orphans would form before the DB
        trigger reaped them).
     2. Within each cluster of products that share a SIGNATURE,
        check if their titles obviously look like the same product
        with author drift (casing, punctuation, etc.).
     3. Separately, find products with the SAME brand+model+inches
        primary key (re-computed from the title) but DIFFERENT
        signature column values — those are the live drift cases.
     4. Sample recently created PayPorte/3CHub products and show
        their title → signature mapping so we can see what the
        signature builder is producing on those titles.

   Read-only. Outputs to console. */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* noop */ }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface ProductRow {
  id:         string;
  title:      string;
  brand:      string | null;
  category:   string | null;
  signature:  string | null;
  created_at: string;
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

async function main() {
  process.stderr.write("Loading all products + signatures…\n");
  const products = await pageAll<ProductRow>(async (off, lim) => {
    const { data, error } = await supa.from("products")
      .select("id, title, brand, category, signature, created_at")
      .range(off, off + lim - 1);
    if (error) throw error;
    return (data ?? []) as ProductRow[];
  });

  /* ── 1) Signature population summary ──────────────────────────── */
  const withSig = products.filter((p) => p.signature && p.signature !== "?|?").length;
  const nullSig = products.filter((p) => !p.signature).length;
  const trivialSig = products.filter((p) => p.signature === "?|?" || p.signature === "?").length;

  console.log("");
  console.log("Havlo · signature builder live audit");
  console.log("─".repeat(60));
  console.log(`Total products:                ${products.length.toLocaleString()}`);
  console.log(`Products with rich signature:  ${withSig.toLocaleString()}   (${((withSig / products.length) * 100).toFixed(1)}%)`);
  console.log(`Products with "?|?" signature: ${trivialSig.toLocaleString()}   (${((trivialSig / products.length) * 100).toFixed(1)}%)  ← matcher gave up`);
  console.log(`Products with NULL signature:  ${nullSig.toLocaleString()}   (${((nullSig / products.length) * 100).toFixed(1)}%)`);
  console.log("");

  /* ── 2) Signatures shared by many products ──────────────────────
     A signature shared by N products means the matcher considers
     them the same product. Histogram by signature value. */
  const bySig = new Map<string, ProductRow[]>();
  for (const p of products) {
    const k = p.signature ?? "(null)";
    let arr = bySig.get(k);
    if (!arr) { arr = []; bySig.set(k, arr); }
    arr.push(p);
  }
  const sigClusterSizes = [...bySig.values()].map((arr) => arr.length).sort((a, b) => b - a);
  console.log("Signature cluster size distribution:");
  console.log(`  Signatures with 1 product:    ${sigClusterSizes.filter((s) => s === 1).length.toLocaleString()}`);
  console.log(`  Signatures with 2-5 products: ${sigClusterSizes.filter((s) => s >= 2 && s <= 5).length.toLocaleString()}`);
  console.log(`  Signatures with 6-20:         ${sigClusterSizes.filter((s) => s >= 6 && s <= 20).length.toLocaleString()}`);
  console.log(`  Signatures with 21+:          ${sigClusterSizes.filter((s) => s >= 21).length.toLocaleString()}`);
  console.log("");

  /* ── 3) THE LEAK: products with the SAME signature should be one
     row, not many. Drill into the largest clusters. */
  const oversizedClusters = [...bySig.entries()]
    .filter(([sig]) => sig !== "(null)" && sig !== "?|?")
    .filter(([, arr]) => arr.length >= 5)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  console.log("Top 10 oversize signature clusters (these are the live duplicates):");
  for (const [sig, arr] of oversizedClusters) {
    console.log(`  sig="${sig}"  ${arr.length} products`);
    /* Show 5 of them. */
    for (const p of arr.slice(0, 5)) {
      const created = p.created_at.slice(0, 10);
      console.log(`    [${created}] "${p.title.slice(0, 80)}"`);
    }
    console.log("");
  }

  /* ── 4) Trivial-signature ("?|?") products: matcher couldn't
     extract a brand or model at all. Show samples by category. */
  console.log("Sample 'matcher gave up' products (signature='?|?'):");
  const trivials = products.filter((p) => p.signature === "?|?");
  const byCategory = new Map<string, ProductRow[]>();
  for (const p of trivials) {
    const k = p.category ?? "(none)";
    let arr = byCategory.get(k);
    if (!arr) { arr = []; byCategory.set(k, arr); }
    arr.push(p);
  }
  for (const [cat, arr] of [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5)) {
    console.log(`  ${cat}: ${arr.length} products`);
    for (const p of arr.slice(0, 5)) {
      console.log(`    "${p.title.slice(0, 90)}"  → sig: "${p.signature}"`);
    }
    console.log("");
  }

  /* ── 5) Recently created products (last 48h) — what's been
     surviving the orphan reaper post-fix. */
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = products.filter((p) => new Date(p.created_at).getTime() > cutoff);
  console.log(`Products created in last 48h: ${recent.length.toLocaleString()}`);
  if (recent.length > 0) {
    console.log("  Sample recent titles + signatures:");
    for (const p of recent.slice(0, 12)) {
      console.log(`    "${p.title.slice(0, 70).padEnd(70)}"  →  ${p.signature ?? "(null)"}`);
    }
  }
  console.log("");
}

main().catch((e) => { console.error("diagnose failed:", e); process.exit(1); });
