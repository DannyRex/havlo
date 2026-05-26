/* One-shot cleanup of AliExpress offer-row bloat.

   Background: until the May 2026 search-aliexpress.ts fix, every AliExpress
   ingest stored the rotating promotion_link as the offer URL. The (store_id,
   url) uniqueness then created a NEW offer row every cron because the token
   inside `s.click.aliexpress.com/s/{token}` differs per API call even for
   the same product. The Phase 3 audit found 1,870 (product, store) pairs
   with ≥2 offers and 8,095 surplus rows catalog-wide.

   Strategy:
     For every (product_id, store_id) pair with >1 offer:
       1. Sort the offers by last_seen_at DESC, then scraped_at DESC.
       2. Keep #1 (the freshest).
       3. Delete the rest.

     Limited to stores where the rotation issue actually applies — AliExpress
     primarily, but we let any store opt in via the --store=<id> flag. Default
     covers AliExpress, the only one demonstrated to have rotating URLs in
     production.

   Pass --apply to write. Default is dry-run.
   Pass --store=<id> to scope to one store (default: aliexpress).
*/

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const APPLY = process.argv.includes("--apply");
const STORE = (() => {
  const arg = process.argv.find((a) => a.startsWith("--store="));
  return arg ? arg.slice("--store=".length) : "aliexpress";
})();

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

  console.log(`${APPLY ? "▶ APPLY" : "● DRY RUN"} — store=${STORE}`);
  console.log();

  type OfferRow = {
    id: string;
    product_id: string;
    last_seen_at: string;
    scraped_at: string;
    current_price: number;
  };
  const offers = await fetchPaged<OfferRow>(
    supa, "offers", "id, product_id, last_seen_at, scraped_at, current_price",
    (q) => q.eq("store_id", STORE),
  );
  console.log(`Total ${STORE} offers: ${offers.length}`);

  /* Bucket by product_id */
  const byProduct = new Map<string, OfferRow[]>();
  for (const o of offers) {
    if (!byProduct.has(o.product_id)) byProduct.set(o.product_id, []);
    byProduct.get(o.product_id)!.push(o);
  }

  /* For each product with >1 offer, choose keepers + delete the rest */
  const toDelete: string[] = [];
  let pairsAffected = 0;
  let extraRows = 0;
  byProduct.forEach((arr, pid) => {
    if (arr.length <= 1) return;
    pairsAffected++;
    extraRows += arr.length - 1;
    arr.sort((a, b) => {
      /* Freshest last_seen_at wins. Tiebreak on scraped_at. Then on
         id for determinism. */
      const ls = b.last_seen_at.localeCompare(a.last_seen_at);
      if (ls !== 0) return ls;
      const sc = b.scraped_at.localeCompare(a.scraped_at);
      if (sc !== 0) return sc;
      return b.id.localeCompare(a.id);
    });
    for (let i = 1; i < arr.length; i++) toDelete.push(arr[i].id);
    void pid;
  });

  console.log(`Products with >1 offer: ${pairsAffected}`);
  console.log(`Extra offer rows:       ${extraRows}`);
  console.log(`Offers to delete:       ${toDelete.length}`);
  /* Sanity: extraRows and toDelete.length should match */
  if (toDelete.length !== extraRows) {
    console.warn(`  ! mismatch — expected ${extraRows}, got ${toDelete.length}`);
  }

  if (!APPLY) {
    console.log();
    console.log("● dry run complete — pass --apply to delete");
    return;
  }

  /* Delete in chunks to stay under PostgREST URL length limits */
  const CHUNK = 500;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const slice = toDelete.slice(i, i + CHUNK);
    const { error } = await supa.from("offers").delete().in("id", slice);
    if (error) { console.warn(`  ! chunk ${i}: ${error.message}`); }
    else { deleted += slice.length; }
  }
  console.log();
  console.log(`✓ deleted ${deleted} offers`);
}

main().catch((e) => { console.error(e); process.exit(1); });
