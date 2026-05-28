-- ──────────────────────────────────────────────────────────────────
-- merchant_inquiries — applications from retailers / brands wanting
-- to be listed on Havlo. Submitted via the form on /for-merchants.
--
-- Each row is two things at once:
--   1. A partnership pipeline item — feeds the hello@havlo.io
--      backlog so the team can prioritise.
--   2. A demand signal — which categories / countries / SKU-volumes
--      are knocking on the door. Useful for ingestion roadmap
--      prioritisation.
--
-- Dedup on (email, store_url) — same merchant re-submitting is a
-- benign no-op rather than spam.
--
-- IDEMPOTENT — create-if-not-exists across the board.
-- ──────────────────────────────────────────────────────────────────

create table if not exists merchant_inquiries (
  id           uuid        primary key default gen_random_uuid(),
  store_name   text        not null,
  contact_name text,
  email        text        not null,
  store_url    text        not null,
  feed_url     text,
  /* Comma-separated list, lowercased in the API layer. Stored as
     text rather than parsed into an array — keeps the schema lean
     and the API layer can split on read. */
  countries    text,
  sku_count    text,
  notes        text,
  user_agent   text,
  /* Pipeline state — set by ops as inquiries move through review.
     v1 values: 'new', 'reviewing', 'approved', 'rejected', 'live'. */
  status       text        not null default 'new',
  created_at   timestamptz not null default now()
);

create unique index if not exists merchant_inquiries_email_store_idx
  on merchant_inquiries (email, store_url);

create index if not exists merchant_inquiries_status_idx
  on merchant_inquiries (status, created_at desc);

-- RLS: service-role only. Same posture as product_requests +
-- price_alerts — emails are PII, no anon/authenticated access.
alter table merchant_inquiries enable row level security;
