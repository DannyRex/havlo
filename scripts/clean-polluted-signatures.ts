#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Clean polluted product signatures.

   buildSignature historically mis-parsed unit / spec / capacity / CPU /
   energy-rating / dimension / "series N" strings into the MODEL slot,
   minting junk canonicals that then pooled unrelated products:

     apple|wine 75cl   ← every wine bottle
     apple|75cl        ← every spirit
     beats|i7 1355u    ← a laptop CPU
     lg|side by side   ← a fridge type
     lg|27 cu          ← a fridge capacity
     lg|2 star         ← an energy rating
     mango|rum 70cl    ← a rum
     kitchenaid|36 24  ← fridge dimensions
     samsung|series 6  ← a generic Bosch/Samsung line
     abercrombie|3 pack← a quantity

   buildSignature now rejects these (isUnitOrSpecModel in normalize.ts),
   so NEW ingests are clean. This one-shot nulls the EXISTING polluted
   rows so they stop wrong-merging and stop being de-fragmentation
   targets. Nulling a signature is the honest opt-out — those products
   still dedup across stores via the exact title_key path; they simply
   no longer claim a heuristic cluster.

   No offer move, no row delete — only products.signature -> NULL.
   Reversible (re-run resignature later if a real model parser is added).

   Run:
     npm run clean-signatures              # dry-run, report only
     npm run clean-signatures -- --apply   # commit (null the polluted rows)
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { isUnitOrSpecModel } from "../src/lib/search/normalize";

const APPLY = process.argv.includes("--apply");

interface Row { id: string; title: string; signature: string | null; }

async function fetchAllProducts(): Promise<Row[]> {
  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("no supabase admin (check .env.local)");
  const out: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from("products").select("id,title,signature")
      .not("signature", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return out;
}

async function main() {
  console.log(`▶ Clean polluted signatures${APPLY ? "" : " (DRY RUN — pass --apply to commit)"}`);
  const rows = await fetchAllProducts();
  console.log(`  ${rows.length} products carry a signature`);

  const polluted = rows.filter((r) => {
    const sig = r.signature!;
    const model = sig.split("|")[1];          // brand|model[|inches]
    return isUnitOrSpecModel(model);
  });

  // Group by signature so the report shows WHICH junk canonicals get cleared.
  const bySig = new Map<string, Row[]>();
  for (const r of polluted) { const a = bySig.get(r.signature!) ?? []; a.push(r); bySig.set(r.signature!, a); }
  const ranked = Array.from(bySig.entries()).sort((a, b) => b[1].length - a[1].length);

  console.log(`\n── ${polluted.length} products under ${ranked.length} polluted signatures ──`);
  for (const [sig, rs] of ranked.slice(0, 30)) {
    console.log(`  ${rs.length.toString().padStart(3)}  ${sig}`);
    console.log(`        e.g. "${rs[0].title.slice(0, 70)}"`);
  }
  if (ranked.length > 30) console.log(`  …and ${ranked.length - 30} more signatures`);

  if (!APPLY) {
    console.log(`\nDry-run complete. Re-run with --apply to null ${polluted.length} signatures.`);
    return;
  }

  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("no supabase admin");
  let done = 0;
  for (const r of polluted) {
    const { error } = await supa.from("products").update({ signature: null }).eq("id", r.id);
    if (error) { console.error(`  ✗ ${r.id}: ${error.message}`); continue; }
    done++;
    if (done % 200 === 0) console.log(`  …${done}/${polluted.length}`);
  }
  console.log(`\n✓ Nulled ${done} polluted signatures. Refresh product_best_offers + caches.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
