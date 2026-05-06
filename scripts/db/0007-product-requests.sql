-- ──────────────────────────────────────────────────────────────────
-- Product-request capture: when a user searches for something Havlo
-- can't find (truly empty state on /deals or /compare), we offer
-- "notify me when found" as one of the recovery options. This table
-- holds those signups.
--
-- Doubles as catalog-demand intelligence: every row is a user
-- explicitly asking for a product we don't currently surface. Sort
-- by query frequency to know what to ingest next.
--
-- Idempotency: unique on (email, query) so re-submitting the same
-- query/email combo no-ops. A user can subscribe to multiple
-- different products though (different query → different row).
-- ──────────────────────────────────────────────────────────────────

create table if not exists product_requests (
  id          uuid        primary key default gen_random_uuid(),
  query       text        not null,
  email       text        not null,
  country     text,
  source      text        not null default 'unknown',  -- 'deals' | 'compare'
  user_agent  text,
  notified_at timestamptz,                              -- set when we email them
  created_at  timestamptz not null default now()
);

create unique index if not exists product_requests_email_query_idx
  on product_requests (lower(email), lower(query));

create index if not exists product_requests_query_idx
  on product_requests (lower(query));

create index if not exists product_requests_pending_idx
  on product_requests (created_at desc)
  where notified_at is null;

-- RLS: lock down. Only service-role (server-side) reads + writes.
-- The /api/notify-product route uses service role; no direct client
-- access (PII protection — we don't want users querying each other's
-- emails).
alter table product_requests enable row level security;

-- No policies = no access for anon / authenticated roles.
-- Service-role bypasses RLS automatically.
