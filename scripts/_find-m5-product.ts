try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { isLikelySameProduct } from "../src/lib/search/query-understanding";
async function main() {
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("products")
    .select("id, title, signature, brand, offers!inner(store_id, current_price, currency)")
    .ilike("title", "%MacBook Pro 14%M5%");
  console.log(`Found ${data?.length ?? 0} MacBook Pro 14 M5 products:`);
  for (const r of (data ?? []) as any[]) {
    const stores = new Set(r.offers.map((o: any) => o.store_id));
    console.log(`  ${r.id} sig="${r.signature}" stores=[${[...stores].join(",")}]`);
    console.log(`    title: "${r.title.slice(0,80)}"`);
    /* Pair against the leak anchor */
    const sync = isLikelySameProduct(
      { title: "Apple 16-inch MacBook Pro Apple M4 chip", brand: "apple", priceNgn: 1_000_000 },
      { title: r.title, brand: r.brand, priceNgn: 1_000_000 },
    );
    console.log(`    sync isLikelySameProduct vs anchor: ${sync}`);
  }
}
main().catch(console.error);
