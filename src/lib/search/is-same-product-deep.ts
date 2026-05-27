/* ─────────────────────────────────────────────────────────────────
   Deep (async) variant of isLikelySameProduct that consults the
   semantic embedding + LLM judge fast-paths.

   When to use this vs sync isLikelySameProduct:
     - SYNC (isLikelySameProduct): variant pooling at ingest time,
       cheap lexical-only filter in tight loops, anywhere that can't
       block on network IO.
     - DEEP (this module): server-side comparison endpoints, /compare
       page, anywhere the marginal ~50-200ms is acceptable in
       exchange for higher recall + fewer false positives.

   Decision flow:
     1. Run sync isLikelySameProduct first. If true (identifier match,
        image-phash match, or all 8 lexical gates pass) → return true
        with no IO cost.
     2. Run sync lexical-only score (count of passing gates / 8). If
        score < 0.3 → return false. The pair is unambiguously different.
     3. Otherwise we're in the AMBIGUOUS zone. Check the semantic
        embedding similarity. If both products have embeddings AND
        cosine >= PHASE3_SIMILARITY_THRESHOLD (0.85) → return true.
     4. Otherwise consult the LLM judge (cache-first). Return true
        only if decision === 'same'. (Variants are intentionally
        excluded by default — caller can opt in to admitting variants
        via the `acceptVariants` flag.)

   Concurrency:
     Multiple parallel calls to judgeMatch on the same pair race
     harmlessly — the upsert function has ON CONFLICT DO NOTHING so
     both calls succeed, both see the same row. Worst case: a few
     redundant LLM calls during a cold-cache burst.
   ───────────────────────────────────────────────────────────────── */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isLikelySameProduct } from "./query-understanding";
import { judgeMatch, JUDGE_BAND_MIN, JUDGE_BAND_MAX } from "./match-judge";

export interface DeepMatchProduct {
  id:                string;
  title:             string;
  brand?:            string | null;
  priceNgn?:         number;
  family?:           string | null;
  gtin?:             string | null;
  mpn?:              string | null;
  googleShoppingId?: string | null;
  imagePhash?:       bigint | null;
  /* Cosine similarity to the anchor. Caller is expected to have
     already fetched this via find_similar_products RPC and attached
     it to the candidate. NULL when neither side had an embedding. */
  similarityToAnchor?: number | null;
  storeId?:          string | null;
}

export interface DeepMatchOptions {
  /** Admit 'variant' decisions (color/size/storage of same product)
      as same-product. Default false — conservative path keeps SKU-
      level distinction. /compare's price-spectrum may want true so
      Pro 256GB and Pro 512GB collapse for the spectrum overview. */
  acceptVariants?: boolean;
  /** Skip the LLM judge consultation, return based on lexical gates
      and embedding only. Useful when the caller wants to avoid all
      external API calls (cold-cache misses cost ~$0.001 each). */
  skipJudge?: boolean;
}

/** Cosine similarity above which we accept candidates without
    consulting the LLM. Mirrors PHASE3_SIMILARITY_THRESHOLD in
    embeddings.ts; redefined here to keep this module's import
    surface narrow (lazy require of embeddings only on first use). */
const SIMILARITY_AUTO_ACCEPT = 0.85;

/** Below this score the lexical gates have already said "different"
    with reasonable certainty — skip both embedding and judge. */
const LEXICAL_ABORT_SCORE = 0.30;

/** Cheap pass-equivalent score from the 8 lexical gates.
    isLikelySameProduct returns boolean; we want a graded score for
    routing decisions. The cheap approximation: if sync returns true,
    score = 1.0; if false, run a permissive variant that re-evaluates
    each gate in isolation and returns the fraction that pass.

    For now we approximate with a simpler heuristic: lexical gates
    rarely return false from a SINGLE gate; they cascade. So a false
    return means at least one strong-signal gate (brand mismatch /
    type mismatch / variant token mismatch) rejected. That maps to a
    LOW score. We use 0.20 as the floor and 0.85 as the bar for
    "ambiguous enough to consult the judge".

    A future refactor can expose a proper gates_passed counter from
    isLikelySameProduct without breaking its boolean API. */
function approximateScore(
  anchor: DeepMatchProduct,
  candidate: DeepMatchProduct,
): number {
  if (isLikelySameProduct(anchor, candidate)) return 1.0;
  /* Sync said no. Map to a score based on the cheap signals that
     might still be true:
       - brand match → +0.3
       - similar price band (±50%) → +0.2
       - cosine similarity present and >= 0.7 → +0.2 (will be
         re-evaluated below at the 0.85 threshold anyway, but this
         routes ambiguous-but-low-confidence pairs to the judge) */
  let s = 0.0;
  const a = anchor.brand?.toLowerCase().trim();
  const c = candidate.brand?.toLowerCase().trim();
  if (a && c && a === c) s += 0.3;
  if (anchor.priceNgn && candidate.priceNgn) {
    const ratio = Math.min(anchor.priceNgn, candidate.priceNgn) /
                  Math.max(anchor.priceNgn, candidate.priceNgn);
    if (ratio >= 0.5) s += 0.2;
  }
  if (candidate.similarityToAnchor != null && candidate.similarityToAnchor >= 0.7) s += 0.2;
  return s;
}

export async function isLikelySameProductDeep(
  supa:      SupabaseClient,
  anchor:    DeepMatchProduct,
  candidate: DeepMatchProduct,
  options:   DeepMatchOptions = {},
): Promise<boolean> {
  /* Stage 1 — sync lexical + identifier + phash fast-paths. */
  if (isLikelySameProduct(anchor, candidate)) return true;

  /* Stage 2 — abort cheaply when the lexical gates are clearly no. */
  const score = approximateScore(anchor, candidate);
  if (score < LEXICAL_ABORT_SCORE) return false;

  /* Stage 3 — semantic embedding admission. The caller is expected
     to have pre-fetched candidate.similarityToAnchor via the
     find_similar_products RPC (so we don't pay the embedding cost
     of the anchor more than once per query). When present AND
     >= SIMILARITY_AUTO_ACCEPT (0.85), admit without LLM call. */
  if (candidate.similarityToAnchor != null && candidate.similarityToAnchor >= SIMILARITY_AUTO_ACCEPT) {
    return true;
  }

  /* Stage 4 — LLM judge consultation. Cache-first; cold-cache pairs
     cost ~$0.001 each. Skip when caller opted out. */
  if (options.skipJudge) return false;
  if (score < JUDGE_BAND_MIN || score > JUDGE_BAND_MAX) return false;

  const verdict = await judgeMatch(
    supa as unknown as Parameters<typeof judgeMatch>[0],
    {
      id:        anchor.id,
      title:     anchor.title,
      brand:     anchor.brand ?? undefined,
      priceNgn:  anchor.priceNgn,
      storeId:   anchor.storeId ?? undefined,
    },
    {
      id:        candidate.id,
      title:     candidate.title,
      brand:     candidate.brand ?? undefined,
      priceNgn:  candidate.priceNgn,
      storeId:   candidate.storeId ?? undefined,
    },
  );

  if (verdict.decision === "same") return true;
  if (verdict.decision === "variant" && options.acceptVariants) return true;
  return false;
}
