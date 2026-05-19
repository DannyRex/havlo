#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Curated cross-retailer ingest.

   The regular ingest pipeline (npm run ingest) fans out by category
   × country across active providers — which gives us a broad
   catalog but very little overlap. Konga's iPhones and Amazon US's
   iPhones end up as different products with no shared store_id.
   Result: 980 single-store products, 5 multi-store products in QA.

   This script does the opposite: for a hand-picked list of high-
   value product queries (~30 popular SKUs), it asks EVERY active
   search provider for the same product. Same query string + every
   provider = guaranteed cross-store overlap on the targets we care
   about most.

   Combined with the query-time signature pooling in pgFtsFindSimilar,
   each target produces a multi-store comparison even when the
   parsed signatures don't perfectly match across retailers.

   Run:    npm run ingest:curated
   Effect: ~30 targets × 3 countries × N providers → ~250 offer
           rows that all parse to the same brand+model keys, giving
           us a real cross-store demo set for launch.
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";

/* High-value targets — popular SKUs where guaranteed cross-store
   coverage demos Havlo's value prop. Curated to be:
     - Recognisable by name (no obscure SKUs)
     - Available across multiple retailer feeds
     - Distributed across categories so the comparison demo isn't
       just phones */
const TARGETS = [
  // Phones — Apple
  "iPhone 15", "iPhone 15 Pro Max", "iPhone 16", "iPhone 16 Pro Max",
  // Phones — Samsung
  "Samsung Galaxy S24 Ultra", "Samsung Galaxy S25 Ultra",
  "Samsung Galaxy A15", "Samsung Galaxy A55",
  // Phones — Google / NG-relevant
  "Pixel 9 Pro", "Tecno Camon 30", "Infinix Hot 50", "Redmi Note 14",
  // Laptops
  "MacBook Pro M4", "MacBook Air M3", "Dell XPS 13", "HP Pavilion 15",
  // Audio
  "AirPods Pro 2", "AirPods Max", "Sony WH-1000XM5",
  "Bose QuietComfort Ultra", "JBL Charge 5", "Beats Studio Pro",
  // TVs / Home
  "Hisense 50 inch TV", "Samsung 55 inch QLED TV",
  "LG OLED 55", "Sony Bravia 55",
  // Appliances / kitchen
  "Ninja Air Fryer", "Dyson V11",
  // Gaming
  "PlayStation 5", "Xbox Series X", "Nintendo Switch OLED",
  // Wearables
  "Apple Watch Series 10",
  /* ── Non-gadget expansion ───────────────────────────────────────
     The chip pool was gadget-heavy because every curated target
     above lives in phones / laptops / audio / gaming. These are the
     highest-recognition SKUs across footwear, fashion, beauty, and
     home so the demo set spans a buyer's actual shopping basket.
     Phones still pool tightest because buildSignature parses brand
     + model best for electronics; fashion / beauty rely more on
     pg-fts trigram match. Acceptable tradeoff for breadth. */
  // Footwear
  "Nike Air Force 1", "Adidas Samba OG", "Air Jordan 1 Mid",
  "Nike Dunk Low", "Crocs Classic Clog",
  // Fashion
  "Levi's 501 Original", "Ray-Ban Wayfarer", "Calvin Klein Boxers",
  // Beauty
  "Maybelline Lash Sensational", "CeraVe Moisturizing Cream",
  "The Ordinary Niacinamide", "Fenty Beauty Gloss Bomb",
  // Home / kitchen
  "Le Creuset Dutch Oven", "Instant Pot Duo 6QT", "Stanley Quencher 40oz",
];

/* Country fan-out — every launch market. Expanded May 2026 re-audit
   from {ng,us,uk} to the full 7 because the audit kept reporting
   "/compare?q=iphone+15 empty for AE/DE/IN/ZA" — those markets had
   zero iPhone 15 / Galaxy S24 / MacBook Air offers because the
   generic category-name ingest ("phones") doesn't surface specific
   flagship SKUs. The curated-targets path queries by SKU name
   ("iPhone 15") so the SerpAPI result set is guaranteed to contain
   that specific model.

   Credit cost: ~50 targets × 7 countries × 1-2 SerpAPI providers
   = ~350-700 calls. Developer plan (5K credits/mo) absorbs this
   comfortably; run on-demand around audits, not on every cron. */
const COUNTRIES = ["ng", "us", "uk", "de", "ae", "in", "za"];

const PER_QUERY_LIMIT = 5;

async function main() {
  const providers = getActiveSearchProviders();
  if (providers.length === 0) {
    console.error("✗ No active search providers. Set the API keys you want active in .env.local.");
    process.exit(1);
  }

  console.log(`▶ Curated cross-retailer ingest`);
  console.log(`  Providers: ${providers.map((p) => p.id).join(", ")}`);
  console.log(`  Targets:   ${TARGETS.length}`);
  console.log(`  Countries: ${COUNTRIES.join(", ")}`);
  console.log(`  Total searches: ${TARGETS.length * COUNTRIES.length * providers.length}`);
  console.log("");

  const startedAt = Date.now();
  let totalFetched  = 0;
  let totalUpserted = 0;
  let totalErrors   = 0;

  for (const target of TARGETS) {
    for (const country of COUNTRIES) {
      for (const provider of providers) {
        const label = `[${provider.id.padEnd(22)}] ${country} ${target.padEnd(26)}`;
        try {
          const deals = await provider.searchDeals({
            q:           target,
            countryCode: country,
            limit:       PER_QUERY_LIMIT,
          });
          if (deals.length === 0) {
            console.log(`· ${label}  0 results`);
            continue;
          }

          /* Tag with a single category so the curated set is easy
             to inspect / audit later. categorySlug='all' so they
             surface across every category filter. */
          deals.forEach((d) => {
            d.category     = "curated";
            d.categorySlug = "all";
          });

          const result = await ingestDeals(
            provider.id,
            `curated:${target}:${country}`,
            deals,
          );
          totalFetched  += result.fetched;
          totalUpserted += result.upserted;
          totalErrors   += result.errors.length;

          const flag = result.errors.length === 0 ? "✓" : "⚠";
          console.log(
            `${flag} ${label}  fetched=${result.fetched} upserted=${result.upserted} errors=${result.errors.length}`,
          );
          if (result.errors.length > 0) {
            for (const e of result.errors.slice(0, 1)) console.log(`    · ${e}`);
          }
        } catch (err) {
          totalErrors++;
          console.error(`✗ ${label}  ${(err as Error).message}`);
        }
      }
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log(`▶ Done in ${elapsed}s`);
  console.log(`  Fetched:  ${totalFetched}`);
  console.log(`  Upserted: ${totalUpserted}`);
  console.log(`  Errors:   ${totalErrors}`);
  console.log("");
  console.log(`Recommended follow-up:`);
  console.log(`  1. npm run dedup            (collapse newly-ingested duplicates)`);
  console.log(`  2. Re-run the verify-dedup query in Supabase`);
  console.log(`  3. Test /ng/compare?q=iPhone+15+Pro+Max — should show multi-store offers`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
