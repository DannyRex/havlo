/* One-shot cleanup of existing offer URLs to match the new
   canonicaliseOfferUrl ingest rule.

   Strategy (per store, to keep the working set bounded):
     1. Fetch all offers for the store.
     2. For each row, compute canonical_url = canonicaliseOfferUrl(url).
     3. Group rows by (store_id, canonical_url).
     4. For groups with >1 row, keep the freshest (by last_seen_at)
        and delete the rest. This is necessary because the URL column
        has a uniqueness constraint with store_id; updating raw → canonical
        would error if a row with the canonical form already exists.
     5. For surviving rows whose raw URL differs from canonical, UPDATE
        the url column.

   Default scope: every store. Pass --store=<id> to scope.
   Pass --apply to write. Default is dry-run. */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { canonicaliseOfferUrl } from "../src/lib/url-helpers";

const APPLY = process.argv.includes("--apply");
const STORE = (() => {
  const a = process.argv.find((s) => s.startsWith("--store="));
  return a ? a.slice("--store=".length) : null;
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

interface OfferRow {
  id: string;
  store_id: string;
  url: string;
  last_seen_at: string;
  scraped_at: string;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  console.log(`${APPLY ? "▶ APPLY" : "● DRY RUN"} — scope: ${STORE ?? "ALL STORES"}`);
  console.log();

  const offers = await fetchPaged<OfferRow>(
    supa, "offers", "id, store_id, url, last_seen_at, scraped_at",
    (q) => STORE ? q.eq("store_id", STORE) : q,
  );
  console.log(`fetched ${offers.length} offers`);

  /* For each row, compute canonical. Bucket by (store_id, canonical). */
  type Bucket = { canonical: string; rows: OfferRow[]; hadDiff: boolean };
  const groups = new Map<string, Bucket>();
  for (const o of offers) {
    const canonical = canonicaliseOfferUrl(o.url);
    const key = `${o.store_id}|${canonical}`;
    let g = groups.get(key);
    if (!g) { g = { canonical, rows: [], hadDiff: false }; groups.set(key, g); }
    g.rows.push(o);
    if (canonical !== o.url) g.hadDiff = true;
  }

  /* Statistics */
  let pairsCollapsing = 0;
  let rowsToDelete = 0;
  let rowsToUpdate = 0;
  groups.forEach((g) => {
    if (g.rows.length > 1) {
      pairsCollapsing++;
      rowsToDelete += g.rows.length - 1;
    }
    if (g.hadDiff) {
      /* At least the surviving row needs the URL column updated. */
      rowsToUpdate++;
    }
  });
  console.log(`(store_id, canonical_url) groups that collapse from multiple raw URLs: ${pairsCollapsing}`);
  console.log(`offers to delete (collapsed dupes): ${rowsToDelete}`);
  console.log(`offers to UPDATE url column (raw → canonical): ${rowsToUpdate}`);
  console.log();

  /* Per-store breakdown of impact */
  const perStore = new Map<string, { collapse: number; del: number; upd: number }>();
  groups.forEach((g) => {
    /* Pick a representative store_id from the first row */
    const sid = g.rows[0].store_id;
    let s = perStore.get(sid);
    if (!s) { s = { collapse: 0, del: 0, upd: 0 }; perStore.set(sid, s); }
    if (g.rows.length > 1) { s.collapse++; s.del += g.rows.length - 1; }
    if (g.hadDiff) s.upd++;
  });
  const topImpact: Array<{ sid: string; del: number; upd: number; collapse: number }> = [];
  perStore.forEach((v, sid) => topImpact.push({ sid, ...v }));
  topImpact.sort((a, b) => (b.del + b.upd) - (a.del + a.upd));
  console.log("top-impacted stores:");
  for (const t of topImpact.slice(0, 10)) {
    console.log(`  ${t.sid.padEnd(25)} collapse=${t.collapse} del=${t.del} upd=${t.upd}`);
  }

  if (!APPLY) {
    console.log("\n● dry run — pass --apply to write");
    return;
  }

  /* Apply: delete collapsed dupes (keep freshest), then update URLs. */
  const toDelete: string[] = [];
  const toUpdate: Array<{ id: string; canonical: string }> = [];
  groups.forEach((g) => {
    if (g.rows.length > 1) {
      /* Keep the freshest, schedule rest for delete */
      g.rows.sort((a, b) => {
        const ls = b.last_seen_at.localeCompare(a.last_seen_at);
        if (ls !== 0) return ls;
        return b.scraped_at.localeCompare(a.scraped_at);
      });
      const keeper = g.rows[0];
      for (let i = 1; i < g.rows.length; i++) toDelete.push(g.rows[i].id);
      if (keeper.url !== g.canonical) toUpdate.push({ id: keeper.id, canonical: g.canonical });
    } else {
      const r = g.rows[0];
      if (r.url !== g.canonical) toUpdate.push({ id: r.id, canonical: g.canonical });
    }
  });

  const CHUNK = 500;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const slice = toDelete.slice(i, i + CHUNK);
    const { error } = await supa.from("offers").delete().in("id", slice);
    if (error) console.warn(`  ! delete chunk ${i}: ${error.message}`);
    else deleted += slice.length;
  }
  console.log(`\n✓ deleted ${deleted} collapsed-dupe rows`);

  /* Updates one-by-one because each row's canonical value differs.
     The supabase-js API doesn't support per-row batched UPDATE in a
     single statement, but we can run in parallel with rate-limit. */
  let updated = 0;
  const BATCH = 20;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const slice = toUpdate.slice(i, i + BATCH);
    await Promise.all(slice.map(async ({ id, canonical }) => {
      const { error } = await supa.from("offers").update({ url: canonical }).eq("id", id);
      if (!error) updated++;
    }));
  }
  console.log(`✓ updated ${updated} URLs to canonical form`);
}

main().catch((e) => { console.error(e); process.exit(1); });
