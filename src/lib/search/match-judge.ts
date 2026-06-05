/* ─────────────────────────────────────────────────────────────────
   Phase 4 — LLM-as-judge for ambiguous product-match decisions.

   When isLikelySameProduct's lexical gates produce a CONFIDENCE
   SCORE in the ambiguous band (0.55 - 0.85), this module's
   `judgeMatch(anchor, candidate)` is consulted.

   Flow:
     1. Build canonical pair key (sorted by id) so both directions
        hit the same cache row.
     2. Look up match_decisions table — if hit, return cached
        decision (paid-once cost).
     3. If miss, call gpt-4o-mini with anchor + candidate titles
        + prices + brands. Strict JSON-mode output.
     4. Write the decision to match_decisions for future hits.

   The judge's "variant" verdict is preserved separately from "same"
   — same product family but different SKU (color/size/storage). The
   caller (isLikelySameProduct) decides whether to admit variants
   as same-product based on the use case. The default is conservative:
   admit "same" only.

   Cost model:
     - gpt-4o-mini at ~200 input tokens + ~30 output tokens per call
     - ~$0.001 per first-time-seen pair
     - Cached forever, only paid once per pair
     - After warm-cache: ~$15/month at our query volume
   ───────────────────────────────────────────────────────────────── */

import OpenAI from "openai";

const JUDGE_MODEL = "gpt-4o-mini-2024-07-18";

/* Confidence band where we consult the judge. Below 0.55 the gates
   already say "not the same" with reasonable certainty; above 0.85
   they already say "yes". The middle is where lexical heuristics
   have run out of signal. */
export const JUDGE_BAND_MIN = 0.55;
export const JUDGE_BAND_MAX = 0.85;

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for match judging.");
  _client = new OpenAI({ apiKey: key });
  return _client;
}

export type MatchDecision = "same" | "variant" | "different";

export interface JudgeInput {
  id:       string;
  title:    string;
  brand?:   string | null;
  priceNgn?: number | null;
  storeId?: string | null;
  /** Denoised SerpAPI snippet + attributes (migration 0077). Surfaced to the
      judge as a `details:` line so it can tell apart fashion/beauty items whose
      titles are near-identical but whose colour/material/audience differ. */
  attributes?: string | null;
}

export interface JudgeResult {
  decision:   MatchDecision;
  confidence: number;   // 0-1, model self-reported
  cached:     boolean;  // was this returned from the DB cache (true) or freshly judged (false)
  model:      string;
}

interface SupabaseLike {
  rpc:  (fn: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (tbl: string) => {
    select: (cols: string) => {
      eq: (col: string, v: unknown) => {
        eq: (col: string, v: unknown) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
}

/* Canonical pair ordering — smaller UUID first by lexicographic
   comparison. Mirrors the CHECK constraint in match_decisions so
   the table only stores one row per pair. */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Look up a pre-judged decision in match_decisions. Returns null on
    cache miss. Cheap — one SELECT against the composite PK. */
export async function lookupCachedDecision(
  supa:       SupabaseLike,
  anchorId:   string,
  candidateId: string,
): Promise<JudgeResult | null> {
  const [a, c] = canonicalPair(anchorId, candidateId);
  const { data, error } = await supa
    .from("match_decisions")
    .select("decision, confidence, model")
    .eq("anchor_id", a)
    .eq("candidate_id", c)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { decision: MatchDecision; confidence: number; model: string };
  return { decision: row.decision, confidence: row.confidence, cached: true, model: row.model };
}

/** Build the judge prompt. Kept short — the model only needs the
    titles + minimal context to decide. Including brand/price is
    cheap and helps disambiguate cases like "iPhone 15 Pro 256GB"
    vs "iPhone 15 Pro 512GB" (variant) or "Nike Air Max 95" at
    very different prices (probably different items / refurb / fake). */
function buildPrompt(anchor: JudgeInput, candidate: JudgeInput): string {
  const fmt = (p: JudgeInput): string => {
    const parts = [`title: ${p.title}`];
    if (p.brand) parts.push(`brand: ${p.brand}`);
    if (p.attributes) parts.push(`details: ${p.attributes.slice(0, 200)}`);
    if (p.priceNgn != null) parts.push(`price_ngn: ${p.priceNgn}`);
    if (p.storeId) parts.push(`store: ${p.storeId}`);
    return parts.join(" | ");
  };
  return [
    "Decide if these two product listings describe the SAME product.",
    "Return JSON exactly: {\"decision\": \"same\" | \"variant\" | \"different\", \"confidence\": 0.0-1.0}",
    "Definitions:",
    "  same     = same product, same SKU. Different stores selling the identical item.",
    "  variant  = same product line, different SKU (color, storage, size, pack count, refurbished vs new).",
    "  different = clearly different products (different generation, different model, different bundle, etc.).",
    "",
    `A: ${fmt(anchor)}`,
    `B: ${fmt(candidate)}`,
  ].join("\n");
}

/** Judge a pair via gpt-4o-mini. Always writes the verdict to the
    cache (or returns the existing one if a race wrote it first).
    Never throws — failure returns the "different" fallback so the
    caller's match decision is conservative.

    Cost: ~200 input tokens + ~30 output tokens per call. */
export async function judgeFresh(
  supa:      SupabaseLike,
  anchor:    JudgeInput,
  candidate: JudgeInput,
): Promise<JudgeResult> {
  let parsed: { decision: MatchDecision; confidence: number } | null = null;

  try {
    const completion = await getClient().chat.completions.create({
      model:       JUDGE_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,   /* Deterministic — same pair → same verdict */
      max_tokens:  100,
      messages: [
        { role: "system", content: "You are a product-matching judge. Reply only with a JSON object." },
        { role: "user",   content: buildPrompt(anchor, candidate) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const obj = JSON.parse(raw) as { decision?: string; confidence?: number };
    if (
      (obj.decision === "same" || obj.decision === "variant" || obj.decision === "different") &&
      typeof obj.confidence === "number" &&
      obj.confidence >= 0 && obj.confidence <= 1
    ) {
      parsed = { decision: obj.decision, confidence: obj.confidence };
    }
  } catch {
    /* swallow — fall through to conservative fallback below */
  }

  if (!parsed) {
    /* Conservative fallback on any API/parse failure: assume different
       so we don't incorrectly merge two products under failed judgment. */
    return { decision: "different", confidence: 0.5, cached: false, model: JUDGE_MODEL };
  }

  /* Write to cache. Best-effort; if the upsert fails for any reason
     (concurrent write, transient DB blip) we still return the fresh
     verdict to the caller. */
  try {
    await supa.rpc("upsert_match_decision", {
      p_a:          anchor.id,
      p_b:          candidate.id,
      p_decision:   parsed.decision,
      p_confidence: parsed.confidence,
      p_model:      JUDGE_MODEL,
    });
  } catch { /* ignore cache-write failures */ }

  return { ...parsed, cached: false, model: JUDGE_MODEL };
}

/** Cache-first judge. Use this as the public entry point — checks
    the cache, calls the LLM only on miss, writes-through. */
export async function judgeMatch(
  supa:      SupabaseLike,
  anchor:    JudgeInput,
  candidate: JudgeInput,
): Promise<JudgeResult> {
  const cached = await lookupCachedDecision(supa, anchor.id, candidate.id);
  if (cached) return cached;
  return judgeFresh(supa, anchor, candidate);
}
