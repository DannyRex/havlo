-- Phase 5b — Live product corpus schema.
--
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Idempotent: safe to re-run.
--
-- Replaces the static src/lib/data/deals.ts as the source of truth once
-- the ingestion cron has populated it. Until then, BrowseProvider falls
-- back to the static file automatically (see src/lib/providers/index.ts).

-- ─── stores: master list of retailers ────────────────────────────────────
create table if not exists stores (
  id                text primary key,                -- 'jumia', 'konga', 'amazon-com'
  name              text not null,
  country           text,                            -- 'NG', 'US', 'CN', etc.
  url               text,
  logo_url          text,
  is_international  boolean default false,
  trusted           boolean default true,
  created_at        timestamptz default now()
);

-- ─── products: canonical product (deduped across stores) ─────────────────
create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  category        text,
  category_slug   text,
  brand           text,
  model           text,
  image_url       text,
  signature       text,                              -- normalized for dedupe
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists products_category_slug_idx on products(category_slug);
create index if not exists products_signature_idx     on products(signature);

-- ─── offers: per-store price for a product (one product → many offers) ──
create table if not exists offers (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id) on delete cascade,
  store_id          text not null references stores(id),
  url               text not null,
  current_price     numeric(12,2) not null,
  original_price    numeric(12,2),
  discount_percent  integer,
  currency          text not null check (currency in ('NGN','USD')),
  in_stock          boolean default true,
  source_provider   text,                            -- 'serpapi-shopping', 'amazon-paapi', etc.
  source_query      text,                            -- the search query that surfaced it
  scraped_at        timestamptz default now(),
  expires_at        timestamptz,                     -- optional TTL
  unique (store_id, url)                             -- dedupe by store + url
);

create index if not exists offers_product_id_idx     on offers(product_id);
create index if not exists offers_current_price_idx  on offers(current_price);
create index if not exists offers_scraped_at_idx     on offers(scraped_at desc);
create index if not exists offers_discount_idx       on offers(discount_percent desc);

-- ─── ingestion_runs: telemetry for cron jobs ─────────────────────────────
create table if not exists ingestion_runs (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,
  query           text,                              -- e.g. category name or "all"
  started_at      timestamptz default now(),
  finished_at     timestamptz,
  status          text default 'running'             -- 'running','success','partial','error'
                  check (status in ('running','success','partial','error')),
  items_fetched   integer default 0,
  items_upserted  integer default 0,
  errors          text[]
);

create index if not exists ingestion_runs_started_idx on ingestion_runs(started_at desc);

-- ─── helper view: best offer per product (cheapest in-stock) ─────────────
create or replace view product_best_offers as
select
  p.id                   as product_id,
  p.title,
  p.category_slug,
  p.brand,
  p.image_url,
  o.id                   as offer_id,
  o.store_id,
  o.url,
  o.current_price,
  o.original_price,
  o.discount_percent,
  o.currency,
  o.scraped_at,
  s.name                 as store_name,
  s.is_international,
  s.logo_url             as store_logo_url
from products p
join lateral (
  select * from offers
  where product_id = p.id and in_stock = true
  order by current_price asc
  limit 1
) o on true
join stores s on s.id = o.store_id;
