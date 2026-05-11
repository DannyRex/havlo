#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   UK retailer-biased SerpAPI ingest.

   Why this exists: the standard ingest-providers.ts uses category
   names ("Phones", "Laptops") as queries against gl=uk. Google
   Shopping UK ranks Amazon results first for those generic queries,
   so the UK pool ended up dominated by Amazon UK + cross-border
   (AliExpress / Shein / Temu / DHgate / ASOS) with almost no native
   UK retailers (Argos / Currys / John Lewis / Boots / AO.com).

   The QA agent flagged this directly: UK shoppers were seeing
   "Local stores: 0" because the SerpAPI ingest wasn't surfacing UK
   high-street retailers and Havlo had no UK-specific scrapers.

   This script fixes that by querying SerpAPI with retailer + product
   queries ("Argos iPhone 17 Pro Max", "Currys MacBook Pro M4"). The
   retailer-name prefix biases Google Shopping toward listings from
   that retailer specifically. We then filter the response to keep
   only rows whose source matches the target retailer (drops the
   inevitable Amazon spillover Google sneaks into every result set).

   v2 (May 2026): expanded from 8 → 14 retailers to fill the gaps a
   real UK shopper would expect. Each retailer now has its OWN SKU
   list (B&Q doesn't sell iPhones; JD Sports doesn't sell drills),
   so the call count is bounded by per-retailer category coverage,
   not a flat "all retailers × all SKUs" matrix. Matchers became
   a list (string[]) so retailers with brand-name ambiguity (B&Q,
   Next) can match multiple variants of how SerpAPI returns their
   source string.

   Cost:
     ~14 retailers, each with ~6-14 SKUs.
     Total: ~120 SerpAPI calls per run.
     Twice-weekly cron = ~960/month against a 1,000-credit Starter
     plan — still within budget. Drop --retailers= to ingest a
     subset if approaching cap.

   Usage:
     npm run ingest:uk-retailers
     npm run ingest:uk-retailers -- --retailers=argos,currys
     npm run ingest:uk-retailers -- --skus=iphone,macbook
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";
import type { Deal } from "../src/types";

/* ── SKU groups ──────────────────────────────────────────────────────
   Grouped by shopper intent, not by category, so the per-retailer
   SKU lists compose cleanly. A retailer that carries both electronics
   and home (John Lewis, Argos) lists multiple groups. A specialist
   (B&Q, Smyths) lists only its native group. */

type SkuQuery = { q: string; categorySlug: string };

const ELECTRONICS_SKUS: SkuQuery[] = [
  // Phones — Apple + Samsung flagships
  { q: "iPhone 17 Pro Max",        categorySlug: "phones" },
  { q: "iPhone 17",                categorySlug: "phones" },
  { q: "Samsung Galaxy S26 Ultra", categorySlug: "phones" },
  { q: "Google Pixel 10 Pro",      categorySlug: "phones" },
  // Computing — current Apple silicon
  { q: "MacBook Pro M4",           categorySlug: "computing" },
  { q: "MacBook Air M3",           categorySlug: "computing" },
  { q: "iPad Pro M4",              categorySlug: "computing" },
  // Gaming
  { q: "PlayStation 5 Slim",       categorySlug: "electronics" },
  { q: "Xbox Series X",            categorySlug: "electronics" },
  { q: "Nintendo Switch OLED",     categorySlug: "electronics" },
  // Audio
  { q: "AirPods Pro 2",            categorySlug: "audio" },
  { q: "Sony WH-1000XM5",          categorySlug: "audio" },
  // TV — UK retailers carry strong TV ranges
  { q: "LG OLED TV 55 inch",       categorySlug: "televisions" },
  { q: "Samsung QLED TV 55 inch",  categorySlug: "televisions" },
];

const HOME_SKUS: SkuQuery[] = [
  { q: "Dyson V15 Detect",        categorySlug: "appliances" },
  { q: "Ninja Air Fryer",         categorySlug: "appliances" },
  { q: "Stanley Quencher tumbler", categorySlug: "home" },
  { q: "duvet king size",         categorySlug: "home" },
  { q: "memory foam mattress",    categorySlug: "home" },
  { q: "lamp shade",              categorySlug: "home" },
];

const DIY_SKUS: SkuQuery[] = [
  { q: "DeWalt cordless drill",   categorySlug: "home" },
  { q: "lawn mower electric",     categorySlug: "home" },
  { q: "step ladder",             categorySlug: "home" },
  { q: "paint Dulux white",       categorySlug: "home" },
  { q: "garden hose",             categorySlug: "home" },
  { q: "Karcher pressure washer", categorySlug: "home" },
];

const FASHION_SPORTS_SKUS: SkuQuery[] = [
  { q: "Nike Air Force 1",        categorySlug: "fashion" },
  { q: "Adidas Samba",            categorySlug: "fashion" },
  { q: "Nike Tech Fleece",        categorySlug: "fashion" },
  { q: "running shoes mens",      categorySlug: "sports" },
  { q: "yoga mat",                categorySlug: "sports" },
  { q: "dumbbells set",           categorySlug: "sports" },
];

const AUTO_CYCLING_SKUS: SkuQuery[] = [
  { q: "car battery",             categorySlug: "home" },
  { q: "dash cam",                categorySlug: "electronics" },
  { q: "bike helmet",             categorySlug: "sports" },
  { q: "kids bike",               categorySlug: "sports" },
  { q: "roof box",                categorySlug: "home" },
  { q: "car phone holder",        categorySlug: "electronics" },
];

const TOY_SKUS: SkuQuery[] = [
  { q: "Lego Technic",            categorySlug: "gaming" },
  { q: "Lego Star Wars",          categorySlug: "gaming" },
  { q: "Barbie Dreamhouse",       categorySlug: "gaming" },
  { q: "Hot Wheels track",        categorySlug: "gaming" },
  { q: "Nintendo Switch OLED",    categorySlug: "electronics" },
];

/* Kept exported as TARGET_SKUS for backward-compat with the
   --skus= filter logic in parseArgs(). Equal to the union of all
   groups — the filter then narrows it. */
const TARGET_SKUS: SkuQuery[] = [
  ...ELECTRONICS_SKUS,
  ...HOME_SKUS,
  ...DIY_SKUS,
  ...FASHION_SPORTS_SKUS,
  ...AUTO_CYCLING_SKUS,
  ...TOY_SKUS,
];

/* ── Retailer registry ───────────────────────────────────────────────
   Each retailer carries:
     - name      : query prefix Google Shopping understands
                   ("Currys iPhone 17 Pro Max")
     - key       : short token for the --retailers= CLI filter
     - matchers  : lowercase substrings used to filter raw SerpAPI
                   results to ONLY this retailer. List so we can
                   catch multiple variants (B&Q vs diy.com,
                   Next plc vs next.co.uk).
     - skus      : per-retailer SKU set so we don't waste credits
                   asking B&Q for iPhones or JD Sports for drills.

   Picked for two criteria:
     1. Real UK high-street presence (so users recognise the name)
     2. Sells across at least one Havlo category (broad SKU coverage)
   Skipped Amazon UK (already in the curated catalog), Tesco /
   Sainsbury (mostly groceries, low cross-shop overlap with our
   product types). */

type RetailerCfg = {
  name:     string;
  key:      string;
  matchers: string[];
  skus:     SkuQuery[];
};

const UK_RETAILERS: RetailerCfg[] = [
  // ── Original 8 (electronics-heavy + department stores) ──
  { name: "Argos",            key: "argos",       matchers: ["argos"],
    skus: [...ELECTRONICS_SKUS, ...HOME_SKUS, ...TOY_SKUS] },

  { name: "Currys",           key: "currys",      matchers: ["currys"],
    skus: ELECTRONICS_SKUS },

  { name: "John Lewis",       key: "john-lewis",  matchers: ["john lewis"],
    skus: [...ELECTRONICS_SKUS, ...HOME_SKUS] },

  { name: "Boots",            key: "boots",       matchers: ["boots"],
    skus: [] /* beauty SKUs not yet defined; placeholder */ },

  { name: "AO.com",           key: "ao",          matchers: ["ao.com", "ao uk"],
    skus: ELECTRONICS_SKUS },

  { name: "Very",             key: "very",        matchers: ["very.co.uk", "very uk", "very "],
    skus: [...ELECTRONICS_SKUS.slice(0, 8), ...FASHION_SPORTS_SKUS] },

  { name: "Selfridges",       key: "selfridges",  matchers: ["selfridges"],
    skus: FASHION_SPORTS_SKUS },

  { name: "Marks & Spencer",  key: "marks",       matchers: ["marks", "m&s "],
    skus: [...FASHION_SPORTS_SKUS, ...HOME_SKUS] },

  // ── v2 additions (gap-fillers for DIY / sports / auto / home / toys) ──
  /* B&Q: DIY anchor, currently zero UK coverage in this category.
     Matchers cover the ampersand variants SerpAPI returns and
     diy.com which B&Q sometimes uses in source attribution. */
  { name: "B&Q",              key: "bq",          matchers: ["b&q", "b & q", "diy.com"],
    skus: DIY_SKUS },

  /* JD Sports: the obvious peer to Sports Direct, much heavier on
     athleisure / lifestyle. Matcher avoids the dangerous bare "jd"
     which would false-match many other stores. */
  { name: "JD Sports",        key: "jd",          matchers: ["jd sports", "jdsports"],
    skus: FASHION_SPORTS_SKUS },

  /* Halfords: auto + cycling, zero coverage today. */
  { name: "Halfords",         key: "halfords",    matchers: ["halfords"],
    skus: AUTO_CYCLING_SKUS },

  /* Dunelm: home & kitchen depth. Current home pool is 17 deals —
     adding Dunelm should roughly double it. */
  { name: "Dunelm",           key: "dunelm",      matchers: ["dunelm"],
    skus: HOME_SKUS },

  /* Next: mainstream fashion + home. Already comes through organically
     (~3 deals via category ingest) — explicit ingest formalises it.
     Matcher avoids bare "next" which would match too many things. */
  { name: "Next",             key: "next",        matchers: ["next.co.uk", "next plc", "next official", "next retail"],
    skus: [...FASHION_SPORTS_SKUS, ...HOME_SKUS] },

  /* Smyths Toys: dedicated toys retailer, complements Argos which
     stocks toys but isn't a specialist. */
  { name: "Smyths Toys",      key: "smyths",      matchers: ["smyths"],
    skus: TOY_SKUS },
];

interface CliArgs {
  retailerKeys?: Set<string>;
  skuTokens?:   string[];
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--retailers=")) {
      args.retailerKeys = new Set(
        arg.slice("--retailers=".length).split(",").map((s) => s.trim().toLowerCase()),
      );
    } else if (arg.startsWith("--skus=")) {
      args.skuTokens = arg
        .slice("--skus=".length)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const providers = getActiveSearchProviders().filter((p) => p.id === "serpapi-shopping");

  if (providers.length === 0) {
    console.error("✗ SerpAPI provider inactive. Set SERPAPI_KEY in env.");
    process.exit(1);
  }
  const provider = providers[0];

  const retailers = UK_RETAILERS.filter(
    (r) => !args.retailerKeys || args.retailerKeys.has(r.key),
  );

  /* Apply --skus= filter to each retailer's SKU list independently.
     If a retailer has no remaining SKUs after the filter (and the
     filter was provided), skip that retailer rather than running
     zero SerpAPI calls against it. */
  const planned = retailers
    .map((r) => ({
      retailer: r,
      skus: r.skus.filter((s) =>
        !args.skuTokens || args.skuTokens.some((t) => s.q.toLowerCase().includes(t)),
      ),
    }))
    .filter((p) => p.skus.length > 0);

  const totalCalls = planned.reduce((n, p) => n + p.skus.length, 0);
  console.log(`▶ UK retailer ingest — ${totalCalls} SerpAPI calls planned`);
  console.log(`  Retailers: ${planned.map((p) => `${p.retailer.name} (${p.skus.length})`).join(", ")}`);
  console.log("");

  const startedAt = Date.now();
  let totalFetched  = 0;
  let totalKept     = 0;
  let totalUpserted = 0;
  let totalErrors   = 0;

  for (const { retailer, skus } of planned) {
    let retailerKept = 0;

    for (const sku of skus) {
      const q = `${retailer.name} ${sku.q}`;
      const label = `[${retailer.name.padEnd(16)}] ${sku.q.padEnd(28)}`;
      try {
        const raw = await provider.searchDeals({
          q,
          countryCode: "uk",
          limit: 10,
        });

        /* Filter to ONLY this retailer. Google Shopping returns
           Amazon spillover even on retailer-prefixed queries; we
           match on store substring (case-insensitive) across the
           retailer's matchers[] list so brand-ambiguous names
           (B&Q, Next, M&S) catch every variant SerpAPI returns. */
        const onTarget = raw.filter((d: Deal) => {
          const storeNameLc = d.storeName.toLowerCase();
          const storeIdLc   = d.storeId.toLowerCase();
          return retailer.matchers.some(
            (m) => storeNameLc.includes(m) || storeIdLc.includes(m),
          );
        });

        /* Tag with category so /api/deals?category=... groups
           correctly. Same pattern as ingest-providers.ts. */
        onTarget.forEach((d) => {
          d.categorySlug = sku.categorySlug;
        });

        const result = await ingestDeals(provider.id, `${retailer.key}:${sku.q}:uk`, onTarget);
        totalFetched  += raw.length;
        totalKept     += onTarget.length;
        totalUpserted += result.upserted;
        totalErrors   += result.errors.length;
        retailerKept  += onTarget.length;

        console.log(
          `${result.errors.length === 0 ? "✓" : "⚠"} ${label} raw=${raw.length} kept=${onTarget.length} upserted=${result.upserted}`,
        );
      } catch (err) {
        totalErrors += 1;
        console.error(`✗ ${label} threw: ${(err as Error).message}`);
      }
    }
    console.log(`  → ${retailer.name}: ${retailerKept} matching rows ingested`);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log(`▶ Done in ${elapsedSec}s`);
  console.log(`  SerpAPI raw rows fetched: ${totalFetched}`);
  console.log(`  Kept (on-target retailer): ${totalKept}`);
  console.log(`  Upserted to DB:           ${totalUpserted}`);
  console.log(`  Errors:                   ${totalErrors}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});

/* Re-export so existing tooling that imports the union still works.
   Keeping this at the bottom of the file so the dev path-of-eyes
   lands on the retailer config first. */
export { TARGET_SKUS };
