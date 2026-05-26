try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature } from "../src/lib/search/normalize";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  const { data } = await supa
    .from("products")
    .select("id, title, brand, model, signature, title_key")
    .ilike("title", "%air force 1%")
    .limit(100);
  if (!data) return;
  console.log(`Found ${data.length} "air force 1" products`);
  console.log("DB brand/model/signature vs recomputed:\n");
  const sigGroups = new Map<string, number>();
  for (const r of data as Array<{ id: string; title: string; brand: string | null; model: string | null; signature: string; title_key: string | null }>) {
    const sig = buildSignature(r.title);
    sigGroups.set(sig.key, (sigGroups.get(sig.key) ?? 0) + 1);
  }
  console.log("Signature distribution among air-force-1 products:");
  Array.from(sigGroups.entries()).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    console.log(`  ${k.padEnd(40)} ${n}`);
  });
  console.log("\nDB-stored signature distribution:");
  const dbSig = new Map<string, number>();
  for (const r of data as Array<{ signature: string }>) {
    dbSig.set(r.signature ?? "(null)", (dbSig.get(r.signature ?? "(null)") ?? 0) + 1);
  }
  Array.from(dbSig.entries()).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    console.log(`  ${k.padEnd(40)} ${n}`);
  });
  console.log("\nDB-stored brand/model distribution:");
  const bm = new Map<string, number>();
  for (const r of data as Array<{ brand: string | null; model: string | null }>) {
    const k = `${r.brand ?? "(null)"}|${r.model ?? "(null)"}`;
    bm.set(k, (bm.get(k) ?? 0) + 1);
  }
  Array.from(bm.entries()).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    console.log(`  ${k.padEnd(40)} ${n}`);
  });
  /* Show 5 sample titles per signature group to see what's going on */
  console.log("\nSample titles per recomputed sig:");
  const byRecomputed = new Map<string, string[]>();
  for (const r of data as Array<{ title: string }>) {
    const k = buildSignature(r.title).key;
    if (!byRecomputed.has(k)) byRecomputed.set(k, []);
    byRecomputed.get(k)!.push(r.title);
  }
  byRecomputed.forEach((titles, key) => {
    console.log(`\n${key} (${titles.length}):`);
    for (const t of titles.slice(0, 5)) console.log(`  ${t.slice(0,90)}`);
  });
}
main().catch(console.error);
