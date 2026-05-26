try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  const PAGE = 1000;
  type Row = { product_id: string; store_id: string; url: string };
  const offers: Row[] = [];
  let from = 0;
  while (true) {
    const { data } = await supa.from("offers").select("product_id, store_id, url").range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    offers.push(...(data as Row[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const psBucket = new Map<string, Row[]>();
  for (const o of offers) {
    const k = `${o.product_id}|${o.store_id}`;
    if (!psBucket.has(k)) psBucket.set(k, []);
    psBucket.get(k)!.push(o);
  }
  const big: Array<{ pid: string; sid: string; n: number; sample: string }> = [];
  psBucket.forEach((arr, k) => {
    if (arr.length >= 10) {
      const [pid, sid] = k.split("|");
      big.push({ pid, sid, n: arr.length, sample: arr[0].url });
    }
  });
  big.sort((a, b) => b.n - a.n);
  /* Aggregate by store */
  const byStore = new Map<string, { n: number; pairs: number; samples: string[] }>();
  for (const e of big) {
    if (!byStore.has(e.sid)) byStore.set(e.sid, { n: 0, pairs: 0, samples: [] });
    const s = byStore.get(e.sid)!;
    s.n += e.n; s.pairs++;
    if (s.samples.length < 2) s.samples.push(`${e.n}: ${e.sample.slice(0, 100)}`);
  }
  const ag: Array<{ sid: string; n: number; pairs: number; samples: string[] }> = [];
  byStore.forEach((v, sid) => ag.push({ sid, ...v }));
  ag.sort((a, b) => b.n - a.n);
  console.log("Stores contributing pairs with ≥10 offers each:");
  for (const a of ag.slice(0, 8)) {
    console.log(`\n${a.sid}: ${a.pairs} pairs, ${a.n} total rows`);
    for (const s of a.samples) console.log(`  ${s}`);
  }
}
main().catch(console.error);
