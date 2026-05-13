/* Why did HYDREX TABS, NEUROVIT FORTE *10 STR, and Emerald Green
   Bandage Dress slip past the retag? Pull exact DB titles + slugs +
   re-infer. */
try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { inferCategoryFromTitle } from "../src/lib/categorize";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  console.log("\n=== Products matching the residual reports ===");
  for (const needle of ["hydrex", "neurovit forte", "bandage dress"]) {
    const { data } = await supa
      .from("products")
      .select("id, title, category_slug")
      .ilike("title", `%${needle}%`)
      .limit(10);
    console.log(`\n${needle.toUpperCase()}:`);
    for (const r of (data as { id: string; title: string; category_slug: string }[] | null) ?? []) {
      const reinferred = inferCategoryFromTitle(r.title);
      const agree = reinferred === r.category_slug ? "✓" : (reinferred ? "✗" : "?");
      console.log(`  ${agree} [db: ${r.category_slug ?? "(null)"}, inferred: ${reinferred ?? "(null)"}]`);
      console.log(`      ${r.title}`);
    }
  }

  /* Also probe /compare path: do searches return data from pgFts? */
  console.log("\n=== PgFts smoke test: are common queries returning hits? ===");
  for (const q of ["iphone 15 pro max", "playstation 5", "ninja air fryer"]) {
    /* Cheap proxy: count products whose title contains the first token */
    const firstWord = q.split(" ")[0];
    const { count } = await supa
      .from("products")
      .select("*", { count: "exact", head: true })
      .ilike("title", `%${firstWord}%`);
    console.log(`  "${q}" → products matching "${firstWord}": ${count ?? 0}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
