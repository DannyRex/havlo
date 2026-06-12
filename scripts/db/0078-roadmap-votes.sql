-- ──────────────────────────────────────────────────────────────────
-- 0078 — public roadmap votes (/roadmap)
--
-- One row per (feature, voter). feature_id values come from the static
-- list in src/lib/data/roadmap.ts (code-reviewed, never user input —
-- the API validates against that list before inserting). voter_hash is
-- a salted SHA-256 of ip+user-agent computed server-side; no PII is
-- stored. The unique constraint makes votes idempotent server-side;
-- the client additionally remembers votes in localStorage.
--
-- The /roadmap page degrades gracefully (zero counts, voting hidden
-- errors) until this migration is applied.
--
-- IDEMPOTENT — safe to re-run.
-- ──────────────────────────────────────────────────────────────────

create table if not exists roadmap_votes (
  id          bigserial primary key,
  feature_id  text not null,
  voter_hash  text not null,
  created_at  timestamptz not null default now(),
  unique (feature_id, voter_hash)
);

create index if not exists roadmap_votes_feature_idx
  on roadmap_votes (feature_id);

-- Service-role access only (the API route uses the admin client);
-- no anon policies on purpose.
alter table roadmap_votes enable row level security;
