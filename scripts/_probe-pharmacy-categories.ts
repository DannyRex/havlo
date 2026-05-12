/* What category do HealthPlus / MedPlus offers fall under? */
try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  for (const storeId of ["healthplus", "medplus", "essenza", "supermart", "ajebomarket", "bitmarte"]) {
    /* Aggregate category_slug for each store's offers in the view. */
    const counts = new Map<string, number>();
    for (let i = 0; i < 5; i++) {
      const { data } = await supa
        .from("product_best_offers")
        .select("category_slug")
        .eq("store_id", storeId)
        .range(i * 1000, (i + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      for (const r of data as { category_slug: string | null }[]) {
        const k = r.category_slug ?? "(null)";
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      if (data.length < 1000) break;
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((a, [, n]) => a + n, 0);
    console.log(`\n${storeId} (${total} offers):`);
    for (const [cat, n] of sorted) {
      const pct = Math.round((n / total) * 100);
      console.log(`  ${cat.padEnd(20)} ${String(n).padStart(4)}  (${pct}%)`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
