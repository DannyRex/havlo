#!/usr/bin/env tsx
/* Diagnostic: replicate getTrendingBuckets + composePicks per country and print
   where each market thins out. Read-only. Run:
     npx tsx scripts/maint/diagnose-trending.ts
*/
try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }

import { getActiveBrowseProvider } from "../../src/lib/providers";
import { filterDealsForCountry, getCountry } from "../../src/lib/country";
import { classifyDeal, spaceByStore } from "../../src/lib/providers/curated-helper";
import { displayDiscountPct, isPlaceholderImageUrl } from "../../src/lib/utils";
import { merchantSearchUrl } from "../../src/lib/merchant-search-urls";
import { composePicks } from "../../src/components/landing/trending-compose";
import type { Deal } from "../../src/types";

const PER_STORE_CAP = 5;
const CAPS = { local: 110, amazon: 48, aliexpress: 14, intlOther: 28 };

const isDeadPassthrough = (u?: string) =>
  !!u && /ibp(?:=|%3d)os|google\.[a-z.]+(?:\/|%2f)search/i.test(u);
const routesToMerchant = (d: Deal, cc: string) => !!merchantSearchUrl(d.storeId, d.storeName, d.title, cc);
const qualityFilter = (cc: string) => (d: Deal) =>
  d.title.length >= 10 && d.title.length <= 70 && !d.title.includes("\\") &&
  !(d.currency === "USD" && d.salePrice < 10) &&
  Boolean(d.imageUrl) && !isPlaceholderImageUrl(d.imageUrl) &&
  displayDiscountPct(d.originalPrice, d.salePrice) > 0 &&
  (!isDeadPassthrough(d.url) || routesToMerchant(d, cc));

function capPerStore(bucket: Deal[], cap: number): Deal[] {
  const seen = new Map<string, number>(); const out: Deal[] = [];
  for (const d of bucket) { const c = seen.get(d.storeId) ?? 0; if (c >= cap) continue; seen.set(d.storeId, c + 1); out.push(d); }
  return out;
}
const byClicks = (b: Deal[]) => [...b].sort((a, z) => (z.clicks ?? 0) - (a.clicks ?? 0));

function composeBuckets(pool: Deal[], isNG: boolean) {
  const b: Record<string, Deal[]> = { local: [], amazon: [], aliexpress: [], "intl-other": [] };
  for (const d of pool) {
    const base = classifyDeal(d);
    if (isNG && base === "local" && d.currency !== "NGN") b["intl-other"].push(d);
    else b[base].push(d);
  }
  return {
    local:      capPerStore(byClicks(b.local), PER_STORE_CAP).slice(0, CAPS.local),
    amazon:     capPerStore(byClicks(b.amazon), PER_STORE_CAP).slice(0, CAPS.amazon),
    aliexpress: capPerStore(byClicks(b.aliexpress), PER_STORE_CAP).slice(0, CAPS.aliexpress),
    intlOther:  capPerStore(byClicks(b["intl-other"]), PER_STORE_CAP).slice(0, CAPS.intlOther),
  };
}

const dedup = (rows: Deal[]) => { const s = new Set<string>(); const o: Deal[] = []; for (const d of rows) { if (s.has(d.id)) continue; s.add(d.id); o.push(d); } return o; };
const topStores = (rows: Deal[], n = 6) => {
  const m = new Map<string, number>(); for (const d of rows) m.set(d.storeName, (m.get(d.storeName) ?? 0) + 1);
  return [...m.entries()].sort((a, z) => z[1] - a[1]).slice(0, n).map(([s, c]) => `${s}:${c}`).join(", ");
};

async function main() {
  const provider = await getActiveBrowseProvider();
  for (const cc of ["ng", "us", "uk", "in", "za", "ae"]) {
    const isNG = cc === "ng";
    const country = getCountry(cc);
    const OPT = { timeoutMs: 20000, noCuratedFallback: false } as const;
    let raw: Deal[];
    if (!isNG) {
      const [disc, fresh] = await Promise.all([
        provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "intl", country: cc }, OPT).catch(() => [] as Deal[]),
        provider.fetchDeals({ sort: "newest", minDiscount: 5, origin: "intl", country: cc }, OPT).catch(() => [] as Deal[]),
      ]);
      raw = [...disc, ...fresh];
      raw = filterDealsForCountry(raw, country);
    } else {
      const [lp, ip, lf, jo] = await Promise.all([
        provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "local", country: cc }, OPT).catch(() => [] as Deal[]),
        provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "intl", country: cc }, OPT).catch(() => [] as Deal[]),
        provider.fetchDeals({ sort: "newest", minDiscount: 5, origin: "local", country: cc }, OPT).catch(() => [] as Deal[]),
        provider.fetchDeals({ sort: "newest", minDiscount: 5, origin: "local", country: cc, stores: ["jumia"] }, OPT).catch(() => [] as Deal[]),
      ]);
      raw = [...lp, ...ip, ...lf, ...jo];
    }
    const rawU = dedup(raw);
    const quality = rawU.filter(qualityFilter(cc));
    const buckets = composeBuckets(quality, isNG);
    const picks = composePicks(buckets, true);
    console.log(`\n=== ${cc.toUpperCase()} ===`);
    console.log(`  raw(dedup)=${rawU.length}  afterQuality=${quality.length}`);
    console.log(`  buckets: local=${buckets.local.length} amazon=${buckets.amazon.length} ali=${buckets.aliexpress.length} intlOther=${buckets.intlOther.length}`);
    console.log(`  FINAL PICK=${picks.length} (target 16)`);
    console.log(`  quality top stores: ${topStores(quality)}`);
    /* Why quality drops rows: show the failing reasons on the raw pool. */
    let noImg = 0, ph = 0, noDisc = 0, badTitle = 0, dead = 0;
    for (const d of rawU) {
      if (!d.imageUrl) noImg++;
      else if (isPlaceholderImageUrl(d.imageUrl)) ph++;
      if (!(displayDiscountPct(d.originalPrice, d.salePrice) > 0)) noDisc++;
      if (!(d.title.length >= 10 && d.title.length <= 70) || d.title.includes("\\")) badTitle++;
      if (isDeadPassthrough(d.url) && !routesToMerchant(d, cc)) dead++;
    }
    console.log(`  drop reasons on raw: noImage=${noImg} placeholder=${ph} noVisibleDiscount=${noDisc} badTitle=${badTitle} deadUrl=${dead}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
