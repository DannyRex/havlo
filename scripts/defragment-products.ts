#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   De-fragmentation — anchor brand-less ORPHAN products to a known
   canonical by a specific model token.

   The problem: the same physical product gets split across many
   product_ids because some listings drop the brand from the title.
   buildSignature() (correctly) refuses to guess a signature when it
   can't parse brand+model, so those listings land with signature=NULL
   and never pool. A shopper opening one of them sees a lonely "1 store"
   spectrum even though the well-parsed canonical of the same product
   carries dozens of offers.

   Example (JBL Flip 6):
     canonical  "JBL FLIP 6"                      signature jbl|flip 6   123 offers
     orphans    "Flip 6 Portable Wireless …"      signature NULL          1 offer
                "Flip 6 Bluetooth Speaker BLACK"  signature NULL          1 offer  … etc.
   The orphans share NO hard id with the canonical (different image
   phash, different google_shopping_id, different title_key) — only the
   model token "flip 6".

   The fix: give a confident orphan the canonical's signature, so the
   existing signature-pooling path unites them. No row merge, no offer
   move — just products.signature, fully reversible.

   SAFE BY DESIGN (high precision over recall — the catalog already
   learned the cost of loose grouping; see the samsung|? note in
   normalize.ts buildSignature):
     • Anchors ONLY to existing tight canonicals (brand+model already
       parsed). Never invents a group, so it cannot recreate the
       "70 unrelated Samsung products under samsung|?" failure.
     • The model token must be SPECIFIC (not a loose category word,
       length >= 4, and either contains a digit, is multi-word, or is
       >= 6 chars) and UNAMBIGUOUS catalog-wide (maps to exactly one
       canonical signature).
     • The orphan must contain the full model token as a whole phrase.
     • Guards: no CONFLICTING brand in the orphan title, compatible
       category, plausible price band, not an accessory/part.

   Run:
     npm run defragment                  # dry-run, report only
     npm run defragment -- --apply       # write signatures
     npm run defragment -- --limit=2000  # cap orphans scanned (safety)
     npm run defragment -- --samples=40  # how many example matches to print
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { buildSignature, isLooseCategoryModel, isUnitOrSpecModel } from "../src/lib/search/normalize";
import { looksLikeAccessory } from "../src/lib/search/query-understanding";

const APPLY    = process.argv.includes("--apply");
const LIMIT    = (() => { const a = process.argv.find((x) => x.startsWith("--limit="));   return a ? parseInt(a.slice(8), 10)  : Infinity; })();
const SAMPLES  = (() => { const a = process.argv.find((x) => x.startsWith("--samples=")); return a ? parseInt(a.slice(10), 10) : 30; })();

const NGN_PER_USD = 1600;        // rough — the price band is only a sanity backstop
const PRICE_BAND  = 4;           // orphan must sit within [median/4, median*4] of the canonical
const MODEL_MIN_LEN = 4;

interface ProductRow { id: string; title: string; signature: string | null; category_slug: string | null; }
interface PriceRow   { product_id: string; current_price: number | string | null; currency: string | null; }

/* Normalise a string for whole-phrase token matching: lowercase, every
   non-alphanumeric run -> single space, trimmed and space-padded so
   `includes(" token ")` is a true word-boundary check. */
function normForMatch(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/* A model token is specific enough to anchor on when it isn't a loose
   category word, isn't a unit/spec (isUnitOrSpecModel — shared with
   buildSignature so the index can't carry a junk canonical the parser
   itself now rejects), and carries real identity: a digit, multiple
   words, or reasonable length. */
function modelTokenIsSpecific(model: string): boolean {
  const m = model.trim();
  if (m.length < MODEL_MIN_LEN) return false;
  if (isLooseCategoryModel(m)) return false;
  if (isUnitOrSpecModel(m)) return false;
  const hasDigit = /\d/.test(m);
  const multiWord = /\s/.test(m);
  return hasDigit || multiWord || m.length >= 6;
}

/* Supplementary accessory / spare-part guard. looksLikeAccessory catches
   the common cases; this adds the part nouns + "for <product>" framing that
   slipped through (earpad sweat covers, replacement batteries for Nokia 3310). */
const ACCESSORY_RE = /\b(case|cases|cover|covers|sleeve|pouch|protector|earpad|ear pad|eartip|ear tip|strap|band|charger|charging|cable|adapter|adaptor|mount|holder|stand|battery|batteries|screen protector|tempered glass|skin|decal|sticker|grip|bumper|replacement|spare|for jbl|for sony|for bose|for apple|for samsung|for nokia)\b/i;

function toUsd(price: number, currency: string | null): number {
  if (!price || price <= 0) return 0;
  return currency === "NGN" ? price / NGN_PER_USD : price;
}

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("no supabase admin (check .env.local)");
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

async function main() {
  console.log(`▶ De-fragmentation${APPLY ? "" : " (DRY RUN — pass --apply to write)"}`);

  const products = await fetchAll<ProductRow>("products", "id,title,signature,category_slug");
  const prices   = await fetchAll<PriceRow>("product_best_offers", "product_id,current_price,currency");
  console.log(`  loaded ${products.length} products, ${prices.length} priced rows`);

  const usdByProduct = new Map<string, number>();
  for (const r of prices) {
    const usd = toUsd(Number(r.current_price), r.currency);
    if (usd > 0) usdByProduct.set(r.product_id, usd);
  }

  /* ── Build the canonical index from tight signatures ──────────────
     modelToken -> { signatures it maps to, brand, categories, usd prices }.
     A token mapping to >1 distinct signature is AMBIGUOUS and dropped. */
  const byModel = new Map<string, { sigs: Set<string>; categories: Set<string>; prices: number[] }>();
  for (const p of products) {
    const sig = p.signature;
    if (!sig || sig.includes("?")) continue;            // tight only
    const parts = sig.split("|");
    if (parts.length < 2) continue;
    const model = parts[1];
    if (!model || !modelTokenIsSpecific(model)) continue;
    const token = normForMatch(model).trim();
    if (!token) continue;
    let e = byModel.get(token);
    if (!e) { e = { sigs: new Set(), categories: new Set(), prices: [] }; byModel.set(token, e); }
    e.sigs.add(sig);
    if (p.category_slug) e.categories.add(p.category_slug);
    const usd = usdByProduct.get(p.id);
    if (usd) e.prices.push(usd);
  }

  // Keep only unambiguous tokens (exactly one canonical signature).
  const canonicalByToken = new Map<string, { sig: string; brand: string; category: string | null; medianUsd: number }>();
  for (const [token, e] of Array.from(byModel.entries())) {
    if (e.sigs.size !== 1) continue;                    // ambiguous -> skip
    const sig = Array.from(e.sigs)[0];
    const brand = sig.split("|")[0];
    const prices = e.prices.slice().sort((a, b) => a - b);
    const medianUsd = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const category = e.categories.size === 1 ? Array.from(e.categories)[0] : null;
    canonicalByToken.set(token, { sig, brand, category, medianUsd });
  }
  // Longest tokens first so "galaxy s24 ultra" wins over a stray "s24".
  const tokensByLen = Array.from(canonicalByToken.keys()).sort((a, b) => b.length - a.length);
  console.log(`  built ${canonicalByToken.size} unambiguous canonical model tokens`);

  /* ── Match orphans ────────────────────────────────────────────────── */
  interface Match { orphan: ProductRow; sig: string; token: string; orphanBrand: string | null; flags: string[]; }
  const matches: Match[] = [];
  const skips = { accessory: 0, noToken: 0, ambiguous: 0, brandMismatch: 0, category: 0, price: 0 };
  let scanned = 0;

  for (const p of products) {
    if (p.signature) continue;                          // orphans only
    if (scanned >= LIMIT) break;
    scanned++;

    if (looksLikeAccessory(p.title) || ACCESSORY_RE.test(p.title)) { skips.accessory++; continue; }
    const hay = normForMatch(p.title);

    // Collect every canonical token present as a whole phrase.
    const hits: string[] = [];
    for (const token of tokensByLen) {
      if (hay.includes(` ${token} `)) hits.push(token);
    }
    if (hits.length === 0) { skips.noToken++; continue; }

    const sigs = new Set(hits.map((t) => canonicalByToken.get(t)!.sig));
    if (sigs.size > 1) { skips.ambiguous++; continue; } // two different products named -> unsafe
    const token = hits[0];
    const canon = canonicalByToken.get(token)!;

    /* Require the orphan to NAME the canonical's brand. The brand-less
       orphans (the Flip 6 class) share no reliable signal with the
       canonical, so auto-anchoring them on a model token alone is unsafe
       — they need the LLM / curation pass, not this heuristic. */
    const orphanBrand = buildSignature(p.title).brand;
    if (orphanBrand !== canon.brand) { skips.brandMismatch++; continue; }

    // Compatible category (only block when both are specific and differ).
    const oc = p.category_slug, cc = canon.category;
    if (oc && cc && oc !== "general" && cc !== "general" && oc !== cc) { skips.category++; continue; }

    // Plausible price band (backstop against parts/bundles the accessory gate missed).
    const ousd = usdByProduct.get(p.id);
    if (ousd && canon.medianUsd > 0) {
      const ratio = ousd / canon.medianUsd;
      if (ratio < 1 / PRICE_BAND || ratio > PRICE_BAND) { skips.price++; continue; }
    }

    matches.push({ orphan: p, sig: canon.sig, token, orphanBrand, flags: orphanBrand ? ["brand-in-title"] : [] });
  }

  /* ── Report ──────────────────────────────────────────────────────── */
  const orphanTotal = products.filter((p) => !p.signature).length;
  console.log(`\n── Result ──`);
  console.log(`  orphans (null signature):     ${orphanTotal}`);
  console.log(`  scanned:                      ${scanned}`);
  console.log(`  MATCHED to a canonical:       ${matches.length}`);
  console.log(`  skipped — accessory:          ${skips.accessory}`);
  console.log(`  skipped — no known model:     ${skips.noToken}`);
  console.log(`  skipped — names 2 products:   ${skips.ambiguous}`);
  console.log(`  skipped — brand not named:    ${skips.brandMismatch}`);
  console.log(`  skipped — category mismatch:  ${skips.category}`);
  console.log(`  skipped — price out of band:  ${skips.price}`);

  // Top canonicals by orphans gained.
  const bySig = new Map<string, Match[]>();
  for (const m of matches) { const a = bySig.get(m.sig) ?? []; a.push(m); bySig.set(m.sig, a); }
  const ranked = Array.from(bySig.entries()).sort((a, b) => b[1].length - a[1].length);
  console.log(`\n── Top canonicals by orphans gained (${ranked.length} distinct) ──`);
  for (const [sig, ms] of ranked.slice(0, 15)) {
    console.log(`  +${ms.length.toString().padStart(3)}  ${sig}`);
    for (const m of ms.slice(0, 3)) console.log(`         ← "${m.orphan.title.slice(0, 64)}"`);
  }

  // Random-ish sample across the whole match set for eyeballing.
  console.log(`\n── Sample matches (${Math.min(SAMPLES, matches.length)}) ──`);
  const step = Math.max(1, Math.floor(matches.length / SAMPLES));
  for (let i = 0; i < matches.length && i / step < SAMPLES; i += step) {
    const m = matches[i];
    console.log(`  "${m.orphan.title.slice(0, 60)}"  →  ${m.sig}  [${m.token}]${m.flags.length ? " " + m.flags.join(",") : ""}`);
  }

  // Surface any match where the orphan ALSO carried a brand (highest-confidence subset).
  const withBrand = matches.filter((m) => m.orphanBrand);
  console.log(`\n  (${withBrand.length} of ${matches.length} matched orphans already named the same brand — the safest subset.)`);

  if (!APPLY) {
    console.log(`\nDry-run complete. Re-run with --apply to write ${matches.length} signatures.`);
    return;
  }

  /* ── Apply ────────────────────────────────────────────────────────── */
  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("no supabase admin");
  let done = 0;
  for (const m of matches) {
    const { error } = await supa.from("products").update({ signature: m.sig }).eq("id", m.orphan.id);
    if (error) { console.error(`  ✗ ${m.orphan.id}: ${error.message}`); continue; }
    done++;
    if (done % 200 === 0) console.log(`  …${done}/${matches.length}`);
  }
  console.log(`\n✓ Wrote ${done} signatures. Refresh product_best_offers + any caches.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
