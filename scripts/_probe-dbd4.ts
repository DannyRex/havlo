try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin()!;
  // UUID col needs explicit text cast for LIKE — use ilike with %  
  const { data } = await supa.from("products")
    .select("id, title, signature, offers!inner(store_id)")
    .ilike("title", "%MacBook Pro%M4%")
    .limit(20);
  if (data) {
    const rows = data.map((r: any) => ({
      id: r.id, title: r.title, sig: r.signature,
      n: new Set(r.offers.map((o: any) => o.store_id)).size,
    })).sort((a, b) => b.n - a.n);
    console.log("Top MacBook Pro M4 candidates by stores:");
    for (const r of rows.slice(0, 8)) {
      console.log(`  ${r.id} ${r.n}st sig="${r.sig}" title="${r.title.slice(0,70)}"`);
    }
    /* For top one, fetch production */
    const t = rows[0];
    if (t) {
      console.log(`\n→ Fetching production for ${t.id} ("${t.title.slice(0,60)}")...\n`);
      const res = await fetch(`https://havlo.io/api/compare?q=${encodeURIComponent(t.title)}&mode=similar&pid=${t.id}&_t=${Date.now()}`, {
        headers: { "Cookie": "havlo-country=ng", "Cache-Control": "no-cache" },
      });
      const d = await res.json() as any;
      if (d.anchor) {
        console.log(`Anchor: ${d.anchor.title}`);
        console.log(`${d.anchor.offers.length} offers:`);
        for (const o of d.anchor.offers) {
          console.log(`  ${(o.storeId ?? "").padEnd(25)} "${(o.productTitle ?? "").slice(0,75)}"`);
        }
      }
    }
  }
}
main().catch(console.error);
