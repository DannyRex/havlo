-- Phase 6 — PostgreSQL Full-Text Search on the products corpus.
--
-- Run after 0001-products-offers-schema.sql.
-- Idempotent: safe to re-run.
--
-- Why this exists:
--   The previous heuristic search engine relied on hardcoded BRANDS lists,
--   PRODUCT_TYPES regexes, and CATEGORY_KEYWORDS — every new brand or category
--   required a code deploy, and unknown brands (rayban, balenciaga, etc.)
--   produced garbage matches. Postgres FTS lets the data drive relevance:
--   anything in the catalog is searchable by name, no enumeration needed.
--
-- What this gives us:
--   • Stemming    ("headphones" matches "headphone")
--   • Stop words  (filters "the", "a", "of", etc. automatically)
--   • Phrase queries via websearch_to_tsquery
--   • Ranking via ts_rank
--   • Trigram similarity for typo tolerance ("rayban" ~ "ray-ban")

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── tsvector column on products ────────────────────────────────────────
-- Generated column → automatically stays in sync with title/brand/model/category
-- without triggers. setweight assigns relative importance: A (highest) → D (lowest).
ALTER TABLE products
  DROP COLUMN IF EXISTS search_doc;

ALTER TABLE products
  ADD COLUMN search_doc tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')),         'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')),         'A') ||
    setweight(to_tsvector('english', coalesce(model, '')),         'B') ||
    setweight(to_tsvector('english', coalesce(category_slug, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(category, '')),      'C')
  ) STORED;

-- ─── Indexes ────────────────────────────────────────────────────────────
-- GIN index for fast `@@ websearch_to_tsquery(...)` lookups
CREATE INDEX IF NOT EXISTS products_search_idx
  ON products USING GIN (search_doc);

-- Trigram index on lowered title — supports typo-tolerant `similarity(...)` queries
CREATE INDEX IF NOT EXISTS products_title_trgm_idx
  ON products USING GIN (lower(title) gin_trgm_ops);

-- ─── Search RPC ─────────────────────────────────────────────────────────
-- One callable that joins products → best-offer, ranked by relevance.
-- Returns Deal-shaped rows the SearchProvider maps directly.
--
-- Ranking blend:
--   • ts_rank on search_doc (FTS quality)
--   • title trigram similarity (catches typos / unknown brands)
--
-- Usage:
--   select * from search_products_fts('rayban', 24);
--   select * from search_products_fts('iphone 15 pro max', 12);
--   select * from search_products_fts('noise cancelling headphones', 10);

CREATE OR REPLACE FUNCTION search_products_fts(
  q text,
  max_results int DEFAULT 24
)
RETURNS TABLE (
  product_id        uuid,
  title             text,
  category_slug     text,
  brand             text,
  image_url         text,
  offer_id          uuid,
  store_id          text,
  store_name        text,
  store_logo_url    text,
  is_international  boolean,
  url               text,
  current_price     numeric,
  original_price    numeric,
  discount_percent  integer,
  currency          text,
  rank              real
)
LANGUAGE sql STABLE AS $$
  WITH ranked AS (
    SELECT
      p.id,
      p.title,
      p.category_slug,
      p.brand,
      p.image_url,
      ts_rank(p.search_doc, websearch_to_tsquery('english', q))
        + similarity(lower(p.title), lower(q)) * 0.5 AS rank
    FROM products p
    WHERE
      p.search_doc @@ websearch_to_tsquery('english', q)
      OR similarity(lower(p.title), lower(q)) > 0.18
    ORDER BY rank DESC
    LIMIT max_results
  )
  SELECT
    r.id              AS product_id,
    r.title,
    r.category_slug,
    r.brand,
    r.image_url,
    o.offer_id,
    o.store_id,
    o.store_name,
    o.store_logo_url,
    o.is_international,
    o.url,
    o.current_price,
    o.original_price,
    o.discount_percent,
    o.currency,
    r.rank
  FROM ranked r
  JOIN product_best_offers o ON o.product_id = r.id
  ORDER BY r.rank DESC;
$$;

-- ─── Sanity check ───────────────────────────────────────────────────────
-- After running this file, verify with:
--   SELECT title, rank FROM search_products_fts('rayban', 5);
--   SELECT title, rank FROM search_products_fts('iphone 15 pro max', 5);
