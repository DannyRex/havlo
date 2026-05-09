#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Diagnose Batch 4 fix: how does the country filter trim the UK
   intl pool now that the untagged-pass leak is plugged.

   What it does:
     1. Fetches ~5K deals from the active provider (browse-db).
     2. Runs them through the NEW filter for NG and UK.
     3. Runs an INLINE re-implementation of the OLD filter for UK
        (the `tag === null → pass` form) to compute the delta.
     4. Prints store-by-store breakdown of what got dropped.

   Run: tsx scripts/diagnose-country-filter.ts
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getActiveBrowseProvider } from "../src/lib/providers";
import {
  filterDealsForCountry, getCountry,
  isNigerianStore, isCrossBorderStore, isStoreInCountry,
  dealCountryTag,
} from "../src/lib/country";
import type { Deal } from "../src/types";

/* Inline copy of the OLD filter — the `tag === null → return true`
   form. Keeps NG path untouched. Used only to compute the delta. */
function oldFilterForUk(deals: Deal[]): Deal[] {
  return deals.filter((d) => {
    if (isNigerianStore(d)) return false;
    if (isCrossBorderStore(d, "uk")) return true;
    if (isStoreInCountry(d, "uk")) return true;
    const tag = dealCountryTag(d);
    if (tag === "uk") return true;
    if (tag === null) return true;       // ← the leak
    return false;
  });
}

function topStores(deals: Deal[], n = 12): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const d of deals) {
    const k = `${d.storeName} (${d.currency})`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/* Inline OLD filter for an arbitrary non-NG country (the leaky form). */
function oldFilterFor(deals: Deal[], code: string): Deal[] {
  return deals.filter((d) => {
    if (isNigerianStore(d)) return false;
    if (isCrossBorderStore(d, code)) return true;
    if (isStoreInCountry(d, code)) return true;
    const tag = dealCountryTag(d);
    if (tag === code) return true;
    if (tag === null) return true;       // ← the leak
    return false;
  });
}

async function main(): Promise<void> {
  const provider = await getActiveBrowseProvider();
  const all = await provider.fetchDeals({ origin: "all", sort: "discount" });
  console.log(`\nFetched ${all.length} raw deals from ${provider.id}\n`);

  const codes = ["ng", "uk", "us", "de", "ae", "in", "za"];

  console.log("─".repeat(72));
  console.log("country  newPool  oldPool  ΔdroppedByFix  topStoreShare");
  console.log("─".repeat(72));
  for (const code of codes) {
    const country = getCountry(code);
    const newPool = filterDealsForCountry(all, country);
    const oldPool = code === "ng" ? newPool : oldFilterFor(all, code);
    const dropped = oldPool.filter((d) => !newPool.some((n) => n.id === d.id));
    const top = topStores(newPool, 1)[0];
    const topShare = top ? `${top[0]} ${(top[1] / Math.max(newPool.length, 1) * 100).toFixed(0)}%` : "—";
    console.log(`${code.padEnd(8)} ${String(newPool.length).padStart(7)} ${String(oldPool.length).padStart(8)} ${String(dropped.length).padStart(14)}  ${topShare}`);
  }
  console.log("─".repeat(72));

  console.log("\nUK store breakdown (composition is the real issue, not leak):");
  for (const [store, n] of topStores(filterDealsForCountry(all, getCountry("uk")), 10)) {
    console.log(`  ${String(n).padStart(5)} × ${store}`);
  }

  console.log("\nDE store breakdown:");
  for (const [store, n] of topStores(filterDealsForCountry(all, getCountry("de")), 10)) {
    console.log(`  ${String(n).padStart(5)} × ${store}`);
  }
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
