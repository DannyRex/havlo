try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin()!;
  /* Count products per store via offers join. A product can be in
     multiple stores, so this sums offer counts not unique product
     counts — but it tells us where backfill effort pays off. */
  const { data } = await supa.from("offers")
    .select("store_id, products!inner(id, gtin, mpn)")
    .is("products.gtin", null)
    .is("products.mpn", null)
    .limit(50000);
  if (!data) { console.log("no data"); return; }
  const counts = new Map<string, number>();
  for (const r of data as any[]) {
    counts.set(r.store_id, (counts.get(r.store_id) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  console.log("Store                          Offers needing backfill");
  for (const [s, n] of sorted.slice(0, 30)) {
    console.log(`${s.padEnd(30).slice(0, 30)} ${String(n).padStart(8)}`);
  }
}
main().catch(console.error);
