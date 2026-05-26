try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature } from "../src/lib/search/normalize";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  const PAGE = 1000;
  type R = { title: string; brand: string | null; model: string | null };
  const all: R[] = [];
  let from = 0;
  while (true) {
    const { data } = await supa.from("products").select("title, brand, model").range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as R[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  /* Stored DB coverage */
  let dbBrand = 0, dbModel = 0, dbBoth = 0;
  /* Recomputed via current parser */
  let liveBrand = 0, liveModel = 0, liveBoth = 0;
  for (const r of all) {
    if (r.brand) dbBrand++;
    if (r.model) dbModel++;
    if (r.brand && r.model) dbBoth++;
    const sig = buildSignature(r.title);
    if (sig.brand) liveBrand++;
    if (sig.model) liveModel++;
    if (sig.brand && sig.model) liveBoth++;
  }
  const fmt = (n: number) => `${n} (${(n/all.length*100).toFixed(1)}%)`;
  console.log(`Total products: ${all.length}`);
  console.log();
  console.log("DB-stored coverage:");
  console.log(`  brand:    ${fmt(dbBrand)}`);
  console.log(`  model:    ${fmt(dbModel)}`);
  console.log(`  both:     ${fmt(dbBoth)}`);
  console.log();
  console.log("Recomputed via current parser:");
  console.log(`  brand:    ${fmt(liveBrand)}`);
  console.log(`  model:    ${fmt(liveModel)}`);
  console.log(`  both:     ${fmt(liveBoth)}`);
  console.log();
  console.log(`Gap (DB vs current parser): brand=${liveBrand - dbBrand}, model=${liveModel - dbModel}, both=${liveBoth - dbBoth}`);
}
main().catch(console.error);
