#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   One-time merge of duplicate products.

   Why this exists: the original ingestion stored signatures as
   JSON.stringify(buildSignature(title)) — which included `norm` and
   `tokens`, both of which vary with the literal title text. Same
   iPhone listed by Konga and Amazon ended up as TWO product_ids
   with one offer each, instead of ONE product_id with two offers.
   QA diagnostic showed 980 single-store products vs 2 multi-store.

   This script:
     1. Fetches every product
     2. Recomputes the canonical key via buildSignature(title).key
     3. UPDATEs products.signature = the new key
     4. Groups products that now share a key (and have brand+model
        parsed — the '?|?' bucket is intentionally NOT merged)
     5. For each group, picks a canonical id (most-offers wins,
        oldest tie-broken), redirects all offers to it, deletes
        the duplicates
     6. Reports before/after counts

   Run: npx tsx --tsconfig tsconfig.scripts.json scripts/dedup-products.ts

   Safe to re-run. The signature update is idempotent. The merge
   step only fires when there are still groups with > 1 product.
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature } from "../src/lib/search/normalize";

interface ProductRow {
  id:        string;
  title:     string;
  signature: string | null;
  image_url: string | null;
}

interface OfferCount {
  product_id: string;
  count:      number;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    process.exit(1);
  }

  /* Step 1 — fetch all products */
  const { data: products, error: fetchErr } = await supa
    .from("products")
    .select("id, title, signature, image_url");

  if (fetchErr || !products) {
    console.error("✗ Failed to fetch products:", fetchErr?.message);
    process.exit(1);
  }
  console.log(`▶ Loaded ${products.length} products`);

  /* Step 2 — compute new keys, update rows */
  let updates  = 0;
  let skipped  = 0;
  const productToKey = new Map<string, string | null>();

  for (const p of products as ProductRow[]) {
    const sig = buildSignature(p.title);
    /* Only set a real signature when we have brand+model. Without
       both, the key collapses to '?|?' which would over-merge
       unrelated unbranded products. Leave signature = null (or
       a unique-per-row sentinel) so they stay distinct. */
    const newKey =
      sig.brand !== null && sig.model !== null
        ? sig.key
        : null;

    productToKey.set(p.id, newKey);

    if (newKey !== null && p.signature !== newKey) {
      const { error } = await supa
        .from("products")
        .update({ signature: newKey })
        .eq("id", p.id);
      if (error) {
        console.warn(`  ✗ ${p.id} signature update: ${error.message}`);
        skipped++;
      } else {
        updates++;
      }
    } else if (newKey === null && p.signature !== null) {
      /* Was previously matched on JSON; now we say 'don't dedup'.
         Null out the signature so future ingests don't collide. */
      const { error } = await supa
        .from("products")
        .update({ signature: null })
        .eq("id", p.id);
      if (!error) updates++;
    }
  }
  console.log(`▶ Signature updates: ${updates}, skipped: ${skipped}`);

  /* Step 3 — find groups of products that now share a non-null key */
  const groupsByKey = new Map<string, string[]>();
  for (const [id, key] of productToKey.entries()) {
    if (!key) continue;
    const list = groupsByKey.get(key) ?? [];
    list.push(id);
    groupsByKey.set(key, list);
  }
  const dupGroups = Array.from(groupsByKey.entries())
    .filter(([, ids]) => ids.length > 1);

  console.log(`▶ Duplicate groups: ${dupGroups.length}`);
  console.log(`  Total duplicate rows to merge: ${
    dupGroups.reduce((sum, [, ids]) => sum + ids.length - 1, 0)
  }`);

  if (dupGroups.length === 0) {
    console.log("✓ Nothing to merge. Catalog is already canonical.");
    return;
  }

  /* Step 4 — for each group, find the offer counts so we can pick
     the canonical id (most offers wins; oldest as tiebreaker). */
  const allDupIds = dupGroups.flatMap(([, ids]) => ids);
  const { data: offerCounts, error: ocErr } = await supa
    .from("offers")
    .select("product_id")
    .in("product_id", allDupIds);

  if (ocErr) {
    console.error("✗ Offer count fetch failed:", ocErr.message);
    process.exit(1);
  }

  const offerCountByProduct = new Map<string, number>();
  for (const row of offerCounts ?? []) {
    const pid = (row as { product_id: string }).product_id;
    offerCountByProduct.set(pid, (offerCountByProduct.get(pid) ?? 0) + 1);
  }

  /* Step 5 — merge each group */
  let mergedGroups = 0;
  let movedOffers  = 0;
  let deletedRows  = 0;

  for (const [key, ids] of dupGroups) {
    /* Sort by offer count desc, then by id asc (deterministic) */
    const sorted = [...ids].sort((a, b) => {
      const ca = offerCountByProduct.get(a) ?? 0;
      const cb = offerCountByProduct.get(b) ?? 0;
      if (cb !== ca) return cb - ca;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const canonical = sorted[0];
    const others = sorted.slice(1);

    /* Redirect offers from the duplicates onto the canonical id.
       offers has a unique constraint on (store_id, url) so two
       offers from the same store+url merging will conflict — handle
       by deleting the duplicate offer if a canonical version
       already exists for that store_id. */
    for (const otherId of others) {
      /* First, delete dup-offers that would conflict with existing
         canonical offers on (store_id, url). */
      const { data: otherOffers } = await supa
        .from("offers")
        .select("id, store_id, url")
        .eq("product_id", otherId);

      for (const oo of (otherOffers ?? []) as Array<{ id: string; store_id: string; url: string }>) {
        const { data: clash } = await supa
          .from("offers")
          .select("id")
          .eq("product_id", canonical)
          .eq("store_id", oo.store_id)
          .eq("url", oo.url)
          .maybeSingle();
        if (clash?.id) {
          /* Canonical already has the same store_id+url offer;
             delete the duplicate to satisfy the unique constraint. */
          await supa.from("offers").delete().eq("id", oo.id);
        } else {
          /* Re-point the offer onto the canonical product_id. */
          await supa.from("offers").update({ product_id: canonical }).eq("id", oo.id);
          movedOffers++;
        }
      }

      /* Delete the duplicate product row. */
      const { error: delErr } = await supa.from("products").delete().eq("id", otherId);
      if (delErr) {
        console.warn(`  ✗ Couldn't delete duplicate product ${otherId}: ${delErr.message}`);
      } else {
        deletedRows++;
      }
    }
    mergedGroups++;
    if (mergedGroups % 50 === 0) {
      console.log(`  ${mergedGroups}/${dupGroups.length} groups merged…`);
    }
  }

  console.log("");
  console.log(`✓ Done.`);
  console.log(`  Groups merged:   ${mergedGroups}`);
  console.log(`  Offers re-pointed: ${movedOffers}`);
  console.log(`  Duplicate products removed: ${deletedRows}`);
  console.log("");

  /* Refresh the cheapest-offer matview that product_best_offers joins
     (migration 0075) now that offers are settled post-dedup, so /deals +
     PDP + count reads stay cheap (precomputed) instead of recomputing the
     LATERAL per query. Non-fatal: a failed call (e.g. 0075 not applied yet)
     just logs and leaves the matview briefly stale until the next ingest. */
  const { error: refreshErr } = await supa.rpc("refresh_cheapest_offers");
  console.log(refreshErr
    ? `  ⚠ cheapest-offer matview refresh skipped: ${refreshErr.message}`
    : `  ✓ cheapest-offer matview refreshed`);
  console.log("");

  console.log("Run this to verify the new histogram:");
  console.log("  select case when stores=1 then 'single' when stores=2 then '2 stores' else '3+ stores' end as bucket, count(*)");
  console.log("  from (select p.id, count(distinct o.store_id) as stores from products p join offers o on o.product_id=p.id group by p.id) sub");
  console.log("  group by 1 order by 1;");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
