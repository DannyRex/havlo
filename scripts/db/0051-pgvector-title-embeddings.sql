/* ─────────────────────────────────────────────────────────────────
   0051 — pgvector + title embeddings (Phase 3 product-match upgrade)
   ─────────────────────────────────────────────────────────────────

   Wires semantic text matching into the product comparison pipeline.

   Why embeddings:
     Lexical title matching (the 8 gates in isLikelySameProduct) misses
     cases where two stores describe the same product with different
     wording — "AirPods 4" vs "Apple AirPods (4th gen with USB-C",
     "Sony WH-1000XM5" vs "Sony Noise-Cancelling Headphones XM5", etc.
     Cosine similarity on dense text embeddings catches these because
     the model has learned that "AirPods 4" and "AirPods 4th gen" map
     to nearby points in vector space.

   Why pgvector:
     Storage + index colocated with the products table = no separate
     vector DB. Supabase ships pgvector as a one-click extension. The
     HNSW index gives sub-millisecond cosine-similarity lookup at our
     scale (~12k vectors today; HNSW scales fine to millions).

   Why text-embedding-3-small (1536 dims):
     - Free first-class OpenAI model — already have OPENAI_API_KEY
     - Cheap: $0.02 per 1M tokens. 12k products × ~30 tokens each =
       ~360k tokens = $0.007 total to backfill the entire catalog.
     - Quality: outperforms ada-002 (the previous standard) and is
       within ~2% of text-embedding-3-large on STS benchmarks at
       1/3 the dimensions.
     - 1536 dims × 4 bytes = 6KB per row. For 12k products → 72MB.
       Negligible vs the rest of the catalog.

   Threshold: cosine similarity >= 0.85 in isLikelySameProduct's
   lexical-gate-fallback path. Empirically tuned to admit "same
   product, different phrasing" while rejecting "same brand,
   different product".

   Apply order: this migration creates the extension + column +
   index. The backfill script (scripts/backfill-title-embeddings.ts)
   populates the column. */

/* Enable the pgvector extension. Supabase pre-installs it; on a
   bare Postgres you'd run `CREATE EXTENSION vector;` once first. */
CREATE EXTENSION IF NOT EXISTS vector;

/* 1536-dim vector matches text-embedding-3-small's output. */
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS title_embedding vector(1536);

/* HNSW index — Hierarchical Navigable Small World graph.
   - m = number of bi-directional links per node. 16 is the
     pgvector default; balances index build time vs query speed.
   - ef_construction = candidate list size during build. 64 is
     the pgvector default; higher = better recall, slower build.
   - vector_cosine_ops = use cosine distance as the metric (the
     standard for normalized text embeddings).

   For 12k rows: build time ~2-3s, query time <1ms per lookup.
   For 100k+ rows: still <10ms — HNSW scales logarithmically. */
CREATE INDEX IF NOT EXISTS idx_products_title_embedding_hnsw
  ON products
  USING hnsw (title_embedding vector_cosine_ops);

COMMENT ON COLUMN products.title_embedding IS
  '1536-dim semantic embedding of the product title via OpenAI text-embedding-3-small. NULL until backfilled. Used by isLikelySameProduct as a fast-path when cosine similarity >= 0.85.';

/* RPC: find products similar to a given embedding, scoped to those
   that already have an embedding. Returns (id, similarity) pairs
   ordered descending. The caller passes a threshold and an optional
   limit.

   Why RPC and not raw SQL in the app: pgvector's operators (<=>)
   require operator-class context that's awkward to express in
   Supabase's JS query builder. Wrapping in a function makes the
   query path one .rpc() call. */
CREATE OR REPLACE FUNCTION find_similar_products(
  query_embedding   vector(1536),
  similarity_min    REAL DEFAULT 0.85,
  result_limit      INT  DEFAULT 50
)
RETURNS TABLE (id UUID, similarity REAL)
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
  SELECT
    p.id,
    /* `<=>` returns cosine DISTANCE (0 = identical, 2 = opposite).
       Convert to similarity in [0,1] where 1 = identical so callers
       can use a single intuitive >= threshold. */
    (1 - (p.title_embedding <=> query_embedding))::REAL AS similarity
  FROM products p
  WHERE p.title_embedding IS NOT NULL
    AND (1 - (p.title_embedding <=> query_embedding)) >= similarity_min
  ORDER BY p.title_embedding <=> query_embedding
  LIMIT result_limit;
$$;

COMMENT ON FUNCTION find_similar_products(vector, REAL, INT) IS
  'Return products with title_embedding cosine similarity >= similarity_min to the query vector, ordered by descending similarity, limited.';
