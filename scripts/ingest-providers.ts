#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Cron-runnable ingestion — pulls live deals from configured search
   providers (SerpAPI etc.) and upserts into products + offers.

   Usage:
     npm run ingest                                 # default countries × all categories
     npm run ingest -- --category=phones,laptops    # subset of categories
     npm run ingest -- --country=us,uk,de           # subset of countries
     npm run ingest -- --provider=serpapi-shopping  # specific provider only
     npm run ingest -- --limit=24                   # per category × country cap

   Default countries: the markets Nigerians actually import from.
   ────────────────────────────────────────────────────────────────── */

/* Load .env.local via Node 20.6+ built-in (no dotenv dep). */
try {
  // @ts-expect-error — process.loadEnvFile is Node-runtime, not in @types/node
  process.loadEnvFile?.(".env.local");
} catch {/* already loaded or unavailable */}

import { categories } from "../src/lib/data/categories";
import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";
import { fetchSerpapiAccount, hasBudget } from "../src/lib/providers/serpapi-credits";

/* High-value categories that benefit from market-mode ingest. These
   have stable MSRPs where the honest spectrum value matters more
   than promo density. Other categories (fashion / beauty / home /
   sports / gaming / health) stick with deals-mode because users
   come there for promotional inventory. */
const MARKET_MODE_CATEGORIES = new Set([
  "phones", "computing", "audio", "electronics", "appliances",
]);

/* The international markets Nigerian shoppers most commonly import from.
   - us:  Amazon.com, eBay, Walmart, Best Buy
   - uk:  Amazon.co.uk, ASOS, Argos, Currys
   - ae:  Amazon.ae, Noon, Sharaf DG (Lagos↔Dubai trade route)
   - de:  Amazon.de, Zalando (auto parts, fashion)
   - in:  Amazon.in, Flipkart (some electronics)
   - za:  Takealot (regional)
   Skip: ng (Google Shopping doesn't operate in Nigeria — use the
   Playwright scraper or affiliate APIs for local stores). */
const DEFAULT_COUNTRIES = ["us", "uk", "ae", "de", "in", "za"];

interface CliArgs {
  categorySlugs?: string[];
  providerId?: string;
  countries: string[];
  perCategoryLimit: number;
  mode: "deals" | "market";
}

function parseArgs(): CliArgs {
  const args: CliArgs = { countries: DEFAULT_COUNTRIES, perCategoryLimit: 20, mode: "deals" };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--category=")) {
      args.categorySlugs = arg.slice("--category=".length).split(",").map((s) => s.trim());
    } else if (arg.startsWith("--provider=")) {
      args.providerId = arg.slice("--provider=".length);
    } else if (arg.startsWith("--country=") || arg.startsWith("--countries=")) {
      args.countries = arg.split("=")[1].split(",").map((s) => s.trim().toLowerCase());
    } else if (arg.startsWith("--limit=")) {
      args.perCategoryLimit = parseInt(arg.slice("--limit=".length), 10) || 20;
    } else if (arg === "--mode=market") {
      args.mode = "market";
    } else if (arg === "--mode=deals") {
      args.mode = "deals";
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const providers = getActiveSearchProviders().filter(
    (p) => !args.providerId || p.id === args.providerId,
  );

  if (providers.length === 0) {
    console.error("✗ No active search providers. Set SERPAPI_KEY (or other) in .env.local");
    process.exit(1);
  }

  let targetCategories = args.categorySlugs
    ? categories.filter((c) => args.categorySlugs!.includes(c.slug))
    : categories.filter((c) => c.slug !== "all");

  /* Market mode runs ONLY on the high-value category whitelist. The
     rest stay in deals mode (handled by the regular Mon+Thu cron).
     This keeps the monthly market cron tiny (~30 calls vs 132 for a
     deal run) and focused on the categories where MSRP visibility
     actually moves the trust dial. */
  if (args.mode === "market" && !args.categorySlugs) {
    targetCategories = targetCategories.filter((c) => MARKET_MODE_CATEGORIES.has(c.slug));
  }

  const totalCalls = targetCategories.length * args.countries.length * providers.length;

  /* SerpAPI credit guard — gated to market mode by design.

     The deal cron (Mon+Thu) is the primary user-facing data refresh:
     we want it to run even when credits are tight, because broken
     `/deals` freshness hurts the product more than spending the last
     plan credits. Add the guard there too if you want, but the
     fail-mode of "deal cron skipped" is worse than "deal cron drains
     credits and we top up sooner".

     Market mode is OPPOSITE: it's a nice-to-have monthly enrichment.
     If credits are low, we'd rather preserve them for user-facing
     live-search (which fires on every paste-a-link / unusual query).
     So market mode SKIPS gracefully when credits + 50% buffer
     wouldn't survive the planned calls.

     Exit code 0 on skip is intentional — GitHub Actions treats
     non-zero as failure and would email/alert. A skip-due-to-budget
     isn't a failure, it's expected steady-state behaviour. */
  const serpapiKey = process.env.SERPAPI_KEY?.trim();
  const usesSerpapi = providers.some((p) => p.id.includes("serpapi"));
  if (args.mode === "market" && serpapiKey && usesSerpapi) {
    try {
      const acct = await fetchSerpapiAccount(serpapiKey);
      console.log(`▶ SerpAPI credits — plan=${acct.planLeft}, extra=${acct.extraLeft}, total=${acct.totalLeft} (${acct.planName})`);
      if (!hasBudget(acct, totalCalls)) {
        console.log(`▷ SKIP: market run needs ${totalCalls} + ${Math.ceil(totalCalls * 0.5)} buffer = ${Math.ceil(totalCalls * 1.5)} credits. Have ${acct.totalLeft}. Reserving budget for user-facing live-search; exiting cleanly.`);
        process.exit(0);
      }
    } catch (err) {
      console.warn(`⚠ SerpAPI credit check failed: ${(err as Error).message}. Proceeding anyway.`);
    }
  }

  console.log(`▶ Ingesting ${args.mode} — ${totalCalls} total searches`);
  console.log(`  Mode:       ${args.mode}${args.mode === "market" ? " (market lane — drops 'deals' query suffix)" : ""}`);
  console.log(`  Providers:  ${providers.map((p) => p.id).join(", ")}`);
  console.log(`  Countries:  ${args.countries.join(", ")}`);
  console.log(`  Categories: ${targetCategories.map((c) => c.slug).join(", ")}`);
  console.log(`  Limit:      ${args.perCategoryLimit} items / search`);
  console.log("");

  const startedAt = Date.now();
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;

  for (const category of targetCategories) {
    for (const country of args.countries) {
      for (const provider of providers) {
        const label = `[${provider.id}] ${country.padEnd(2)} ${category.name.padEnd(18)}`;
        try {
          const deals = await provider.searchDeals({
            q: category.name,
            countryCode: country,
            limit: args.perCategoryLimit,
            mode: args.mode,
          });

          // Tag every deal with the source category so /api/deals
          // can filter by categorySlug = "phones" etc.
          deals.forEach((d) => {
            d.category = category.name;
            d.categorySlug = category.slug;
          });

          const result = await ingestDeals(provider.id, `${category.slug}:${country}`, deals);
          totalFetched += result.fetched;
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;

          // Quick discount summary so we can spot non-deal feeds at a glance
          const discounts = deals.map((d) => d.discountPercent).filter((p) => p > 0);
          const avgDiscount = discounts.length
            ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
            : 0;
          const minDisc = discounts.length ? Math.min(...discounts) : 0;
          const maxDisc = discounts.length ? Math.max(...discounts) : 0;

          const flag = result.errors.length === 0 ? "✓" : "⚠";
          console.log(
            `${flag} ${label}  fetched=${result.fetched} upserted=${result.upserted} discounts=${discounts.length}/${deals.length} (avg ${avgDiscount}%, range ${minDisc}-${maxDisc}%) errors=${result.errors.length}`,
          );
          if (result.errors.length > 0) {
            for (const e of result.errors.slice(0, 2)) console.log(`    · ${e}`);
            if (result.errors.length > 2) console.log(`    · …and ${result.errors.length - 2} more`);
          }
        } catch (err) {
          totalErrors += 1;
          console.error(`✗ ${label}  threw: ${(err as Error).message}`);
        }
      }
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log(`▶ Done in ${elapsedSec}s`);
  console.log(`  Fetched:  ${totalFetched}`);
  console.log(`  Upserted: ${totalUpserted}`);
  console.log(`  Errors:   ${totalErrors}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
