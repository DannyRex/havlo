#!/usr/bin/env tsx
/* Diagnostic probe: fire ONE SerpAPI call per problem retailer and
   print the raw source strings Google Shopping returns. Used to
   debug why AO.com / Very / M&S returned ~0 from the last UK ingest
   despite having real catalogues.

   Why this exists: ingest-uk-retailers.ts filters SerpAPI responses
   via a `matchers: string[]` list. If the substring we're matching
   doesn't appear in the source string Google returns, the row gets
   dropped. The fix is to update the matcher — but first we need to
   see the actual string. This script does that without burning
   credits on a full re-ingest.

   Cost: 1 SerpAPI call per retailer × 3 retailers = 3 credits.

   Usage:
     pnpm tsx scripts/diagnose-uk-matchers.ts
     pnpm tsx scripts/diagnose-uk-matchers.ts --retailers=ao,very

   Output:
     For each retailer, print the raw `store` strings from the top
     5 SerpAPI results so we can eyeball what Google considers
     canonical. */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getActiveSearchProviders } from "../src/lib/providers";
import type { Deal } from "../src/types";

const PROBES: Array<{ name: string; key: string; sku: string }> = [
  /* One SKU per retailer that we'd expect them to stock. Cheap
     calls, but no point probing something the retailer doesn't
     sell. AO is white goods so an air fryer is fair; Very and
     M&S are department-store catalogues with fashion + electronics
     overlap. */
  { name: "AO.com",          key: "ao",    sku: "Ninja Air Fryer" },
  { name: "Very",            key: "very",  sku: "iPhone 17" },
  { name: "Marks & Spencer", key: "marks", sku: "duvet king size" },
];

function parseArgs(): Set<string> | null {
  const arg = process.argv.find((a) => a.startsWith("--retailers="));
  if (!arg) return null;
  return new Set(
    arg.slice("--retailers=".length).split(",").map((s) => s.trim().toLowerCase()),
  );
}

async function main(): Promise<void> {
  const filter = parseArgs();
  const providers = getActiveSearchProviders().filter((p) => p.id === "serpapi-shopping");
  if (providers.length === 0) {
    console.error("✗ SerpAPI provider inactive. Set SERPAPI_KEY in env.");
    process.exit(1);
  }
  const provider = providers[0];

  const probes = filter ? PROBES.filter((p) => filter.has(p.key)) : PROBES;

  console.log(`▶ Diagnostic probe — ${probes.length} SerpAPI calls\n`);

  for (const probe of probes) {
    const q = `${probe.name} ${probe.sku}`;
    console.log(`──  ${probe.name}  ──`);
    console.log(`    query: "${q}"`);

    try {
      const raw = await provider.searchDeals({
        q,
        countryCode: "uk",
        limit: 10,
      });

      if (raw.length === 0) {
        console.log("    (no results)");
      } else {
        /* Print the raw store / storeId / storeName fields from the
           top 5 results. The "source" field in SerpAPI's response
           lands in storeName after parsing — that's the substring
           the matcher tests against. */
        console.log("    Top 5 results — what storeName Google returned:");
        raw.slice(0, 5).forEach((d: Deal, i) => {
          console.log(`      ${i + 1}. storeName=${JSON.stringify(d.storeName).padEnd(40)} storeId=${JSON.stringify(d.storeId)}`);
        });
      }
    } catch (err) {
      console.error(`    ✗ threw: ${(err as Error).message}`);
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
