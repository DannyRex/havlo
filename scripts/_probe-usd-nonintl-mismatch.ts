/* Drill into the 48 USD-on-non-intl-store offers from probe round 2.

   The expected invariant: USD-priced offers come from intl-flagged stores
   (SerpAPI normalises everything to USD, those stores are flagged
   is_international=true). A USD offer on is_international=false is either:
     (a) An NG-anchored store that picked up a USD-priced listing
         (Konga occasionally publishes price in USD for niche imports)
     (b) An ingest bug — store was flagged false but the offer is intl
     (c) An is_international flag that didn't get updated after store
         was reclassified

   Output the actual rows so we can decide. */

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

  const offers = await fetchPaged<{ id: string; store_id: string; product_id: string; currency: string; current_price: number; source_provider: string | null; source_query: string | null; source_country: string | null }>(
    supa, "offers",
    "id, store_id, product_id, currency, current_price, source_provider, source_query, source_country",
    (q) => q.eq("in_stock", true).eq("currency", "USD"),
  );

  const storesIntl = await fetchPaged<{ id: string; name: string; country: string | null; is_international: boolean }>(
    supa, "stores", "id, name, country, is_international",
    (q) => q.eq("is_international", false),
  );
  const intlMap = new Map(storesIntl.map((s) => [s.id, s] as const));

  const usdOnLocal = offers.filter((o) => intlMap.has(o.store_id));
  console.log(`USD offers on is_international=false stores: ${usdOnLocal.length}`);
  console.log();

  /* Group by store */
  const byStore = new Map<string, typeof usdOnLocal>();
  for (const o of usdOnLocal) {
    if (!byStore.has(o.store_id)) byStore.set(o.store_id, []);
    byStore.get(o.store_id)!.push(o);
  }
  const groups: Array<{ id: string; rows: typeof usdOnLocal }> = [];
  byStore.forEach((rows, id) => groups.push({ id, rows }));
  groups.sort((a, b) => b.rows.length - a.rows.length);

  for (const { id, rows } of groups) {
    const store = intlMap.get(id)!;
    console.log(`${id} (${store.name}, country=${store.country}, is_intl=${store.is_international})`);
    console.log(`  ${rows.length} USD offer(s)`);
    /* Provenance sample */
    const provSet = new Set(rows.map((r) => r.source_provider ?? "(null)"));
    const countrySet = new Set(rows.map((r) => r.source_country ?? "(null)"));
    console.log(`  source_providers: ${Array.from(provSet).join(", ")}`);
    console.log(`  source_countries: ${Array.from(countrySet).join(", ")}`);
    /* First 2 row samples */
    for (const r of rows.slice(0, 2)) {
      console.log(`    price=${r.current_price} source_query=${r.source_query}`);
    }
    console.log();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
