#!/usr/bin/env tsx
/* Diagnose homepage CategoryGrid count vs /api/deals total. The user
   reported the homepage tile count doesn't match what /deals page shows
   for the same category.

   Hits Supabase directly (bypassing unstable_cache + provider abstraction
   which require the Next request context) to recreate both pipelines
   side-by-side and surface the deltas. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { categories } from "../src/lib/data/categories";
import { filterDealsForCountry, getCountry, inferStoreCountry } from "../src/lib/country";
import { isUsableMerchantUrl } from "../src/lib/url-helpers";
import type { Deal } from "../src/types";

const browsable = categories.filter((c) => c.slug !== "all");

interface Row {
  product_id:       string;
  title:            string;
  category_slug:    string | null;
  brand:            string | null;
  image_url:        string | null;
  offer_id:         string;
  store_id:         string;
  url:              string;
  current_price:    number;
  original_price:   number | null;
  discount_percent: number | null;
  currency:         "NGN" | "USD";
  scraped_at:       string;
  store_name:       string;
  is_international: boolean;
  store_logo_url:   string | null;
}

function rowToDeal(r: Row): Deal {
  return {
    id: r.offer_id, title: r.title, description: r.title,
    category: r.category_slug ?? "general",
    categorySlug: r.category_slug ?? "all",
    storeId: r.store_id, storeName: r.store_name,
    originalPrice: r.original_price ?? r.current_price,
    salePrice: r.current_price,
    discountPercent: r.discount_percent ?? 0,
    currency: r.currency,
    imageUrl: r.image_url ?? undefined,
    imageGradient: "", imageEmoji: "",
    url: r.url, expiresAt: null,
    isHot: (r.discount_percent ?? 0) >= 30,
    isFeatured: false,
    tags: [r.store_name, r.category_slug ?? ""].filter(Boolean),
    saves: 0, clicks: 0,
    postedAt: r.scraped_at.slice(0, 10),
  };
}

async function fetchAll(opts: {
  category?: string;
  minDiscount: number;
  origin: "local" | "intl" | "all";
}): Promise<Deal[]> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];
  const PAGE = 1000, PAGES = 8;
  const buildQuery = () => {
    let q = supa.from("product_best_offers").select("*");
    if (opts.category && opts.category !== "all") q = q.eq("category_slug", opts.category);
    if (opts.minDiscount > 0) q = q.gte("discount_percent", opts.minDiscount);
    if (opts.origin === "local") q = q.eq("is_international", false);
    if (opts.origin === "intl")  q = q.eq("is_international", true);
    return q.order("discount_percent", { ascending: false }).order("offer_id", { ascending: true });
  };
  const reqs = Array.from({ length: PAGES }, (_, i) =>
    buildQuery().range(i * PAGE, (i + 1) * PAGE - 1));
  const results = await Promise.all(reqs);
  const all: Row[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (!r.data) continue;
    for (const row of r.data as Row[]) {
      if (seen.has(row.offer_id)) continue;
      seen.add(row.offer_id);
      all.push(row);
    }
  }
  return all.filter((r) => isUsableMerchantUrl(r.url)).map(rowToDeal);
}

async function main() {
  for (const countryCode of ["ng", "uk"] as const) {
    const country = getCountry(countryCode);
    const isNG = country.code === "ng";
    console.log(`\n══ ${country.code.toUpperCase()} ${country.name} ══`);
    console.log(`slug             tile-count   deals-total   delta`);

    for (const cat of browsable) {
      /* /api/deals pipeline (truth source) */
      const apiRaw = await fetchAll({
        category: cat.slug, minDiscount: 0, origin: "all",
      });
      const apiFiltered = filterDealsForCountry(apiRaw, country);
      const isLocalToUser = (d: Deal): boolean => {
        const sc = inferStoreCountry(d.storeId, d.storeName);
        if (sc !== null) return sc.toLowerCase() === country.code.toLowerCase();
        return d.currency === country.currency;
      };
      const effectiveOrigin = !isNG ? "intl" : "all";
      const apiTotal =
        effectiveOrigin === "intl" ? apiFiltered.filter((d) => !isLocalToUser(d)).length :
        apiFiltered.length;

      /* CategoryGrid pipeline (post-fix — must match) */
      const tileFiltered = filterDealsForCountry(apiRaw, country);
      const tileCount = isNG
        ? tileFiltered.length
        : tileFiltered.filter((d) => !isLocalToUser(d)).length;

      const delta = tileCount - apiTotal;
      const flag = delta === 0 ? "✓" : (delta > 0 ? "OVER " : "UNDER");
      console.log(`${cat.slug.padEnd(14)}  ${String(tileCount).padStart(8)}   ${String(apiTotal).padStart(11)}   ${String(delta).padStart(5)}  ${flag}`);
    }
  }
}
main().catch((e) => { console.error("✗", e); process.exit(1); });
