/* Phase 3 ingest integrity probe — diagnostic-only, no mutations.

   Probes the production catalog for ingest-pipeline integrity issues
   that fail silently:

     1. Currency vs anchor mismatch (offer.currency='NGN' but store.country!='NG')
     2. Stores with no country tag (drop out of /local-tab filters)
     3. Stale in_stock offers (last_seen_at older than 30d but in_stock=true)
     4. Orphan products (no offers point at them)
     5. Stores in DB with zero offers (created but never written-to)
     6. Title placeholders that escaped cleanProductTitle
     7. Offers with sentinel-leak strings ("[BLOCKED:" etc.)
     8. Duplicate title_key across DIFFERENT product ids (post-0046 dedup gaps)
     9. Offers with NULL store_id or product_id
    10. Offers where (current_price = 0 OR current_price IS NULL) but is_deal=true

   Each section prints a count + a 5-row sample so we know what to fix.
   Pure read-only — safe to run against prod. */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

/* Filter callback receives the post-select builder (PostgrestFilterBuilder
   in PostgREST terms). select() must run BEFORE .eq/.lt/.ilike chains —
   we can't call .from then chain filters then select, because .select()
   only exists on the PostgrestQueryBuilder, not on the filter chain. */
async function fetchAll<T>(
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
    const base = supa.from(table).select(select);
    const q = filters(base).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) { console.warn(`  ! fetch err ${error.message}`); break; }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function count(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<number> {
  const base = supa.from(table).select("*", { count: "exact", head: true });
  const { count: n, error } = await filters(base);
  if (error) { console.warn(`  ! count err ${error.message}`); return -1; }
  return n ?? 0;
}

function pad(n: number | string, w = 8) { return String(n).padStart(w); }

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no supabase"); process.exit(1); }

  /* Baseline ─────────────────────────────────────────────────────── */
  const stores  = await count(supa, "stores",   (q) => q);
  const prods   = await count(supa, "products", (q) => q);
  const offers  = await count(supa, "offers",   (q) => q);
  const offersInStock = await count(supa, "offers", (q) => q.eq("in_stock", true));
  console.log(`\n── Baseline ──────────────────────────────────────`);
  console.log(`  stores=${pad(stores)}  products=${pad(prods)}  offers=${pad(offers)} (in_stock=${offersInStock})`);

  /* 1. Currency vs anchor mismatch ──────────────────────────────── */
  console.log(`\n── 1. Currency vs anchor mismatch ────────────────`);
  /* All NGN offers should sit under store_country='NG'. Find any
     NGN-priced offer whose store is tagged anything else. */
  const ngnRows = await fetchAll<{ store_id: string; currency: string }>(
    supa,
    "offers",
    "store_id, currency",
    (q) => q.eq("currency", "NGN").eq("in_stock", true),
  );
  const storeRows = await fetchAll<{ id: string; country: string | null; name: string }>(
    supa, "stores", "id, country, name", (q) => q,
  );
  const storeCountryById = new Map(storeRows.map((s) => [s.id, s.country] as const));
  const storeNameById    = new Map(storeRows.map((s) => [s.id, s.name]    as const));
  const ngnMisanchored = ngnRows.filter((r) => {
    const c = storeCountryById.get(r.store_id);
    return c !== null && c !== undefined && c.toUpperCase() !== "NG";
  });
  const ngnUnanchored = ngnRows.filter((r) => !storeCountryById.get(r.store_id));
  console.log(`  NGN offers with store.country != 'NG': ${ngnMisanchored.length}`);
  console.log(`  NGN offers with store.country IS NULL: ${ngnUnanchored.length}`);
  if (ngnMisanchored.length > 0) {
    const sample = ngnMisanchored.slice(0, 5).map((r) => `${r.store_id} (country=${storeCountryById.get(r.store_id)})`);
    console.log(`    sample: ${sample.join(", ")}`);
  }
  if (ngnUnanchored.length > 0) {
    const cnt = new Map<string, number>();
    for (const r of ngnUnanchored) cnt.set(r.store_id, (cnt.get(r.store_id) ?? 0) + 1);
    const sample = Array.from(cnt.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, n]) => `${id}(${n})`);
    console.log(`    top unanchored NGN store_ids: ${sample.join(", ")}`);
  }

  /* 2. Stores with no country tag ───────────────────────────────── */
  console.log(`\n── 2. Stores missing country ─────────────────────`);
  const noCountry = storeRows.filter((s) => s.country === null || s.country === "");
  console.log(`  stores with country=NULL/'': ${noCountry.length} / ${storeRows.length} (${Math.round(noCountry.length / storeRows.length * 100)}%)`);
  /* True cross-border globals are EXPECTED to be NULL (AliExpress /
     Shein / Temu / DHgate). The rest are bugs. */
  const GLOBAL_OK = ["aliexpress", "shein", "temu", "dhgate", "banggood", "ali-express"];
  const trulyMissing = noCountry.filter((s) => !GLOBAL_OK.some((g) => s.id.toLowerCase().includes(g) || s.name.toLowerCase().includes(g)));
  console.log(`  → excluding known globals: ${trulyMissing.length}`);
  if (trulyMissing.length > 0) {
    console.log(`    sample: ${trulyMissing.slice(0, 10).map((s) => `${s.id} (${s.name})`).join(", ")}`);
  }

  /* 3. Stale in_stock offers ────────────────────────────────────── */
  console.log(`\n── 3. Stale in_stock offers (>30d) ───────────────`);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const sixtyDaysAgo  = new Date(Date.now() - 60 * 86400_000).toISOString();
  const stale30 = await count(supa, "offers", (q) =>
    q.eq("in_stock", true).lt("last_seen_at", thirtyDaysAgo),
  );
  const stale60 = await count(supa, "offers", (q) =>
    q.eq("in_stock", true).lt("last_seen_at", sixtyDaysAgo),
  );
  console.log(`  in_stock=true AND last_seen_at < 30d: ${stale30}`);
  console.log(`  in_stock=true AND last_seen_at < 60d: ${stale60}  ← past the TTL_DAYS=30 sweep`);

  /* 4. Orphan products (no offer points at them) ─────────────────── */
  console.log(`\n── 4. Orphan products ────────────────────────────`);
  const allProdIds = await fetchAll<{ id: string }>(supa, "products", "id", (q) => q);
  const offersProdIds = await fetchAll<{ product_id: string }>(supa, "offers", "product_id", (q) => q);
  const usedProdIds = new Set(offersProdIds.map((r) => r.product_id));
  const orphans = allProdIds.filter((p) => !usedProdIds.has(p.id));
  console.log(`  products with zero offers: ${orphans.length} / ${allProdIds.length}`);

  /* 5. Empty stores ─────────────────────────────────────────────── */
  console.log(`\n── 5. Stores with zero offers ────────────────────`);
  const offersStoreIds = await fetchAll<{ store_id: string }>(supa, "offers", "store_id", (q) => q);
  const usedStoreIds = new Set(offersStoreIds.map((r) => r.store_id));
  const emptyStores = storeRows.filter((s) => !usedStoreIds.has(s.id));
  console.log(`  stores in stores-table with zero offers: ${emptyStores.length} / ${storeRows.length}`);
  if (emptyStores.length > 0) {
    console.log(`    sample: ${emptyStores.slice(0, 10).map((s) => s.id).join(", ")}`);
  }

  /* 6. Title placeholders that escaped cleanProductTitle ──────────── */
  console.log(`\n── 6. Title placeholders that escaped ────────────`);
  /* Any product whose title still begins with "Generic " etc. means the
     cleanProductTitle didn't run (legacy ingest before the May 2026
     fix, or some path that bypasses ingestDeals). */
  const bad6 = await fetchAll<{ id: string; title: string }>(
    supa, "products", "id, title",
    (q) => q.or("title.ilike.Generic %,title.ilike.Unbranded %,title.ilike.No Brand %"),
  );
  console.log(`  products with leftover Generic/Unbranded/No Brand prefix: ${bad6.length}`);
  if (bad6.length > 0) {
    console.log(`    sample: ${bad6.slice(0, 5).map((p) => p.title.slice(0, 60)).join("\n              ")}`);
  }

  /* 7. Sentinel leaks ───────────────────────────────────────────── */
  console.log(`\n── 7. [BLOCKED:…] sentinel leaks ─────────────────`);
  const sentTitle = await count(supa, "products", (q) => q.ilike("title", "%[BLOCKED:%"));
  const sentStoreName = await count(supa, "stores", (q) => q.ilike("name", "%[BLOCKED:%"));
  const sentStoreId = await count(supa, "stores", (q) => q.ilike("id", "%[BLOCKED:%"));
  console.log(`  products.title with sentinel: ${sentTitle}`);
  console.log(`  stores.name with sentinel:    ${sentStoreName}`);
  console.log(`  stores.id with sentinel:      ${sentStoreId}`);

  /* 8. Duplicate title_key across DIFFERENT product ids ─────────── */
  console.log(`\n── 8. Duplicate title_key across products ────────`);
  const allProds = await fetchAll<{ id: string; title_key: string | null }>(
    supa, "products", "id, title_key", (q) => q,
  );
  const tkCount = new Map<string, number>();
  for (const p of allProds) {
    if (!p.title_key) continue;
    tkCount.set(p.title_key, (tkCount.get(p.title_key) ?? 0) + 1);
  }
  const dupes = Array.from(tkCount.entries()).filter(([, n]) => n > 1);
  const totalDupRows = dupes.reduce((acc, [, n]) => acc + n, 0);
  console.log(`  unique title_keys with > 1 product:  ${dupes.length}`);
  console.log(`  total redundant products from this:  ${totalDupRows - dupes.length}`);
  const noTitleKey = allProds.filter((p) => !p.title_key).length;
  console.log(`  products with NULL/empty title_key:  ${noTitleKey}`);
  if (dupes.length > 0) {
    const top = dupes.sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`    worst offenders: ${top.map(([k, n]) => `${k.slice(0, 30)}×${n}`).join(", ")}`);
  }

  /* 9. Offer integrity ──────────────────────────────────────────── */
  console.log(`\n── 9. Offer integrity ────────────────────────────`);
  const nullStore   = await count(supa, "offers", (q) => q.is("store_id", null));
  const nullProduct = await count(supa, "offers", (q) => q.is("product_id", null));
  const nullUrl     = await count(supa, "offers", (q) => q.or("url.is.null,url.eq."));
  console.log(`  offers with NULL store_id:   ${nullStore}`);
  console.log(`  offers with NULL product_id: ${nullProduct}`);
  console.log(`  offers with NULL/empty url:  ${nullUrl}`);

  /* 10. is_deal=true but price not real ────────────────────────── */
  console.log(`\n── 10. is_deal=true with broken price ────────────`);
  const badPrice = await count(supa, "offers", (q) =>
    q.eq("is_deal", true).or("current_price.is.null,current_price.eq.0,current_price.lt.0"),
  );
  console.log(`  is_deal=true AND price<=0 OR price IS NULL: ${badPrice}`);

  /* Extra: scraper provenance audit — what % of offers come from each provider? */
  console.log(`\n── 11. Offer provenance (in_stock=true) ──────────`);
  const provRows = await fetchAll<{ source_provider: string | null }>(
    supa, "offers", "source_provider", (q) => q.eq("in_stock", true),
  );
  const byProv = new Map<string, number>();
  for (const r of provRows) {
    const k = r.source_provider ?? "(null)";
    byProv.set(k, (byProv.get(k) ?? 0) + 1);
  }
  const provSorted = Array.from(byProv.entries()).sort((a, b) => b[1] - a[1]);
  for (const [prov, n] of provSorted) {
    console.log(`  ${prov.padEnd(35)} ${pad(n)}  (${(n / provRows.length * 100).toFixed(1)}%)`);
  }

  console.log(`\n──────────────────────────────────────────────────\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
