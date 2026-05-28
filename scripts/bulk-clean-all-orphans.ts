#!/usr/bin/env tsx
/* One-shot cleanup of ALL orphan products via REST. Loads every
   product, finds those with no offers, bulk-deletes in 200-id chunks.
   After this runs the catalog should be ~14,700 (per the diagnose
   readings). Re-run the orphan diagnostic immediately after — if it
   reports near-zero, the trigger is doing its job going forward and
   only pre-existing orphans needed manual cleanup. If new orphans
   keep appearing across consecutive runs, there's a creation path
   the trigger doesn't catch. */
try { /* @ts-expect-error */ process.loadEnvFile?.(".env.local"); } catch {}
import { createClient } from "@supabase/supabase-js";

async function pageAll<T>(fetcher: (off: number, lim: number) => Promise<T[]>, pageSize = 1000): Promise<T[]> {
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
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  console.log("Loading products + offers…");
  const products = await pageAll<{ id: string }>(async (off, lim) => {
    const { data } = await supa.from("products").select("id").range(off, off + lim - 1);
    return (data ?? []) as Array<{ id: string }>;
  });
  const offers = await pageAll<{ product_id: string }>(async (off, lim) => {
    const { data } = await supa.from("offers").select("product_id").range(off, off + lim - 1);
    return (data ?? []) as Array<{ product_id: string }>;
  });
  const withOffer = new Set(offers.map((o) => o.product_id));
  const orphanIds = products.map((p) => p.id).filter((id) => !withOffer.has(id));
  console.log(`Products: ${products.length}`);
  console.log(`Offers:   ${offers.length}`);
  console.log(`Orphans:  ${orphanIds.length}`);

  if (orphanIds.length === 0) {
    console.log("Nothing to clean. ✓");
    return;
  }

  const CHUNK = 200;
  let deleted = 0;
  for (let i = 0; i < orphanIds.length; i += CHUNK) {
    const chunk = orphanIds.slice(i, i + CHUNK);
    const { data, error } = await supa.from("products").delete().in("id", chunk).select("id");
    if (error) {
      console.log(`  chunk ${i / CHUNK + 1}: ERROR ${error.message}`);
      continue;
    }
    deleted += data?.length ?? 0;
    process.stderr.write(`  …deleted ${deleted} / ${orphanIds.length}\r`);
  }
  console.log(`\nDeleted ${deleted} of ${orphanIds.length}.`);

  /* Final verification. */
  const { count } = await supa.from("products").select("*", { count: "exact", head: true });
  console.log(`Catalog now: ${count} products`);
}
main().catch((e) => { console.error(e); process.exit(1); });
