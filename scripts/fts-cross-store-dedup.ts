#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Cross-store FTS dedup migration.

   Phase 5's resignature-products script merged products that shared
   an exact buildSignature() key. Phase 6 audit found that's a small
   fraction (~5%) of the cross-store merge opportunity — most same-
   product-different-store pairs HAVE different titles that produce
   different signature keys. Examples:

     Slot's   "PRE-OWNED APPLE IPHONE 15 PRO MAX 256GB - SLOT"
     Konga's  "Apple iPhone 15 Pro Max 256GB Black Titanium"
     Jumia's  "iPhone 15 Pro Max 256GB - Apple - Titanium Black"

   All same phone, three different product_ids, no signature match.

   This migration uses the EXISTING runtime variant gate
   (partitionDupesByVariantMatch + isLikelySameProduct) — the same
   gate the PDP already applies on every render to surface cross-
   store offers in the spectrum bar. Promoting those runtime matches
   to permanent DB merges:
     1. Makes the comparison count honest in dropdowns + category
        tiles (today they overcount because dupes count separately).
     2. Cuts PDP latency — variant pooling at runtime becomes a no-op
        for already-merged products.
     3. Lifts the catalog's "2+ stores" comparability rate from 4.5%
        toward its runtime ceiling (~14% on comparable categories).

   Scope: comparison-relevant categories only (phones, computing,
   gaming, audio, appliances, electronics). Fashion/beauty/health
   are deliberately excluded — most of their products are genuinely
   single-store-unique (ASOS owns the SKU, no other retailer carries
   it).

   Safety:
     · isLikelySameProduct gate enforces brand + family + numeric
       overlap + variant tokens + size + price band.
     · Additional price-spread guard (max/min ratio ≤ MAX_GROUP_RATIO)
       across all candidate prices. Same guard resignature uses.
     · DRY-RUN default. Pass --apply to write.
     · --limit=N caps the products scanned (safety while iterating
       on the script).
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { pgFtsFindDupes } from "../src/lib/search/pg-fts";
import { partitionDupesByVariantMatch } from "../src/lib/search/variant-pooling";

// Cross-store-comparable categories. Appliances split back out of
// electronics (June 2026) — fridges/washers/ACs dedupe across stores too.
const COMPARABLE_CATS = new Set(["phones", "computing", "gaming", "audio", "electronics", "appliances"]);
const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const a = process.argv.find((s) => s.startsWith("--limit="));
  return a ? parseInt(a.slice("--limit=".length), 10) : null;
})();

/* Same guard the existing resignature script uses. */
const MAX_GROUP_RATIO = 4;
const USD_TO_NGN = 1500;
/* Max cluster size — union-find can chain transitively (A matches B,
   B matches C → A,B,C merged even if A and C aren't actually the same
   SKU). Most legitimately-same products are at ≤ 5 stores in our
   catalog. Anything larger is almost certainly transitive false-
   positives; drop the whole cluster rather than risk a bad merge. */
const MAX_CLUSTER_SIZE = 5;

interface ProductRow {
  id: string;
  title: string;
  brand: string | null;
  category_slug: string | null;
  created_at: string;
}

async function fetchPaged<T>(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const q = filters(supa.from(table).select(select)).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) { console.warn(error.message); break; }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  console.log(`▶ Cross-store FTS dedup ${APPLY ? "(APPLY)" : "(DRY RUN)"}${LIMIT ? `  limit=${LIMIT}` : ""}`);

  /* Pull all in-stock offers + their store ids so we can identify
     which products are single-store today (the merge targets) and
     compute price ranges for the guard. */
  const allOffers = await fetchPaged<{ product_id: string; store_id: string; current_price: number; currency: string }>(
    supa, "offers", "product_id, store_id, current_price, currency", (q) => q.eq("in_stock", true),
  );
  const storesByProduct = new Map<string, Set<string>>();
  const pricesByProduct = new Map<string, number[]>();
  for (const o of allOffers) {
    if (!storesByProduct.has(o.product_id)) storesByProduct.set(o.product_id, new Set());
    storesByProduct.get(o.product_id)!.add(o.store_id);
    const price = o.currency === "NGN" ? o.current_price : o.current_price * USD_TO_NGN;
    if (price > 0) {
      if (!pricesByProduct.has(o.product_id)) pricesByProduct.set(o.product_id, []);
      pricesByProduct.get(o.product_id)!.push(price);
    }
  }

  /* Pull all products in comparable categories. Skip products without
     a category — those won't pass the family gate downstream anyway. */
  let products = await fetchPaged<ProductRow>(
    supa, "products", "id, title, brand, category_slug, created_at",
    (q) => q.in("category_slug", Array.from(COMPARABLE_CATS)),
  );
  if (LIMIT) products = products.slice(0, LIMIT);
  console.log(`  scanning ${products.length} products in [${Array.from(COMPARABLE_CATS).join(", ")}]`);

  /* For each product, find dupes via FTS and check if any pass the
     variant gate AND come from a different store than the anchor.

     We track CLUSTERS as union-find: each product points at its
     "leader" (the canonical product_id). When two products are
     determined to be the same product, we union their clusters. */
  const leader = new Map<string, string>();
  for (const p of products) leader.set(p.id, p.id);
  function find(id: string): string {
    let cur = id;
    const path: string[] = [];
    while (leader.get(cur) !== cur) {
      path.push(cur);
      cur = leader.get(cur)!;
    }
    for (const p of path) leader.set(p, cur);  // path compression
    return cur;
  }
  function union(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) leader.set(ra, rb);
  }

  let pairsConsidered = 0;
  let pairsMerged = 0;
  let i = 0;
  for (const p of products) {
    i++;
    if (i % 100 === 0) process.stdout.write(`\r  ${i}/${products.length}  pairs merged so far: ${pairsMerged}`);

    /* Skip already-merged products — speeds up the back half of the
       loop because their canonical leader already absorbed the cluster. */
    /* Run the FTS dupes search. limit=20 + strict=true matches what
       the PDP partition pipeline uses. */
    const dupes = await pgFtsFindDupes(p.title, 0, { limit: 20, strict: true });
    if (dupes.length === 0) continue;

    /* Same partition the PDP uses. likelyVariants = strict same-
       product gate (brand + family + variant + size + model + price). */
    const partition = partitionDupesByVariantMatch(
      { title: p.title, brand: p.brand, priceNgn: pricesByProduct.get(p.id)?.[0] ?? 0, family: p.category_slug ?? null },
      dupes,
    );

    for (const candidate of partition.likelyVariants) {
      if (candidate.key === p.id) continue;
      pairsConsidered++;
      /* candidate is a DupeResult with .key (the product_id) and .offers
         (the offers under that product). The cross-store gain only
         materialises if the candidate's offers touch a store our anchor
         doesn't yet have. */
      const anchorStores = storesByProduct.get(p.id) ?? new Set();
      const candidateStores = new Set(candidate.offers.map((o) => o.storeId));
      const newStores = Array.from(candidateStores).filter((s) => !anchorStores.has(s));
      if (newStores.length === 0) continue;  // candidate would add no new store; skip
      /* TIGHTER GATE: require BOTH anchor and candidate to have a
         parsed brand. isLikelySameProduct accepts null brands (treats
         them as "both unknown, neutral pass"), but that creates the
         transitive-chaining problem — once one product with brand=null
         matches another with brand=null on family+tokens alone, the
         union-find absorbs every appliance-category null-brand row
         that touches the chain. Requiring brand-on-both-sides keeps
         the merge precision high; we lose some recall on truly-
         unbranded white-label products but those have less cross-
         store overlap value anyway. */
      if (!p.brand) continue;
      if (!candidate.brand) continue;
      if (p.brand.toLowerCase() !== candidate.brand.toLowerCase()) continue;
      union(p.id, candidate.key);
      pairsMerged++;
    }
  }
  process.stdout.write(`\n`);

  /* Build cluster summary from the union-find result. Each canonical
     leader → list of members. */
  const clusters = new Map<string, string[]>();
  for (const p of products) {
    const root = find(p.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(p.id);
  }
  const mergeGroups = Array.from(clusters.values()).filter((g) => g.length > 1);
  console.log(`\n  pairs considered: ${pairsConsidered}`);
  console.log(`  pairs merged (would-be): ${pairsMerged}`);
  console.log(`  cluster groups (>= 2 members): ${mergeGroups.length}`);
  console.log(`  members across groups: ${mergeGroups.reduce((a, g) => a + g.length, 0)}`);

  /* Two guards per cluster:
       (a) Size guard — reject clusters > MAX_CLUSTER_SIZE members
           (transitive chaining false-positives).
       (b) Price-spread guard — reject when max/min ratio > MAX_GROUP_RATIO
           (accessory/parent or cross-market currency mix).
     Both must pass for a cluster to be merged. */
  const guarded: string[][] = [];
  const blockedBySize: string[][] = [];
  const blockedByPrice: string[][] = [];
  for (const group of mergeGroups) {
    if (group.length > MAX_CLUSTER_SIZE) {
      blockedBySize.push(group);
      continue;
    }
    let min = Infinity, max = 0;
    for (const id of group) {
      const prices = pricesByProduct.get(id) ?? [];
      for (const p of prices) {
        if (p < min) min = p;
        if (p > max) max = p;
      }
    }
    if (max === 0 || min === Infinity) { guarded.push(group); continue; }
    if (max / min > MAX_GROUP_RATIO) {
      blockedByPrice.push(group);
    } else {
      guarded.push(group);
    }
  }
  console.log(`  groups passing both guards: ${guarded.length}`);
  console.log(`  groups blocked by SIZE (> ${MAX_CLUSTER_SIZE} members, transitive chaining suspected): ${blockedBySize.length}`);
  console.log(`  groups blocked by PRICE-SPREAD (> ${MAX_GROUP_RATIO}x): ${blockedByPrice.length}`);

  /* Print samples */
  const productById = new Map(products.map((p) => [p.id, p] as const));
  console.log(`\nSamples — first 8 mergeable clusters:`);
  for (const g of guarded.slice(0, 8)) {
    console.log(`  cluster (${g.length} members):`);
    for (const id of g.slice(0, 4)) {
      const p = productById.get(id);
      const stores = Array.from(storesByProduct.get(id) ?? []).join(",");
      console.log(`    "${(p?.title ?? "?").slice(0, 65)}"  [${id.slice(0,8)}]  stores=${stores}`);
    }
  }
  if (blockedBySize.length > 0) {
    console.log(`\nBlocked-by-size samples (transitive chaining suspected):`);
    for (const g of blockedBySize.slice(0, 2)) {
      console.log(`  cluster of ${g.length} members:`);
      for (const id of g.slice(0, 4)) {
        const p = productById.get(id);
        console.log(`    "${(p?.title ?? "?").slice(0, 60)}"`);
      }
      console.log(`    … ${g.length - 4} more`);
    }
  }
  if (blockedByPrice.length > 0) {
    console.log(`\nBlocked-by-price samples (price-spread tripped):`);
    for (const g of blockedByPrice.slice(0, 3)) {
      for (const id of g.slice(0, 3)) {
        const p = productById.get(id);
        const prices = pricesByProduct.get(id) ?? [];
        const minP = Math.min(...prices), maxP = Math.max(...prices);
        console.log(`    "${(p?.title ?? "?").slice(0, 60)}" ₦${minP.toFixed(0)}-₦${maxP.toFixed(0)}`);
      }
      console.log(`    ---`);
    }
  }

  if (!APPLY) {
    console.log(`\n● dry run — pass --apply to merge`);
    return;
  }

  /* Apply: for each cluster, pick canonical (most in-stock offers;
     tie-break on oldest created_at). Move all non-canonical offers
     to canonical, dedupe (store_id, url) collisions, delete the
     orphan products. */
  let mergedProducts = 0;
  let movedOffers = 0;
  let deletedProducts = 0;
  let canonicalUpdated = 0;
  for (const group of guarded) {
    /* Score each product: 2 pts per in-stock offer + 1 per total.
       Tie-break on oldest. */
    const ids = group;
    const offerCounts = new Map<string, number>();
    for (const id of ids) {
      const n = storesByProduct.get(id)?.size ?? 0;
      offerCounts.set(id, n);
    }
    let canonical = ids[0];
    for (const id of ids) {
      const a = offerCounts.get(id) ?? 0;
      const b = offerCounts.get(canonical) ?? 0;
      const pa = productById.get(id), pb = productById.get(canonical);
      if (a > b || (a === b && pa && pb && pa.created_at < pb.created_at)) canonical = id;
    }

    for (const id of ids) {
      if (id === canonical) continue;
      const { data: offers } = await supa.from("offers").select("id, store_id, url").eq("product_id", id);
      const { data: canonOffers } = await supa.from("offers").select("store_id, url").eq("product_id", canonical);
      const canonSet = new Set((canonOffers ?? []).map((o: { store_id: string; url: string }) => `${o.store_id}|${o.url}`));
      const moveIds: string[] = [];
      const dropIds: string[] = [];
      for (const o of (offers ?? []) as Array<{ id: string; store_id: string; url: string }>) {
        if (canonSet.has(`${o.store_id}|${o.url}`)) dropIds.push(o.id);
        else moveIds.push(o.id);
      }
      if (moveIds.length > 0) {
        const { error } = await supa.from("offers").update({ product_id: canonical }).in("id", moveIds);
        if (error) { console.warn(`  ! move ${id}: ${error.message}`); continue; }
        movedOffers += moveIds.length;
      }
      if (dropIds.length > 0) {
        await supa.from("offers").delete().in("id", dropIds);
      }
      const { error: delErr } = await supa.from("products").delete().eq("id", id);
      if (delErr) { console.warn(`  ! delete ${id}: ${delErr.message}`); continue; }
      deletedProducts++;
    }
    mergedProducts++;
    canonicalUpdated++;
    void canonicalUpdated;
  }

  console.log(`\n✓ Applied:`);
  console.log(`  cluster canonicals updated: ${mergedProducts}`);
  console.log(`  offers reattached:          ${movedOffers}`);
  console.log(`  orphan products deleted:    ${deletedProducts}`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
