/* compute-store-counts.ts
   ---------------------------------------------------------------------------
   Refreshes the `store_filter_counts` table (migration 0089) with the TRUE
   per-country, per-category, per-store reachable counts that power the /deals
   "Stores" dropdown. Run by the compute-category-counts GitHub Action once per
   ingest cycle — NOT at request time.

   WHY this exists (June 2026): the dropdown chip must equal what the grid
   shows when you tick a store. A live count can't match cheaply — the grid
   de-duplicates variants, and the broad capped pool gives only a tier-
   dependent slice (which produced "1 product in All, 4 in Deals" for a tiny
   store). Counting per store is cheap to do OFFLINE, so we precompute it here.

   Sibling of compute-category-counts.ts and deliberately just as GENTLE on the
   DB: ONE sequential scan of product_best_offers, off the request path. It
   reuses that script's exact load + country-filter + is_real_deal predicate so
   the store counts agree with the category tiles and origin pills.

   Usage:
     npx tsx scripts/compute-store-counts.ts            # compute + UPSERT
     npx tsx scripts/compute-store-counts.ts --dry-run  # compute + print only
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
import { displayStoreName } from "../src/lib/store-display";

const DRY_RUN = process.argv.includes("--dry-run");

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

/* ONE sequential pass — identical to compute-category-counts.loadAllSlim so
   the two precomputes scan the same rows and never disagree. */
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
  isRealDeal: (d.discountPercent ?? 0) > 0,
}));

type Deal = ReturnType<typeof toDeal>;

interface StoreCountRow {
  country: string;
  category_slug: string;
  store_key: string;
  store_name: string;
  is_local: boolean;
  all_count: number;
  deals_count: number;
}

/* Group reachable deals by CANONICAL store (lower(displayStoreName)) — the
   exact key /api/deals matches the ticked store on, so seller/marketplace
   variants (eBay sellers, Walmart-*, Amazon-*) collapse into one entry whose
   count equals what ticking it shows. */
function groupByStore(country: string, slug: string, deals: Deal[]): StoreCountRow[] {
  const m = new Map<string, StoreCountRow>();
  for (const d of deals) {
    const name = displayStoreName(d.storeName);
    const key = name.toLowerCase();
    let e = m.get(key);
    if (!e) {
      e = {
        country, category_slug: slug, store_key: key, store_name: name,
        is_local: isDealLocalToCountry(d, getCountry(country)),
        all_count: 0, deals_count: 0,
      };
      m.set(key, e);
    }
    e.all_count++;
    if (d.isRealDeal) e.deals_count++;
  }
  return Array.from(m.values());
}

async function main() {
  const t0 = Date.now();
  const slim = await loadAllSlim();
  const allDeals: Deal[] = [...slim.map(toDeal), ...CURATED];
  console.log(`loaded ${slim.length} offers (+${CURATED.length} curated) in ${Date.now() - t0}ms`);

  const browsable = categories.filter((c) => c.slug !== "all" && !c.hidden);
  const rows: StoreCountRow[] = [];

  for (const c of ACTIVE_COUNTRIES) {
    const country = getCountry(c.code);
    const reachable = filterDealsForCountry(allDeals, country) as Deal[];
    rows.push(...groupByStore(c.code, "all", reachable));
    for (const cat of browsable) {
      const inCat = reachable.filter((d) => d.categorySlug === cat.slug);
      if (inCat.length) rows.push(...groupByStore(c.code, cat.slug, inCat));
    }
    const nStores = new Set(rows.filter((r) => r.country === c.code && r.category_slug === "all").map((r) => r.store_key)).size;
    console.log(`  ${c.code}: ${reachable.length} reachable across ${nStores} stores`);
  }

  if (DRY_RUN) {
    console.log(`\n[dry-run] computed ${rows.length} rows, NOT writing. Samples:`);
    const pick = (cc: string, key: string) => rows.find((r) => r.country === cc && r.category_slug === "all" && r.store_key === key);
    console.log("  ng/fouani:", pick("ng", "fouani"));
    console.log("  uk/shein:",  pick("uk", "shein"));
    console.log("  uk/asos:",   pick("uk", "asos"));
    return;
  }

  /* Stale-row sweep first: a store that drops to zero in a category must not
     keep a phantom row from a previous run. Replace the whole table contents
     (it is small, single-writer, and read with a staleness guard). */
  const stamp = new Date().toISOString();
  const payload = rows.map((r) => ({ ...r, updated_at: stamp }));
  /* Chunked upsert (PostgREST caps payload size); ~2-3k rows total. */
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supa
      .from("store_filter_counts")
      .upsert(payload.slice(i, i + 500), { onConflict: "country,category_slug,store_key" });
    if (error) throw new Error(`upsert chunk ${i}: ${error.message}`);
  }
  /* Drop rows older than this run's stamp (stores/categories that vanished). */
  const { error: delErr } = await supa
    .from("store_filter_counts")
    .delete()
    .lt("updated_at", stamp);
  if (delErr) throw new Error(`prune: ${delErr.message}`);
  console.log(`\nUPSERTed ${payload.length} rows into store_filter_counts.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("compute-store-counts FAILED:", e.message);
    process.exit(1);
  });
