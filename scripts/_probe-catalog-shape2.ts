try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin()!;
  // Total products
  const { count: total } = await supa.from("products").select("*", { count: "exact", head: true });
  console.log("Total products:", total);
  // Top stores by offer count
  const stores = ["konga","supermart","essenza","healthplus","medplus","slot","kara","threechub","jumia","ajebomarket","asos","amazon-uk","aliexpress","best-buy","argos","currys","walmart","bitmarte","dhgate","nykaa"];
  console.log("\nStore offer counts:");
  for (const s of stores) {
    const { count } = await supa.from("offers").select("*", { count: "exact", head: true }).eq("store_id", s);
    console.log(`  ${s.padEnd(20)} ${count}`);
  }
}
main().catch(console.error);
