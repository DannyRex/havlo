#!/usr/bin/env tsx
/* One-off backfill for the May 2026 catalog-visibility fix.

   Companion to:
     - src/lib/providers/ingestion.ts (is_deal semantic relaxation
       + cleanProductTitle + honest original_price = null for
       no-markdown rows)

   This script reconciles existing rows with the new ingest semantic:

     1. is_deal backfill. The old logic set is_deal=true only when
        discount > 0, which hid 7,632 in-stock offers (~38% of the
        catalog) from /deals and the store filter dropdown. Flip
        them all to is_deal=true so they're visible immediately
        without waiting for the next scrape cron to upsert them.

     2. Product title cleanup. Strip "Generic ", "Unbranded ",
        "No Brand " prefixes from existing products.title rows so
        the catalog matches what new ingests will produce. ~24
        Jumia rows + scattered Walmart / Amazon UK / Ubuy /
        Ninja UAE rows.

     3. Honest original_price + discount_percent. Where existing
        rows have original_price === current_price (no real
        markdown) flip both original_price and discount_percent to
        NULL so the discount-badge renderer stops being prompted.

   Defaults to DRY RUN — pass --apply to actually mutate.

   Usage:
     # See what would change:
     npx tsx --tsconfig tsconfig.scripts.json scripts/maint/backfill-is-deal-and-titles.ts

     # Apply changes:
     npx tsx --tsconfig tsconfig.scripts.json scripts/maint/backfill-is-deal-and-titles.ts --apply
*/

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { getSupabaseAdmin } from "../../src/lib/providers/db-client";

interface Args { apply: boolean }
function parseArgs(): Args {
  const args: Args = { apply: false };
  for (const a of process.argv.slice(2)) if (a === "--apply") args.apply = true;
  return args;
}

const TITLE_PLACEHOLDER_BRANDS = /^(generic|unbranded|no\s*brand)\s*[-:|]?\s*/i;
function cleanProductTitle(raw: string): string {
  let t = raw.trim();
  for (let i = 0; i < 3; i++) {
    const next = t.replace(TITLE_PLACEHOLDER_BRANDS, "").trim();
    if (next === t) break;
    t = next;
  }
  return t.replace(/\s{2,}/g, " ");
}

async function fetchAllPages<T>(supa: any, table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supa.from(table).select(cols).range(from, from + PAGE - 1);
    if (error) { console.error(`page ${from} ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function step1_isDealBackfill(supa: any, apply: boolean) {
  console.log(`\n── 1. is_deal backfill (in-stock + has price → is_deal=true) ──`);
  const { count: needs } = await supa
    .from("offers").select("*", { count: "exact", head: true })
    .eq("is_deal", false).eq("in_stock", true).gt("current_price", 0);
  console.log(`  ${needs ?? 0} in-stock offers currently is_deal=false (would flip to true)`);
  if (!apply || !needs) return;

  /* Batch by id-chunk. A naive single UPDATE blows past Supabase's
     8s statement timeout (Step 1 of the May 2026 backfill failed
     this way at 7,632 rows). Page id-lists in batches of 500,
     update each batch by id-IN. Each batch comfortably finishes
     under the timeout. */
  const PAGE = 500;
  let totalOk = 0, totalFail = 0;
  while (true) {
    /* Re-query the next batch each loop (rather than paging through
       a stable id list) so we don't update the same row twice if a
       concurrent ingest writes between batches. The WHERE clause on
       (is_deal=false AND in_stock=true) self-shrinks as we update. */
    const { data: batch, error: selErr } = await supa
      .from("offers").select("id")
      .eq("is_deal", false).eq("in_stock", true).gt("current_price", 0)
      .limit(PAGE);
    if (selErr) { console.log(`  ✗ select: ${selErr.message}`); break; }
    if (!batch || batch.length === 0) break;
    const ids = (batch as Array<{ id: string }>).map((r) => r.id);
    const { error: updErr } = await supa
      .from("offers").update({ is_deal: true }).in("id", ids);
    if (updErr) {
      console.log(`  ✗ batch ${totalOk / PAGE + 1}: ${updErr.message}`);
      totalFail += ids.length;
      break;
    }
    totalOk += ids.length;
    if (totalOk % 1000 === 0) console.log(`    progress: ${totalOk} / ${needs ?? "?"}`);
  }
  console.log(`  ${totalFail === 0 ? "✓" : "⚠"} flipped ${totalOk} to is_deal=true${totalFail > 0 ? `, ${totalFail} failed` : ""}`);
}

async function step2_titleCleanup(supa: any, apply: boolean) {
  console.log(`\n── 2. Product title cleanup (strip Generic / Unbranded / No Brand) ──`);
  const products = await fetchAllPages<{ id: string; title: string }>(supa, "products", "id, title");
  const candidates: Array<{ id: string; before: string; after: string }> = [];
  for (const p of products) {
    const cleaned = cleanProductTitle(p.title);
    if (cleaned !== p.title && cleaned.length >= 3) {
      candidates.push({ id: p.id, before: p.title, after: cleaned });
    }
  }
  console.log(`  ${candidates.length} product titles would be cleaned`);
  for (const c of candidates.slice(0, 10)) {
    console.log(`    "${c.before.slice(0, 60)}"  →  "${c.after.slice(0, 60)}"`);
  }
  if (candidates.length > 10) console.log(`    ... and ${candidates.length - 10} more`);
  if (!apply || candidates.length === 0) return;

  let ok = 0, fail = 0;
  /* One UPDATE per row — cleanest mapping from id → new title.
     Volume is tiny (~30 rows). */
  for (const c of candidates) {
    const { error } = await supa.from("products").update({ title: c.after }).eq("id", c.id);
    if (error) { console.log(`    ✗ ${c.id}: ${error.message}`); fail++; } else { ok++; }
  }
  console.log(`  ✓ updated ${ok}, ✗ ${fail}`);
}

async function step3_honestMarkdownNulls(supa: any, apply: boolean) {
  console.log(`\n── 3. NULL original_price + discount where there's no real markdown ──`);
  /* Rows where original_price equals current_price (or is below it)
     were dishonest claims. Set both original_price and
     discount_percent to NULL so the badge renderer correctly shows
     "no markdown known" instead of a fake "0% off". */
  const offers = await fetchAllPages<{ id: string; current_price: number; original_price: number | null; discount_percent: number | null }>(
    supa, "offers", "id, current_price, original_price, discount_percent",
  );
  const candidates = offers.filter((o) =>
    o.original_price !== null && o.original_price <= o.current_price,
  );
  console.log(`  ${candidates.length} offers with original_price <= current_price (no real markdown)`);
  if (!apply || candidates.length === 0) return;

  /* Batch update via .in("id", chunkIds) for efficiency. PostgREST
     caps URL length; 500 ids per chunk is safe. */
  let ok = 0, fail = 0;
  const CHUNK = 500;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const ids = candidates.slice(i, i + CHUNK).map((c) => c.id);
    const { error } = await supa
      .from("offers").update({ original_price: null, discount_percent: null })
      .in("id", ids);
    if (error) { console.log(`  ✗ batch ${i / CHUNK + 1}: ${error.message}`); fail += ids.length; } else { ok += ids.length; }
  }
  console.log(`  ✓ nulled ${ok}, ✗ ${fail}`);
}

async function main() {
  const args = parseArgs();
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no Supabase admin client"); process.exit(1); }
  console.log(`▶ Catalog backfill (May 2026 visibility fix)`);
  console.log(`  mode: ${args.apply ? "APPLY" : "DRY RUN (use --apply to mutate)"}`);
  await step1_isDealBackfill(supa, args.apply);
  await step2_titleCleanup(supa, args.apply);
  await step3_honestMarkdownNulls(supa, args.apply);
  console.log(`\n${args.apply ? "✓ Done." : "Dry run complete. Re-run with --apply to mutate."}\n`);
}
main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
