#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   NG WooCommerce Store-API ingest orchestrator.

   The WooCommerce twin of ingest-ng-shopify.ts. Woo stores expose
   /wp-json/wc/store/v1/products — a public, no-auth, paginated JSON
   endpoint with the full structured catalog (prices in minor units,
   stock, images, categories, sale flags). No DOM scraping, no
   Playwright, no Cloudflare wall: a handful of HTTPS fetches per
   store.

   First tenant: Pointek (pointekonline.com) — major NG phones +
   electronics + appliances chain, ~510 SKUs. (The May 2026 Shopify
   probe wrote pointek off as "DNS / timeout" — it probed the dead
   pointek.com.ng domain; the live store is pointekonline.com and is
   WooCommerce, hence this path.)

   Cost: zero external API credits.

   Usage:
     npm run ingest:ng-woo                    # all configured stores
     npm run ingest:ng-woo -- --store=pointek --dry-run
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { ingestDeals } from "../src/lib/providers/ingestion.js";
import { getSupabaseAdmin } from "../src/lib/providers/db-client.js";
import type { Deal } from "../src/types/index.js";

/* ── Per-store configs ───────────────────────────────────────────
   New Woo store = new block here. categoryMap translates the store's
   own category slugs to Havlo category slugs; anything unmapped falls
   back to `defaultCat` and ingestion's title-based category
   auto-correction refines from there. */
interface WooConfig {
  name:       string;
  storeId:    string;
  baseUrl:    string;          // no trailing slash
  defaultCat: string;          // Havlo category slug fallback
  /** store category slug substring → Havlo category slug. First match
      wins; checked against every category slug on the product. */
  categoryMap: Array<[string, string]>;
  /** Safety cap on pagination (pages × 100 products). */
  maxPages:   number;
}

const WOO_CONFIGS: WooConfig[] = [
  {
    name:       "Pointek",
    storeId:    "pointek",
    baseUrl:    "https://www.pointekonline.com",
    defaultCat: "electronics",
    categoryMap: [
      ["phone", "phones"], ["tablet", "phones"], ["smartwatch", "electronics"],
      ["laptop", "computing"], ["computer", "computing"], ["printer", "computing"],
      ["television", "electronics"], ["tv", "electronics"],
      ["audio", "audio"], ["speaker", "audio"], ["headphone", "audio"], ["sound", "audio"],
      ["appliance", "appliances"], ["refrigerator", "appliances"], ["freezer", "appliances"],
      ["washing", "appliances"], ["air-condition", "appliances"], ["generator", "appliances"],
      ["kitchen", "appliances"], ["blender", "appliances"], ["microwave", "appliances"],
      ["gaming", "gaming"], ["console", "gaming"],
      ["camera", "electronics"],
    ],
    maxPages: 12, // 510 SKUs today; 1,200-product ceiling leaves growth room
  },

  /* ── Booze.ng — NG online liquor store (June 2026, supermarket cat) ── */
  {
    name:       "Booze.ng",
    storeId:    "booze",
    baseUrl:    "https://booze.ng",
    defaultCat: "supermarket",
    categoryMap: [], // whole catalog is drinks → supermarket
    maxPages:   20,
  },

  /* ── My Liquor Hub — NG online liquor store ── */
  {
    name:       "My Liquor Hub",
    storeId:    "myliquorhub",
    baseUrl:    "https://myliquorhub.com",
    defaultCat: "supermarket",
    categoryMap: [],
    maxPages:   20,
  },
];

/* ── Woo Store API product shape (the subset we read) ──────────── */
interface WooPrices {
  price:               string; // minor units, e.g. "32000000" = ₦320,000.00
  regular_price:       string;
  sale_price:          string;
  currency_code:       string;
  currency_minor_unit: number;
}
interface WooProduct {
  id:          number;
  name:        string;
  permalink:   string;
  sku:         string;
  on_sale:     boolean;
  is_in_stock: boolean;
  prices:      WooPrices;
  images:      Array<{ src: string }>;
  categories:  Array<{ name: string; slug: string }>;
  short_description?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#8211;/g, "–").replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"').replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapCategory(cfg: WooConfig, p: WooProduct): string {
  for (const c of p.categories ?? []) {
    const slug = c.slug.toLowerCase();
    for (const [frag, havlo] of cfg.categoryMap) {
      if (slug.includes(frag)) return havlo;
    }
  }
  return cfg.defaultCat;
}

async function fetchWooCatalog(cfg: WooConfig): Promise<WooProduct[]> {
  const out: WooProduct[] = [];
  for (let page = 1; page <= cfg.maxPages; page++) {
    const url = `${cfg.baseUrl}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HavloBot/1.0; +https://havlo.io)" },
    });
    if (!res.ok) {
      console.log(`    ! ${cfg.storeId} page ${page}: HTTP ${res.status} — stopping pagination`);
      break;
    }
    const batch = (await res.json()) as WooProduct[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break; // short page = last page
  }
  return out;
}

function wooToDeal(cfg: WooConfig, p: WooProduct, idx: number): Deal | null {
  const minor = Math.pow(10, p.prices?.currency_minor_unit ?? 2);
  const sale     = parseInt(p.prices?.sale_price    || p.prices?.price || "0", 10) / minor;
  const original = parseInt(p.prices?.regular_price || p.prices?.price || "0", 10) / minor;
  if (!(sale > 0) || !p.name || !p.permalink) return null;
  /* Woo returns the store's native currency — Pointek prices in NGN,
     which is exactly Deal's NGN lane. A future non-NGN Woo store
     would need an FX hop here; fail loudly rather than mis-currency. */
  if (p.prices.currency_code !== "NGN") return null;

  const title = decodeEntities(p.name);
  const discount = original > sale ? Math.round(((original - sale) / original) * 100) : 0;
  const catSlug = mapCategory(cfg, p);

  return {
    id:              `woo-${cfg.storeId}-${Date.now().toString(36)}-${idx}`,
    title,
    description:     decodeEntities(p.short_description || "") || title,
    category:        catSlug,
    categorySlug:    catSlug,
    storeId:         cfg.storeId,
    storeName:       cfg.name,
    originalPrice:   original > 0 ? original : sale,
    salePrice:       sale,
    discountPercent: discount,
    currency:        "NGN",
    imageUrl:        p.images?.[0]?.src,
    url:             p.permalink,
    expiresAt:       null,
    isHot:           discount >= 30,
    isFeatured:      false,
    tags:            ["country:ng"],
    saves:           0,
    clicks:          0,
    postedAt:        new Date().toISOString().slice(0, 10),
    storeCountry:    "NG",
  };
}

interface Args { store?: string; dryRun?: boolean }
function parseArgs(): Args {
  const a: Args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--store=")) a.store = arg.slice("--store=".length).toLowerCase();
    else if (arg === "--dry-run")   a.dryRun = true;
  }
  return a;
}

async function main() {
  const { store, dryRun } = parseArgs();
  const configs = store
    ? WOO_CONFIGS.filter((c) => c.storeId === store)
    : WOO_CONFIGS;
  if (configs.length === 0) {
    console.error(`✗ no Woo config matches --store=${store}`);
    console.error(`  available: ${WOO_CONFIGS.map((c) => c.storeId).join(", ")}`);
    process.exit(1);
  }
  console.log(`▶ NG WooCommerce ingest ${dryRun ? "(DRY RUN)" : ""}`);
  console.log(`  stores: ${configs.map((c) => c.storeId).join(", ")}\n`);

  let totalUpserted = 0;

  for (const cfg of configs) {
    const products = await fetchWooCatalog(cfg);
    const inStock  = products.filter((p) => p.is_in_stock);
    const seenUrls = new Set<string>();
    const deals: Deal[] = [];
    inStock.forEach((p, i) => {
      const d = wooToDeal(cfg, p, i);
      if (!d || seenUrls.has(d.url)) return;
      seenUrls.add(d.url);
      deals.push(d);
    });
    console.log(`  → ${cfg.storeId}: ${products.length} fetched, ${inStock.length} in stock → ${deals.length} deals`);
    if (dryRun) {
      for (const d of deals.slice(0, 5)) {
        console.log(`      ${d.categorySlug.padEnd(11)} ₦${d.salePrice.toLocaleString()} ${d.title.slice(0, 56)}`);
      }
      continue;
    }
    if (deals.length === 0) continue;

    /* Full-catalog walk → per-store sweep is safe, same rationale as
       the Shopify path (offers absent from the live catalog flip
       in_stock=false; ingestDeals's sweep guards prevent a transient
       error from nuking the store). */
    const result = await ingestDeals(`woo-json-${cfg.storeId}`, `${cfg.storeId}:ng`, deals, {
      sweepScope: { store: cfg.storeId },
    });
    totalUpserted += result.upserted;
    for (const e of result.errors) console.log(`    ! ${e}`);
    console.log(`    upserted ${result.upserted}`);
  }

  if (!dryRun && totalUpserted > 0) {
    /* Refresh the cheapest-offer matview the deals feed reads —
       standalone scripts must do this themselves or fresh offers stay
       invisible until the next cron (same lesson as ingest-ebay-uk). */
    const supa = getSupabaseAdmin();
    if (supa) {
      const { error } = await supa.rpc("refresh_cheapest_offers");
      console.log(error ? `  ! matview refresh failed: ${error.message}` : "  ✓ cheapest-offer matview refreshed");
    }
  }

  console.log(`\n✓ Done — upserted ${totalUpserted}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
