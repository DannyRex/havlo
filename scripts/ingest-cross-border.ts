#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Cross-border marketplace ingest: SHEIN + Temu via SerpAPI.

   WHY THIS EXISTS: the homepage marquee and the "scanning N stores"
   count advertise SHEIN and Temu as sources, but the catalogue carried
   almost none of their offers (pre-launch QA: SHEIN 8 in-stock, Temu 1).
   That contradicted the honest-comparison promise. SerpAPI has NO native
   SHEIN/Temu engine, and the google_shopping engine has no merchant
   filter param, so this reuses the exact pattern ingest-uk-retailers.ts
   uses for Argos/Currys: issue a retailer-suffixed Google Shopping query
   ("summer dress SHEIN") and keep only rows whose source is the target
   merchant, dropping the Amazon/AliExpress spillover Google injects.

   YIELD WARNING (read before widening): Temu pulled ALL of its Google
   Shopping listings on 2025-04-09 (US tariff / de-minimis pressure) and
   now drives demand through its own app, so its Google-Shopping yield is
   ~0 -- Temu queries usually return nothing yet still cost 1 credit each.
   SHEIN still surfaces, but mainly in fashion/beauty. The SKU lists below
   are fashion/beauty ONLY (these merchants do not index in electronics).
   Temu was dropped from the cron (--merchants=shein in scrape-deals.yml)
   after its kept= counts stayed at 0, since it pulled its Google Shopping
   listings 2025-04-09. Re-add it to --merchants if it indexes again.

   COST: ~10 SKUs x 4 countries x 1 merchant (SHEIN) = ~40 SerpAPI calls/run.
   Mon/Wed/Fri cron ~= 13 runs/mo ~= 520 credits/month, well inside
   the Developer plan's (5,000/mo) headroom.

   STORE/COUNTRY HANDLING needs NO new code: "shein" and "temu" are
   already in GLOBAL_INTL_STORES (src/lib/country.ts), so ingestion tags
   them is_international with store.country = NULL (visible cross-border in
   every market's allowlist, never "local"). Logos already exist in
   public/logos/. So this script only has to fetch + filter + ingest.

   Usage:
     npm run ingest:cross-border
     npm run ingest:cross-border -- --merchants=shein     # SHEIN only
     npm run ingest:cross-border -- --country=uk,us
     npm run ingest:cross-border -- --dry-run
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";
import type { Deal } from "../src/types";

type SkuQuery = { q: string; categorySlug: string };

/* Fashion + beauty ONLY — the categories where SHEIN/Temu actually
   index in Google Shopping. Querying electronics for them burns credits
   for nothing. Per-country so spelling/intent fits the market. */
const SKUS_BY_COUNTRY: Record<string, SkuQuery[]> = {
  uk: [
    { q: "summer midi dress",     categorySlug: "fashion" },
    { q: "oversized hoodie",      categorySlug: "fashion" },
    { q: "high waisted jeans",    categorySlug: "fashion" },
    { q: "knit cardigan",         categorySlug: "fashion" },
    { q: "cargo trousers",        categorySlug: "fashion" },
    { q: "bodycon dress",         categorySlug: "fashion" },
    { q: "loungewear set",        categorySlug: "fashion" },
    { q: "makeup brush set",      categorySlug: "beauty"  },
    { q: "press on nails",        categorySlug: "beauty"  },
    { q: "lip gloss set",         categorySlug: "beauty"  },
  ],
  us: [
    { q: "summer maxi dress",     categorySlug: "fashion" },
    { q: "oversized graphic tee", categorySlug: "fashion" },
    { q: "high waisted leggings", categorySlug: "fashion" },
    { q: "cropped cardigan",      categorySlug: "fashion" },
    { q: "cargo pants women",     categorySlug: "fashion" },
    { q: "bodycon mini dress",    categorySlug: "fashion" },
    { q: "loungewear set",        categorySlug: "fashion" },
    { q: "makeup brush set",      categorySlug: "beauty"  },
    { q: "press on nails",        categorySlug: "beauty"  },
    { q: "lip gloss set",         categorySlug: "beauty"  },
  ],
  ae: [
    { q: "abaya casual",          categorySlug: "fashion" },
    { q: "summer maxi dress",     categorySlug: "fashion" },
    { q: "oversized hoodie",      categorySlug: "fashion" },
    { q: "wide leg trousers",     categorySlug: "fashion" },
    { q: "knit cardigan",         categorySlug: "fashion" },
    { q: "co-ord set",            categorySlug: "fashion" },
    { q: "makeup brush set",      categorySlug: "beauty"  },
    { q: "press on nails",        categorySlug: "beauty"  },
    { q: "lip gloss set",         categorySlug: "beauty"  },
    { q: "false eyelashes",       categorySlug: "beauty"  },
  ],
  za: [
    { q: "summer dress",          categorySlug: "fashion" },
    { q: "oversized hoodie",      categorySlug: "fashion" },
    { q: "high waisted jeans",    categorySlug: "fashion" },
    { q: "knit cardigan",         categorySlug: "fashion" },
    { q: "cargo pants",           categorySlug: "fashion" },
    { q: "bodycon dress",         categorySlug: "fashion" },
    { q: "loungewear set",        categorySlug: "fashion" },
    { q: "makeup brush set",      categorySlug: "beauty"  },
    { q: "press on nails",        categorySlug: "beauty"  },
    { q: "lip gloss set",         categorySlug: "beauty"  },
  ],
};

type Merchant = { key: string; name: string; matchers: string[] };

/* Query suffix = name; matchers = lowercase source substrings to keep
   (drops the Amazon/AliExpress spillover Google returns on every query). */
const MERCHANTS: Merchant[] = [
  { key: "shein", name: "SHEIN", matchers: ["shein"] },
  { key: "temu",  name: "Temu",  matchers: ["temu"]  },
];

/* google_shopping-supported markets only. NG excluded (google_shopping
   falls back to "us" and mis-tags); IN excluded (SHEIN is banned there);
   DE deferred. */
const COUNTRIES = ["uk", "us", "ae", "za"];

function argVal(name: string): string | null {
  const f = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}

async function main(): Promise<void> {
  const provider = getActiveSearchProviders().find((p) => p.id === "serpapi-shopping");
  if (!provider) {
    console.error("✗ SerpAPI provider inactive. Set SERPAPI_KEY in env.");
    process.exit(1);
  }

  const merchantArg = argVal("merchants");
  const merchantKeys = merchantArg
    ? new Set(merchantArg.split(",").map((s) => s.trim().toLowerCase()))
    : null;
  const merchants = MERCHANTS.filter((m) => !merchantKeys || merchantKeys.has(m.key));

  const countryArg = argVal("country");
  const countries = (countryArg ? countryArg.split(",").map((s) => s.trim().toLowerCase()) : COUNTRIES)
    .filter((c) => COUNTRIES.includes(c));

  const dryRun = process.argv.includes("--dry-run");

  let planned = 0;
  for (const m of merchants) for (const c of countries) planned += (SKUS_BY_COUNTRY[c]?.length ?? 0);

  console.log(`▶ Cross-border ingest — ${planned} SerpAPI calls planned`);
  console.log(`  Merchants: ${merchants.map((m) => m.name).join(", ")}   Countries: ${countries.join(", ")}`);
  if (merchants.some((m) => m.key === "temu")) {
    console.log("  ⚠ Temu yield is ~0 since its 2025-04-09 Google Shopping pullout — watch the kept= counts.");
  }
  if (dryRun) { console.log("  (dry-run — no SerpAPI calls made)"); return; }
  console.log("");

  const startedAt = Date.now();
  let totalFetched = 0, totalKept = 0, totalUpserted = 0, totalErrors = 0;
  const keptByMerchant: Record<string, number> = {};

  for (const m of merchants) {
    keptByMerchant[m.key] = 0;
    for (const country of countries) {
      const skus = SKUS_BY_COUNTRY[country] ?? [];
      for (const sku of skus) {
        const q = `${sku.q} ${m.name}`;
        const label = `[${m.name.padEnd(5)} ${country}] ${sku.q.padEnd(22)}`;
        try {
          const raw = await provider.searchDeals({ q, countryCode: country, limit: 10 });

          /* Keep ONLY this merchant's rows — Google Shopping returns
             AliExpress/Amazon spillover on every query. Same matcher
             filter ingest-uk-retailers.ts uses. */
          const onTarget = raw.filter((d: Deal) => {
            const nm = d.storeName.toLowerCase();
            const id = d.storeId.toLowerCase();
            return m.matchers.some((x) => nm.includes(x) || id.includes(x));
          });
          onTarget.forEach((d) => { d.categorySlug = sku.categorySlug; });

          const result = await ingestDeals(provider.id, `${m.key}:${sku.q}:${country}`, onTarget);
          totalFetched  += raw.length;
          totalKept     += onTarget.length;
          totalUpserted += result.upserted;
          totalErrors   += result.errors.length;
          keptByMerchant[m.key] += onTarget.length;

          console.log(
            `${result.errors.length === 0 ? "✓" : "⚠"} ${label} raw=${raw.length} kept=${onTarget.length} upserted=${result.upserted}`,
          );
        } catch (err) {
          totalErrors += 1;
          console.error(`✗ ${label} threw: ${(err as Error).message}`);
        }
      }
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log(`▶ Done in ${elapsedSec}s`);
  console.log(`  Raw fetched: ${totalFetched}   Kept: ${totalKept}   Upserted: ${totalUpserted}   Errors: ${totalErrors}`);
  for (const m of merchants) {
    const kept = keptByMerchant[m.key];
    console.log(`  ${m.name}: ${kept} on-target rows${kept === 0 ? "   ⚠ zero kept — consider dropping from cron" : ""}`);
  }
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
