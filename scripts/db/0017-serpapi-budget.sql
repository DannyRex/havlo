-- ──────────────────────────────────────────────────────────────────
-- SerpAPI monthly usage tracker.
--
-- Backs the soft monthly budget cap in /api/live-search.
--   - Each successful SerpAPI call increments `calls` for the
--     current month-key ('YYYY-MM').
--   - When `calls >= cap * 0.8`, /api/live-search returns DB-only
--     results without calling SerpAPI for the rest of the month.
--   - `cap` is per-row so we can adjust the limit mid-month if we
--     upgrade the SerpAPI plan or want to spike-allow a category
--     ingest without changing code.
--
-- Idempotency:
--   The table is upserted on month_key. Re-running the migration
--   is safe; existing rows survive.
--
-- Atomicity note:
--   The /api/live-search increment is a read-then-write (not
--   atomic). Under high parallel load a few increments may be lost
--   — acceptable for a SOFT 80% cap (the 20% headroom absorbs any
--   slop). If/when we want strict atomicity, replace the upsert
--   in src/lib/serpapi-budget.ts with the increment_serpapi_calls
--   RPC defined below, which uses UPDATE … SET calls = calls + n
--   in a single statement.
-- ──────────────────────────────────────────────────────────────────

create table if not exists serpapi_usage (
  month_key  text     primary key,    -- 'YYYY-MM'
  calls      integer  not null default 0,
  cap        integer  not null default 5000,
  updated_at timestamptz not null default now()
);

create index if not exists serpapi_usage_updated_at_idx on serpapi_usage(updated_at desc);

-- ── Atomic increment RPC (optional, currently unused) ────────────
create or replace function increment_serpapi_calls(p_month_key text, p_n integer default 1)
returns integer
language plpgsql
as $$
declare
  v_calls integer;
begin
  insert into serpapi_usage (month_key, calls)
  values (p_month_key, p_n)
  on conflict (month_key)
  do update set calls = serpapi_usage.calls + p_n, updated_at = now()
  returning calls into v_calls;
  return v_calls;
end;
$$;

-- Sanity check after applying:
-- select * from serpapi_usage order by month_key desc limit 3;
