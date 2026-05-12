/* What titles are getting misclassified into the wrong category?
   Focus: pharmacy stores leaking into computing/home (and any other
   obvious cross-category errors caught by spot-check). */
try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { inferCategoryFromTitle } from "../src/lib/categorize";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  /* Section 1: HealthPlus/MedPlus titles tagged "computing". */
  console.log("\n=== HealthPlus titles tagged 'computing' ===");
  const { data: hpComputing } = await supa
    .from("product_best_offers")
    .select("title")
    .eq("store_id", "healthplus")
    .eq("category_slug", "computing")
    .limit(30);
  for (const r of (hpComputing as { title: string }[] | null) ?? []) {
    const reinferred = inferCategoryFromTitle(r.title);
    console.log(`  [${reinferred ?? "?"}]  ${r.title.slice(0, 100)}`);
  }

  console.log("\n=== MedPlus titles tagged 'computing' ===");
  const { data: mpComputing } = await supa
    .from("product_best_offers")
    .select("title")
    .eq("store_id", "medplus")
    .eq("category_slug", "computing")
    .limit(20);
  for (const r of (mpComputing as { title: string }[] | null) ?? []) {
    const reinferred = inferCategoryFromTitle(r.title);
    console.log(`  [${reinferred ?? "?"}]  ${r.title.slice(0, 100)}`);
  }

  /* Section 2: random sample across all stores — what would a `health`
     category capture if we added wellness/pharmacy keyword rules? */
  console.log("\n=== Titles currently in 'beauty' that look like meds/supplements ===");
  const { data: beautyMeds } = await supa
    .from("product_best_offers")
    .select("title, store_id")
    .eq("category_slug", "beauty")
    .or("title.ilike.%paracetamol%,title.ilike.%vitamin%,title.ilike.%supplement%,title.ilike.%syrup%,title.ilike.%tablet%,title.ilike.%capsule%,title.ilike.%antibiotic%,title.ilike.%multivitamin%,title.ilike.%pain relief%,title.ilike.%first aid%")
    .limit(30);
  for (const r of (beautyMeds as { title: string; store_id: string }[] | null) ?? []) {
    console.log(`  [${r.store_id}]  ${r.title.slice(0, 100)}`);
  }

  /* Section 3: products in pharmacies whose title doesn't look pharma. */
  console.log("\n=== HealthPlus titles tagged 'home' (likely cleansers/baby etc.) ===");
  const { data: hpHome } = await supa
    .from("product_best_offers")
    .select("title")
    .eq("store_id", "healthplus")
    .eq("category_slug", "home")
    .limit(20);
  for (const r of (hpHome as { title: string }[] | null) ?? []) {
    console.log(`  ${r.title.slice(0, 100)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
