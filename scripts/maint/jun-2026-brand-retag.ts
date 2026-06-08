/* ──────────────────────────────────────────────────────────────────
   Maintenance: re-tag products whose stored `brand` was OVER-extracted
   by the pre-Jun-2026 buildSignature.

   Context: buildSignature.findBrand used to (a) attribute the brand
   referenced in a "fits-for" accessory phrase to the accessory itself
   ("Battery for Nokia 215" → nokia, "Controller for Xbox" → xbox,
   "Screen Protector for Samsung Monitor" → samsung) and (b) match
   common English words that double as brand tokens ("Surface mount
   diode" → microsoft, "Instant coffee" → instant, "Diseqc Switch" →
   switch, "Honor guard" → honor). Both leaked wrong brands into the
   `products.brand` column, which then polluted the brand hubs (e.g.
   non-Microsoft items under /brand/microsoft) and the comparison
   brand-gate.

   The Jun-2026 fix adds a compatibility-governed-region guard plus a
   context-required map (see src/lib/search/normalize.ts). This script
   reconciles already-ingested rows with that fix.

   SCOPE — intentionally tight. Only rows where the stored brand is
   NON-NULL and the current buildSignature yields a DIFFERENT brand
   (either null = mis-tag removed, or a corrected brand) are updated.
   Rows the new logic would NEWLY tag (old brand NULL → some brand;
   ~947, caused by the BRANDS list growing since those rows were first
   ingested, NOT by the over-extraction bug) are deliberately LEFT
   ALONE here — that under-tagging is a separate clean-up with a wider
   blast radius and deserves its own pass.

   For each corrected row we rewrite brand + model + signature together
   (all three come from the same buildSignature call) so the row stays
   internally consistent. Updating `signature` only corrects the stored
   fingerprint; it does NOT merge product rows (physical de-duplication
   happens in the ingest dedup pass), so this is safe to run anytime.

   Usage:
     npx tsx scripts/maint/jun-2026-brand-retag.ts            # dry run
     npx tsx scripts/maint/jun-2026-brand-retag.ts --apply    # writes

   After --apply, refresh the read model so the hubs pick up the new
   brands:
     REFRESH MATERIALIZED VIEW CONCURRENTLY product_best_offers;

   Idempotent: a second run finds nothing to change.
   ────────────────────────────────────────────────────────────────── */

process.loadEnvFile?.(".env.local");
import { getSupabaseAdmin } from "../../src/lib/providers/db-client";
import { buildSignature } from "../../src/lib/search/normalize";

interface Row {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  signature: string | null;
}
interface Fix {
  id: string;
  title: string;
  oldBrand: string | null;
  newBrand: string | null;
  newModel: string | null;
  newSignature: string | null;
}

const APPLY = process.argv.includes("--apply");
const PAGE = 1000;
const WRITE_CHUNK = 25;

async function chunk<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

(async () => {
  const db = getSupabaseAdmin();

  const fixes: Fix[] = [];
  let scanned = 0, gained = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("products")
      .select("id,title,brand,model,signature")
      .range(from, from + PAGE - 1);
    if (error) { console.error("read error:", error.message); process.exit(1); }
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (const r of rows) {
      scanned++;
      const sig = buildSignature(r.title || "");
      const oldB = r.brand;
      const newB = sig.brand;
      if (!oldB && newB) { gained++; continue; }          // under-tag — out of scope
      if (oldB && newB !== oldB) {                          // over-tag correction
        fixes.push({
          id: r.id, title: r.title, oldBrand: oldB,
          newBrand: newB, newModel: sig.model,
          newSignature: sig.key && sig.key.length > 0 ? sig.key : null,
        });
      }
    }
    if (rows.length < PAGE) break;
  }

  const nulled = fixes.filter((f) => f.newBrand === null).length;
  const changed = fixes.length - nulled;

  console.log(`Scanned ${scanned} products.`);
  console.log(`In scope (over-tag corrections): ${fixes.length}  (→null: ${nulled}, →different: ${changed})`);
  console.log(`Out of scope (under-tagged, left alone): ${gained}`);
  console.log("");
  const byOld: Record<string, number> = {};
  for (const f of fixes) byOld[f.oldBrand ?? "?"] = (byOld[f.oldBrand ?? "?"] ?? 0) + 1;
  console.log("-- corrections by old (wrong) brand --");
  for (const [k, n] of Object.entries(byOld).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log("\n-- sample corrections --");
  for (const f of fixes.slice(0, 25))
    console.log(`  [${f.oldBrand} → ${f.newBrand ?? "null"}]  ${(f.title || "").slice(0, 70)}`);

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes. Re-run with --apply to update ${fixes.length} rows.`);
    process.exit(0);
  }

  console.log(`\nApplying ${fixes.length} updates...`);
  let done = 0, failed = 0;
  await chunk(fixes, WRITE_CHUNK, async (f) => {
    const { error } = await db
      .from("products")
      .update({ brand: f.newBrand, model: f.newModel, signature: f.newSignature })
      .eq("id", f.id);
    if (error) { failed++; if (failed <= 10) console.error(`  fail ${f.id}: ${error.message}`); }
    else done++;
  });
  console.log(`Done. updated=${done} failed=${failed}`);
  console.log("Now refresh the read model:");
  console.log("  REFRESH MATERIALIZED VIEW CONCURRENTLY product_best_offers;");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
