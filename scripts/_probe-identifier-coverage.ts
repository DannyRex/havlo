/* Probe: structured-identifier coverage across products.
   ─────────────────────────────────────────────────────────────
   Measures the rollout of the Phase 1 product-match upgrade.
   Reports, by country and overall:
     - % of products with GTIN, MPN, or Google Shopping ID
     - % of products with ANY structured identifier
     - Top 20 stores by identifier-coverage rate

   Run after a few days of cron ingest to confirm SerpAPI's
   product_id is being captured. Expected steady-state: ~50-70%
   of mainstream-brand products will have google_shopping_id,
   ~10-20% will eventually have GTIN once we add Schema.org
   JSON-LD harvest to the scraper providers (Phase 1.5).

   Usage: tsx scripts/_probe-identifier-coverage.ts */

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();

  /* Overall counts */
  const { count: totalProducts } = await supa
    .from("products")
    .select("*", { count: "exact", head: true });
  const { count: gtinCount } = await supa
    .from("products")
    .select("*", { count: "exact", head: true })
    .not("gtin", "is", null);
  const { count: mpnCount } = await supa
    .from("products")
    .select("*", { count: "exact", head: true })
    .not("mpn", "is", null);
  const { count: gshCount } = await supa
    .from("products")
    .select("*", { count: "exact", head: true })
    .not("google_shopping_id", "is", null);
  const { count: anyIdCount } = await supa
    .from("products")
    .select("*", { count: "exact", head: true })
    .or("gtin.not.is.null,mpn.not.is.null,google_shopping_id.not.is.null");

  const total = totalProducts ?? 0;
  const pct = (n: number | null | undefined) =>
    total === 0 ? "0%" : `${(((n ?? 0) / total) * 100).toFixed(1)}%`;

  console.log("\n── Overall identifier coverage ──");
  console.log(`Total products:           ${total.toLocaleString()}`);
  console.log(`GTIN coverage:            ${pct(gtinCount)}  (${gtinCount?.toLocaleString() ?? 0})`);
  console.log(`MPN coverage:             ${pct(mpnCount)}  (${mpnCount?.toLocaleString() ?? 0})`);
  console.log(`Google Shopping ID:       ${pct(gshCount)}  (${gshCount?.toLocaleString() ?? 0})`);
  console.log(`ANY identifier:           ${pct(anyIdCount)}  (${anyIdCount?.toLocaleString() ?? 0})`);

  /* Coverage by store (only show top 20 with ≥ 20 products to filter noise).
     LEFT JOIN via the offers table since products doesn't have store_id
     directly — products are shared across multiple stores. We compute
     "store has identifier coverage X%" as: of all OFFERS from that
     store, what % point to a product with any structured identifier. */
  const { data: storeStats, error } = await supa.rpc("identifier_coverage_by_store");
  if (error || !storeStats) {
    console.log("\n(Skipping per-store breakdown — RPC not deployed; run scripts/db/0049b-identifier-coverage-rpc.sql if you want this.)");
  } else {
    console.log("\n── Top 20 stores by identifier coverage (≥20 offers each) ──");
    console.log("Store                          Offers  Identified  Coverage");
    for (const s of storeStats.slice(0, 20)) {
      const cov = s.total_offers === 0 ? "0%" : `${((s.identified_offers / s.total_offers) * 100).toFixed(1)}%`;
      console.log(
        `${s.store_id.padEnd(30).slice(0, 30)} ${String(s.total_offers).padStart(6)}  ${String(s.identified_offers).padStart(10)}  ${cov.padStart(7)}`,
      );
    }
  }

  /* Sample of recent identifier hits — sanity check that we're capturing
     real-looking values, not junk. */
  const { data: samples } = await supa
    .from("products")
    .select("id, title, brand, gtin, mpn, google_shopping_id")
    .or("gtin.not.is.null,mpn.not.is.null,google_shopping_id.not.is.null")
    .order("id", { ascending: false })
    .limit(10);
  if (samples && samples.length > 0) {
    console.log("\n── Sample of recent products with identifiers ──");
    for (const p of samples) {
      const idParts = [
        p.gtin ? `gtin=${p.gtin}` : null,
        p.mpn ? `mpn=${p.mpn}` : null,
        p.google_shopping_id ? `gsh=${p.google_shopping_id}` : null,
      ].filter(Boolean).join(", ");
      console.log(`  ${p.title.slice(0, 60).padEnd(60)} [${p.brand ?? "?"}] ${idParts}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
