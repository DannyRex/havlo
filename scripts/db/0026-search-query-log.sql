-- ──────────────────────────────────────────────────────────────────
-- search_query_log — capture every search + result count.
--
-- Powers:
--   1. Popular-search suggestions on the Hero (empty-input chips).
--   2. Zero-result query reporting (catalog gaps we should fill).
--   3. Ranking training data (which queries surface which products
--      → optimise the ranking blend over time).
--
-- Schema kept deliberately lean:
--   • country  — ISO-2 of the visitor's market (so popular-by-country
--                works without extra joins).
--   • query    — the literal text the user typed. We TRIM but don't
--                lowercase here — preservation is useful for analytics;
--                the popular_searches RPC lowercases at read time.
--   • surface  — 'hero' | 'deals' | 'compare'. Different surfaces have
--                different intent (browse vs paste-link), useful when
--                tuning ranking per-surface later.
--   • mode     — 'text' | 'url' (URL paste flows through differently).
--   • result_count — 0 means "no results", >0 means we returned
--                something. Powers the zero-result report.
--   • clicked_through — set by a follow-up update if the user clicks
--                a result within the same session. Optional — most
--                inserts won't carry this. Powers CTR analysis.
--   • created_at — for time-window queries.
--
-- Cost guard: the insert is fire-and-forget from the client (no
-- await), and the table only holds the last 90 days of rows via the
-- cleanup query at the bottom. At 10k searches/day that's <1M rows
-- — index size stays trivial.
--
-- IDEMPOTENT.
-- ──────────────────────────────────────────────────────────────────

create table if not exists search_query_log (
  id              bigserial primary key,
  country         text,
  query           text not null,
  surface         text not null check (surface in ('hero', 'deals', 'compare')),
  mode            text default 'text' check (mode in ('text', 'url')),
  result_count    integer,
  clicked_through boolean default false,
  created_at      timestamptz not null default now()
);

-- For popular-searches by country (most queries hit this composite).
create index if not exists search_query_log_country_created_idx
  on search_query_log (country, created_at desc);

-- For zero-result reporting (the "what queries miss" admin pane).
create index if not exists search_query_log_zero_result_idx
  on search_query_log (created_at desc)
  where coalesce(result_count, 0) = 0;


-- ── popular_searches(country, days_back, max_results) ─────────────
-- Top N queries by frequency for a country, last N days. Returns
-- both the query and the count so the UI can show "Searched 142
-- times this week" if it wants.
--
-- Lowercases at read time so "iPhone 15" and "iphone 15" collapse
-- into one bucket. Drops queries shorter than 3 chars (mostly typos
-- in progress).

create or replace function popular_searches(
  p_country     text default null,
  p_days_back   integer default 30,
  p_max_results integer default 10
)
returns table (
  query  text,
  count  integer
)
language sql
stable
as $$
  select
    lower(trim(s.query)) as query,
    count(*)::integer    as count
  from search_query_log s
  where s.created_at > now() - (p_days_back || ' days')::interval
    and length(trim(s.query)) >= 3
    and (p_country is null or lower(s.country) = lower(p_country))
    and coalesce(s.result_count, 0) > 0   -- only queries that returned something
  group by lower(trim(s.query))
  order by count(*) desc, max(s.created_at) desc
  limit p_max_results;
$$;


-- ── Retention ───────────────────────────────────────────────────────
-- Cron-friendly: delete rows older than 90 days. Run weekly via:
--   delete from search_query_log where created_at < now() - interval '90 days';
-- (Or wire into the same cron that calls sweep-stale-offers.)


-- ── Sanity checks ───────────────────────────────────────────────────
--   insert into search_query_log (country, query, surface, mode, result_count)
--   values ('ng', 'iphone 15', 'hero', 'text', 12);
--
--   select * from popular_searches(p_country=>'ng', p_max_results=>5);
