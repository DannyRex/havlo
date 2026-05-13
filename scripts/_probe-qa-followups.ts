/* Targeted probes for the QA follow-up items:
   - Supermart visibility (NG roster + in-stock count + view rows)
   - Bluetooth speakers tagged Computing (find culprits)
   - DHgate scraped_at recency vs pharmacies (newest-sort dominance) */
try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { inferStoreCountry } from "../src/lib/country";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  /* 1. Supermart sanity ── */
  console.log("\n=== Supermart sanity check ===");
  const { count: smOffers } = await supa
    .from("offers")
    .select("*", { count: "exact", head: true })
    .eq("store_id", "supermart")
    .eq("in_stock", true);
  const { count: smViewRows } = await supa
    .from("product_best_offers")
    .select("*", { count: "exact", head: true })
    .eq("store_id", "supermart");
  const { data: smStore } = await supa
    .from("stores")
    .select("id, name, country, is_international")
    .eq("id", "supermart")
    .maybeSingle();
  const inferredCountry = smStore
    ? inferStoreCountry((smStore as { id: string; name: string }).id, (smStore as { id: string; name: string }).name)
    : null;
  console.log(`  offers (in_stock=true):     ${smOffers}`);
  console.log(`  product_best_offers rows:   ${smViewRows}`);
  console.log(`  store row:                  ${JSON.stringify(smStore)}`);
  console.log(`  inferStoreCountry:          ${inferredCountry ?? "(null → falls through to currency)"}`);

  /* 2. Bluetooth speakers in Computing ── */
  console.log("\n=== Bluetooth speakers tagged Computing ===");
  const { data: btCompute } = await supa
    .from("product_best_offers")
    .select("title, store_id")
    .eq("category_slug", "computing")
    .or("title.ilike.%bluetooth speaker%,title.ilike.%bt speaker%,title.ilike.%wireless speaker%,title.ilike.%portable speaker%")
    .limit(20);
  for (const r of (btCompute as { title: string; store_id: string }[] | null) ?? []) {
    console.log(`  [${r.store_id.padEnd(14)}]  ${r.title.slice(0, 100)}`);
  }
  /* Bare 'speaker' in computing — likely the audio rule missed it. */
  console.log("\n=== Any 'speaker' titles in Computing (broader) ===");
  const { data: spkCompute } = await supa
    .from("product_best_offers")
    .select("title, store_id")
    .eq("category_slug", "computing")
    .ilike("title", "%speaker%")
    .limit(10);
  for (const r of (spkCompute as { title: string; store_id: string }[] | null) ?? []) {
    console.log(`  [${r.store_id.padEnd(14)}]  ${r.title.slice(0, 100)}`);
  }

  /* 3. DHgate vs pharmacy scrape recency ── */
  console.log("\n=== Per-store max(scraped_at) ===");
  for (const storeId of ["dhgate", "healthplus", "medplus", "bitmarte", "essenza", "supermart", "ajebomarket", "konga"]) {
    const { data: latest } = await supa
      .from("offers")
      .select("scraped_at")
      .eq("store_id", storeId)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log(`  ${storeId.padEnd(14)}  ${latest?.scraped_at ?? "(none)"}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
