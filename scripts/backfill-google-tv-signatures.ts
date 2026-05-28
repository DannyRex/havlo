#!/usr/bin/env tsx
/* Re-compute and persist signatures for products that currently
   carry a "google|?|*in" key. The May 28 2026 brand-context guard
   in buildSignature() routes these to the actual hardware brand
   (tcl, skyworth, nexus, vitron, bruhm) when present in the title.
   Existing rows weren't re-signaturized by the ingest pipeline
   because title_key already matched them — only new inserts pick
   up new signatures by default. This is a targeted backfill.

   Read pattern + report + write. Idempotent — running again does
   nothing once signatures match. */
try { /* @ts-expect-error */ process.loadEnvFile?.(".env.local"); } catch {}
import { createClient } from "@supabase/supabase-js";
import { buildSignature } from "../src/lib/search/normalize";

async function main() {
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  /* Pull every row with a google|?* signature OR any signature that
     looks like a "give-up" anchor still surfacing brand|? — the
     d730342 fix wrote NULL for those, but anything already in the
     google|?|nnin form from before the Fashion extractor lands here. */
  const { data, error } = await supa
    .from("products")
    .select("id, title, signature")
    .or("signature.like.google|?%,signature.like.%|?,signature.like.%|?|%");
  if (error) { console.error(error); process.exit(1); }
  const rows = (data ?? []) as Array<{ id: string; title: string; signature: string | null }>;
  console.log(`Found ${rows.length} candidate rows.`);

  let updated = 0, unchanged = 0, nulled = 0;
  for (const r of rows) {
    const next = buildSignature(r.title);
    const newSig = next.key && next.key.length > 0 ? next.key : null;
    if (newSig === r.signature) { unchanged++; continue; }
    const { error: updErr } = await supa
      .from("products")
      .update({ signature: newSig, brand: next.brand, model: next.model })
      .eq("id", r.id);
    if (updErr) { console.log(`  update ${r.id}: ${updErr.message}`); continue; }
    if (newSig === null) nulled++; else updated++;
    if ((updated + nulled) % 50 === 0) process.stderr.write(`  …${updated + nulled} updated\r`);
  }
  console.log(`\nDone. Updated: ${updated}  Nulled: ${nulled}  Unchanged: ${unchanged}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
