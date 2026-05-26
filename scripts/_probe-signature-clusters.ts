/* Find products that share a brand|model signature — surface the
   platform / family-collision problem where buildSignature collapses
   distinct products into one cluster.

   Output:
     - Top 20 clusters by member count
     - For each, sample 5 titles so we can tell whether they're
       legitimately variants of one product (size/color) or different
       products that share a platform (PS4 controllers vs PS4 games). */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature } from "../src/lib/search/normalize";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  const PAGE = 1000;
  type R = { id: string; title: string; brand: string | null; model: string | null; signature: string };
  const all: R[] = [];
  let from = 0;
  while (true) {
    const { data } = await supa
      .from("products")
      .select("id, title, brand, model, signature")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as R[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Total products: ${all.length}\n`);

  /* Bucket by signature */
  const bySig = new Map<string, R[]>();
  for (const r of all) {
    /* Recompute signature from title (DB may have stale or absent signature
       for legacy rows). The recomputed signature key is what current
       dedup would use. */
    const sig = buildSignature(r.title);
    const k = sig.key;
    if (!bySig.has(k)) bySig.set(k, []);
    bySig.get(k)!.push(r);
  }

  /* Filter to clusters with ≥3 members and skip "?|?" (no signature) */
  const clusters: Array<{ key: string; members: R[] }> = [];
  bySig.forEach((members, key) => {
    if (members.length >= 3 && !key.startsWith("?")) clusters.push({ key, members });
  });
  clusters.sort((a, b) => b.members.length - a.members.length);

  console.log(`Clusters with ≥3 members (excl no-brand): ${clusters.length}`);
  console.log();
  console.log("Top 20 clusters:");
  for (const c of clusters.slice(0, 20)) {
    console.log(`\n${c.key}  (${c.members.length} products)`);
    /* Sample 5 titles — sorted by title length to surface variety */
    const sample = [...c.members].sort((a, b) => a.title.length - b.title.length).slice(0, 5);
    for (const m of sample) {
      console.log(`  ${m.title.slice(0, 100)}`);
    }
  }

  /* Total dedup-loss: every cluster with N members SHOULD have N-1
     of them be variants or duplicates. If they're distinct products,
     that's signature collapse. Count members past 1 across all
     ≥3-clusters as the upper-bound bloat. */
  const totalBloat = clusters.reduce((acc, c) => acc + (c.members.length - 1), 0);
  console.log(`\nTotal members across ≥3-clusters past the first: ${totalBloat}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
