try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  /* Find the actual product_id by looking up the top-bloat row again */
  const { data: offers } = await supa.from("offers")
    .select("id, product_id, store_id, url, current_price, scraped_at, last_seen_at")
    .eq("store_id", "aliexpress")
    .limit(10000);
  if (!offers) return;
  /* Count per product_id */
  const byPid = new Map<string, Array<typeof offers[0]>>();
  for (const o of offers) {
    if (!byPid.has(o.product_id)) byPid.set(o.product_id, []);
    byPid.get(o.product_id)!.push(o);
  }
  /* Sort by count desc, pick top 3 */
  const sorted = Array.from(byPid.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [pid, rows] of sorted.slice(0, 3)) {
    console.log(`\n=== product_id=${pid}  rows=${rows.length} ===`);
    /* Show price distribution + url distinctness */
    const prices = rows.map((r) => r.current_price);
    const pmin = Math.min(...prices), pmax = Math.max(...prices);
    console.log(`  price range: ${pmin} … ${pmax}`);
    const urlSet = new Set(rows.map((r) => r.url));
    console.log(`  unique URLs: ${urlSet.size}`);
    /* Show 5 sample full urls with their ids */
    let i = 0;
    for (const r of rows) {
      if (i++ >= 5) break;
      console.log(`  ${r.id.slice(0,8)} price=${r.current_price}`);
      console.log(`    ${r.url}`);
    }
  }
}
main().catch(console.error);
