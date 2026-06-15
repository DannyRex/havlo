/* compute-category-counts.ts
   ---------------------------------------------------------------------------
   Refreshes the `category_reach_counts` table (migration 0071) with the TRUE
   per-country, per-category reachable deal counts. Run by the
   compute-category-counts GitHub Action once per ingest cycle — NOT at request
   time. This is the offline half of the June-2026 counts fix: the homepage
   tiles + /deals pills read the tiny precomputed table instead of scanning the
   whole product_best_offers view on every request (which overloaded the DB
   pool in production).

   Deliberately GENTLE on the DB: ONE sequential pass (no parallel fan-out),
   once per run. That is the opposite of the request-time scan that caused the
   incident — a single sequential ~10-page read by a scheduled job is trivial
   load.

   Usage:
     npx tsx scripts/compute-category-counts.ts            # compute + UPSERT
     npx tsx scripts/compute-category-counts.ts --dry-run  # compute + print only
*/
import { createClient } from "@supabase/supabase-js";
import {
  filterDealsForCountry,
  isDealLocalToCountry,
  getCountry,
  ACTIVE_COUNTRIES,
  type Country,
} from "../src/lib/country";
import { curatedAmazonDeals } from "../src/lib/data/curated-amazon";
import { categories } from "../src/lib/data/categories";

const DRY_RUN = process.argv.includes("--dry-run");

/* Local runs read .env.local; in CI the env is injected by the workflow and
   this file is absent (loadEnvFile throws → harmless no-op). */
try { (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local"); } catch { /* CI: env from workflow */ }

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env");
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SUPABASE_KEY);

const SLIM_COLS =
  "store_id,store_name,store_country,currency,category_slug,discount_percent,is_international,is_real_deal";
const PAGE = 1000;

interface SlimRow {
  store_id: string;
  store_name: string;
  store_country: string | null;
  currency: string;
  category_slug: string | null;
  discount_percent: number | null;
  is_international: boolean;
  is_real_deal: boolean | null;
}

/* ONE sequential pass — page by page, stop at the first short page. No
   parallelism: the whole point is to be kind to the DB. */
async function loadAllSlim(): Promise<SlimRow[]> {
  const rows: SlimRow[] = [];
  for (let page = 0; page < 64; page++) {
    const { data, error } = await supa
      .from("product_best_offers")
      .select(SLIM_COLS)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`slim page ${page}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as SlimRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

function toDeal(r: SlimRow) {
  return {
    storeId: r.store_id,
    storeName: r.store_name,
    storeCountry: r.store_country,
    currency: r.currency,
    tags: [r.store_name, r.is_international ? "intl" : "local"],
    categorySlug: r.category_slug ?? "all",
    discountPercent: r.discount_percent ?? 0,
    isRealDeal: r.is_real_deal ?? ((r.discount_percent ?? 0) > 0),
  };
}

const CURATED = curatedAmazonDeals.map((d) => ({
  storeId: d.storeId,
  storeName: d.storeName,
  storeCountry: d.storeCountry ?? null,
  currency: d.currency,
  tags: d.tags ?? [],
  categorySlug: d.categorySlug ?? "all",
  discountPercent: d.discountPercent ?? 0,
  /* Curated rows have no matview is_real_deal — keep the discount-only
     definition so they stay consistent with the live curated fallback. */
  isRealDeal: (d.discountPercent ?? 0) > 0,
}));

type Deal = ReturnType<typeof toDeal>;

interface CountRow {
  country: string;
  category_slug: string;
  all_count: number;
  local_count: number;
  intl_count: number;
  all_deals: number;
  local_deals: number;
  intl_deals: number;
}

function bucket(country: Country, slug: string, deals: Deal[]): CountRow {
  const local = deals.filter((d) => isDealLocalToCountry(d, country));
  const intl = deals.filter((d) => !isDealLocalToCountry(d, country));
  /* "deals" = is_real_deal (0083): a markdown OR cross-store-cheapest OR
     below-30d-high. The SAME predicate the live /api/deals pill + browse-db
     getOriginCounts use, so the precomputed tile == the live count. */
  const disc = (a: Deal[]) => a.filter((d) => d.isRealDeal).length;
  return {
    country: country.code,
    category_slug: slug,
    all_count: deals.length,
    local_count: local.length,
    intl_count: intl.length,
    all_deals: disc(deals),
    local_deals: disc(local),
    intl_deals: disc(intl),
  };
}

async function main() {
  const t0 = Date.now();
  const slim = await loadAllSlim();
  const allDeals: Deal[] = [...slim.map(toDeal), ...CURATED];
  console.log(`loaded ${slim.length} offers (+${CURATED.length} curated) in ${Date.now() - t0}ms`);

  const browsable = categories.filter((c) => c.slug !== "all" && !c.hidden);
  const rows: CountRow[] = [];

  for (const c of ACTIVE_COUNTRIES) {
    const country = getCountry(c.code);
    const reachable = filterDealsForCountry(allDeals, country) as Deal[];
    // all-categories aggregate (default /deals view)
    rows.push(bucket(country, "all", reachable));
    // per-category (tiles + filtered view)
    for (const cat of browsable) {
      const inCat = reachable.filter((d) => d.categorySlug === cat.slug);
      rows.push(bucket(country, cat.slug, inCat));
    }
    const fashion = rows.find((r) => r.country === c.code && r.category_slug === "fashion");
    console.log(`  ${c.code}: ${reachable.length} reachable | fashion=${fashion?.all_count ?? 0}`);
  }

  if (DRY_RUN) {
    console.log(`\n[dry-run] computed ${rows.length} rows, NOT writing. Sample:`);
    console.log(rows.slice(0, 3));
    return;
  }

  /* UPSERT in one call (≈66 rows). on_conflict on the PK. */
  const { error } = await supa
    .from("category_reach_counts")
    .upsert(
      rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: "country,category_slug" },
    );
  if (error) throw new Error(`upsert: ${error.message}`);
  console.log(`\nUPSERTed ${rows.length} rows into category_reach_counts.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("compute-category-counts FAILED:", e.message);
    process.exit(1);
  });
