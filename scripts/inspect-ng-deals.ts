#!/usr/bin/env tsx
/* One-shot diagnostic: why /ng/deals only shows 4 stores.
   Counts offers per store across the whole DB so we can see whether
   the missing stores (ASOS, Shein, Temu, eBay, etc.) are actually
   ingested or just filtered out. Also reports total offer count vs
   in_stock count vs unique store count.

   Run: npx tsx --tsconfig tsconfig.scripts.json scripts/inspect-ng-deals.ts */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { filterDealsForCountry, getCountry } from "../src/lib/country";
import type { Deal } from "../src/types";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase admin client unavailable");
    process.exit(1);
  }

  console.log("▶ Catalog audit — what's actually in the DB?\n");

  /* 1. Total products + offers + stores */
  const [{ count: pCount }, { count: oCount }, { count: sCount }] = await Promise.all([
    supa.from("products").select("*", { count: "exact", head: true }),
    supa.from("offers").select("*", { count: "exact", head: true }),
    supa.from("stores").select("*", { count: "exact", head: true }),
  ]);
  console.log(`Total products: ${pCount}`);
  console.log(`Total offers:   ${oCount}`);
  console.log(`Total stores:   ${sCount}\n`);

  /* 2. In-stock offers grouped by store */
  const { data: rows } = await supa
    .from("offers")
    .select("store_id, in_stock, currency, stores!inner(name, country, is_international)")
    .eq("in_stock", true)
    .limit(10000);

  if (!rows) {
    console.error("✗ Failed to fetch offers");
    process.exit(1);
  }

  type Row = {
    store_id: string;
    currency: string;
    stores: { name: string; country: string | null; is_international: boolean };
  };

  const counts = new Map<string, { name: string; country: string | null; intl: boolean; count: number; ngn: number; usd: number }>();
  for (const r of rows as unknown as Row[]) {
    const key = r.store_id;
    const existing = counts.get(key) ?? {
      name: r.stores.name,
      country: r.stores.country,
      intl: r.stores.is_international,
      count: 0, ngn: 0, usd: 0,
    };
    existing.count++;
    if (r.currency === "NGN") existing.ngn++;
    else existing.usd++;
    counts.set(key, existing);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);

  console.log(`In-stock offers by store (top 30):\n`);
  console.log(`  ${"id".padEnd(28)} ${"name".padEnd(22)} ${"country".padEnd(8)} ${"intl".padEnd(5)} ${"count".padStart(6)}  ngn / usd`);
  for (const [id, m] of sorted.slice(0, 30)) {
    const intlStr = m.intl ? "yes" : "no";
    console.log(`  ${id.padEnd(28)} ${(m.name ?? "").slice(0, 22).padEnd(22)} ${(m.country ?? "null").padEnd(8)} ${intlStr.padEnd(5)} ${String(m.count).padStart(6)}  ${m.ngn} / ${m.usd}`);
  }

  console.log(`\nUnique stores with offers: ${counts.size}`);

  /* 3. Simulate the NG filter to see how many of those stores
        would actually surface on /ng/deals. */
  console.log(`\n── NG filter simulation ──`);
  const ngCountry = getCountry("ng");
  const fakeDeals: Array<Deal> = Array.from(counts.entries()).flatMap(([id, m]) =>
    Array(m.count).fill(null).map(() => ({
      id, title: m.name, description: m.name,
      category: "general", categorySlug: "all",
      storeId: id, storeName: m.name,
      originalPrice: 0, salePrice: 0, discountPercent: 0,
      currency: m.ngn > 0 ? "NGN" : "USD",
      imageGradient: "", imageEmoji: "", url: "",
      expiresAt: null, isHot: false, isFeatured: false,
      tags: [], saves: 0, clicks: 0, postedAt: "2026-01-01",
    } as Deal))
  );
  const ngFiltered = filterDealsForCountry(fakeDeals, ngCountry);
  const ngStores = new Set(ngFiltered.map((d) => d.storeId));
  console.log(`Offers passing NG filter: ${ngFiltered.length} (of ${fakeDeals.length})`);
  console.log(`Distinct stores visible to NG users: ${ngStores.size}`);

  /* 4. Stores in DB that have NO offers — wasted store rows */
  const allStoreIds = new Set<string>();
  const { data: allStores } = await supa.from("stores").select("id, name");
  ((allStores ?? []) as Array<{ id: string; name: string }>).forEach((s) => allStoreIds.add(s.id));
  const storesWithoutOffers = Array.from(allStoreIds).filter((id) => !counts.has(id));
  if (storesWithoutOffers.length > 0) {
    console.log(`\nStores with 0 in-stock offers: ${storesWithoutOffers.length}`);
    console.log(`  ${storesWithoutOffers.slice(0, 10).join(", ")}${storesWithoutOffers.length > 10 ? "..." : ""}`);
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
