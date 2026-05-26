/* Backfill products.brand and products.model from the current
   buildSignature() parser. Closes the gap between the DB columns
   (stale — only as good as the parser at ingest time) and what the
   live comparison gates need to operate (sibling detection +
   variant pooling read brand directly).

   Strategy:
     For every product, run buildSignature(title). If the parser
     extracts a brand or model the DB row doesn't have, UPDATE
     that column. Don't overwrite existing values (those came from
     a specific ingest path that may have known better than the
     generic parser does today).

   Idempotent: a row whose DB brand/model already match the parser
   output is skipped.

   Pass --apply to write. Default is dry-run.
*/

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature } from "../src/lib/search/normalize";

const APPLY = process.argv.includes("--apply");

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  const PAGE = 1000;
  type R = { id: string; title: string; brand: string | null; model: string | null };
  const all: R[] = [];
  let from = 0;
  while (true) {
    const { data } = await supa.from("products").select("id, title, brand, model").range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as R[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`${APPLY ? "▶ APPLY" : "● DRY RUN"} — scanning ${all.length} products`);

  const updates: Array<{ id: string; brand?: string; model?: string }> = [];
  let brandOnly = 0, modelOnly = 0, both = 0;
  for (const r of all) {
    const sig = buildSignature(r.title);
    const wantBrand = sig.brand && !r.brand;
    const wantModel = sig.model && !r.model;
    if (!wantBrand && !wantModel) continue;
    const u: { id: string; brand?: string; model?: string } = { id: r.id };
    if (wantBrand) u.brand = sig.brand!;
    if (wantModel) u.model = sig.model!;
    updates.push(u);
    if (wantBrand && wantModel) both++;
    else if (wantBrand) brandOnly++;
    else modelOnly++;
  }
  console.log(`  rows needing update: ${updates.length}`);
  console.log(`    brand+model: ${both}`);
  console.log(`    brand only:  ${brandOnly}`);
  console.log(`    model only:  ${modelOnly}`);

  if (!APPLY) {
    /* Show 10 samples */
    console.log("\nsamples (first 10):");
    for (const u of updates.slice(0, 10)) {
      console.log(`  ${u.id.slice(0,8)} brand=${u.brand ?? "—"} model=${u.model ?? "—"}`);
    }
    console.log("\n● dry run — pass --apply to write");
    return;
  }

  /* Apply updates one-by-one because each row's update fields differ.
     Parallelise in chunks to keep wall time reasonable. */
  let done = 0;
  const BATCH = 25;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    await Promise.all(slice.map(async (u) => {
      const patch: Record<string, string> = {};
      if (u.brand) patch.brand = u.brand;
      if (u.model) patch.model = u.model;
      const { error } = await supa.from("products").update(patch).eq("id", u.id);
      if (!error) done++;
      else if (i === 0) console.warn(`  ! ${u.id}: ${error.message}`);
    }));
  }
  console.log(`\n✓ updated ${done} products`);
}

main().catch((e) => { console.error(e); process.exit(1); });
