#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   ORPHAN PRODUCTS — surfaces the bucket-A products (in `products`
   table with no row in `offers`). These can't render a PDP because
   the page query needs at least one offer for store_name +
   anchorPriceNgn. So they're dead weight in the catalog: SEO surface
   that 404s on click-through, ingest noise during dedup, search index
   bloat.

   What this script does NOT do: delete anything. Read-only. Outputs:
     - Console summary (counts, age + activity histograms, top
       category / brand offenders)
     - CSV at outputs/orphan-products-YYYY-MM-DD.csv with one row
       per orphan: id, title, brand, category, created_at, updated_at,
       days_since_created, days_since_updated, image_url. Open in a
       sheet to filter / sort / decide on cleanup.

   Why no "last-known offer date" column: offer_price_history rows
   reference offers via ON DELETE CASCADE, so any history that
   existed when the offer was deleted is also gone. The only surviving
   signal is products.updated_at (most recent write of any kind to
   the product row itself) — captured as `days_since_updated`. Old
   `updated_at` ≈ "hasn't been touched by ingest in a while", so
   probably safe to drop. Recent `updated_at` with no offers means
   either ingest is upserting product rows without surviving offers
   (FK-then-deduped path) or there's a real bug to chase.

   Cleanup pattern (NOT run by this script — paste into Supabase SQL
   editor manually after reviewing the CSV):
     delete from products p
     where not exists (select 1 from offers o where o.product_id = p.id)
       and p.updated_at < now() - interval '14 days';
   The 14-day floor protects products that were just upserted by a
   running ingest whose offer-write half hasn't landed yet. */

try {
  // @ts-expect-error — process.loadEnvFile is Node-runtime
  process.loadEnvFile?.(".env.local");
} catch { /* noop */ }

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Product {
  id:         string;
  title:      string;
  brand:      string | null;
  category:   string | null;
  image_url:  string | null;
  created_at: string;
  updated_at: string;
}

async function pageAll<T>(
  fetcher: (offset: number, limit: number) => Promise<T[]>,
  label: string,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const batch = await fetcher(offset, pageSize);
    out.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset % 10000 === 0) process.stderr.write(`  …${label} scanned ${offset.toLocaleString()}\n`);
  }
  return out;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function bucketAge(days: number): string {
  if (days <= 1)   return "≤ 1 day";
  if (days <= 7)   return "≤ 1 week";
  if (days <= 30)  return "≤ 1 month";
  if (days <= 90)  return "≤ 3 months";
  if (days <= 180) return "≤ 6 months";
  return "> 6 months";
}

async function main() {
  process.stderr.write("Loading all products…\n");
  const products = await pageAll<Product>(
    async (off, lim) => {
      const { data, error } = await supa
        .from("products")
        .select("id, title, brand, category, image_url, created_at, updated_at")
        .range(off, off + lim - 1);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    "products",
  );

  process.stderr.write("Loading offer→product mapping…\n");
  const offers = await pageAll<{ product_id: string }>(
    async (off, lim) => {
      const { data, error } = await supa
        .from("offers")
        .select("product_id")
        .range(off, off + lim - 1);
      if (error) throw error;
      return (data ?? []) as Array<{ product_id: string }>;
    },
    "offers",
  );
  const productsWithOffer = new Set(offers.map((o) => o.product_id));

  /* Filter to orphans. */
  const orphans = products.filter((p) => !productsWithOffer.has(p.id));
  const now = new Date();

  /* Stats. */
  const ageHist     = new Map<string, number>();
  const updateHist  = new Map<string, number>();
  const categoryHist = new Map<string, number>();
  const brandHist    = new Map<string, number>();
  for (const p of orphans) {
    const ageDays    = daysBetween(now, new Date(p.created_at));
    const updateDays = daysBetween(now, new Date(p.updated_at));
    ageHist.set(bucketAge(ageDays),       (ageHist.get(bucketAge(ageDays)) ?? 0) + 1);
    updateHist.set(bucketAge(updateDays), (updateHist.get(bucketAge(updateDays)) ?? 0) + 1);
    if (p.category) categoryHist.set(p.category, (categoryHist.get(p.category) ?? 0) + 1);
    if (p.brand)    brandHist.set(p.brand,       (brandHist.get(p.brand)       ?? 0) + 1);
  }

  const orderedAges = ["≤ 1 day", "≤ 1 week", "≤ 1 month", "≤ 3 months", "≤ 6 months", "> 6 months"];

  /* Sort orphans by created_at DESC for the CSV. */
  const sortedOrphans = [...orphans].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  /* Output. */
  const total = products.length;
  const orphanCount = orphans.length;
  const pct = (n: number, of: number) => of > 0 ? `${((n / of) * 100).toFixed(1)}%` : "—";

  console.log("");
  console.log("Havlo · orphan products (no offers) cleanup audit");
  console.log("─".repeat(60));
  console.log(`Total products:                              ${total.toLocaleString()}`);
  console.log(`Orphan products (no offers):                 ${orphanCount.toLocaleString()}   (${pct(orphanCount, total)})`);
  console.log("");

  console.log("Distribution by created_at age:");
  for (const k of orderedAges) {
    const v = ageHist.get(k) ?? 0;
    if (v === 0) continue;
    console.log(`  created ${k.padEnd(14)} ${v.toLocaleString().padStart(7)}   (${pct(v, orphanCount)})`);
  }
  console.log("");

  console.log("Distribution by updated_at age (recency of last write):");
  for (const k of orderedAges) {
    const v = updateHist.get(k) ?? 0;
    if (v === 0) continue;
    console.log(`  updated ${k.padEnd(14)} ${v.toLocaleString().padStart(7)}   (${pct(v, orphanCount)})`);
  }
  console.log("");

  console.log("Top 8 categories among orphans:");
  const topCategories = [...categoryHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [cat, n] of topCategories) {
    console.log(`  ${cat.padEnd(40)} ${n.toLocaleString().padStart(7)}   (${pct(n, orphanCount)})`);
  }
  console.log("");

  console.log("Top 8 brands among orphans:");
  const topBrands = [...brandHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [brand, n] of topBrands) {
    console.log(`  ${brand.padEnd(40)} ${n.toLocaleString().padStart(7)}   (${pct(n, orphanCount)})`);
  }
  console.log("");

  /* CSV export. */
  const outDir = join(process.cwd(), "outputs");
  try { mkdirSync(outDir, { recursive: true }); } catch { /* exists */ }
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = join(outDir, `orphan-products-${stamp}.csv`);

  const csvHeader = "id,title,brand,category,created_at,updated_at,days_since_created,days_since_updated,image_url";
  const csvRows: string[] = [csvHeader];
  for (const p of sortedOrphans) {
    const ageDays    = daysBetween(now, new Date(p.created_at));
    const updateDays = daysBetween(now, new Date(p.updated_at));
    /* CSV-safe escape: double-quotes, embedded commas and quotes */
    const esc = (s: string | null) => {
      if (s == null) return "";
      const safe = s.replace(/"/g, '""');
      return `"${safe}"`;
    };
    csvRows.push([
      p.id,
      esc(p.title),
      esc(p.brand),
      esc(p.category),
      p.created_at,
      p.updated_at,
      String(ageDays),
      String(updateDays),
      esc(p.image_url),
    ].join(","));
  }
  writeFileSync(csvPath, csvRows.join("\n") + "\n", "utf8");

  console.log(`CSV exported: ${csvPath}`);
  console.log(`  → open in a sheet, filter on days_since_updated > 14`);
  console.log(`  → confident drops can be DELETEd via Supabase SQL editor:`);
  console.log("");
  console.log("    delete from products p");
  console.log("    where not exists (select 1 from offers o where o.product_id = p.id)");
  console.log("      and p.updated_at < now() - interval '14 days';");
  console.log("");
  console.log("    -- products.id is referenced by offers.product_id ON DELETE CASCADE,");
  console.log("    -- so the orphans go cleanly without leaving any FK debris behind.");
  console.log("");
}

main().catch((e) => {
  console.error("audit failed:", e);
  process.exit(1);
});
