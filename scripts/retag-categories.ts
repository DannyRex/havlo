#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   One-shot category retag — fixes existing DB rows where the source
   ingest tag disagrees with what the title actually describes.

   Why this exists: ingest-providers.ts unconditionally tags every
   result from a 'phones' query as category=phones. SerpAPI's match
   for the bare query 'Phones' returns occasional false positives —
   Bluetooth speakers, AI sunglasses, satellite cable splitters —
   which were landing in the Phones filter on /deals. The QA agent
   flagged this as a top-of-funnel trust killer.

   The auto-correct in ingestion.ts dealToProductRow() handles
   future ingests. This script handles the existing ~1,200 rows.

   Run:    npm run retag
   Effect: scans products table, runs each title through
           inferCategoryFromTitle, and updates rows where the
           inferred category differs from the stored one.
   Idempotent: re-running produces 0 changes once the DB is clean.

   By default runs in DRY-RUN mode and just reports planned changes.
   Pass --apply to actually write the updates.
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { categoryDisagreesWithTitle } from "../src/lib/categorize";
import { categories } from "../src/lib/data/categories";

interface ProductRow {
  id:            string;
  title:         string;
  category:      string | null;
  category_slug: string | null;
}

const SLUG_TO_NAME = new Map(categories.map((c) => [c.slug, c.name]));

async function main() {
  const apply = process.argv.includes("--apply");
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase admin client unavailable. Check .env.local");
    process.exit(1);
  }

  console.log(`▶ Retagging product categories (${apply ? "APPLY" : "DRY-RUN"})\n`);

  /* Page through products in chunks. supabase-js default limit is
     1000 rows per query; explicit range() lets us iterate. */
  const PAGE = 500;
  let from = 0;
  let total = 0;
  let proposedChanges = 0;
  const buckets = new Map<string, number>(); // "fromSlug → toSlug" → count
  const samples = new Map<string, string[]>();

  while (true) {
    const { data, error } = await supa
      .from("products")
      .select("id, title, category, category_slug")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(`✗ Page query failed at offset ${from}:`, error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    total += data.length;

    for (const row of data as ProductRow[]) {
      if (!row.title || !row.category_slug) continue;
      const { disagrees, inferred } = categoryDisagreesWithTitle(row.category_slug, row.title);
      if (!disagrees || !inferred) continue;

      proposedChanges++;
      const key = `${row.category_slug} → ${inferred}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      const existing = samples.get(key) ?? [];
      if (existing.length < 3) {
        existing.push(row.title);
        samples.set(key, existing);
      }

      if (apply) {
        const newName = SLUG_TO_NAME.get(inferred) ?? row.category;
        const { error: updErr } = await supa
          .from("products")
          .update({ category_slug: inferred, category: newName })
          .eq("id", row.id);
        if (updErr) {
          console.error(`  ✗ Update failed for ${row.id}: ${updErr.message}`);
        }
      }
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Scanned: ${total} products`);
  console.log(`Proposed changes: ${proposedChanges}\n`);

  if (proposedChanges === 0) {
    console.log("✓ No changes needed. Catalog is already clean.");
    return;
  }

  console.log("By transition:");
  const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedBuckets) {
    console.log(`  ${count.toString().padStart(4)} × ${key}`);
    const ex = samples.get(key) ?? [];
    for (const t of ex) console.log(`        e.g. "${t.slice(0, 80)}"`);
  }

  if (!apply) {
    console.log(`\n→ Re-run with --apply to write these changes.`);
  } else {
    console.log(`\n✓ Applied ${proposedChanges} updates.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
