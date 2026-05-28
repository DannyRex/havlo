try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("products")
    .select("id, title, offers!inner(store_id)")
    .ilike("title", "%MacBook Pro M4%")
    .limit(20);
  if (!data) return;
  const rows = (data as Array<{ id: string; title: string; offers: Array<{ store_id: string }> }>)
    .map((r) => ({ id: r.id, title: r.title, n: new Set(r.offers.map((o) => o.store_id)).size }))
    .sort((a, b) => b.n - a.n);
  for (const r of rows.slice(0, 5)) {
    console.log(`${r.id} ${r.n} stores  "${r.title.slice(0, 80)}"`);
  }
  /* Now hit the live compare API for the top match. */
  const top = rows[0];
  if (!top) return;
  console.log(`\nFetching /api/compare for top: ${top.id}\n`);
  const res = await fetch(`https://havlo.io/api/compare?q=${encodeURIComponent(top.title)}&mode=similar&pid=${top.id}`, {
    headers: { "Cookie": "havlo-country=ng" },
  });
  const d = await res.json() as { anchor?: { title: string; offers: Array<{ storeId: string; productTitle?: string }> } };
  if (d.anchor) {
    console.log(`Anchor title: ${d.anchor.title}`);
    console.log(`${d.anchor.offers.length} offers:`);
    for (const o of d.anchor.offers) {
      console.log(`  ${o.storeId.padEnd(25)} title="${(o.productTitle ?? "").slice(0, 70)}"`);
    }
  }
}
main().catch(console.error);
