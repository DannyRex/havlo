try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  const { data, count } = await supa.from("products").select("id, title, brand, model, signature", { count: "exact" })
    .ilike("title", "%air force 1%").limit(20);
  console.log(`Air Force 1 products now: ${count}`);
  const sigs = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ signature: string | null }>) {
    sigs.set(r.signature ?? "(null)", (sigs.get(r.signature ?? "(null)") ?? 0) + 1);
  }
  for (const [s, n] of Array.from(sigs.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${s}: ${n}`);
}
main().catch(console.error);
