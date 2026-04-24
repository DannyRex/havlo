-- Phase 2 — Supabase schema for vector search.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- See: docs/ai-search/ROADMAP.md §2.2

-- ─── Extensions ──────────────────────────────────────────────────────────
create extension if not exists vector;

-- ─── Main index table ────────────────────────────────────────────────────
-- One row per deal. Stores both the structured fields from extracted.json
-- and the vector embeddings from embed-deals.ts.
create table if not exists deals_index (
  id              text primary key,                  -- deal id from src/lib/data/deals.ts
  title           text not null,
  category        text not null,
  store_id        text not null,
  price_ngn       integer not null,
  image_url       text,

  -- Structured fields (mirror of extracted.json — denormalized for fast filtering)
  brand           text,
  model           text,
  variant         text,
  product_type    text,
  storage_gb      integer,
  ram_gb          integer,
  inches          numeric,
  color           text,
  is_accessory    boolean default false,
  search_terms    text,

  -- Vectors
  text_emb        vector(1536),                       -- OpenAI text-embedding-3-small
  image_emb       vector(1024),                       -- Cohere multimodal v3

  -- Caching helpers (don't re-embed if these are unchanged)
  text_hash       text,
  image_url_hash  text,

  -- Telemetry
  popularity_score numeric default 0,                 -- updated weekly by Phase 3 cron
  updated_at       timestamptz default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────
-- HNSW for fast ANN. m=16, ef_construction=64 are good defaults for ~10k–1M rows.
create index if not exists deals_index_text_emb_hnsw
  on deals_index using hnsw (text_emb vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists deals_index_image_emb_hnsw
  on deals_index using hnsw (image_emb vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- B-tree indexes for structured filters
create index if not exists deals_index_brand          on deals_index (brand);
create index if not exists deals_index_category       on deals_index (category);
create index if not exists deals_index_product_type   on deals_index (product_type);
create index if not exists deals_index_price          on deals_index (price_ngn);

-- ─── Click telemetry (Phase 3) ───────────────────────────────────────────
create table if not exists clicks (
  id          bigserial primary key,
  deal_id     text not null references deals_index(id) on delete cascade,
  query       text,
  position    integer,                                -- 0-indexed rank in result set
  search_mode text,                                   -- 'single' | 'list' | 'similar'
  user_hash   text,                                   -- anonymized (sha256 of ip+ua+day)
  created_at  timestamptz default now()
);
create index if not exists clicks_deal_id  on clicks (deal_id);
create index if not exists clicks_created  on clicks (created_at);
