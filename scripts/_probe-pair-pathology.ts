/* Investigate (product_id, store_id) pairs with absurd numbers of
   offers — top of the long tail had 176, 168×2, 167, 162 offers each.
   These are pathological; a single product on a single store should
   normally be ~1 offer.

   Hypotheses:
     A. The URLs in the offers table have tracking params that vary
        between scrapes, so the (store_id, url) uniqueness constraint
        creates a new offer every time even though the underlying
        URL points at the same listing.
     B. The store legitimately has many distinct listings for the
        same canonical product (Amazon variant ASINs, eBay sellers,
        Walmart marketplace).

   Inspecting the top offender will tell us which. */

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

  const offers = await fetchPaged<{ id: string; product_id: string; store_id: string; url: string }>(
    supa, "offers", "id, product_id, store_id, url", (q) => q,
  );

  const psBucket = new Map<string, Array<{ id: string; url: string }>>();
  for (const o of offers) {
    const k = `${o.product_id}|${o.store_id}`;
    if (!psBucket.has(k)) psBucket.set(k, []);
    psBucket.get(k)!.push({ id: o.id, url: o.url });
  }

  const big: Array<{ k: string; n: number; urls: Array<{ id: string; url: string }> }> = [];
  psBucket.forEach((arr, k) => { if (arr.length >= 50) big.push({ k, n: arr.length, urls: arr }); });
  big.sort((a, b) => b.n - a.n);

  console.log(`Pairs with ≥50 offers: ${big.length}\n`);

  /* Inspect the top 5 — print URL diversity stats */
  for (const { k, n, urls } of big.slice(0, 5)) {
    const [pid, sid] = k.split("|");
    console.log(`(product=${pid.slice(0, 8)}…, store=${sid})  n=${n}`);

    /* Look at URL distinctness: same canonical (without query string)? */
    const seenCanonical = new Map<string, number>();
    for (const u of urls) {
      const canonical = u.url.split("?")[0];
      seenCanonical.set(canonical, (seenCanonical.get(canonical) ?? 0) + 1);
    }
    console.log(`  unique URLs (incl query string):   ${urls.length}`);
    console.log(`  unique URLs (canonical, no query): ${seenCanonical.size}`);

    /* Show 3 sample URLs */
    for (const u of urls.slice(0, 3)) console.log(`    ${u.url.slice(0, 130)}`);
    if (urls.length > 3) console.log(`    … ${urls.length - 3} more`);
    console.log();
  }

  /* Total bloat: how many offer rows are surplus? Each pair with n>1
     beyond the first is extra. */
  let bloat = 0;
  psBucket.forEach((arr) => { if (arr.length > 1) bloat += arr.length - 1; });
  console.log(`\nTotal "extra" offer rows from dup-per-pair: ${bloat}`);
  console.log(`(if every pair collapsed to 1 offer, offers table would shrink by ${bloat})`);

  /* Compute by canonical-URL: if all duplicates per pair share the
     same canonical URL, the fix is URL-canonicalization at ingest.
     If they're distinct sellers / variants, leave them. */
  let pairsSameCanonical = 0;
  let pairsDifferentCanonical = 0;
  psBucket.forEach((arr) => {
    if (arr.length <= 1) return;
    const cs = new Set(arr.map((a) => a.url.split("?")[0]));
    if (cs.size === 1) pairsSameCanonical++; else pairsDifferentCanonical++;
  });
  console.log(`\nDup-pairs collapsible by canonical URL: ${pairsSameCanonical}`);
  console.log(`Dup-pairs with distinct canonical URLs:  ${pairsDifferentCanonical}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
