/* Find the overlap between NULL-country stores and stores-with-offers.

   A NULL-country store with offers is invisible to the local-tab on
   /[country]/deals — its rows surface in 'intl' bucket via is_international
   but never in the visitor's local view. A NULL-country store with ZERO
   offers is dead weight (probably created during a brief ingest then
   the offers were swept).

   Output:
     - Total NULL-country stores (truly orphaned vs global cross-border)
     - Of those, how many have at least one offer
     - How many of THOSE offers are in_stock=true
     - Top 20 stores ranked by in_stock_offer_count where we'd benefit
       from backfilling the country tag

   Pure read-only. */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { inferStoreCountry } from "../src/lib/country";

const GLOBAL_OK = ["aliexpress", "shein", "temu", "dhgate", "banggood", "ali-express"];
function isExpectedGlobal(id: string, name: string): boolean {
  const lc = `${id} ${name}`.toLowerCase();
  return GLOBAL_OK.some((g) => lc.includes(g));
}

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
    if (error) { console.warn(`fetch err ${error.message}`); break; }
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

  const stores = await fetchPaged<{ id: string; name: string; country: string | null }>(
    supa, "stores", "id, name, country",
    (q) => q.is("country", null),
  );
  console.log(`NULL-country stores total: ${stores.length}`);

  const offers = await fetchPaged<{ store_id: string; in_stock: boolean; source_query: string | null }>(
    supa, "offers", "store_id, in_stock, source_query", (q) => q,
  );

  const inStockByStore = new Map<string, number>();
  const totalByStore   = new Map<string, number>();
  const querySamples   = new Map<string, Set<string>>();
  for (const o of offers) {
    totalByStore.set(o.store_id, (totalByStore.get(o.store_id) ?? 0) + 1);
    if (o.in_stock) inStockByStore.set(o.store_id, (inStockByStore.get(o.store_id) ?? 0) + 1);
    if (o.source_query) {
      if (!querySamples.has(o.store_id)) querySamples.set(o.store_id, new Set());
      querySamples.get(o.store_id)!.add(o.source_query);
    }
  }

  const expectedGlobal = stores.filter((s) => isExpectedGlobal(s.id, s.name));
  const others         = stores.filter((s) => !isExpectedGlobal(s.id, s.name));

  console.log(`  expected-global (AliExpress/Shein/Temu/DHgate/Banggood): ${expectedGlobal.length}`);
  console.log(`  other NULL-country stores: ${others.length}`);
  console.log();

  const withOffers    = others.filter((s) => (totalByStore.get(s.id) ?? 0) > 0);
  const inStockGroup  = others.filter((s) => (inStockByStore.get(s.id) ?? 0) > 0);
  console.log(`  of those, with ANY offer:        ${withOffers.length}`);
  console.log(`  of those, with in_stock offers:  ${inStockGroup.length}`);
  console.log();

  /* What does inferStoreCountry think about each one? If the JS roster
     recognises them, we can backfill from inferStoreCountry directly. */
  let jsRosterHit = 0;
  let jsRosterMiss = 0;
  const missSample: Array<{ id: string; name: string; cnt: number; sampleQuery: string | null }> = [];
  for (const s of inStockGroup) {
    const inferred = inferStoreCountry(s.id, s.name);
    if (inferred) {
      jsRosterHit++;
    } else {
      jsRosterMiss++;
      missSample.push({
        id: s.id,
        name: s.name,
        cnt: inStockByStore.get(s.id) ?? 0,
        sampleQuery: querySamples.get(s.id) ? Array.from(querySamples.get(s.id)!)[0] : null,
      });
    }
  }
  console.log(`  ${jsRosterHit} would be backfilled by inferStoreCountry (JS roster recognises them)`);
  console.log(`  ${jsRosterMiss} are unknown to the JS roster — need source_query country signal`);
  console.log();

  console.log(`Top 20 inStock-but-NULL-country stores not in the JS roster:`);
  missSample.sort((a, b) => b.cnt - a.cnt);
  for (const m of missSample.slice(0, 20)) {
    console.log(`  ${m.id.padEnd(30)} ${String(m.cnt).padStart(4)}  query=${m.sampleQuery ?? "(none)"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
