/* For the 110 NULL-country stores that have in-stock offers:
   - What % of their offers have offers.source_country set?
   - What's the dominant source_country per store (if any)?

   If a store's offers all agree on one source_country, we can safely
   backfill stores.country to that value. If they disagree (visitor-
   market prefix patterns), we need a different signal. */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function fetchPaged<T>(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const q = filters(supa.from(table).select(select)).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) { console.warn(error.message); break; }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  const nullStores = await fetchPaged<{ id: string; name: string }>(
    supa, "stores", "id, name", (q) => q.is("country", null),
  );
  const nullStoreIds = new Set(nullStores.map((s) => s.id));

  const offers = await fetchPaged<{ store_id: string; source_country: string | null; source_query: string | null; in_stock: boolean }>(
    supa, "offers", "store_id, source_country, source_query, in_stock", (q) => q.eq("in_stock", true),
  );

  type Bucket = { total: number; bySC: Map<string, number>; sampleQueries: Set<string> };
  const perStore = new Map<string, Bucket>();
  for (const o of offers) {
    if (!nullStoreIds.has(o.store_id)) continue;
    let b = perStore.get(o.store_id);
    if (!b) { b = { total: 0, bySC: new Map(), sampleQueries: new Set() }; perStore.set(o.store_id, b); }
    b.total++;
    const sc = o.source_country ?? "(null)";
    b.bySC.set(sc, (b.bySC.get(sc) ?? 0) + 1);
    if (o.source_query) b.sampleQueries.add(o.source_query);
  }

  /* Classify each store: agree on one country (>=80%), disagree, or no signal. */
  type Decision = "AGREE" | "MIXED" | "NONE";
  const decisions: Array<{ id: string; total: number; pick: string | null; dec: Decision; pct: number; samples: string[] }> = [];
  for (const s of nullStores) {
    const b = perStore.get(s.id);
    if (!b) {
      decisions.push({ id: s.id, total: 0, pick: null, dec: "NONE", pct: 0, samples: [] });
      continue;
    }
    let topSc: string | null = null;
    let topN = 0;
    for (const [sc, n] of b.bySC.entries()) {
      if (sc === "(null)") continue;
      if (n > topN) { topN = n; topSc = sc; }
    }
    const samples = Array.from(b.sampleQueries).slice(0, 2);
    if (!topSc) {
      decisions.push({ id: s.id, total: b.total, pick: null, dec: "NONE", pct: 0, samples });
    } else if (topN / b.total >= 0.8) {
      decisions.push({ id: s.id, total: b.total, pick: topSc, dec: "AGREE", pct: topN / b.total, samples });
    } else {
      decisions.push({ id: s.id, total: b.total, pick: topSc, dec: "MIXED", pct: topN / b.total, samples });
    }
  }

  const agree   = decisions.filter((d) => d.dec === "AGREE");
  const mixed   = decisions.filter((d) => d.dec === "MIXED");
  const noneSig = decisions.filter((d) => d.dec === "NONE");

  console.log(`Decision breakdown for ${nullStores.length} NULL-country stores:`);
  console.log(`  AGREE (≥80% on one source_country): ${agree.length}  ← safe to backfill`);
  console.log(`  MIXED (top-source-country < 80%):  ${mixed.length}`);
  console.log(`  NONE  (no source_country signal):  ${noneSig.length}`);
  console.log();

  /* Breakdown of the AGREE group by chosen country */
  const byPick = new Map<string, number>();
  for (const d of agree) byPick.set(d.pick!, (byPick.get(d.pick!) ?? 0) + 1);
  console.log(`AGREE breakdown by chosen country:`);
  for (const [cc, n] of Array.from(byPick.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cc.toUpperCase().padEnd(4)} ${n} stores`);
  }
  console.log();

  console.log(`First 15 AGREE samples (id, n_offers, pick, sample_query):`);
  for (const d of agree.sort((a, b) => b.total - a.total).slice(0, 15)) {
    console.log(`  ${d.id.padEnd(30)} n=${String(d.total).padStart(4)}  pick=${(d.pick ?? "").padEnd(4)}  q=${d.samples[0] ?? ""}`);
  }
  console.log();
  console.log(`MIXED samples (need manual review):`);
  for (const d of mixed.slice(0, 10)) {
    console.log(`  ${d.id.padEnd(30)} n=${String(d.total).padStart(4)}  top=${d.pick} (${(d.pct*100).toFixed(0)}%)  samples=${d.samples.join(" | ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
