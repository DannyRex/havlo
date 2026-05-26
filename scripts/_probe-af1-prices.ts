try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  const { data: prods } = await supa.from("products").select("id, title").ilike("title", "%air force 1%").limit(200);
  if (!prods) return;
  const ids = (prods as Array<{ id: string }>).map((p) => p.id);
  const { data: offers } = await supa.from("offers").select("product_id, current_price, currency").in("product_id", ids).eq("in_stock", true);
  const USD_TO_NGN = 1500;
  const prices = ((offers ?? []) as Array<{ current_price: number; currency: string }>)
    .map((o) => o.currency === "NGN" ? o.current_price : o.current_price * USD_TO_NGN)
    .filter((p) => p > 0).sort((a, b) => a - b);
  if (prices.length === 0) { console.log("no in-stock offers"); return; }
  console.log(`offers: ${prices.length}`);
  console.log(`min: ${prices[0]}  median: ${prices[Math.floor(prices.length/2)]}  max: ${prices[prices.length-1]}`);
  console.log(`ratio max/min: ${(prices[prices.length-1] / prices[0]).toFixed(2)}x`);
}
main().catch(console.error);
