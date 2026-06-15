-- 0084-drop-duplicate-browse-deals.sql
-- HOTFIX for a regression introduced by 0083.
--
-- 0083 intended to DROP the existing browse_deals and recreate it with the
-- extra p_deals_only arg. But its DROP signature declared p_rotate_seed as
-- `integer`, while the LIVE function (from 0066) declared it as `bigint`.
-- `drop function if exists` matches by EXACT argument types, so the bigint
-- function was NOT dropped — 0083 just created a SECOND browse_deals beside
-- it. PostgREST then can't resolve a plain browse_deals(...) call (no
-- p_deals_only) between the two overloads and returns PGRST203
-- ("Could not choose the best candidate function"), which makes the local
-- deals fetch fail — emptying the homepage TrendingDeals grid and the
-- /deals local pass.
--
-- FIX: drop the stale 10-arg bigint-rotate-seed function. The 11-arg
-- function 0083 created (p_rotate_seed integer + p_deals_only boolean, which
-- returns is_real_deal) is the canonical one and is left in place.
--
-- Verify after running (expect exactly ONE row):
--   select oid::regprocedure
--   from pg_proc where proname = 'browse_deals';

drop function if exists browse_deals(
  text, integer, text, text, text, text[], integer, boolean, text, bigint
);
