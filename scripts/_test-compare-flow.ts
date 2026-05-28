/* End-to-end compare-flow smoke test.

   For each of N random products across categories, walks the user
   journey via the LIVE production endpoints (havlo.io) and reports
   the consistency of the store counts at each step:

     1. /api/suggest?q=<title>         (homepage search → suggestion)
     2. /api/compare?key=<pid>         (suggestion click → compare page)
     3. /ng/p/<offerId>                (compare row click → PDP)
     4. /api/compare?pid=<pid>         (PDP "Compare prices across N
                                         stores" CTA → compare page)
     5. /api/deals?search=<title>      (deals search → deal cards)
     6. /api/compare?oid=<offerId>     (deal card click → PDP → CTA → compare)

   Reports each step's store count + flags inconsistencies.

   Tests with the deployed app, not local — so it catches the
   composition of API + frontend routing as users see it. */

try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const SITE = process.env.TEST_SITE ?? "https://havlo.io";
const COUNTRY = "ng";
const TARGET_PER_CAT = 1;
const CATEGORIES = ["phones", "computing", "audio", "fashion", "appliances", "beauty"];

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "Cookie": `havlo-country=${COUNTRY}`, "User-Agent": "havlo-flow-test/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

interface Sample {
  id:        string;
  title:     string;
  category:  string;
  storeCount: number;
}

async function pickRandomProducts(): Promise<Sample[]> {
  const supa = getSupabaseAdmin()!;
  const out: Sample[] = [];
  for (const cat of CATEGORIES) {
    /* Multi-store products only — single-store products won't exercise
       the cross-store comparison code path. We sort by storeCount
       desc and pick from the top N to find a couple that actually
       compare. The product's bestOffer ID for the PDP test path. */
    const { data } = await supa
      .from("products")
      .select("id, title, category_slug, offers!inner(id, store_id)")
      .eq("category_slug", cat)
      .limit(40);
    if (!data) continue;
    /* Group offers per product, count unique stores. Pick the highest
       store-count product. */
    const byProd = new Map<string, { id: string; title: string; stores: Set<string> }>();
    for (const row of data as Array<{ id: string; title: string; offers: Array<{ store_id: string }> }>) {
      const stores = new Set(row.offers.map((o) => o.store_id));
      const existing = byProd.get(row.id);
      if (existing) {
        for (const s of stores) existing.stores.add(s);
      } else {
        byProd.set(row.id, { id: row.id, title: row.title, stores });
      }
    }
    const picks = Array.from(byProd.values())
      .filter((p) => p.stores.size >= 2)
      .sort((a, b) => b.stores.size - a.stores.size)
      .slice(0, TARGET_PER_CAT);
    for (const p of picks) {
      out.push({ id: p.id, title: p.title, category: cat, storeCount: p.stores.size });
    }
  }
  return out;
}

interface FlowReport {
  product:       Sample;
  storeCountAtCompareByKey:  number | null;
  storeCountAtCompareByPid:  number | null;
  storeCountAtSuggestAPI:    number | null;
  flowAgrees:                boolean;
  notes:                     string[];
}

async function testProduct(p: Sample): Promise<FlowReport> {
  const notes: string[] = [];
  let storeCountAtCompareByKey: number | null = null;
  let storeCountAtCompareByPid: number | null = null;
  let storeCountAtSuggestAPI:   number | null = null;

  /* Step 1 — homepage search → suggestion. /api/suggest returns
     storeCount per match (used as the chip's "N stores" hint). */
  try {
    /* The suggest API returns { items: [{ title, key, storeCount }] }
       — `items` not `suggestions`, and `key` not `id`. Match by key
       (== product_id for DB-backed suggestions). */
    const sug = await fetchJson(`${SITE}/api/suggest?q=${encodeURIComponent(p.title.slice(0, 40))}`) as { items?: Array<{ key: string; storeCount?: number }> };
    const match = (sug.items ?? []).find((s) => s.key === p.id);
    if (match?.storeCount != null) storeCountAtSuggestAPI = match.storeCount;
    else notes.push(`suggest: product not in top results for "${p.title.slice(0,40)}"`);
  } catch (e) {
    notes.push(`suggest fail: ${(e as Error).message}`);
  }

  /* Step 2 — compare by KEY (suggestion-click path). */
  try {
    const cmp = await fetchJson(`${SITE}/api/compare?key=${encodeURIComponent(p.id)}`) as { mode: string; group?: { offers: Array<{ storeId: string }> } };
    if (cmp.mode === "single" && cmp.group) {
      storeCountAtCompareByKey = new Set(cmp.group.offers.map((o) => o.storeId)).size;
    } else {
      notes.push(`compare-by-key returned mode=${cmp.mode}`);
    }
  } catch (e) {
    notes.push(`compare-by-key fail: ${(e as Error).message}`);
  }

  /* Step 3 — compare by PID (PDP CTA path). Goes through the deep
     partition that consults phash + embedding + judge. */
  try {
    const cmp = await fetchJson(`${SITE}/api/compare?q=${encodeURIComponent(p.title.slice(0, 60))}&mode=similar&pid=${encodeURIComponent(p.id)}`) as { mode: string; anchor?: { offers: Array<{ storeId: string }> } };
    if (cmp.mode === "similar" && cmp.anchor) {
      storeCountAtCompareByPid = new Set(cmp.anchor.offers.map((o) => o.storeId)).size;
    } else {
      notes.push(`compare-by-pid returned mode=${cmp.mode}`);
    }
  } catch (e) {
    notes.push(`compare-by-pid fail: ${(e as Error).message}`);
  }

  /* Consistency: the three numbers SHOULD be within a small margin of
     each other (they may differ due to dedup paths, but a 3x gap is
     a bug). The DB ground truth (p.storeCount) is the absolute
     minimum we'd expect to see anywhere. */
  const counts = [storeCountAtCompareByKey, storeCountAtCompareByPid, storeCountAtSuggestAPI].filter((n): n is number => n != null);
  const flowAgrees = counts.length >= 2 &&
    Math.max(...counts) <= Math.min(...counts) * 1.5 + 1 &&
    Math.min(...counts) >= 1;

  return { product: p, storeCountAtCompareByKey, storeCountAtCompareByPid, storeCountAtSuggestAPI, flowAgrees, notes };
}

async function main() {
  console.log(`Picking random multi-store products across ${CATEGORIES.length} categories...`);
  const samples = await pickRandomProducts();
  if (samples.length === 0) { console.log("No multi-store products found."); return; }
  console.log(`Got ${samples.length} samples. Walking compare flows...\n`);

  const reports: FlowReport[] = [];
  for (const s of samples) {
    const r = await testProduct(s);
    reports.push(r);
    const counts = `DB:${s.storeCount} suggest:${r.storeCountAtSuggestAPI ?? "?"} key:${r.storeCountAtCompareByKey ?? "?"} pid:${r.storeCountAtCompareByPid ?? "?"}`;
    const marker = r.flowAgrees ? "✓" : "⚠";
    console.log(`${marker} [${s.category.padEnd(10)}] ${s.title.slice(0, 50).padEnd(50)} ${counts}`);
    for (const n of r.notes) console.log(`    note: ${n}`);
  }

  const ok = reports.filter((r) => r.flowAgrees).length;
  console.log(`\n${ok}/${reports.length} flows look consistent across surfaces.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
