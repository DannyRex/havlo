#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   De-fragmentation C — LLM pass for BRAND-LESS orphans.

   The rule-based pass (defragment-products.ts) only trusts orphans that
   NAME their brand. The real fragmentation is the brand-less class — a
   listing titled "Flip 6 Portable Wireless Bluetooth Speaker" with no
   "JBL" anywhere — which a rule can't safely tell apart from some other
   brand's "Flip 6". This pass takes exactly those orphans (match a clean,
   distinctive, unambiguous canonical model token, but don't name the
   brand) and asks the existing product-match judge "is this the
   <canonical>?". On a confident same/variant verdict it adopts the
   canonical signature so the existing signature-pooling unites them.

   Verdicts go through judgeMatch → cached in match_decisions (paid once),
   so a later --apply run is mostly free. No row merge / offer move — only
   products.signature, reversible.

   Run:
     npm run defragment-llm                 # dry-run, ~25 judge calls, report
     npm run defragment-llm -- --limit=60   # cap judge calls (cost control)
     npm run defragment-llm -- --apply      # judge ALL candidates + write
     npm run defragment-llm -- --conf=0.85  # min confidence to adopt (default 0.8)
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature, isLooseCategoryModel, isUnitOrSpecModel } from "../src/lib/search/normalize";
import { looksLikeAccessory } from "../src/lib/search/query-understanding";
import { judgeMatch } from "../src/lib/search/match-judge";

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => { const a = process.argv.find((x) => x.startsWith("--limit=")); return a ? parseInt(a.slice(8), 10) : (APPLY ? Infinity : 25); })();
const CONF  = (() => { const a = process.argv.find((x) => x.startsWith("--conf="));  return a ? parseFloat(a.slice(7)) : 0.8; })();
const CONCURRENCY = 6;
const NGN_PER_USD = 1600, PRICE_BAND = 4, MODEL_MIN_LEN = 4;

interface ProductRow { id: string; title: string; signature: string | null; category_slug: string | null; }
interface PriceRow   { product_id: string; current_price: number | string | null; currency: string | null; }
interface Canon { sig: string; brand: string; category: string | null; medianUsd: number; repId: string; repTitle: string; }

function normForMatch(s: string): string { return ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `; }
function modelTokenIsSpecific(m: string): boolean {
  const t = m.trim();
  if (t.length < MODEL_MIN_LEN || isLooseCategoryModel(t) || isUnitOrSpecModel(t)) return false;
  return /\d/.test(t) || /\s/.test(t) || t.length >= 6;
}
function toUsd(p: number, c: string | null): number { return !p || p <= 0 ? 0 : (c === "NGN" ? p / NGN_PER_USD : p); }

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const supa = getSupabaseAdmin(); if (!supa) throw new Error("no supabase admin (.env.local)");
  const out: T[] = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error; if (!data || data.length === 0) break;
    out.push(...(data as T[])); if (data.length < PAGE) break;
  }
  return out;
}

async function mapLimit<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) break; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function main() {
  console.log(`▶ De-frag LLM pass${APPLY ? "" : ` (DRY RUN — ${LIMIT} judge calls max)`}  conf>=${CONF}`);
  const supa = getSupabaseAdmin(); if (!supa) throw new Error("no supabase admin");

  const products = await fetchAll<ProductRow>("products", "id,title,signature,category_slug");
  const prices   = await fetchAll<PriceRow>("product_best_offers", "product_id,current_price,currency");
  const usd = new Map<string, number>();
  for (const r of prices) { const u = toUsd(Number(r.current_price), r.currency); if (u > 0) usd.set(r.product_id, u); }

  // Canonical index: token -> single clean canonical (with a representative title).
  const byTok = new Map<string, { sigs: Set<string>; cats: Set<string>; prices: number[]; reps: ProductRow[] }>();
  for (const p of products) {
    const sig = p.signature; if (!sig || sig.includes("?")) continue;
    const model = sig.split("|")[1]; if (!model || !modelTokenIsSpecific(model)) continue;
    const tok = normForMatch(model).trim(); if (!tok) continue;
    let e = byTok.get(tok); if (!e) { e = { sigs: new Set(), cats: new Set(), prices: [], reps: [] }; byTok.set(tok, e); }
    e.sigs.add(sig); if (p.category_slug) e.cats.add(p.category_slug);
    const u = usd.get(p.id); if (u) e.prices.push(u);
    e.reps.push(p);
  }
  const canonByTok = new Map<string, Canon>();
  for (const [tok, e] of Array.from(byTok.entries())) {
    if (e.sigs.size !== 1) continue;
    const sig = Array.from(e.sigs)[0];
    const ps = e.prices.slice().sort((a, b) => a - b);
    // Representative title: the shortest one that names the brand (cleanest canonical).
    const brand = sig.split("|")[0];
    const rep = e.reps.slice().sort((a, b) => a.title.length - b.title.length)
      .find((r) => r.title.toLowerCase().includes(brand)) ?? e.reps[0];
    canonByTok.set(tok, { sig, brand, category: e.cats.size === 1 ? Array.from(e.cats)[0] : null,
      medianUsd: ps.length ? ps[Math.floor(ps.length / 2)] : 0, repId: rep.id, repTitle: rep.title });
  }
  const toks = Array.from(canonByTok.keys()).sort((a, b) => b.length - a.length);

  // Brand-LESS candidates: match a clean token, but the orphan names NO brand.
  const cands: { orphan: ProductRow; canon: Canon }[] = [];
  for (const p of products) {
    if (p.signature) continue;
    if (looksLikeAccessory(p.title)) continue;
    const hay = normForMatch(p.title);
    const hits = toks.filter((t) => hay.includes(` ${t} `));
    if (hits.length === 0) continue;
    const sigs = new Set(hits.map((t) => canonByTok.get(t)!.sig));
    if (sigs.size > 1) continue;
    const canon = canonByTok.get(hits[0])!;
    if (buildSignature(p.title).brand !== null) continue;     // brand-less ONLY (named-brand → rule script)
    const oc = p.category_slug, cc = canon.category;
    if (oc && cc && oc !== "general" && cc !== "general" && oc !== cc) continue;
    const ou = usd.get(p.id);
    if (ou && canon.medianUsd > 0) { const r = ou / canon.medianUsd; if (r < 1 / PRICE_BAND || r > PRICE_BAND) continue; }
    cands.push({ orphan: p, canon });
  }
  console.log(`  ${cands.length} brand-less candidates match a clean canonical`);

  const batch = cands.slice(0, LIMIT);
  console.log(`  judging ${batch.length}…`);
  let accepted = 0;
  const verdicts = await mapLimit(batch, CONCURRENCY, async (c) => {
    const j = await judgeMatch(supa as never,
      { id: c.canon.repId, title: c.canon.repTitle, brand: c.canon.brand },
      { id: c.orphan.id,   title: c.orphan.title });
    const ok = (j.decision === "same" || j.decision === "variant") && j.confidence >= CONF;
    if (ok) accepted++;
    return { c, j, ok };
  });

  console.log(`\n── Verdicts (${batch.length}) ──`);
  for (const v of verdicts) {
    console.log(`  ${v.ok ? "ADOPT" : "skip "} [${v.j.decision} ${v.j.confidence.toFixed(2)}${v.j.cached ? " c" : ""}]  "${v.c.orphan.title.slice(0, 52)}"  →  ${v.c.canon.sig}`);
  }
  console.log(`\n  ${accepted}/${batch.length} adopt the canonical signature (conf>=${CONF}).`);

  if (!APPLY) { console.log(`\nDry-run complete. --apply judges all ${cands.length} + writes.`); return; }

  let done = 0;
  for (const v of verdicts) {
    if (!v.ok) continue;
    const { error } = await supa.from("products").update({ signature: v.c.canon.sig }).eq("id", v.c.orphan.id);
    if (error) { console.error(`  ✗ ${v.c.orphan.id}: ${error.message}`); continue; }
    if (++done % 100 === 0) console.log(`  …wrote ${done}`);
  }
  console.log(`\n✓ Wrote ${done} signatures. Refresh product_best_offers + caches.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
