#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Jumia ingest via SerpAPI (engine=jumia).

   Replaces the Playwright scraper at scripts/scrapers/jumia.ts which
   was defeated by Cloudflare in early 2026. SerpAPI's dedicated
   Jumia engine bypasses the bot wall by hitting Jumia's own search
   API server-side.

   Strategy: a curated query list covering the highest-traffic
   shopper intents on Jumia NG. Each query maps to a category so
   the ingested rows land in the right /deals filter slot. We
   AVOID a "scrape every category × N pages" sweep (that would
   burn ~60+ SerpAPI credits per run); the focused query list
   delivers ~80% of the inventory at ~25% of the cost.

   Cost: ~15-20 calls per run. Plus plan ($0.005/call) ≈ $0.10/run.
   Daily cron = ~$3/month for Jumia coverage.

   Usage:
     npm run ingest:jumia                   # default query list
     npm run ingest:jumia -- --queries=phones,laptops  # subset by token
     npm run ingest:jumia -- --country=ke    # different Jumia market
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { jumiaSerpapiProvider } from "../src/lib/providers/search-jumia-serpapi";
import { ingestDeals } from "../src/lib/providers/ingestion";
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import type { Deal } from "../src/types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

/* Canonicalise a Jumia URL by stripping Google tracking params so
   the URL keys in google_images results match what's in our DB.
   Mirrors the helper in search-jumia-serpapi.ts. */
function canonicaliseJumiaUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("srsltid");
    u.searchParams.delete("gclid");
    u.searchParams.delete("gad_source");
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    return u.toString();
  } catch {
    return url;
  }
}

interface GoogleImagesResult {
  link?:     string;
  original?: string;
}

/* Image backfill for niche Jumia products that didn't match the
   site-wide google_images call during the main ingest pass.

   Why this is needed: the main ingest fires ONE google_images call
   per curated query (e.g. "iPhone 15 site:jumia.com.ng"). That
   returns the top 100 product images for the query. Niche products
   that exist on Jumia but rank low in image-search results
   (Microsoft Micro Innovations Xbox variants, Scanfrost twin-tub
   washing machines, etc.) don't get matched and land with null
   image_url. The 22% miss rate the user reported.

   Fix: after the main ingest, scan for Jumia rows with no image,
   fire a TARGETED google_images call with the product's exact
   title plus site:jumia.com.ng. Take the first jumia.is image
   returned. Updates products.image_url directly.

   Cost: one SerpAPI credit per missing product (~$0.005). Typical
   backfill batch: 20-30 missing products = $0.10-$0.15 per run.
   Trivial against the main ingest's 58-credit cost. */
async function fetchImageForTitle(title: string, apiKey: string): Promise<string | null> {
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", `${title} site:jumia.com.ng`);
  url.searchParams.set("gl", "ng");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json() as { images_results?: GoogleImagesResult[]; error?: string };
    if (data.error) return null;
    /* Prefer ng.jumia.is CDN images over Google Shopping thumbnails
       (encrypted-tbn0.gstatic.com) — the direct CDN URLs are stable
       and high-quality 500x500 / 680x680 product photos. Google
       thumbnails expire and reference Google's CDN rather than
       Jumia's. */
    for (const img of data.images_results ?? []) {
      if (img.original?.includes("jumia.is")) return img.original;
    }
    /* Fallback: first non-empty original image, even if it's a
       Google Shopping thumbnail. Better than no image. */
    for (const img of data.images_results ?? []) {
      if (img.original) return img.original;
    }
    return null;
  } catch {
    return null;
  }
}

async function backfillJumiaImages(apiKey: string): Promise<{ scanned: number; filled: number; errors: number }> {
  const supa = getSupabaseAdmin();
  if (!supa) return { scanned: 0, filled: 0, errors: 0 };

  /* Find products that:
       (a) have at least one in-stock Jumia offer, AND
       (b) have null image_url in the products row.
     Two-step query because Supabase JS can't filter by a foreign
     table's column in one shot when we want the product row back.

     Step 1: pull distinct product_ids from offers where
             store_id = 'jumia' AND in_stock = true.
     Step 2: query products where id IN (those) AND image_url IS NULL. */
  const { data: offers } = await supa
    .from("offers")
    .select("product_id")
    .eq("store_id", "jumia")
    .eq("in_stock", true);

  const ids = Array.from(new Set((offers ?? []).map((o: { product_id: string }) => o.product_id))).filter(Boolean);
  if (ids.length === 0) return { scanned: 0, filled: 0, errors: 0 };

  const { data: products } = await supa
    .from("products")
    .select("id, title")
    .in("id", ids)
    .is("image_url", null);

  const missing = (products ?? []) as Array<{ id: string; title: string }>;
  if (missing.length === 0) return { scanned: 0, filled: 0, errors: 0 };

  console.log(`\n▶ Image backfill — ${missing.length} Jumia products missing image_url`);

  let filled = 0;
  let errors = 0;
  /* Sequential — keeps SerpAPI request rate gentle. Per-product
     calls are quick (~500ms), so 20-30 sequential takes ~15s. */
  for (const p of missing) {
    const img = await fetchImageForTitle(p.title, apiKey);
    if (img) {
      const { error } = await supa.from("products").update({ image_url: img }).eq("id", p.id);
      if (error) {
        errors++;
        console.warn(`  ✗ ${p.title.slice(0, 60)} — update failed: ${error.message}`);
      } else {
        filled++;
        console.log(`  ✓ ${p.title.slice(0, 60)}`);
      }
    } else {
      console.log(`  · ${p.title.slice(0, 60)} — no image found`);
    }
  }

  return { scanned: missing.length, filled, errors };
}

/* ── Curated NG query list ────────────────────────────────────────
   Each entry runs ONE SerpAPI call. Categories chosen to cover
   the categories Havlo's homepage tile grid surfaces, plus some
   high-velocity sub-categories (sneakers, earbuds, TVs) where
   Jumia's flash sales tend to sit.

   The query strings are deliberately LOOSE — Jumia's own search
   ranks by relevance + sale priority, so "Phones" returns the
   currently-promoted phone listings rather than every phone in
   the catalog. That's what we want for a deals feed: the things
   Jumia is actively pushing this hour.

   When you need product-specific coverage (e.g. iPhone 17 Pro
   tracking), add the explicit query to the list — SerpAPI returns
   the same shape regardless of query specificity. */
interface JumiaQuery {
  q:            string;
  categorySlug: string;
}

const QUERIES: JumiaQuery[] = [
  /* Phones — brand + model gets product pages; bare "Smartphones"
     hits Jumia's category landing pages which carry no per-product
     price markup. Generation tokens (15 / 14 / Camon) keep results
     specific. */
  { q: "iPhone 15",                     categorySlug: "phones"      },
  { q: "iPhone 14",                     categorySlug: "phones"      },
  { q: "iPhone 13",                     categorySlug: "phones"      },
  { q: "Samsung Galaxy A",              categorySlug: "phones"      },
  { q: "Samsung Galaxy S",              categorySlug: "phones"      },
  { q: "Tecno Camon",                   categorySlug: "phones"      },
  { q: "Tecno Spark",                   categorySlug: "phones"      },
  { q: "Infinix Note",                  categorySlug: "phones"      },
  { q: "Infinix Smart",                 categorySlug: "phones"      },
  { q: "Itel phone",                    categorySlug: "phones"      },

  /* Computing — same pattern; specific brand+line surfaces product
     pages. */
  { q: "MacBook Air",                   categorySlug: "computing"   },
  { q: "MacBook Pro",                   categorySlug: "computing"   },
  { q: "HP Pavilion",                   categorySlug: "computing"   },
  { q: "Dell Inspiron",                 categorySlug: "computing"   },
  { q: "Lenovo IdeaPad",                categorySlug: "computing"   },

  /* Electronics — TVs by brand. "Smart TV" alone returns category
     pages. */
  { q: "Hisense TV",                    categorySlug: "electronics" },
  { q: "Samsung TV",                    categorySlug: "electronics" },
  { q: "LG TV",                         categorySlug: "electronics" },
  { q: "TCL TV",                        categorySlug: "electronics" },

  /* Audio — Jumia NG carries Oraimo + JBL + Anker as the top
     brands; specific brand queries get product pages. */
  { q: "Oraimo earbuds",                categorySlug: "audio"       },
  { q: "JBL speaker",                   categorySlug: "audio"       },
  { q: "Anker speaker",                 categorySlug: "audio"       },

  /* Appliances — same pattern. Hisense and Scanfrost dominate NG
     white-goods listings on Jumia. */
  { q: "Hisense fridge",                categorySlug: "appliances"  },
  { q: "Scanfrost washing machine",     categorySlug: "appliances"  },

  /* Fashion — branded sneakers / footwear gets product pages.
     "Sneakers" alone hits Jumia's category landing. */
  { q: "Nike sneakers",                 categorySlug: "fashion"     },
  { q: "Adidas sneakers",               categorySlug: "fashion"     },

  /* Beauty — Lord's and Nivea + Olay are top-selling Jumia NG
     beauty brands. */
  { q: "Nivea body lotion",             categorySlug: "beauty"      },

  /* Gaming — current consoles. */
  { q: "PlayStation 5",                 categorySlug: "gaming"      },
  { q: "Xbox Series",                   categorySlug: "gaming"      },
];

/* ── CLI args ─────────────────────────────────────────────────── */

interface CliArgs {
  queryTokens?: string[];
  country?:     string;
  /** Skip the curated-query scrape and run ONLY the image-backfill
      pass against existing Jumia products with null image_url. Use
      to top up images without burning the ~17 credits a full ingest
      costs. Typical backfill batch: 5-30 products = $0.025-$0.15. */
  imagesOnly?:  boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--queries=")) {
      args.queryTokens = arg.slice("--queries=".length).split(",").map((s) => s.trim().toLowerCase());
    } else if (arg.startsWith("--country=")) {
      args.country = arg.slice("--country=".length).toLowerCase();
    } else if (arg === "--images-only") {
      args.imagesOnly = true;
    }
  }
  return args;
}

/* ── Main ─────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const args = parseArgs();
  const country = args.country ?? "ng";

  if (!jumiaSerpapiProvider.isActive()) {
    console.error("✗ Jumia SerpAPI provider inactive. Set SERPAPI_KEY in env (and ensure SERPAPI_DISABLED isn't set to true).");
    process.exit(1);
  }

  /* --images-only: skip the scrape, only run the backfill pass.
     Useful for cheaply topping up the 3-5% of Jumia products that
     persistently don't match the broad google_images call during a
     normal ingest. Falls through to the backfill block below. */
  if (args.imagesOnly) {
    const apiKey = process.env.SERPAPI_KEY?.trim();
    if (!apiKey) { console.error("✗ SERPAPI_KEY not set"); process.exit(1); }
    console.log("▶ Jumia images-only backfill (skipping scrape)\n");
    const stats = await backfillJumiaImages(apiKey);
    console.log(`\n✓ Done — scanned=${stats.scanned} filled=${stats.filled} errors=${stats.errors}`);
    return;
  }

  /* Filter queries against --queries=... CLI arg. Token match is
     substring-based on either the q or the categorySlug so
     `--queries=phone,laptop` catches "Smartphones" + "Laptops". */
  const planned = args.queryTokens
    ? QUERIES.filter((q) => args.queryTokens!.some((t) =>
        q.q.toLowerCase().includes(t) || q.categorySlug.toLowerCase().includes(t),
      ))
    : QUERIES;

  if (planned.length === 0) {
    console.error("✗ No queries match the --queries= filter. Aborting.");
    process.exit(1);
  }

  console.log(`▶ Jumia ingest via SerpAPI — ${planned.length} calls planned, country=${country}`);
  console.log("");

  const startedAt = Date.now();
  let totalFetched  = 0;
  let totalKept     = 0;
  let totalUpserted = 0;
  let totalErrors   = 0;

  for (const { q, categorySlug } of planned) {
    const label = `[${categorySlug.padEnd(11)}] ${q.padEnd(28)}`;
    try {
      const raw = await jumiaSerpapiProvider.searchDeals({
        q,
        countryCode: country,
        limit:       40,   // Jumia returns up to ~40 per page
      });
      totalFetched += raw.length;

      /* Tag each deal's category so /api/deals?category=... groups
         them correctly. The provider's mapToDeal returns
         categorySlug='all' as a placeholder; here we override to
         the curated slug from the query. */
      raw.forEach((d: Deal) => {
        d.categorySlug = categorySlug;
        /* Same gradient/emoji per category as the Playwright
           scraper used. The provider's default is generic; the
           per-category tone reads better in the masonry. */
      });

      const result = await ingestDeals(jumiaSerpapiProvider.id, `jumia:${q}:${country}`, raw);
      totalKept     += raw.length;
      totalUpserted += result.upserted;
      if (result.errors.length > 0) totalErrors += result.errors.length;

      console.log(`  ${label} fetched=${raw.length.toString().padStart(3)} upserted=${result.upserted.toString().padStart(3)}${result.errors.length > 0 ? ` errors=${result.errors.length}` : ""}`);
    } catch (err) {
      totalErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ${label} ERROR: ${msg}`);
    }
  }

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log("");
  console.log(`✓ Jumia ingest complete in ${elapsedSec}s — fetched=${totalFetched} kept=${totalKept} upserted=${totalUpserted} errors=${totalErrors}`);

  /* Image backfill — runs after the main ingest so it catches BOTH
     fresh upserts that didn't match the broad google_images call
     AND historical rows from earlier ingest cycles that still lack
     images. ~$0.10 per cycle on the Plus plan. */
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (apiKey) {
    try {
      const stats = await backfillJumiaImages(apiKey);
      if (stats.scanned > 0) {
        console.log(`✓ Image backfill — scanned=${stats.scanned} filled=${stats.filled} errors=${stats.errors}`);
      }
    } catch (err) {
      console.warn("✗ Image backfill failed:", err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch((err) => {
  console.error("✗ Fatal error:", err);
  process.exit(1);
});
