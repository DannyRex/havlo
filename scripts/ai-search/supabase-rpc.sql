-- Phase 2.5 — ANN search RPCs
--
-- Apply once after Phase 2.4 image embeddings have completed:
--   psql or paste into Supabase SQL Editor.
--
-- These functions are what `src/lib/search/vector.ts` calls. They keep the
-- pgvector-specific operators (`<=>`) on the database side so the TS code
-- stays clean and PostgREST-friendly.
--
-- Idempotent — safe to re-run.

-- ── Text-only ANN ──────────────────────────────────────────────────────────
-- Returns top-K deals ranked by cosine similarity to a query text embedding.
-- Optional filters narrow before ANN (cheap when filters are sparse).
CREATE OR REPLACE FUNCTION match_deals_by_text(
  query_embedding     vector(1536),
  match_count         int     DEFAULT 50,
  filter_brand        text    DEFAULT NULL,
  filter_product_type text    DEFAULT NULL,
  filter_is_accessory boolean DEFAULT NULL,
  exclude_id          text    DEFAULT NULL
)
RETURNS TABLE (
  id           text,
  title        text,
  brand        text,
  product_type text,
  is_accessory boolean,
  price_ngn    bigint,
  category     text,
  score        float
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.title,
    d.brand,
    d.product_type,
    d.is_accessory,
    d.price_ngn,
    d.category,
    (1 - (d.text_emb <=> query_embedding))::float AS score
  FROM deals_index d
  WHERE d.text_emb IS NOT NULL
    AND (filter_brand        IS NULL OR d.brand        = filter_brand)
    AND (filter_product_type IS NULL OR d.product_type = filter_product_type)
    AND (filter_is_accessory IS NULL OR d.is_accessory = filter_is_accessory)
    AND (exclude_id          IS NULL OR d.id          <> exclude_id)
  ORDER BY d.text_emb <=> query_embedding
  LIMIT match_count;
$$;

-- ── Image-only ANN ─────────────────────────────────────────────────────────
-- Used when we have an anchor product's image vector and want visually
-- similar items (the "Dupe.com" core).
CREATE OR REPLACE FUNCTION match_deals_by_image(
  query_embedding     vector(1024),
  match_count         int     DEFAULT 50,
  filter_product_type text    DEFAULT NULL,
  filter_is_accessory boolean DEFAULT NULL,
  exclude_id          text    DEFAULT NULL
)
RETURNS TABLE (
  id           text,
  title        text,
  brand        text,
  product_type text,
  price_ngn    bigint,
  category     text,
  score        float
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.title,
    d.brand,
    d.product_type,
    d.price_ngn,
    d.category,
    (1 - (d.image_emb <=> query_embedding))::float AS score
  FROM deals_index d
  WHERE d.image_emb IS NOT NULL
    AND (filter_product_type IS NULL OR d.product_type = filter_product_type)
    AND (filter_is_accessory IS NULL OR d.is_accessory = filter_is_accessory)
    AND (exclude_id          IS NULL OR d.id          <> exclude_id)
  ORDER BY d.image_emb <=> query_embedding
  LIMIT match_count;
$$;

-- ── Hybrid (text 0.6 + image 0.4) ──────────────────────────────────────────
-- "Find similar" mode: blend text + image similarity to an anchor.
-- Both vectors required.
CREATE OR REPLACE FUNCTION match_deals_hybrid(
  query_text_emb      vector(1536),
  query_image_emb     vector(1024),
  match_count         int     DEFAULT 50,
  text_weight         float   DEFAULT 0.6,
  image_weight        float   DEFAULT 0.4,
  exclude_id          text    DEFAULT NULL
)
RETURNS TABLE (
  id           text,
  title        text,
  brand        text,
  product_type text,
  is_accessory boolean,
  price_ngn    bigint,
  category     text,
  score        float
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.title,
    d.brand,
    d.product_type,
    d.is_accessory,
    d.price_ngn,
    d.category,
    (
      text_weight  * (1 - (d.text_emb  <=> query_text_emb)) +
      image_weight * (1 - (d.image_emb <=> query_image_emb))
    )::float AS score
  FROM deals_index d
  WHERE d.text_emb IS NOT NULL
    AND d.image_emb IS NOT NULL
    AND (exclude_id IS NULL OR d.id <> exclude_id)
  ORDER BY (
      text_weight  * (d.text_emb  <=> query_text_emb) +
      image_weight * (d.image_emb <=> query_image_emb)
    )
  LIMIT match_count;
$$;

-- ── Fetch anchor vectors ───────────────────────────────────────────────────
-- One-shot getter for "find similar" so we don't pay two round-trips.
CREATE OR REPLACE FUNCTION get_deal_vectors(deal_id text)
RETURNS TABLE (
  id        text,
  text_emb  vector(1536),
  image_emb vector(1024)
)
LANGUAGE sql STABLE AS $$
  SELECT id, text_emb, image_emb FROM deals_index WHERE id = deal_id LIMIT 1;
$$;
