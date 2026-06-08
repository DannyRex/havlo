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

   SCOPE. By default, only rows where the stored brand is NON-NULL and
   the current buildSignature yields a DIFFERENT brand (null = mis-tag
   removed, or a corrected brand) are updated: the over-extraction
   clean-up. Pass --include-untagged to ALSO fill rows the new logic
   would NEWLY tag (old brand NULL -> some brand; ~947, caused by the
   BRANDS list growing since those rows were first ingested, NOT by the
   over-extraction bug). The under-tag fill has a wider blast radius, so
   it stays opt-in.

   For each corrected row we rewrite brand + model + signature together
   (all three come from the same buildSignature call) so the row stays
   internally consistent. Updating `signature` only corrects the stored
   fingerprint; it does NOT merge product rows (physical de-duplication
   happens in the ingest dedup pass), so this is safe to run anytime.

   Usage:
     npx tsx .../jun-2026-brand-retag.ts                              # dry run, over-tag only
     npx tsx .../jun-2026-brand-retag.ts --include-untagged           # dry run, both passes
     npx tsx .../jun-2026-brand-retag.ts --apply                      # write over-tag fixes
     npx tsx .../jun-2026-brand-retag.ts --apply --include-untagged   # write both passes

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
  kind: "over" | "under";
}

const APPLY = process.argv.includes("--apply");
/* --include-untagged also fills rows that currently have NO brand but
   should (the BRANDS list grew after they were first ingested, e.g. a
   Stanley tumbler stored as brand=null). Larger blast radius than the
   over-tag corrections, so it's opt-in. */
const INCLUDE_UNTAGGED = process.argv.includes("--include-untagged");
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
      const newSignature = sig.key && sig.key.length > 0 ? sig.key : null;
      if (!oldB && newB) {
        /* under-tag: a row that should carry a brand but doesn't.
           Only fixed with --include-untagged. */
        gained++;
        if (!INCLUDE_UNTAGGED) continue;
        fixes.push({ id: r.id, title: r.title, oldBrand: null, newBrand: newB, newModel: sig.model, newSignature, kind: "under" });
      } else if (oldB && newB !== oldB) {
        /* over-tag correction (accessory / false-word / mis-canonicalised) */
        fixes.push({ id: r.id, title: r.title, oldBrand: oldB, newBrand: newB, newModel: sig.model, newSignature, kind: "over" });
      }
    }
    if (rows.length < PAGE) break;
  }

  const over  = fixes.filter((f) => f.kind === "over");
  const under = fixes.filter((f) => f.kind === "under");
  const nulled  = over.filter((f) => f.newBrand === null).length;
  const changed = over.length - nulled;

  console.log(`Scanned ${scanned} products.`);
  console.log(`Over-tag corrections: ${over.length}  (→null: ${nulled}, →different: ${changed})`);
  if (INCLUDE_UNTAGGED) console.log(`Under-tag fills:      ${under.length}  (null → brand)`);
  else console.log(`Under-tagged (untouched; pass --include-untagged to fill): ${gained}`);
  console.log(`Total to apply: ${fixes.length}`);
  console.log("");

  const byOld: Record<string, number> = {};
  for (const f of over) byOld[f.oldBrand ?? "?"] = (byOld[f.oldBrand ?? "?"] ?? 0) + 1;
  console.log("-- over-tag corrections by old (wrong) brand --");
  for (const [k, n] of Object.entries(byOld).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log("\n-- sample over-tag corrections --");
  for (const f of over.slice(0, 20))
    console.log(`  [${f.oldBrand} → ${f.newBrand ?? "null"}]  ${(f.title || "").slice(0, 70)}`);

  if (INCLUDE_UNTAGGED) {
    const byNew: Record<string, number> = {};
    for (const f of under) byNew[f.newBrand ?? "?"] = (byNew[f.newBrand ?? "?"] ?? 0) + 1;
    console.log("\n-- under-tag fills by NEW brand (top 20) --");
    for (const [k, n] of Object.entries(byNew).sort((a, b) => b[1] - a[1]).slice(0, 20))
      console.log(`  ${String(n).padStart(4)}  ${k}`);
    console.log("\n-- sample under-tag fills --");
    for (const f of under.slice(0, 20))
      console.log(`  [null → ${f.newBrand}]  ${(f.title || "").slice(0, 70)}`);
  }

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
