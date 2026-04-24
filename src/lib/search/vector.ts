/**
 * Phase 2.5 — Vector search engine (replaces heuristic for high-recall queries)
 *
 * Public API mirrors `./index.ts` so the API route can swap implementations
 * with a one-line change behind a feature flag:
 *
 *   import { vectorSearch as search } from "@/lib/search/vector";
 *
 * Pipeline:
 *   1. Embed query (OpenAI text-embedding-3-small, 1536d). Cached per process.
 *   2. ANN against `deals_index.text_emb` via Supabase RPC.
 *      Optional structured filters (brand / product_type / accessory) inferred
 *      from the query signature. Cheap pre-filters keep recall on broad queries
 *      ("phone", "earbuds") and stop cross-category leakage.
 *   3. Map dealId → ProductGroup using the already-built in-memory cache from
 *      `./index.ts`. We never re-derive grouping; vectors only re-RANK.
 *   4. Per-group score = max ANN score among that group's deals + small
 *      structural bonuses (multi-store, brand match, accessory penalty).
 *   5. Mode resolution (single / list / empty) follows the same rules as the
 *      heuristic engine so the frontend doesn't have to change.
 *
 * "Find similar" mode pulls the anchor's text+image vectors with one RPC,
 * then runs the hybrid (text 0.6 + image 0.4) ANN — closing the gap on
 * Dupe.com's visual matching.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import {
  buildSignature, tokensOf, type ProductSignature,
} from "./normalize";
import { parseStoreUrl } from "./url-parser";
import {
  getProductGroups, getDealIdToGroup,
  classifyProductType, dupeSimilarity, ACCESSORY_RE, RELATED_CATS, suggestFallbacks,
  type SearchOutput, type ProductGroup, type DupeResult,
} from "./index";

/* ── Lazy-init clients ─────────────────────────────────────────────── */

let _supa: SupabaseClient | null = null;
let _openai: OpenAI | null = null;

function getSupa(): SupabaseClient {
  if (_supa) return _supa;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Vector search requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  _supa = createClient(url, key, { auth: { persistSession: false } });
  return _supa;
}

function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Vector search requires OPENAI_API_KEY");
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

/* ── Query embedding cache ─────────────────────────────────────────── */
// Process-level LRU. Search traffic has a fat head — the same 200 queries
// account for most volume. Caching here turns ~$0.000002 per repeat into 0.
const _embCache = new Map<string, number[]>();
const EMB_CACHE_MAX = 1000;

async function embedText(q: string): Promise<number[]> {
  const k = q.toLowerCase().trim();
  const hit = _embCache.get(k);
  if (hit) {
    // LRU touch
    _embCache.delete(k);
    _embCache.set(k, hit);
    return hit;
  }
  const resp = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: k.slice(0, 8000),
    encoding_format: "float",
  });
  const vec = resp.data[0].embedding;
  _embCache.set(k, vec);
  if (_embCache.size > EMB_CACHE_MAX) {
    const firstKey = _embCache.keys().next().value;
    if (firstKey !== undefined) _embCache.delete(firstKey);
  }
  return vec;
}

/* ── Query intent inference ────────────────────────────────────────── */

// Same category-keyword guard used by the heuristic engine. We pre-filter
// at the SQL level when the query is a category keyword so "phone" doesn't
// pull a phone case as the top hit through pure embedding similarity.
const CATEGORY_TYPE_FILTER: Record<string, string> = {
  phone:        "flagship-phone",  // applied loosely — see below
  phones:       "flagship-phone",
  smartphone:   "flagship-phone",
  tablet:       "tablet",
  laptop:       "laptop",
  macbook:      "premium-laptop",
  tv:           "tv",
  television:   "tv",
  fridge:       "fridge",
  console:      "console",
  playstation:  "console",
  xbox:         "console",
  earbuds:      "earbuds",
  headphone:    "headphones",
  headphones:   "headphones",
  speaker:      "speaker",
  watch:        "smartwatch",
  smartwatch:   "smartwatch",
};

interface QueryIntent {
  brand:        string | null;
  productType:  string | null;  // strict filter
  productTypes: string[] | null; // loose filter (multi-type acceptable)
  isAccessory:  boolean | null;  // true = user wants one, null = no preference
  signature:    ProductSignature;
}

function inferIntent(qRaw: string): QueryIntent {
  const sig = buildSignature(qRaw);
  const lower = qRaw.toLowerCase();
  const userWantsAccessory = ACCESSORY_RE.test(lower);

  // Multi-type families — keep "earbuds" search returning both earbuds
  // and premium-earbuds rather than collapsing to one bucket.
  const TYPE_FAMILIES: Record<string, string[]> = {
    "flagship-phone":  ["flagship-phone", "budget-phone"],
    "earbuds":         ["earbuds", "premium-earbuds"],
    "premium-earbuds": ["earbuds", "premium-earbuds"],
    "laptop":          ["laptop", "premium-laptop"],
  };

  let strictType: string | null = null;
  let looseTypes: string[] | null = null;
  for (const tok of lower.split(/\s+/)) {
    const mapped = CATEGORY_TYPE_FILTER[tok];
    if (mapped) {
      looseTypes = TYPE_FAMILIES[mapped] ?? [mapped];
      break;
    }
  }

  return {
    brand: sig.brand,
    productType: strictType,
    productTypes: looseTypes,
    isAccessory: userWantsAccessory ? true : null,
    signature: sig,
  };
}

/* ── ANN call helpers ──────────────────────────────────────────────── */

interface AnnHit {
  id: string;
  title: string;
  brand: string | null;
  product_type: string | null;
  is_accessory: boolean | null;
  price_ngn: number | null;
  category: string | null;
  score: number;
}

async function annTextSearch(
  embedding: number[],
  matchCount: number,
  filters: { brand?: string | null; productType?: string | null; isAccessory?: boolean | null; excludeId?: string | null },
): Promise<AnnHit[]> {
  const { data, error } = await getSupa().rpc("match_deals_by_text", {
    query_embedding:     embedding,
    match_count:         matchCount,
    filter_brand:        filters.brand        ?? null,
    filter_product_type: filters.productType  ?? null,
    filter_is_accessory: filters.isAccessory  ?? null,
    exclude_id:          filters.excludeId    ?? null,
  });
  if (error) throw new Error(`match_deals_by_text failed: ${error.message}`);
  return (data ?? []) as AnnHit[];
}

async function annHybridSearch(
  textEmb: number[],
  imageEmb: number[],
  matchCount: number,
  excludeId: string,
): Promise<AnnHit[]> {
  const { data, error } = await getSupa().rpc("match_deals_hybrid", {
    query_text_emb:  textEmb,
    query_image_emb: imageEmb,
    match_count:     matchCount,
    text_weight:     0.6,
    image_weight:    0.4,
    exclude_id:      excludeId,
  });
  if (error) throw new Error(`match_deals_hybrid failed: ${error.message}`);
  return (data ?? []) as AnnHit[];
}

async function fetchDealVectors(dealId: string): Promise<{ text: number[] | null; image: number[] | null }> {
  const { data, error } = await getSupa().rpc("get_deal_vectors", { deal_id: dealId });
  if (error) throw new Error(`get_deal_vectors failed: ${error.message}`);
  const row = (data ?? [])[0];
  if (!row) return { text: null, image: null };
  // Supabase returns vectors as JSON-serialised arrays (or strings, depending
  // on driver — handle both).
  const parse = (v: unknown): number[] | null => {
    if (!v) return null;
    if (Array.isArray(v)) return v as number[];
    if (typeof v === "string") {
      try { return JSON.parse(v) as number[]; } catch { return null; }
    }
    return null;
  };
  return { text: parse(row.text_emb), image: parse(row.image_emb) };
}

/* ── Group-level rescoring ─────────────────────────────────────────── */

interface ScoredGroup { group: ProductGroup; score: number; topHitScore: number; }

function rescoreToGroups(hits: AnnHit[], queryRaw: string, intent: QueryIntent): ScoredGroup[] {
  const idToGroup = getDealIdToGroup();
  const userWantsAccessory = ACCESSORY_RE.test(queryRaw.toLowerCase());

  // Aggregate ANN hits per group: keep best ANN score, count hit support.
  const byGroup = new Map<string, { group: ProductGroup; bestAnn: number; hitCount: number; hits: AnnHit[] }>();
  for (const h of hits) {
    // Loose product-type filter applied here (SQL filter would be too strict
    // because some valid hits have product_type = null in extracted.json).
    if (intent.productTypes && h.product_type && !intent.productTypes.includes(h.product_type)) continue;
    const g = idToGroup.get(h.id);
    if (!g) continue;
    const cur = byGroup.get(g.key);
    if (!cur) byGroup.set(g.key, { group: g, bestAnn: h.score, hitCount: 1, hits: [h] });
    else { cur.bestAnn = Math.max(cur.bestAnn, h.score); cur.hitCount++; cur.hits.push(h); }
  }

  const queryTokens = tokensOf(queryRaw);

  const out: ScoredGroup[] = [];
  for (const { group, bestAnn, hitCount, hits } of Array.from(byGroup.values())) {
    let score = bestAnn * 100;  // 0–100

    // Multi-deal support — if N deals from this group all rank in the top-K,
    // that's strong corroboration. Diminishing returns past 4.
    score += Math.min(hitCount, 4) * 1.5;

    // Brand match boost — embeddings already encode this softly, but an
    // exact token bump helps disambiguate borderline cases.
    if (intent.brand && group.brand && group.brand === intent.brand) score += 6;

    // Multi-store boost — same rationale as the heuristic engine.
    score += Math.min(group.storeCount, 5) * 1.5;

    // Accessory penalty — vectors don't always separate "iPhone case" from
    // "iPhone". Applied only when the user clearly wasn't asking for one.
    if (!userWantsAccessory) {
      const isAccessory = ACCESSORY_RE.test(group.title) || hits.some((h: AnnHit) => h.is_accessory);
      if (isAccessory) score -= 25;
    }

    // Word-boundary boost — rewards exact word presence in the title (helps
    // tiebreak "Spark 30" vs. unrelated Tecno phones when both are close).
    for (const t of queryTokens) {
      if (t.length < 2) continue;
      const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(group.title)) score += 2;
    }

    out.push({ group, score, topHitScore: bestAnn });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/* ── Mode resolution ───────────────────────────────────────────────── */

function decideMode(scored: ScoredGroup[], intent: QueryIntent): "single" | "list" {
  if (scored.length === 0) return "list"; // caller will catch empty separately
  const top = scored[0];
  const second = scored[1];
  // SINGLE if query is specific (brand+model) AND top dominates by margin.
  const querySpecific = !!(intent.signature.brand && (intent.signature.model || intent.signature.storageGb || intent.signature.inches));
  const dominates = !second || top.score > second.score + 10;
  return querySpecific && dominates ? "single" : "list";
}

/* ── Public: vectorSearch ──────────────────────────────────────────── */

export async function vectorSearch(rawQuery: string, opts?: { limit?: number }): Promise<SearchOutput> {
  const q = rawQuery.trim();
  if (!q) return { mode: "empty", query: q, suggestions: [] };

  const limit = opts?.limit ?? 24;
  const intent = inferIntent(q);

  // Embed + ANN. We over-fetch (200) because dedup-by-group typically keeps
  // 1–4 hits per group; without headroom the result set thins out.
  const embedding = await embedText(q);
  const hits = await annTextSearch(embedding, 200, {
    brand:        intent.brand,
    isAccessory:  intent.isAccessory,
    // productType passed loosely in TS-side filter (see rescoreToGroups)
  });

  const scored = rescoreToGroups(hits, q, intent);

  // Threshold — anything below 35 is noise (a 0.20 cosine similarity post-bonus).
  const filtered = scored.filter((x) => x.score > 35);

  if (filtered.length === 0) {
    // Suggest fallbacks via the existing heuristic helper — uses local index, no API call.
    const groups = getProductGroups();
    return { mode: "empty", query: q, suggestions: suggestFallbacks(intent.signature, q, groups) };
  }

  const mode = decideMode(filtered, intent);

  if (mode === "single") {
    const top = filtered[0];
    const alts = filtered.slice(1)
      .filter((x) => x.group.category === top.group.category && x.group.key !== top.group.key)
      .slice(0, 6)
      .map((x) => x.group);
    return { mode: "single", query: q, group: top.group, alternatives: alts };
  }

  // LIST mode
  const seen = new Set<string>();
  const list: ProductGroup[] = [];
  for (const x of filtered) {
    if (seen.has(x.group.key)) continue;
    seen.add(x.group.key);
    list.push(x.group);
    if (list.length >= limit) break;
  }
  return { mode: "list", query: q, groups: list, total: filtered.length };
}

/* ── Public: vectorFindSimilar ─────────────────────────────────────── */

export async function vectorFindSimilar(rawQuery: string, opts?: { limit?: number }): Promise<SearchOutput> {
  const q = rawQuery.trim();
  if (!q) return { mode: "empty", query: q, suggestions: [] };

  const limit = opts?.limit ?? 16;

  // Step 1: locate the anchor (re-use vectorSearch).
  const anchorResult = await vectorSearch(q, { limit: 1 });
  let anchor: ProductGroup;
  if (anchorResult.mode === "empty") return anchorResult;
  if (anchorResult.mode === "single") anchor = anchorResult.group;
  else if (anchorResult.mode === "list") anchor = anchorResult.groups[0];
  else /* "similar" — shouldn't happen from vectorSearch but be defensive */ anchor = anchorResult.anchor;

  // Step 2: pick a representative dealId for the anchor (any deal in the group)
  // and pull its text + image vectors. We then do hybrid ANN.
  const idToGroup = getDealIdToGroup();
  const repId = anchor.offers[0]
    ? Array.from(idToGroup.entries()).find(([, g]) => g.key === anchor.key)?.[0] ?? null
    : null;

  if (!repId) {
    // Anchor exists but has no Supabase row — fall back to text-only with
    // the anchor's title as the query.
    return await vectorSearchSimilarFromTitle(anchor, q, limit);
  }

  const { text: anchorTextEmb, image: anchorImageEmb } = await fetchDealVectors(repId);
  if (!anchorTextEmb) return await vectorSearchSimilarFromTitle(anchor, q, limit);

  let hits: AnnHit[];
  if (anchorImageEmb) {
    hits = await annHybridSearch(anchorTextEmb, anchorImageEmb, 200, repId);
  } else {
    hits = await annTextSearch(anchorTextEmb, 200, { excludeId: repId });
  }

  const dupes = hitsToDupes(hits, anchor);
  return { mode: "similar", query: q, anchor, dupes: dupes.slice(0, limit) };
}

/** Fallback when the anchor isn't in Supabase yet (newly scraped, etc.) */
async function vectorSearchSimilarFromTitle(anchor: ProductGroup, query: string, limit: number): Promise<SearchOutput> {
  const embedding = await embedText(anchor.title);
  const hits = await annTextSearch(embedding, 200, {});
  const dupes = hitsToDupes(hits, anchor);
  return { mode: "similar", query, anchor, dupes: dupes.slice(0, limit) };
}

/** Convert ANN hits into DupeResult[] applying the same business rules as
 *  the heuristic findSimilar (related categories, price ceiling, accessory
 *  filter, dupe-similarity blend). */
function hitsToDupes(hits: AnnHit[], anchor: ProductGroup): DupeResult[] {
  const idToGroup = getDealIdToGroup();
  const anchorSig = buildSignature(anchor.title);
  const anchorType = classifyProductType(anchor.title, anchor.category);
  const relatedCats = RELATED_CATS[anchor.category] ?? [anchor.category];
  const priceCeiling = anchor.bestPrice * 1.1;

  // Aggregate ANN hits per group, retain best ANN score
  const byGroup = new Map<string, { group: ProductGroup; bestAnn: number }>();
  for (const h of hits) {
    const g = idToGroup.get(h.id);
    if (!g || g.key === anchor.key) continue;
    if (!relatedCats.includes(g.category)) continue;
    if (g.bestPrice > priceCeiling) continue;
    if (ACCESSORY_RE.test(g.title) && !ACCESSORY_RE.test(anchor.title)) continue;
    if (g.key.startsWith("fallback|") && !g.brand) continue;
    const cur = byGroup.get(g.key);
    if (!cur || h.score > cur.bestAnn) byGroup.set(g.key, { group: g, bestAnn: h.score });
  }

  const dupes: DupeResult[] = [];
  for (const { group, bestAnn } of Array.from(byGroup.values())) {
    // Blend vector similarity (0–1) with the structural dupe-similarity
    // (0–100). Vector dominates because it's more semantically aware;
    // structural anchors recall on edge cases.
    const structural = dupeSimilarity(anchor, anchorSig, anchorType, group);
    const blended = Math.round(bestAnn * 60 + structural * 0.4);
    if (blended < 25) continue;

    const savingsVsAnchor = anchor.bestPrice - group.bestPrice;
    const savingsPercent = anchor.bestPrice > 0 ? Math.round((savingsVsAnchor / anchor.bestPrice) * 100) : 0;

    dupes.push({
      ...group,
      similarityScore: blended,
      savingsVsAnchor: Math.max(0, savingsVsAnchor),
      savingsPercent: Math.max(0, savingsPercent),
    });
  }

  dupes.sort((a, b) => {
    const aS = a.similarityScore * 0.55 + Math.min(a.savingsPercent, 80) * 0.45;
    const bS = b.similarityScore * 0.55 + Math.min(b.savingsPercent, 80) * 0.45;
    if (Math.abs(bS - aS) > 2) return bS - aS;
    return b.storeCount - a.storeCount;
  });

  return dupes;
}

/* ── Public: vectorFindSimilarByUrl ────────────────────────────────── */

export async function vectorFindSimilarByUrl(rawUrl: string): Promise<SearchOutput> {
  const parsed = parseStoreUrl(rawUrl);
  if (!parsed || !parsed.searchTerms) return { mode: "empty", query: rawUrl, suggestions: [] };

  // Try exact URL match first — same as heuristic engine.
  const groups = getProductGroups();
  let exact: ProductGroup | null = null;
  const normIn = parsed.originalUrl.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  for (const g of groups) {
    for (const o of g.offers) {
      const normOff = o.url.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
      if (normOff === normIn) { exact = g; break; }
    }
    if (exact) break;
  }

  if (exact) {
    // Re-route into vectorFindSimilar using the exact title (won't re-embed
    // anchor — same query string returns same cached embedding).
    const result = await vectorFindSimilar(exact.title);
    // Override anchor to the URL-matched one (in case findSimilar picked a
    // slightly different group on the title-fuzzy path).
    if (result.mode === "similar") return { ...result, query: rawUrl, anchor: exact };
    return result;
  }

  // No exact URL match — search by extracted terms.
  return await vectorFindSimilar(parsed.searchTerms);
}
