#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Appliances re-split (#25) — OPTIONAL verifier / completer for the
   0068 migration.

   Migration 0068 does the bulk re-tag in SQL, scoped to the
   electronics/home buckets the 0065 merge had filled. This script is
   the belt-and-braces follow-up: it re-checks EVERY product through
   categorize.ts itself (the ingest SSOT) rather than a hand-translated
   SQL regex, so it:
     · verifies 0068 matched what categorize would do (no JS/SQL drift), and
     · catches cross-category strays 0068 deliberately skips — e.g. a
       robot vacuum a brand rule had parked under "phones" — because it
       respects categorize's full rule priority, not just a keyword match.

   Safe to run before OR after 0068 (idempotent — only ever moves a row
   TO appliances, and skips rows already there). Dry-run by default.
   Needs the Supabase WRITE key, so run from CI / locally, not against
   the read-only app key.

   Usage:
     npx tsx scripts/recategorise-appliances.ts            # dry-run (report only)
     npx tsx scripts/recategorise-appliances.ts --apply    # write changes
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* env may already be present (CI secrets) */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { categoryDisagreesWithTitle } from "../src/lib/categorize";

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("No Supabase admin client (missing env)."); process.exit(1); }

  // Pull every product's id + title + current category.
  const products: Array<{ id: string; title: string; category_slug: string | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products").select("id, title, category_slug").range(from, from + 999);
    if (error) { console.error("fetch error:", error.message); process.exit(1); }
    const d = data ?? [];
    products.push(...(d as any[]));
    if (d.length < 1000) break;
  }
  console.log(`Scanned ${products.length} products.`);

  // Find rows whose title categorises to "appliances" but aren't tagged so.
  const toFix: string[] = [];
  const sample: string[] = [];
  for (const p of products) {
    if (p.category_slug === "appliances") continue;
    const { disagrees, inferred } = categoryDisagreesWithTitle(p.category_slug, p.title ?? "");
    if (disagrees && inferred === "appliances") {
      toFix.push(p.id);
      if (sample.length < 12) sample.push(`[${p.category_slug}] ${String(p.title).slice(0, 56)}`);
    }
  }
  console.log(`Would re-tag → appliances: ${toFix.length}`);
  sample.forEach((s) => console.log("   " + s));

  if (!APPLY) { console.log("\nDry-run. Re-run with --apply to write."); return; }
  if (toFix.length === 0) { console.log("Nothing to update."); return; }

  let updated = 0;
  for (let i = 0; i < toFix.length; i += 200) {
    const chunk = toFix.slice(i, i + 200);
    const { error } = await supa.from("products").update({ category_slug: "appliances" }).in("id", chunk);
    if (error) { console.error(`update chunk ${i}:`, error.message); continue; }
    updated += chunk.length;
  }
  console.log(`Updated ${updated} products to category_slug = 'appliances'.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL", (e as Error).message); process.exit(1); });
