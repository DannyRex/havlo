-- 0080-harden-fx-rate-search-path.sql
-- fx_rate() (0072) was defined as a plain STABLE SQL function with NO
-- `set search_path`. That made it inlinable, and when it was inlined into a
-- CREATE MATERIALIZED VIEW build (0079, first attempt) the unqualified
-- `fx_rates` failed to resolve in the SQL editor's search_path:
--   ERROR: relation "fx_rates" does not exist  (during inlining of fx_rate)
--
-- 0079 was fixed by inlining a schema-qualified lookup so it no longer calls
-- fx_rate at all. This migration hardens fx_rate ITSELF so any FUTURE caller
-- (another matview, an index expression, a generated column, a different
-- search_path) is safe:
--   1. `set search_path = public` pins resolution to public regardless of the
--      caller's path, and as a side effect makes the function non-inlinable,
--      so it can never be inlined into a DDL build and break again.
--   2. the table is also schema-qualified as public.fx_rates inside the body
--      (belt and suspenders, so it resolves even if the search_path pin is
--      ever removed).
--
-- Behaviour is UNCHANGED: same signature, same STABLE volatility, same math
-- (rate = quote units per 1 USD, USD->NGN fallback 1650, else 1). CREATE OR
-- REPLACE keeps the existing function OID, so every caller (price-history,
-- 30-day-low, alerts RPCs) keeps working with no churn. The function stays
-- cheap: fx_rates is a 6-row table and STABLE means it is evaluated once per
-- distinct argument set per query, not per row.
--
-- ROLLBACK: re-run the 0072 fx_rate definition (without the SET clause).
--
-- Apply in the Supabase SQL editor.

create or replace function fx_rate(p_base text, p_quote text)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select rate from public.fx_rates where base = p_base and quote = p_quote),
    case when p_base = 'USD' and p_quote = 'NGN' then 1650 else 1 end
  );
$$;
