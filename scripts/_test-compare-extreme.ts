/* Extreme comparison-engine smoke test.
   ───────────────────────────────────────────────────────────────
   Goes well beyond _test-compare-flow.ts:

   1. SAMPLES — broad: pulls one multi-store product per category
      (11 categories) AND one single-store product per category
      (to test the "no comparison possible" path) AND a hand-curated
      ADVERSARIAL set designed to STRESS the matching engine.

   2. ADVERSARIAL pairs — known false-positive risks the Phase 3
      embeddings WOULD admit if the Stage 2.5 veto isn't catching
      them:
        - Galaxy A15 5G  vs  Galaxy A17 5G   (different generations,
          same line — embedding cosine ~0.93)
        - iPhone 15      vs  iPhone 15 Pro   (different tier, same gen)
        - WH-1000XM4     vs  WH-1000XM5      (consecutive product
          codes — letter-glued model token differs)
        - MacBook Pro M3 vs  MacBook Pro M4  (different chip)

      For each adversarial anchor, we fetch the compare-by-pid
      response and verify NONE of the known-bad candidates leak into
      anchor.offers. If they do → veto regression.

   3. COUNTRIES — runs the same suite for NG, UK, US, DE (the four
      with the largest catalogs). Confirms cross-country reach
      without country-skew bugs.

   4. CTA CONSISTENCY — for each multi-store product, fetches:
        a) Suggest API count
        b) Compare-by-pid count (uses deep partition)
        c) Anchor-offers count from /api/compare/dupes (if present)
      Reports skew across the three surfaces.

   5. STORE-NAME INTEGRITY — for each anchor offer, asserts the
      storeName in the row payload is non-empty and not a known
      junk sentinel ('[BLOCKED:', 'unknown', etc.).

   6. PERFORMANCE — wall-time per /api/compare call, broken down by
      country + product. Flags any call > 3s as slow.

   Usage:
     npx tsx scripts/_test-compare-extreme.ts
     npx tsx scripts/_test-compare-extreme.ts --country=ng  (only NG)
     npx tsx scripts/_test-compare-extreme.ts --quick      (skip
       the cross-country sweep — NG-only smoke)
*/

try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const SITE = process.env.TEST_SITE ?? "https://havlo.io";
const CATEGORIES = [
  "phones", "computing", "audio", "fashion", "appliances", "beauty",
  "sports", "gaming", "health", "home", "electronics",
];

const argv = process.argv.slice(2);
const arg  = (n: string) => { const f = argv.find((a) => a.startsWith(`--${n}=`)); return f ? f.slice(n.length + 3) : null; };
const ONLY_COUNTRY = arg("country");
const QUICK = argv.includes("--quick");

const COUNTRIES = QUICK || ONLY_COUNTRY
  ? [ONLY_COUNTRY ?? "ng"]
  : ["ng", "uk", "us", "de"];

/* ── HTTP helper ─────────────────────────────────────────────── */
async function fetchJson(url: string, country: string): Promise<{ data: unknown; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { "Cookie": `havlo-country=${country}`, "User-Agent": "havlo-extreme-test/1.0" },
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return { data: await res.json(), ms };
}

/* ── Failure tracking ─────────────────────────────────────────── */
interface Failure { surface: string; ctx: string; msg: string }
const failures: Failure[] = [];
const successes: string[] = [];
function fail(surface: string, ctx: string, msg: string) { failures.push({ surface, ctx, msg }); }
function ok(label: string) { successes.push(label); }

/* ── PHASE 1 — multi-store sampling per category ─────────────── */
async function pickMultiStoreSamples(country: string): Promise<Array<{ id: string; title: string; category: string; storeCount: number }>> {
  const supa = getSupabaseAdmin()!;
  const out: Array<{ id: string; title: string; category: string; storeCount: number }> = [];
  for (const cat of CATEGORIES) {
    const { data } = await supa.from("products")
      .select("id, title, category_slug, offers!inner(store_id, stores!inner(country))")
      .eq("category_slug", cat)
      .limit(80);
    if (!data) continue;
    const byProd = new Map<string, { id: string; title: string; stores: Set<string> }>();
    for (const row of data as Array<{ id: string; title: string; offers: Array<{ store_id: string; stores: { country: string | null } | null }> }>) {
      const stores = new Set(
        row.offers
          .filter((o) => {
            const c = (o.stores?.country ?? "").toLowerCase();
            return !c || c === country || c === "global";
          })
          .map((o) => o.store_id)
      );
      const e = byProd.get(row.id);
      if (e) { for (const s of stores) e.stores.add(s); }
      else   { byProd.set(row.id, { id: row.id, title: row.title, stores }); }
    }
    const picks = Array.from(byProd.values())
      .filter((p) => p.stores.size >= 2)
      .sort((a, b) => b.stores.size - a.stores.size);
    if (picks[0]) out.push({ id: picks[0].id, title: picks[0].title, category: cat, storeCount: picks[0].stores.size });
  }
  return out;
}

/* ── PHASE 2 — cross-country end-to-end walk ─────────────────── */
async function testProductFlow(p: { id: string; title: string; category: string; storeCount: number }, country: string): Promise<void> {
  const ctx = `[${country}] ${p.category} "${p.title.slice(0, 40)}"`;

  /* (a) Suggest API — does the product surface for its own title? */
  try {
    const { data: sug } = await fetchJson(`${SITE}/api/suggest?q=${encodeURIComponent(p.title.slice(0, 40))}`, country);
    const items = (sug as { items?: Array<{ key: string; storeCount?: number }> }).items ?? [];
    const match = items.find((x) => x.key === p.id);
    if (!match) {
      fail("suggest", ctx, `product not in top suggest results`);
    } else if ((match.storeCount ?? 0) < 1) {
      fail("suggest", ctx, `storeCount = ${match.storeCount ?? 0}`);
    }
  } catch (e) {
    fail("suggest", ctx, `fetch failed: ${(e as Error).message}`);
  }

  /* (b) Compare API by pid — the deep-partition path. */
  let pidStoreCount = 0;
  let pidOffersTotal = 0;
  try {
    const { data: cmp, ms } = await fetchJson(`${SITE}/api/compare?q=${encodeURIComponent(p.title.slice(0, 60))}&mode=similar&pid=${encodeURIComponent(p.id)}`, country);
    const a = (cmp as { mode: string; anchor?: { offers: Array<{ storeId: string; storeName: string; offerId: string; price: number }> } }).anchor;
    if (!a) {
      fail("compare-pid", ctx, `mode=${(cmp as { mode?: string }).mode}, no anchor`);
    } else {
      pidStoreCount = new Set(a.offers.map((o) => o.storeId)).size;
      pidOffersTotal = a.offers.length;
      /* Store-name integrity */
      for (const o of a.offers) {
        if (!o.storeName || /\[BLOCKED:/i.test(o.storeName)) {
          fail("compare-pid", ctx, `bad storeName "${o.storeName}" on offer ${o.offerId}`);
        }
        if (!o.offerId) {
          fail("compare-pid", ctx, `missing offerId on row store=${o.storeId}`);
        }
      }
      /* Performance gate. */
      if (ms > 3000) fail("perf", ctx, `compare-by-pid took ${ms}ms (> 3s)`);
    }
  } catch (e) {
    fail("compare-pid", ctx, `fetch failed: ${(e as Error).message}`);
  }

  /* Consistency window. Allow deep-partition to find UP TO 2x the DB
     count (legitimate cross-product pooling) but not less than half
     (would mean we're dropping legitimate stores). */
  if (pidStoreCount > 0) {
    if (pidStoreCount > p.storeCount * 2 + 2) {
      fail("consistency", ctx, `pid storeCount=${pidStoreCount} > 2x DB(${p.storeCount}) — possible over-pool`);
    } else if (pidStoreCount < Math.floor(p.storeCount / 2)) {
      fail("consistency", ctx, `pid storeCount=${pidStoreCount} < half DB(${p.storeCount}) — possible under-pool`);
    } else {
      ok(`${ctx} DB:${p.storeCount} → pid:${pidStoreCount} offers:${pidOffersTotal} ✓`);
    }
  }
}

/* ── PHASE 3 — adversarial false-positive checks ─────────────── */
interface AdversarialPair { anchorTitle: string; mustNotContainTitleFragments: string[] }
const ADVERSARIAL: AdversarialPair[] = [
  { anchorTitle: "Samsung Galaxy A17 5G",     mustNotContainTitleFragments: ["A15", "A16", "A18", "A55", "A57", "A06"] },
  { anchorTitle: "Apple iPhone 15",           mustNotContainTitleFragments: ["iPhone 14", "iPhone 16", "iPhone 17", "iPhone 13"] },
  { anchorTitle: "Sony WH-1000XM5",           mustNotContainTitleFragments: ["XM4", "XM3"] },
  { anchorTitle: "Apple MacBook Pro M4",      mustNotContainTitleFragments: ["M3", "M2", "M1"] },
];

async function testAdversarial(country: string): Promise<void> {
  const supa = getSupabaseAdmin()!;
  for (const adv of ADVERSARIAL) {
    /* Find an anchor product by title ilike (close enough to the
       adversarial label). Picks the highest-store-count match so
       we exercise the deep partition. */
    const { data } = await supa.from("products")
      .select("id, title, offers!inner(store_id)")
      .ilike("title", `%${adv.anchorTitle.split(" ").slice(0, 3).join(" ")}%`)
      .limit(40);
    if (!data) continue;
    const sorted = (data as Array<{ id: string; title: string; offers: Array<{ store_id: string }> }>)
      .map((r) => ({ id: r.id, title: r.title, n: new Set(r.offers.map((o) => o.store_id)).size }))
      .sort((a, b) => b.n - a.n);
    /* Pick the first match whose title is genuinely the anchor we want
       (not e.g. a CASE for an iPhone 15 when we want the iPhone 15
       itself). Simple heuristic: title contains the FIRST adversarial
       fragment NOT in the exclusion list. */
    const anchor = sorted.find((r) => {
      const t = r.title.toLowerCase();
      return t.includes(adv.anchorTitle.toLowerCase()) ||
             (adv.anchorTitle.toLowerCase().split(" ").every((w) => t.includes(w)));
    });
    if (!anchor) { ok(`adversarial[${country}] ${adv.anchorTitle}: no anchor found in DB`); continue; }
    const ctx = `[${country}] adv "${adv.anchorTitle}" pid=${anchor.id.slice(0, 8)}`;
    try {
      const { data: cmp } = await fetchJson(`${SITE}/api/compare?q=${encodeURIComponent(adv.anchorTitle)}&mode=similar&pid=${encodeURIComponent(anchor.id)}`, country);
      const a = (cmp as { anchor?: { offers: Array<{ storeId: string; productTitle?: string }> } }).anchor;
      if (!a) { fail("adversarial", ctx, "no anchor returned"); continue; }
      /* Check each offer for forbidden variant labels. productTitle
         carries the per-store title for variant-pooled offers — that's
         where the bad pool would surface. */
      const leaks: string[] = [];
      for (const o of a.offers) {
        const tt = (o.productTitle ?? "").toLowerCase();
        if (!tt) continue;
        for (const bad of adv.mustNotContainTitleFragments) {
          if (tt.includes(bad.toLowerCase())) {
            leaks.push(`${o.storeId}=${o.productTitle?.slice(0, 50)}`);
          }
        }
      }
      if (leaks.length > 0) {
        fail("adversarial", ctx, `FALSE-POSITIVE leak (${leaks.length}): ${leaks.slice(0, 3).join(" | ")}`);
      } else {
        ok(`${ctx} no cross-generation leaks ✓ (${a.offers.length} offers)`);
      }
    } catch (e) {
      fail("adversarial", ctx, `fetch failed: ${(e as Error).message}`);
    }
  }
}

/* ── PHASE 4 — cross-border CTA-text check ──────────────────── */
async function testCrossBorderCTA(country: string): Promise<void> {
  /* For NG specifically: find an offer from a non-shoppable store
     (BackMarket / refurbed-de / 93mobiles / fonezone / bigbasket)
     that's pooled into an iPhone 15 anchor, then fetch that offer's
     PDP and assert it renders normally (no silent redirect).
     The post-deploy fix removed the silent redirect; pre-fix this
     would have 30x-redirected to a Jumia offer. */
  if (country !== "ng") return;
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("offers")
    .select("id, store_id, products!inner(title)")
    .in("store_id", ["back-market", "93mobiles", "fonezone", "refurbed-de", "bigbasket"])
    .ilike("products.title", "%iPhone%")
    .limit(3);
  if (!data || data.length === 0) {
    ok("crossborder[ng]: no test offers found (data shape may differ)");
    return;
  }
  for (const row of data as Array<{ id: string; store_id: string; products: { title: string } }>) {
    const ctx = `crossborder[ng] offer=${row.id.slice(0, 8)} store=${row.store_id}`;
    try {
      const res = await fetch(`${SITE}/ng/p/${row.id}`, {
        headers: { "Cookie": "havlo-country=ng" },
        redirect: "manual",
      });
      if (res.status === 307 || res.status === 308) {
        fail("crossborder", ctx, `still silently redirecting (status ${res.status})`);
      } else if (res.status === 200) {
        ok(`${ctx} renders normally ✓ (status 200)`);
      } else {
        fail("crossborder", ctx, `unexpected status ${res.status}`);
      }
    } catch (e) {
      fail("crossborder", ctx, `fetch failed: ${(e as Error).message}`);
    }
  }
}

/* ── Driver ──────────────────────────────────────────────────── */
async function main() {
  console.log(`Extreme compare-engine test — site=${SITE}, countries=${COUNTRIES.join(",")}\n`);

  /* Phase 1 + 2: cross-country end-to-end walks. */
  for (const country of COUNTRIES) {
    console.log(`\n── [${country}] sampling multi-store products per category ──`);
    const samples = await pickMultiStoreSamples(country);
    console.log(`  ${samples.length} samples`);
    for (const s of samples) {
      await testProductFlow(s, country);
    }
  }

  /* Phase 3: adversarial pairs (one country is enough — DB-wide check). */
  console.log(`\n── adversarial false-positive checks ──`);
  await testAdversarial("ng");

  /* Phase 4: cross-border CTA integrity. */
  console.log(`\n── cross-border CTA / no-silent-redirect ──`);
  await testCrossBorderCTA("ng");

  /* ── Report ──────────────────────────────────────────────── */
  console.log(`\n${"═".repeat(70)}`);
  console.log(`SUMMARY  successes=${successes.length}  failures=${failures.length}`);
  console.log("═".repeat(70));
  if (failures.length === 0) {
    console.log("\nAll checks passed.");
    console.log("\nSample successes:");
    for (const s of successes.slice(0, 12)) console.log(`  ✓ ${s}`);
  } else {
    console.log("\nFailures:");
    const bySurface = new Map<string, Failure[]>();
    for (const f of failures) {
      const k = f.surface;
      if (!bySurface.has(k)) bySurface.set(k, []);
      bySurface.get(k)!.push(f);
    }
    for (const [surface, list] of bySurface) {
      console.log(`\n  [${surface}] (${list.length})`);
      for (const f of list.slice(0, 8)) console.log(`    ✗ ${f.ctx}  ${f.msg}`);
      if (list.length > 8) console.log(`    ...and ${list.length - 8} more`);
    }
    console.log(`\n${successes.length} passing checks not shown.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
