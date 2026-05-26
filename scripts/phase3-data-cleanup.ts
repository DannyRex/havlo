/* Phase 3 ingest-integrity one-shot cleanup.

   Five passes, each idempotent and safety-gated:

     A. Backfill stores.country for the 68 "AGREE" stores — those where
        ≥80% of their in_stock offers agree on a single source_country.
        These are NULL because an early ingest had no country signal;
        their offers DID record source_country correctly. Lights them
        up on local-tab filters (B&H Photo on /us, Holland & Barrett
        on /uk, BigBasket on /in, Trendyol on /ae, Boohoo on /uk, etc.)

     B. Flip the 57 stale in_stock offers (last_seen_at < 30d, in_stock
        true) — the TTL sweep only runs when a store is touched, so
        stores nothing's actively ingesting accumulate stale rows.
        These are now stale enough that we hide them from /deals.

     C. Delete 19 orphan products (no offer points at them). They're
        invisible to every surface anyway; cleanup keeps catalog
        counts honest.

     D. Delete 378 zero-offer stores. Pure dead weight — they show
        up nowhere (dropdown RPCs filter to stores with offers).
        Safe because no FK violations: no offers reference them.

   Pass --apply to write changes. Default is dry-run (counts only).

   Run after deploying the ingest writer fix so new ingests don't
   recreate the gaps. */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { isGlobalIntlStore } from "../src/lib/country";

const APPLY = process.argv.includes("--apply");

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

  console.log(APPLY ? "▶ APPLY mode — will write" : "● DRY RUN — pass --apply to write");
  console.log();

  /* ── A. Country backfill ──────────────────────────────────────── */
  console.log("== A. Backfill stores.country from offers.source_country (AGREE ≥80%) ==");
  const nullStores = await fetchPaged<{ id: string; name: string }>(
    supa, "stores", "id, name", (q) => q.is("country", null),
  );
  const nullStoreIds = new Set(nullStores.map((s) => s.id));
  const offers = await fetchPaged<{ store_id: string; source_country: string | null }>(
    supa, "offers", "store_id, source_country", (q) => q.eq("in_stock", true),
  );

  type Bucket = { total: number; bySC: Map<string, number> };
  const perStore = new Map<string, Bucket>();
  for (const o of offers) {
    if (!nullStoreIds.has(o.store_id)) continue;
    let b = perStore.get(o.store_id);
    if (!b) { b = { total: 0, bySC: new Map() }; perStore.set(o.store_id, b); }
    b.total++;
    const sc = o.source_country ?? "(null)";
    b.bySC.set(sc, (b.bySC.get(sc) ?? 0) + 1);
  }

  /* Bucket the AGREE stores by target country so we can do one UPDATE
     per country instead of one per store. forEach iteration to keep
     es2017 happy without downlevelIteration. */
  const storeIndex = new Map(nullStores.map((s) => [s.id, s] as const));
  const byCountry = new Map<string, string[]>();
  const skippedGlobal: string[] = [];
  perStore.forEach((b, storeId) => {
    let topSc: string | null = null;
    let topN = 0;
    b.bySC.forEach((n, sc) => {
      if (sc === "(null)") return;
      if (n > topN) { topN = n; topSc = sc; }
    });
    /* AGREE = ≥80% of offers point at one source_country */
    if (topSc && topN / b.total >= 0.8) {
      /* Safety guard: never tag a known global cross-border retailer
         (Shein, AliExpress, Trendyol, Temu, etc.) — even if 80%+ of
         its offers came from one country, the store legitimately
         serves multiple markets and country=NULL is the correct
         semantic. The probe found shein and trendyol both landing
         in the AGREE bucket because Americans search Shein the most
         and most Trendyol queries used ae as their suffix — both
         would be wrong tags. */
      const s = storeIndex.get(storeId);
      if (s && isGlobalIntlStore(s.id, s.name)) {
        skippedGlobal.push(storeId);
        return;
      }
      const cc = topSc.toUpperCase();
      if (!/^(NG|UK|US|DE|AE|IN|ZA)$/.test(cc)) return;
      if (!byCountry.has(cc)) byCountry.set(cc, []);
      byCountry.get(cc)!.push(storeId);
    }
  });
  if (skippedGlobal.length > 0) {
    console.log(`  (skipped ${skippedGlobal.length} global stores: ${skippedGlobal.join(", ")})`);
  }

  let backfilled = 0;
  const buckets: Array<[string, string[]]> = [];
  byCountry.forEach((ids, cc) => buckets.push([cc, ids]));
  for (const [cc, ids] of buckets) {
    console.log(`  ${cc}: ${ids.length} stores  (${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", …" : ""})`);
    if (!APPLY) { backfilled += ids.length; continue; }
    /* Same `country IS NULL` guard as the new ingest writer's Pass B:
       we only fill blanks, never overwrite a value someone else may
       have set since the probe ran. */
    const { error } = await supa.from("stores").update({ country: cc })
      .in("id", ids).is("country", null);
    if (error) { console.warn(`    ! ${cc}: ${error.message}`); }
    else { backfilled += ids.length; }
  }
  console.log(`  → ${APPLY ? "backfilled" : "would backfill"}: ${backfilled} stores`);
  console.log();

  /* ── B. Stale in_stock sweep (whole catalog) ──────────────────── */
  console.log("== B. Flip stale in_stock offers (last_seen_at < 30d) ==");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const staleRows = await fetchPaged<{ id: string; store_id: string }>(
    supa, "offers", "id, store_id",
    (q) => q.eq("in_stock", true).lt("last_seen_at", thirtyDaysAgo),
  );
  console.log(`  candidates: ${staleRows.length}`);
  /* Per-store breakdown for visibility */
  const stalePerStore = new Map<string, number>();
  for (const r of staleRows) stalePerStore.set(r.store_id, (stalePerStore.get(r.store_id) ?? 0) + 1);
  const topStale = Array.from(stalePerStore.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [sid, n] of topStale) console.log(`    ${sid}: ${n}`);

  if (APPLY && staleRows.length > 0) {
    /* Batch update by id list. PostgREST .in() copes with thousands
       of ids in one go but we slice to be safe. */
    const ids = staleRows.map((r) => r.id);
    const CHUNK = 500;
    let flipped = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error } = await supa.from("offers").update({ in_stock: false }).in("id", slice);
      if (error) console.warn(`    ! flip chunk ${i}: ${error.message}`);
      else flipped += slice.length;
    }
    console.log(`  → flipped: ${flipped}`);
  } else if (!APPLY) {
    console.log(`  → would flip: ${staleRows.length}`);
  }
  console.log();

  /* ── C. Orphan products ───────────────────────────────────────── */
  console.log("== C. Delete orphan products (no offer points at them) ==");
  const allProds = await fetchPaged<{ id: string }>(supa, "products", "id", (q) => q);
  const offerProdIds = await fetchPaged<{ product_id: string }>(supa, "offers", "product_id", (q) => q);
  const used = new Set(offerProdIds.map((r) => r.product_id));
  const orphanIds = allProds.filter((p) => !used.has(p.id)).map((p) => p.id);
  console.log(`  orphan products: ${orphanIds.length}`);
  if (APPLY && orphanIds.length > 0) {
    const CHUNK = 500;
    let deleted = 0;
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      const slice = orphanIds.slice(i, i + CHUNK);
      const { error } = await supa.from("products").delete().in("id", slice);
      if (error) console.warn(`    ! delete chunk ${i}: ${error.message}`);
      else deleted += slice.length;
    }
    console.log(`  → deleted: ${deleted}`);
  } else if (!APPLY) {
    console.log(`  → would delete: ${orphanIds.length}`);
  }
  console.log();

  /* ── D. Empty stores ──────────────────────────────────────────── */
  console.log("== D. Delete stores with zero offers ==");
  const allStores = await fetchPaged<{ id: string }>(supa, "stores", "id", (q) => q);
  const offerStoreIds = await fetchPaged<{ store_id: string }>(supa, "offers", "store_id", (q) => q);
  const usedStores = new Set(offerStoreIds.map((r) => r.store_id));
  const emptyIds = allStores.filter((s) => !usedStores.has(s.id)).map((s) => s.id);
  console.log(`  empty stores: ${emptyIds.length}`);
  if (APPLY && emptyIds.length > 0) {
    const CHUNK = 500;
    let deleted = 0;
    for (let i = 0; i < emptyIds.length; i += CHUNK) {
      const slice = emptyIds.slice(i, i + CHUNK);
      const { error } = await supa.from("stores").delete().in("id", slice);
      if (error) console.warn(`    ! delete chunk ${i}: ${error.message}`);
      else deleted += slice.length;
    }
    console.log(`  → deleted: ${deleted}`);
  } else if (!APPLY) {
    console.log(`  → would delete: ${emptyIds.length}`);
  }
  console.log();

  console.log(APPLY ? "✓ done" : "● dry run complete — pass --apply to write");
}

main().catch((e) => { console.error(e); process.exit(1); });
