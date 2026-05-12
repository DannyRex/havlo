/* What HealthPlus titles STILL route to computing post-retag? */
try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { inferCategoryFromTitle } from "../src/lib/categorize";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  console.log("\n=== HealthPlus titles STILL tagged 'computing' ===");
  const { data: hp } = await supa
    .from("product_best_offers")
    .select("title")
    .eq("store_id", "healthplus")
    .eq("category_slug", "computing")
    .limit(30);
  for (const r of (hp as { title: string }[] | null) ?? []) {
    const reinferred = inferCategoryFromTitle(r.title);
    console.log(`  [now-${reinferred ?? "?"}]  ${r.title.slice(0, 100)}`);
  }

  console.log("\n=== MedPlus titles STILL tagged 'computing' ===");
  const { data: mp } = await supa
    .from("product_best_offers")
    .select("title")
    .eq("store_id", "medplus")
    .eq("category_slug", "computing")
    .limit(20);
  for (const r of (mp as { title: string }[] | null) ?? []) {
    const reinferred = inferCategoryFromTitle(r.title);
    console.log(`  [now-${reinferred ?? "?"}]  ${r.title.slice(0, 100)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
