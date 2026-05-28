#!/usr/bin/env tsx
/* Deliberate bulk-delete test: take the next 100 orphans from the
   CSV (skipping the 5 already deleted), bulk-delete them with the
   same .in() pattern ingestion.ts uses, and check before/after
   counts. If counts match expected, ingest's bulk delete is fine and
   something else is creating new orphans. If they don't, the bulk
   .in() is silently no-op for these IDs. */
try { /* @ts-expect-error */ process.loadEnvFile?.(".env.local"); } catch {}
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

async function main() {
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const csv = readFileSync("outputs/orphan-products-2026-05-28.csv", "utf-8");
  const lines = csv.split("\n").slice(1).filter(Boolean);
  const allIds = lines.map((l) => l.split(",")[0]);

  /* Skip the 5 we already deleted, take next 100. */
  const candidates = allIds.slice(5, 105);

  /* Count exists-pre. */
  const { count: existsPre } = await supa.from("products").select("*", { count: "exact", head: true }).in("id", candidates);
  console.log(`Of 100 candidate orphan IDs from CSV: ${existsPre} actually exist in DB right now.`);

  /* Bulk delete the same way ingestion does. */
  const { error, data } = await supa.from("products").delete().in("id", candidates).select("id");
  if (error) {
    console.log(`Bulk delete ERROR: ${error.message}`);
  } else {
    console.log(`Bulk delete returned ${data?.length ?? 0} rows.`);
  }

  /* Count exists-post. */
  const { count: existsPost } = await supa.from("products").select("*", { count: "exact", head: true }).in("id", candidates);
  console.log(`After bulk delete, ${existsPost} of those 100 still exist.`);

  /* Total catalog count for sanity. */
  const { count: total } = await supa.from("products").select("*", { count: "exact", head: true });
  console.log(`Total products in catalog now: ${total}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
