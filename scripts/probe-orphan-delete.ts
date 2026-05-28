#!/usr/bin/env tsx
/* Probe — why doesn't deleting orphans stick? Pick 5 IDs from the
   orphans CSV, attempt a delete on each one individually, and report
   the error / row-affected status. Will surface:
     - FK constraint blocks from non-cascading tables
     - Trigger-side roll-backs
     - Permission issues
     - Silent no-op deletes (rows already gone) */
try { /* @ts-expect-error */ process.loadEnvFile?.(".env.local"); } catch {}
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

async function main() {
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const csv = readFileSync("outputs/orphan-products-2026-05-28.csv", "utf-8");
  const lines = csv.split("\n").slice(1).filter(Boolean).slice(0, 5);
  const ids = lines.map((l) => l.split(",")[0]);

  console.log(`Testing delete on ${ids.length} orphan IDs:\n`);
  for (const id of ids) {
    /* Pre-check: does the product actually exist? */
    const { data: pre, error: preErr } = await supa
      .from("products")
      .select("id, title, signature")
      .eq("id", id)
      .maybeSingle();
    if (preErr) { console.log(`  [${id}] pre-check error: ${preErr.message}`); continue; }
    if (!pre) { console.log(`  [${id}] doesn't exist (already deleted)`); continue; }
    console.log(`  [${id}] exists — title: "${pre.title?.slice(0, 50)}"`);

    /* Sibling-check: does it have any offers? */
    const { count: offerCount } = await supa
      .from("offers")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id);
    console.log(`    has ${offerCount ?? 0} offers`);

    /* Delete attempt. */
    const { error: delErr, data: delData } = await supa
      .from("products")
      .delete()
      .eq("id", id)
      .select("id");
    if (delErr) {
      console.log(`    DELETE error: ${delErr.message}`);
    } else {
      console.log(`    DELETE succeeded — rows returned: ${delData?.length ?? 0}`);
    }

    /* Post-check: is it gone? */
    const { data: post } = await supa
      .from("products")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    console.log(`    post-check: ${post ? "STILL EXISTS (delete blocked?)" : "gone"}`);
    console.log("");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
