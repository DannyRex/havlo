#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   One-shot resignature migration.

   Why this exists: the signature parser (src/lib/search/normalize.ts)
   gained ~40 new brands + MODEL_HINTS for drinkware, MacBook chips,
   Sony WH/WF lines, Bose QC variants, Dyson, Ninja, Logitech etc.
   The auto-correct in ingestion.ts dealToProductRow uses the new
   parser for FUTURE ingests. This script handles existing rows so
   they stop being orphans under '?|?' or short keys.

   Two effects per product:

     1. SIGNATURE DRIFT — same product, new key
        e.g. signature='?|?' (no brand) → 'stanley|quencher h2.0'
             signature='apple|macbook pro' → 'apple|macbook pro 16 inch m4'
        Action: UPDATE products.signature = new_key. No offer touch.

     2. MERGE COLLISION — multiple products now share a new key
        e.g. P1 title='Stanley Quencher 40oz' signature='?|?'
             P2 title='Stanley Quencher 30oz' signature='?|?'
             Both re-key to 'stanley|quencher h2.0'.
             (Size lives outside the key by design — the variant
             gate handles size separately on /compare.)
        Action: pick canonical product (most in-stock offers,
        tie-break on oldest created_at), move all offers from the
        rest to it, then delete the orphan products.

   SPLIT cases (one product → many) are NOT handled here. Splits
   would require re-fetching each offer's source title, which isn't
   stored on the offer row. If the FIRST ingest's title drove the
   wrong key (e.g. 'iPhone 15 Pro Max' collapsed to 'apple|iphone
   15 pro' under the old regex), this script will re-key it to the
   correct new value but every offer attached stays attached. Real
   prod impact: rare, since most products consolidate to the
   canonical title at first ingest from a major retailer.

   Run:
     npm run resignature                 # dry-run, report only
     npm run resignature -- --apply      # commit changes
     npm run resignature -- --limit=500  # cap rows scanned (safety)
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature, isLooseCategoryModel } from "../src/lib/search/normalize";
import { extractSizeTokens } from "../src/lib/search/query-understanding";

interface CliArgs {
  apply?: boolean;
  limit?: number;
}

function parseArgs(): CliArgs {
  const out: CliArgs = {};
  for (const a of process.argv.slice(2)) {
    if (a === "--apply") out.apply = true;
    else if (a.startsWith("--limit=")) out.limit = parseInt(a.slice("--limit=".length), 10);
  }
  return out;
}

interface ProductRow {
  id: string;
  title: string;
  signature: string | null;
  category_slug: string | null;
  brand: string | null;
  created_at: string;
}

/* Page through products in chunks — Supabase PostgREST defaults to
   1000-row max. Order by created_at so re-runs are deterministic. */
async function fetchAllProducts(limit: number | null): Promise<ProductRow[]> {
  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("Supabase not configured");
  const all: ProductRow[] = [];
  const page = 1000;
  let from = 0;
  while (true) {
    if (limit && all.length >= limit) break;
    const { data, error } = await supa
      .from("products")
      .select("id, title, signature, category_slug, brand, created_at")
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as ProductRow[]));
    if (data.length < page) break;
    from += page;
  }
  if (limit) return all.slice(0, limit);
  return all;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ Supabase admin not configured"); process.exit(1); }

  console.log(`▶ Resignature migration${args.apply ? "" : " (DRY RUN — pass --apply to commit)"}`);
  if (args.limit) console.log(`  Scanning up to ${args.limit} products`);

  const products = await fetchAllProducts(args.limit ?? null);
  console.log(`▶ Loaded ${products.length} products\n`);

  /* Pass 1: compute new signatures + categorise changes.

     IMPORTANT — merge safety guard: a signature key is only safe to
     merge on when BOTH brand AND model are populated (not "?").
     The parser returns "?" for unparseable parts, so keys like
     "?|?", "sony|?", "cuisinart|?" don't identify a specific SKU —
     they identify "every product whose brand/model the parser
     couldn't extract". Merging "Sony DualSense Controller" with
     "Sony India SA-D40M2 Soundbar" just because both fall to
     "sony|?" would catastrophically pool unrelated products.

     Drift updates (single-product keys) ARE still applied — those
     just rename the column with no cross-product impact. */
  const drifts: Array<{ row: ProductRow; oldSig: string | null; newSig: string }> = [];
  const collisionMap = new Map<string, ProductRow[]>(); // new_sig → products

  function isMergeSafeKey(key: string): boolean {
    const parts = key.split("|");
    if (parts.length < 2) return false;
    const [brand, model] = parts;
    if (!brand || brand === "?") return false;
    if (!model || model === "?") return false;
    /* Mirror pg-fts.ts isSignatureTightEnoughForPooling: a brand|<loose
       category> key (apparel/beauty category words like "dress"/"mascara",
       or a "boat|dress"-style brand mis-tag) can RENAME a column but must
       never trigger a destructive cross-product MERGE — those category keys
       intentionally group DIFFERENT products. Added Jun 2026 alongside the
       NULL-signature brand recovery as the safety net for any residual
       common-word brand mis-tag. */
    if (isLooseCategoryModel(model)) return false;
    return true;
  }

  for (const p of products) {
    const newKey = buildSignature(p.title).key;
    if (newKey === (p.signature ?? "")) continue;
    drifts.push({ row: p, oldSig: p.signature, newSig: newKey });
    if (!collisionMap.has(newKey)) collisionMap.set(newKey, []);
    collisionMap.get(newKey)!.push(p);
  }

  const driftOnly = drifts.length;
  /* Filter merge candidates: only safe keys, and only groups ≥2.
     Then sub-bucket each merge group by size-token signature. The
     signature key intentionally excludes sub-19" inches (so phones
     with inconsistent "6.1 inch" vs nothing collapse cleanly) —
     but that means a Surface Laptop 13" and 15" share the same
     key. Sub-bucketing by extractSizeTokens keeps actual size
     SKUs separate during merge. */
  function sizeTokenKey(title: string): string {
    return extractSizeTokens(title).sort().join(",");
  }
  type SubGroup = { key: string; sizeKey: string; products: ProductRow[] };
  const subGroups: SubGroup[] = [];
  const unsafeMergeGroupsRaw = Array.from(collisionMap.entries())
    .filter(([key, ps]) => ps.length > 1 && !isMergeSafeKey(key));
  for (const [key, ps] of collisionMap.entries()) {
    if (ps.length < 2) continue;
    if (!isMergeSafeKey(key)) continue;
    const buckets = new Map<string, ProductRow[]>();
    for (const p of ps) {
      const sk = sizeTokenKey(p.title);
      if (!buckets.has(sk)) buckets.set(sk, []);
      buckets.get(sk)!.push(p);
    }
    for (const [sk, sub] of buckets) {
      if (sub.length > 1) subGroups.push({ key, sizeKey: sk, products: sub });
    }
  }

  /* PRICE-SPREAD GUARD (added after QA report May 2026 caught a £14
     bartyspares Dyson accessory merged into the Dyson V11 vacuum
     product_id, producing a 1:66 price spread on a single PDP).
     For each candidate merge sub-group, fetch the price range of each
     product's in-stock offers. If the cheapest-of-cheap vs
     most-expensive-of-expensive ratio exceeds MAX_GROUP_RATIO, the
     group is one or more of:
       (a) an accessory was mis-signed as the parent
       (b) a SKU-level variant got pooled (different storage tier,
           different chip generation, different size we didn't capture
           in extractSizeTokens)
     Either way, refuse to merge — keep them as separate products and
     let the variant gate sort them out at compare time. */
  const MAX_GROUP_RATIO = 4;
  type GroupPriceRange = { min: number; max: number; productMins: Map<string, number>; productMaxs: Map<string, number>; };
  async function fetchGroupRange(productIds: string[]): Promise<GroupPriceRange> {
    const { data } = await supa
      .from("offers")
      .select("product_id, current_price, currency")
      .in("product_id", productIds)
      .eq("in_stock", true);
    const USD_TO_NGN = 1500; // rough normalisation; only used for ratio comparison
    let min = Infinity, max = 0;
    const productMins = new Map<string, number>();
    const productMaxs = new Map<string, number>();
    for (const o of (data ?? []) as Array<{ product_id: string; current_price: number; currency: string }>) {
      const price = o.currency === "NGN" ? o.current_price : o.current_price * USD_TO_NGN;
      if (price <= 0) continue;
      if (price < min) min = price;
      if (price > max) max = price;
      const pMin = productMins.get(o.product_id) ?? Infinity;
      const pMax = productMaxs.get(o.product_id) ?? 0;
      if (price < pMin) productMins.set(o.product_id, price);
      if (price > pMax) productMaxs.set(o.product_id, price);
    }
    return { min, max, productMins, productMaxs };
  }

  const blockedByPriceGuard: SubGroup[] = [];
  const safeSubGroups: SubGroup[] = [];
  for (const g of subGroups) {
    const range = await fetchGroupRange(g.products.map((p) => p.id));
    if (range.max === 0 || range.min === Infinity) {
      /* No in-stock offers — keep the merge; the worst case is that
         we collapse two empty products. Safe. */
      safeSubGroups.push(g);
      continue;
    }
    const ratio = range.max / range.min;
    if (ratio > MAX_GROUP_RATIO) {
      blockedByPriceGuard.push(g);
      continue;
    }
    safeSubGroups.push(g);
  }
  const collisionGroups = safeSubGroups;
  const unsafeProductsTouched = unsafeMergeGroupsRaw.reduce((a, [, ps]) => a + ps.length, 0);
  const merging = collisionGroups.reduce((acc, g) => acc + g.products.length, 0);
  const collapseTo = collisionGroups.length;

  console.log(`──────────────────────────────────────────────────────────────`);
  console.log(`SCOPE`);
  console.log(`  Products with signature change:        ${driftOnly}`);
  console.log(`  Safe merge sub-groups (brand+model+size match): ${collisionGroups.length}`);
  console.log(`  Products being merged into canonical:  ${merging - collapseTo}`);
  console.log(`  Unsafe collisions (skipped, drift only): ${unsafeMergeGroupsRaw.length} groups, ${unsafeProductsTouched} products`);
  console.log(`  Blocked by price-spread guard (>${MAX_GROUP_RATIO}x): ${blockedByPriceGuard.length} groups`);
  console.log(`──────────────────────────────────────────────────────────────\n`);

  if (blockedByPriceGuard.length > 0) {
    console.log(`SAMPLE — blocked by price-spread (first 5):`);
    for (const g of blockedByPriceGuard.slice(0, 5)) {
      console.log(`  → ${g.key}  (${g.products.length} products, ratio guard tripped)`);
      for (const p of g.products.slice(0, 4)) console.log(`        "${p.title.slice(0, 60)}"  [${p.id.slice(0, 8)}]`);
    }
    console.log("");
  }

  /* Show sample of each change type. */
  const driftSamples = drifts.filter((d) => (collisionMap.get(d.newSig)?.length ?? 0) === 1).slice(0, 8);
  if (driftSamples.length > 0) {
    console.log(`SAMPLE — signature drift (no merge):`);
    for (const d of driftSamples) {
      console.log(`  · "${d.row.title.slice(0, 60)}"`);
      console.log(`      ${d.oldSig ?? "(null)"}  →  ${d.newSig}`);
    }
    console.log("");
  }

  if (collisionGroups.length > 0) {
    console.log(`SAMPLE — merge sub-groups (first 8):`);
    for (const g of collisionGroups.slice(0, 8)) {
      const sz = g.sizeKey ? `  size=[${g.sizeKey}]` : "";
      console.log(`  → ${g.key}${sz}  (${g.products.length} products merging)`);
      for (const p of g.products.slice(0, 4)) console.log(`        "${p.title.slice(0, 60)}"  [${p.id.slice(0, 8)}]`);
      if (g.products.length > 4) console.log(`        … and ${g.products.length - 4} more`);
    }
    console.log("");
  }

  if (!args.apply) {
    console.log(`Dry-run complete. Re-run with --apply to commit.`);
    return;
  }

  /* Pass 2 — APPLY. Process merges first (per-group canonical pick
     + offer reattachment + orphan delete), then bare drifts. */
  let mergedProducts = 0;
  let movedOffers = 0;
  let deletedProducts = 0;
  let drifted = 0;

  for (const g of collisionGroups) {
    const newKey = g.key;
    const group = g.products;
    /* Pick canonical: product with most in-stock offers; tie-break
       on oldest created_at. Counting offers per product needs a
       group query — chunk by product_id. */
    const ids = group.map((p) => p.id);
    const { data: offerCounts } = await supa.from("offers").select("product_id, in_stock").in("product_id", ids);
    const score = new Map<string, number>();
    for (const o of (offerCounts ?? []) as Array<{ product_id: string; in_stock: boolean }>) {
      score.set(o.product_id, (score.get(o.product_id) ?? 0) + (o.in_stock ? 2 : 1));
    }
    let canonical = group[0];
    for (const p of group) {
      const a = score.get(p.id) ?? 0;
      const b = score.get(canonical.id) ?? 0;
      if (a > b || (a === b && p.created_at < canonical.created_at)) canonical = p;
    }

    /* Move offers from non-canonical → canonical. Use update-by-id
       to dodge unique (store_id, url) collisions: if both groups
       have an offer at the same URL, keep the canonical's and
       drop the duplicate. */
    for (const p of group) {
      if (p.id === canonical.id) continue;
      const { data: offers } = await supa.from("offers").select("id, store_id, url").eq("product_id", p.id);
      const { data: canonOffers } = await supa.from("offers").select("store_id, url").eq("product_id", canonical.id);
      const canonSet = new Set((canonOffers ?? []).map((o: { store_id: string; url: string }) => `${o.store_id}|${o.url}`));
      const moveIds: string[] = [];
      const dropIds: string[] = [];
      for (const o of (offers ?? []) as Array<{ id: string; store_id: string; url: string }>) {
        if (canonSet.has(`${o.store_id}|${o.url}`)) dropIds.push(o.id);
        else moveIds.push(o.id);
      }
      if (moveIds.length > 0) {
        const { error } = await supa.from("offers").update({ product_id: canonical.id }).in("id", moveIds);
        if (error) { console.warn(`  ✗ move offers ${p.id}: ${error.message}`); continue; }
        movedOffers += moveIds.length;
      }
      if (dropIds.length > 0) {
        const { error } = await supa.from("offers").delete().in("id", dropIds);
        if (error) console.warn(`  ✗ drop dup offers ${p.id}: ${error.message}`);
      }
      const { error: delErr } = await supa.from("products").delete().eq("id", p.id);
      if (delErr) { console.warn(`  ✗ delete product ${p.id}: ${delErr.message}`); continue; }
      deletedProducts++;
    }
    /* Update canonical's signature. */
    const { error } = await supa.from("products").update({ signature: newKey }).eq("id", canonical.id);
    if (error) console.warn(`  ✗ update canonical ${canonical.id}: ${error.message}`);
    else mergedProducts++;
  }

  /* Bare signature drifts — products that won't be merged.
     Covers two cases:
       (1) Key has no collision (one product mapped to it).
       (2) Key has collisions BUT the key is unsafe to merge on
           (brand or model is "?"). Those products keep their
           rows; we just rename their signature column.
     Products in SAFE collision groups are already handled by the
     merge logic above — they're skipped here. */
  const bareDrifts = drifts.filter((d) => {
    const groupSize = collisionMap.get(d.newSig)?.length ?? 0;
    if (groupSize === 1) return true;
    if (!isMergeSafeKey(d.newSig)) return true;
    return false;
  });
  for (const d of bareDrifts) {
    const { error } = await supa.from("products").update({ signature: d.newSig }).eq("id", d.row.id);
    if (error) { console.warn(`  ✗ drift update ${d.row.id}: ${error.message}`); continue; }
    drifted++;
  }

  console.log(`──────────────────────────────────────────────────────────────`);
  console.log(`APPLIED`);
  console.log(`  Merge canonical updates:     ${mergedProducts}`);
  console.log(`  Offers reattached:           ${movedOffers}`);
  console.log(`  Orphan products deleted:     ${deletedProducts}`);
  console.log(`  Signature drift updates:     ${drifted}`);
  console.log(`──────────────────────────────────────────────────────────────`);
}

main().catch((err) => { console.error("✗ Fatal:", err); process.exit(1); });
