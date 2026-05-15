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
import type { Deal } from "../src/types";

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
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--queries=")) {
      args.queryTokens = arg.slice("--queries=".length).split(",").map((s) => s.trim().toLowerCase());
    } else if (arg.startsWith("--country=")) {
      args.country = arg.slice("--country=".length).toLowerCase();
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
}

main().catch((err) => {
  console.error("✗ Fatal error:", err);
  process.exit(1);
});
