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

-- Plain-column unique index (NOT functional). Supabase's PostgREST
-- `onConflict: "email,query"` parameter resolves to PostgreSQL's
-- ON CONFLICT (email, query), which only matches a unique index on
-- those literal columns. A functional index like (lower(email),
-- lower(query)) is treated as a different index and the upsert fails
-- with 'no unique constraint matching the ON CONFLICT specification'.
-- Casing is normalised in the API layer (both email and query are
-- lowercased before insert) so the plain index gives correct dedup.
create unique index if not exists product_requests_email_query_idx
  on product_requests (email, query);

-- Lookup index for the catalog-demand leaderboard query (group by
-- lower(query) to count requests per term).
create index if not exists product_requests_query_idx
  on product_requests (query);

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
