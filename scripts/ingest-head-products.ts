#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Head-product saturation ingest — docs/vertical-depth-plan.md.

   Targets the comparison-DENSE tech vertical by querying specific popular
   MODELS per market (phones, computing, audio, gaming, electronics,
   appliances) instead of broad category names. One market-mode SerpAPI
   query per model returns many sellers + a google_shopping_id (the real
   cross-merchant match key), so this is the highest comparison-density-
   per-credit ingest path.

   Separate from scripts/ingest-providers.ts on purpose: the cron loop stays
   untouched. Run this manually (or add to a workflow) when you want to push
   density on the head spine.

   Usage:
     npm run ingest:head                      # default countries × head spine
     npm run ingest:head -- --country=uk,us   # subset of markets
     npm run ingest:head -- --limit=24        # items per query
   NG note: Google Shopping doesn't serve NG, so NG is excluded here; NG head
   products come from the site-scoped NG-merchant lane (ingest:ng-serpapi).
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — process.loadEnvFile is Node-runtime, not in @types/node
  process.loadEnvFile?.(".env.local");
} catch {/* already loaded or unavailable */}

import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";
import { fetchSerpapiAccount, hasBudget } from "../src/lib/providers/serpapi-credits";
import { headProductSeeds } from "../src/lib/providers/head-products";

/* google_shopping markets only — NG isn't supported by the engine (see file
   header). NG head products flow through ingest:ng-serpapi. */
const DEFAULT_COUNTRIES = ["us", "uk", "ae", "in", "za"];

async function main() {
  let countries = DEFAULT_COUNTRIES;
  let limit = 24;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--country=")) {
      countries = arg.slice("--country=".length).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else if (arg.startsWith("--limit=")) {
      limit = Math.max(1, parseInt(arg.slice("--limit=".length), 10) || limit);
    }
  }

  const providers = getActiveSearchProviders().filter((p) => p.id.includes("serpapi"));
  if (providers.length === 0) {
    console.error("✗ Head-product ingest needs a SerpAPI provider. Set SERPAPI_KEY in .env.local");
    process.exit(1);
  }

  /* (country, seed) jobs — the global core runs for every market, plus that
     market's local additions. */
  const jobs = countries.flatMap((country) =>
    headProductSeeds(country).map((s) => ({ country, ...s })),
  );
  const totalCalls = jobs.length * providers.length;

  /* Credit guard — same 0-buffer policy as the deals cron: if we can't afford
     the whole run, skip cleanly (exit 0) rather than burn a partial run. */
  const serpapiKey = process.env.SERPAPI_KEY?.trim();
  if (serpapiKey) {
    try {
      const acct = await fetchSerpapiAccount(serpapiKey);
      console.log(`▶ SerpAPI credits — total=${acct.totalLeft} (${acct.planName})`);
      if (!hasBudget(acct, totalCalls, 0)) {
        console.log(`▷ SKIP: head-product run needs ${totalCalls} credits, have ${acct.totalLeft}. Top up to resume; exiting cleanly.`);
        process.exit(0);
      }
    } catch (err) {
      console.warn(`⚠ SerpAPI credit check failed: ${(err as Error).message}. Proceeding anyway.`);
    }
  }

  console.log(`▶ Head-product ingest — ${jobs.length} seeds × ${providers.length} provider(s) = ${totalCalls} searches`);
  console.log(`  Countries: ${countries.join(", ")}`);
  console.log(`  Limit:     ${limit} items / search`);
  console.log("");

  let fetched = 0, upserted = 0, errors = 0;
  for (const job of jobs) {
    for (const provider of providers) {
      const label = `[${provider.id}] ${job.country.padEnd(2)} ${job.q.slice(0, 26).padEnd(26)}`;
      try {
        /* market mode + keepFullPrice: we want EVERY seller (full price and
           promo) so the cross-store spectrum is dense, not just discounts. */
        const deals = await provider.searchDeals({
          q:           job.q,
          countryCode: job.country,
          limit,
          mode:        "market",
          keepFullPrice: true,
        });
        deals.forEach((d) => { d.category = job.categoryName; d.categorySlug = job.categorySlug; });
        const r = await ingestDeals(provider.id, `head:${job.categorySlug}:${job.country}`, deals);
        fetched += r.fetched; upserted += r.upserted; errors += r.errors.length;
        console.log(`${r.errors.length === 0 ? "✓" : "⚠"} ${label}  fetched=${r.fetched} upserted=${r.upserted} errors=${r.errors.length}`);
      } catch (err) {
        errors += 1;
        console.error(`✗ ${label}  threw: ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n▶ Done — fetched=${fetched} upserted=${upserted} errors=${errors}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
