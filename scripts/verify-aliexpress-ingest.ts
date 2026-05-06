#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Quick sanity check: did the AliExpress ingest land in Supabase,
   and what does the catalog look like?

   Schema reminder:
     - offers.store_id is the FK we filter on
     - offers.product_id joins to products (which holds title + category)

   Run: npx tsx --tsconfig tsconfig.scripts.json scripts/verify-aliexpress-ingest.ts
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase env vars missing");
    process.exit(1);
  }

  /* Total AliExpress offers (one per store-URL pair) */
  const { count: offerCount, error: countErr } = await supa
    .from("offers")
    .select("*", { count: "exact", head: true })
    .eq("store_id", "aliexpress");

  if (countErr) {
    console.error("✗ Count query failed:", JSON.stringify(countErr, null, 2));
    process.exit(1);
  }

  console.log(`▶ AliExpress offers in Supabase: ${offerCount ?? 0}`);

  /* Distinct products behind those offers */
  const { data: offerRows } = await supa
    .from("offers")
    .select("product_id, source_country, current_price, original_price, discount_percent")
    .eq("store_id", "aliexpress");

  const distinctProducts = new Set((offerRows ?? []).map((r) => r.product_id));
  console.log(`▶ Distinct AliExpress products:    ${distinctProducts.size}`);

  /* By source_country */
  const byCountry: Record<string, number> = {};
  for (const r of offerRows ?? []) {
    const c = r.source_country ?? "(global)";
    byCountry[c] = (byCountry[c] ?? 0) + 1;
  }
  console.log("\n▶ Offers by source_country:");
  Object.entries(byCountry).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
    console.log(`  ${c.padEnd(10)} ${n}`);
  });

  /* By category — needs a join */
  const productIds = Array.from(distinctProducts).slice(0, 1000);
  if (productIds.length > 0) {
    const { data: products } = await supa
      .from("products")
      .select("id, category_slug")
      .in("id", productIds);

    const byCat: Record<string, number> = {};
    for (const p of products ?? []) {
      const slug = p.category_slug ?? "(null)";
      byCat[slug] = (byCat[slug] ?? 0) + 1;
    }
    console.log("\n▶ Distinct products by category:");
    Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([slug, n]) => {
      console.log(`  ${slug.padEnd(15)} ${n}`);
    });
  }

  /* Top 5 by discount — eyeball deal quality */
  const { data: topDeals } = await supa
    .from("offers")
    .select("current_price, original_price, discount_percent, products(title)")
    .eq("store_id", "aliexpress")
    .gte("discount_percent", 20)
    .order("discount_percent", { ascending: false })
    .limit(5);

  if (topDeals && topDeals.length > 0) {
    console.log("\n▶ Top 5 by discount:");
    topDeals.forEach((d: any, i: number) => {
      const title = d.products?.title ?? "(no title)";
      console.log(`  ${i + 1}. ${title.slice(0, 70)}`);
      console.log(`     $${d.current_price} (was $${d.original_price}, ${d.discount_percent}% off)`);
    });
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
