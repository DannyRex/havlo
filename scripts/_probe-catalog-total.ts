try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }
  const { count: viewCount } = await supa.from("product_best_offers").select("*", { count: "exact", head: true });
  const { count: zeroDiscount } = await supa.from("product_best_offers").select("*", { count: "exact", head: true }).eq("discount_percent", 0);
  const { count: hasDiscount } = await supa.from("product_best_offers").select("*", { count: "exact", head: true }).gt("discount_percent", 0);

  const truncated = (viewCount ?? 0) - 4000;
  console.log(`product_best_offers total rows: ${viewCount}`);
  console.log(`  with discount > 0: ${hasDiscount}`);
  console.log(`  with discount = 0: ${zeroDiscount}`);
  console.log(`\nCurrent PAGES=4 cap → /api/deals sees top 4000 rows.`);
  console.log(`Sort is discount-DESC → the bottom ${truncated > 0 ? truncated : 0} rows get truncated.`);
  console.log(`Those are mostly 0% rows (HealthPlus, MedPlus, Bitmarte, most Essenza/Supermart).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
