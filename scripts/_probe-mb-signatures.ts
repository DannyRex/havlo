try { process.loadEnvFile?.(".env.local"); } catch {}
import { buildSignature } from "../src/lib/search/normalize";
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  /* JS-side signature for each title (what buildSignature would produce now). */
  const titles = [
    "Apple MacBook Pro M4",
    "Apple MacBook Pro M3",
    "Apple MacBook Air M4",
    "Apple MacBook Air 15-inch M4 chip",
    "Apple 16-inch MacBook Pro Apple M4 chip",
    "Apple MacBook Pro 14-inch M4 Chip CPU RAM",
  ];
  console.log("=== JS-side signatures ===");
  for (const t of titles) {
    const s = buildSignature(t);
    console.log(`  ${t.padEnd(50)} → key="${s.key}" brand=${s.brand} model=${s.model}`);
  }
  /* DB-side signatures actually persisted. */
  console.log("\n=== DB-persisted signatures for MacBook M4 anchor + nearby ===");
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("products")
    .select("id, title, signature, brand, model")
    .ilike("title", "%MacBook%")
    .limit(20);
  for (const r of (data ?? []) as Array<{ id: string; title: string; signature: string | null; brand: string | null; model: string | null }>) {
    console.log(`  ${r.id.slice(0,8)} sig="${r.signature ?? "NULL"}" title="${r.title.slice(0,50)}"`);
  }
}
main().catch(console.error);
