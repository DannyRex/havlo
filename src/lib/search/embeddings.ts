/* ─────────────────────────────────────────────────────────────────
   Semantic title embeddings via OpenAI text-embedding-3-small.

   This module owns the embedding compute path. Two surfaces use it:

     1. Ingestion (src/lib/providers/ingestion.ts) — compute the
        embedding for each new product title at write time, in
        batches of 100 to amortize the OpenAI round-trip.

     2. Query path (src/lib/search/query-understanding.ts via
        find_similar_products RPC) — embed the user's query OR the
        anchor product's title at query time, look up similar
        products by cosine, use as a fast-path admit in
        isLikelySameProduct when similarity >= 0.85.

   Model choice (text-embedding-3-small, 1536 dims):
     - $0.02 / 1M input tokens → ~$0.007 for full 12k-product backfill
     - Outperforms ada-002 on STS benchmarks
     - 1536 dims × 4 bytes = 6KB/row → 72MB total at our scale
     - Native OpenAI client, no extra deps beyond the already-
       installed openai package

   Threshold (PHASE3_SIMILARITY_THRESHOLD = 0.85):
     Empirically tuned. Below 0.85 we get false positives like
     "different sizes of the same brand's perfume". At 0.88+ we
     miss legitimate "AirPods 4" vs "Apple AirPods 4th gen with
     USB-C" matches. 0.85 is the sweet spot.

   Batching:
     OpenAI accepts up to 2048 inputs per /embeddings call. We
     send 100 per batch — small enough to retry cheaply on
     transient 429s, large enough to amortize TLS handshake.
   ───────────────────────────────────────────────────────────────── */

import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const DIMS  = 1536;

/* Cosine threshold above which two product titles are "likely the
   same product" in isLikelySameProduct's lazy lexical-gate-fallback.
   Lower in the codebase (query-understanding.ts) imports this. */
export const PHASE3_SIMILARITY_THRESHOLD = 0.85;

/* Memoised client. Lazy-init means modules that import this file
   for the constant THRESHOLD don't pay the OpenAI client-construct
   cost just for the constant. */
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for embedding computation.");
  _client = new OpenAI({ apiKey: key });
  return _client;
}

/* Sanitize input. OpenAI's tokenizer chokes on extremely long
   strings (technically the limit is 8191 tokens, ~32KB for
   text-embedding-3-small, but product titles are <300 chars so this
   is defensive). Empty/whitespace input would consume a token slot
   for nothing — skip. */
function sanitize(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length > 8000) return t.slice(0, 8000);
  return t;
}

/** Embed a single title. Returns null on failure. Prefer
    embedTitles() for batches — it's ~50x cheaper at scale. */
export async function embedTitle(title: string): Promise<number[] | null> {
  const clean = sanitize(title);
  if (!clean) return null;
  try {
    const res = await getClient().embeddings.create({ model: MODEL, input: clean });
    return res.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/** Embed up to 100 titles at once. Returns an array parallel to
    `titles` (index N → embedding for titles[N]). Failed inputs
    (empty / whitespace / API error for that batch) come back as null
    in their slot. */
export async function embedTitles(titles: string[]): Promise<Array<number[] | null>> {
  if (titles.length === 0) return [];

  /* Build sanitized list + remember which original indices were
     skipped (empty/whitespace) so the result array stays aligned. */
  const sanitised: string[] = [];
  const idxMap:    number[] = [];   // sanitised[i] = sanitize(titles[idxMap[i]])
  for (let i = 0; i < titles.length; i++) {
    const s = sanitize(titles[i]);
    if (s !== null) { sanitised.push(s); idxMap.push(i); }
  }
  if (sanitised.length === 0) return titles.map(() => null);

  let response: Array<{ embedding: number[] }>;
  try {
    const res = await getClient().embeddings.create({ model: MODEL, input: sanitised });
    response = res.data;
  } catch {
    /* Whole-batch failure (timeout, 429, bad payload). Caller can
       retry with a smaller batch; we return all-null for now. */
    return titles.map(() => null);
  }

  /* Fan results back into a parallel array aligned to titles. */
  const out: Array<number[] | null> = titles.map(() => null);
  for (let i = 0; i < response.length; i++) {
    out[idxMap[i]] = response[i].embedding;
  }
  return out;
}

/** Format a JS number array as PostgreSQL vector(N) literal:
      [0.1, 0.2, 0.3] → "[0.1,0.2,0.3]"
    Supabase JS client + pgvector accepts this string format for
    vector column inserts and updates. Float precision: 6 decimals
    is enough for embeddings (the underlying float32 has ~7
    significant digits) and keeps payload size manageable. */
export function vectorToPg(vec: number[]): string {
  return `[${vec.map((x) => x.toFixed(6)).join(",")}]`;
}

/** Sanity check — useful in tests / probes. */
export const EMBEDDING_DIMS = DIMS;
