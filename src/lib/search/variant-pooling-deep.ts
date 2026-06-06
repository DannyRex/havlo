/* ─────────────────────────────────────────────────────────────────
   Deep async variant of partitionDupesByVariantMatch.

   Same partition semantics as the sync version in variant-pooling.ts,
   but consults Phase 3 (semantic embeddings) and Phase 4 (LLM judge)
   for dupes that fall through the sync gates. Pulls all needed
   enrichment in a single bulk SELECT, then evaluates each dupe in
   JS — no per-dupe DB round trips, no per-dupe LLM calls unless the
   ambiguous-band threshold is reached.

   The hot path (sync gates pass) costs exactly ONE extra DB round
   trip vs the sync version: the bulk enrichment fetch. ~50-100ms
   on a typical /compare or PDP page. Cold-cache LLM consultations
   add ~200-500ms per ambiguous pair but those decisions cache forever
   in match_decisions.

   When to use this vs sync:
     - SYNC partitionDupesByVariantMatch — ingestion paths, edge
       runtime, anywhere that can't block on network IO
     - DEEP this module — server-side /compare, PDP rails, anywhere
       willing to spend a bit of extra latency for higher recall
   ───────────────────────────────────────────────────────────────── */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DupeResult } from "@/lib/search";
import { isLikelySameProductDeep, type DeepMatchProduct } from "./is-same-product-deep";
import {
  extractRequiredNumbers,
  extractRequiredModelTokens,
  extractVariantTokens,
  extractQueryBrand,
  candidateHasBrand,
} from "./query-understanding";
import { titlesColorConflict, distinctiveOverlap, titlesTechConflict, titlesConcentrationConflict, hasModelCode } from "./normalize";
import { isDescriptiveProduct, detectFamily } from "./families";

/* Descriptive products (detected family is NOT number-identity) pool only when
   the two titles' IDENTIFYING tokens (brand / model / material, with generic
   filler + colour + size/volume stripped) agree at least this much. Generic
   dropship listings have no identifying token -> overlap 0 -> never pool. 0.75
   keeps near-identical listings ("JW Pei Dumpling Bag" across stores) while
   splitting one-word-different products ("Ambleside" vs "Bold" lampshade,
   "Original" vs "Infinity" kitchen roll) that sat just above the old 0.7. */
const DESCRIPTIVE_OVERLAP_MIN = 0.75;
import type { PartitionResult } from "./variant-pooling";

/* Sibling detection is identical to variant-pooling.ts's sync
   version — narrow scope: same brand, same numeric+model tokens,
   differing variant sub-tier. Inlined here so we don't have to
   export the helper from the sync module. */
function looksLikeSibling(
  anchorBrand:    string,
  anchorNumbers:  string[],
  anchorModels:   string[],
  anchorVariants: string[],
  d:              DupeResult,
): boolean {
  const dBrand = (d.brand ?? "").toLowerCase().trim();
  if (!anchorBrand || !dBrand || anchorBrand !== dBrand) return false;
  const dTitleLc = d.title.toLowerCase();
  for (const n of anchorNumbers) if (!dTitleLc.includes(n)) return false;
  for (const m of anchorModels) if (!dTitleLc.includes(m)) return false;
  const dVariants = extractVariantTokens(d.title);
  const anchorSet = new Set(anchorVariants);
  const dSet      = new Set(dVariants);
  return anchorVariants.some((v) => !dSet.has(v)) ||
         dVariants.some((v) => !anchorSet.has(v));
}

/* Bulk enrichment row shape — what we pull in one round trip for
   the anchor + every dupe. Vectors come back as the PG text format
   "[0.1,0.2,...]" via the Supabase JS client; parsed lazily inside
   cosineSim() so we never allocate float arrays for products that
   the cheap gates already accepted/rejected.

   image_phash: PG bigint serialises to JS string in JSON responses
   to preserve precision (Number can't hold full 64 bits). Parsed
   to BigInt lazily for the same reason. */
interface Enrichment {
  id:                 string;
  gtin:               string | null;
  mpn:                string | null;
  google_shopping_id: string | null;
  image_phash:        string | null;
  title_embedding:    string | null;
  attributes:         string | null;
}

/** Parse pgvector text format "[0.1,0.2,...]" to a Float32Array.
    Returns null on malformed input. Cached on the Enrichment row
    via a Symbol-keyed property so repeated cosineSim calls don't
    re-parse the same string. */
const PARSED_VEC = Symbol("parsedVec");
function getVec(e: Enrichment): Float32Array | null {
  const cached = (e as unknown as Record<symbol, Float32Array | null | undefined>)[PARSED_VEC];
  if (cached !== undefined) return cached;
  let vec: Float32Array | null = null;
  if (e.title_embedding) {
    try {
      const arr = JSON.parse(e.title_embedding) as number[];
      if (Array.isArray(arr) && arr.length > 0) {
        vec = new Float32Array(arr);
      }
    } catch { /* malformed — leave null */ }
  }
  (e as unknown as Record<symbol, Float32Array | null>)[PARSED_VEC] = vec;
  return vec;
}

/** Cosine similarity between two text-embedding-3-small vectors.
    OpenAI's embeddings are L2-normalised so cosine == dot product —
    skip the norm divisions. Returns null when either side missing. */
function cosineSim(a: Enrichment | undefined, b: Enrichment | undefined): number | null {
  if (!a || !b) return null;
  const va = getVec(a);
  const vb = getVec(b);
  if (!va || !vb || va.length !== vb.length) return null;
  let dot = 0;
  for (let i = 0; i < va.length; i++) dot += va[i] * vb[i];
  return dot;
}

/** Build a DeepMatchProduct from a DupeResult + its enrichment row +
    pre-computed cosine similarity. Stays cheap; no allocations
    beyond the spread. */
function toDeepProduct(
  d: { id: string; title: string; brand: string | null; bestPrice: number; storeId?: string | null },
  enrich: Enrichment | undefined,
  similarity: number | null,
): DeepMatchProduct {
  return {
    id:                  d.id,
    title:               d.title,
    brand:               d.brand,
    priceNgn:            d.bestPrice,
    gtin:                enrich?.gtin ?? null,
    mpn:                 enrich?.mpn ?? null,
    googleShoppingId:    enrich?.google_shopping_id ?? null,
    imagePhash:          enrich?.image_phash ? BigInt(enrich.image_phash) : null,
    similarityToAnchor:  similarity,
    storeId:             d.storeId ?? null,
    attributes:          enrich?.attributes ?? null,
  };
}

export interface DeepPartitionOptions {
  /** Bound on parallel judgeMatch calls. Cap so cold-cache bursts
      don't fan out 50 concurrent OpenAI calls. */
  judgeConcurrency?: number;
}

export async function partitionDupesByVariantMatchDeep(
  supa:    SupabaseClient,
  anchor:  { id: string; title: string; brand: string | null; priceNgn: number; family?: string | null },
  dupes:   DupeResult[],
  options: DeepPartitionOptions = {},
): Promise<PartitionResult> {
  /* Empty short-circuit — nothing to enrich. */
  if (dupes.length === 0) {
    return { likelyVariants: [], siblingVariants: [], otherProducts: [] };
  }

  /* Bulk enrichment fetch — one round trip for the anchor + every
     dupe. The columns are exactly what isLikelySameProductDeep
     needs.

     DupeResult.key is the canonical product identifier — for real
     DB-backed dupes it's the products.id (UUID), but signature-
     synthesised dupes (no products row yet) carry a fingerprint
     string like "apple|iphone 15" instead. Filter to UUID-shaped
     keys before the IN lookup so the query doesn't fail trying to
     cast "apple|iphone 15" to UUID. */
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  const dupeIds = dupes.filter((d) => UUID_RE.test(d.key)).map((d) => d.key);
  const allIds = [anchor.id, ...dupeIds];
  const { data: enriched, error } = await supa
    .from("products")
    .select("id, gtin, mpn, google_shopping_id, image_phash, title_embedding, attributes")
    .in("id", allIds);
  if (error) {
    /* DB failure — fall through to the sync gates only, no Phase 3/4
       benefit but also no broken page. */
    const enrichMap = new Map<string, Enrichment>();
    return partitionFallback(anchor, dupes, enrichMap, supa, options);
  }
  const enrichMap = new Map<string, Enrichment>(
    (enriched as Enrichment[]).map((e) => [e.id, e]),
  );

  return partitionFallback(anchor, dupes, enrichMap, supa, options);
}

/* Core partition loop — shared by the happy path and the DB-failure
   fallback. Caps judge concurrency via a simple counting semaphore. */
async function partitionFallback(
  anchor:    { id: string; title: string; brand: string | null; priceNgn: number; family?: string | null },
  dupes:     DupeResult[],
  enrichMap: Map<string, Enrichment>,
  supa:      SupabaseClient,
  options:   DeepPartitionOptions,
): Promise<PartitionResult> {
  const concurrency = options.judgeConcurrency ?? 4;

  const anchorBrand = (anchor.brand ?? "").toLowerCase().trim();
  const anchorNumbers = extractRequiredNumbers(anchor.title);
  const anchorModels  = extractRequiredModelTokens(anchor.title);
  const anchorVariants = extractVariantTokens(anchor.title);
  const anchorEnrich  = enrichMap.get(anchor.id);

  /* Fashion/beauty brand gate (June 2026) — see partitionDupesByVariantMatch
     (sync) for the full rationale. A brand-less knockoff ("GG", "Amiri") with a
     near-identical apparel title was sailing into the spectrum via the
     embedding auto-accept, over-counting the PDP store count vs the brand-gated
     /compare path. Require the candidate to carry the anchor's brand before the
     (expensive) deep match can promote it to a same-product variant. Gated to
     fashion/beauty (category_slug) so electronics whose brand-name differs from
     its line-name ("Apple"/"iPhone 15") is never dropped. */
  const fam = (anchor.family ?? "").toLowerCase();
  const fashionFamily = fam === "fashion" || fam === "beauty";
  /* The distinctive-token overlap gate keys on the DETECTED family (from the
     title), NOT category_slug. category_slug is unreliable -- NG tags a lot of
     fashion (mules, dresses, perfumes) as 'electronics', which used to bypass
     the gate. isDescriptiveProduct() classifies by title: number-identity
     families (phone/tv/laptop/console/...) keep the model matcher; everything
     else (apparel, footwear, fragrance, jewellery, furniture, toys, and
     unclassified titles) gets the overlap gate regardless of its slug. */
  const descriptiveFamily = isDescriptiveProduct(anchor.title);
  /* Generic TV anchor ("LG 4K Smart TV" -- no panel type, no model code) can't
     be reliably matched to a specific model, so it must not pool every TV in the
     line. Number-identity, so the overlap gate doesn't catch it. */
  const genericTvAnchor = detectFamily(anchor.title) === "tv" && !hasModelCode(anchor.title);
  const fashionBrandGate = fashionFamily
    && !!(anchorBrand || extractQueryBrand(anchor.title));
  const anchorBrandForGate = anchorBrand || extractQueryBrand(anchor.title);

  const anchorDeep: DeepMatchProduct = {
    id:               anchor.id,
    title:            anchor.title,
    brand:            anchor.brand,
    priceNgn:         anchor.priceNgn,
    family:           anchor.family ?? null,
    gtin:             anchorEnrich?.gtin ?? null,
    mpn:              anchorEnrich?.mpn ?? null,
    googleShoppingId: anchorEnrich?.google_shopping_id ?? null,
    imagePhash:       anchorEnrich?.image_phash ? BigInt(anchorEnrich.image_phash) : null,
    attributes:       anchorEnrich?.attributes ?? null,
  };

  const likelyVariants:  DupeResult[] = [];
  const siblingVariants: DupeResult[] = [];
  const otherProducts:   DupeResult[] = [];

  /* Process in chunks of `concurrency` so we cap parallel judge calls.
     Each iteration awaits its chunk before starting the next — simple,
     bounded, deterministic ordering preserved. DupeResult uses `key`
     as its identifier — pass-through to id for the deep product
     shape. */
  for (let i = 0; i < dupes.length; i += concurrency) {
    const chunk = dupes.slice(i, i + concurrency);
    const verdicts = await Promise.all(chunk.map(async (d) => {
      const dEnrich = enrichMap.get(d.key);
      const sim = cosineSim(anchorEnrich, dEnrich);
      const candidate = toDeepProduct({ ...d, id: d.key }, dEnrich, sim);
      /* Fashion/beauty gates (skip the expensive deep match + judge entirely):
         (1) the candidate must carry the anchor's brand (brand-less knockoffs
             can't be embedding-rescued), and
         (2) a DIFFERENT canonical colour means a different SKU -- so the
             embedding/judge can never pool a white jacket with a navy one.
         Electronics is unaffected (colour variants share a product_id). */
      const isVariant = !genericTvAnchor
        && (!descriptiveFamily || distinctiveOverlap(anchor.title, d.title) >= DESCRIPTIVE_OVERLAP_MIN)
        && !titlesTechConflict(anchor.title, d.title)
        && !titlesConcentrationConflict(anchor.title, d.title)
        && (!fashionBrandGate || candidateHasBrand(d.title, anchorBrandForGate))
        && !(descriptiveFamily && titlesColorConflict(anchor.title, d.title))
        && await isLikelySameProductDeep(supa, anchorDeep, candidate);
      return { d, isVariant };
    }));
    for (const { d, isVariant } of verdicts) {
      if (isVariant) {
        likelyVariants.push(d);
      } else if (looksLikeSibling(anchorBrand, anchorNumbers, anchorModels, anchorVariants, d)) {
        siblingVariants.push(d);
      } else {
        otherProducts.push(d);
      }
    }
  }

  return { likelyVariants, siblingVariants, otherProducts };
}
