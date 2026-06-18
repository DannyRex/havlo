-- 0086 — Fully close anon execute on refresh_cheapest_offers()
-- ---------------------------------------------------------------------------
-- 0085 revoked EXECUTE from `anon` + `authenticated`, but Postgres grants
-- EXECUTE to PUBLIC by default and both roles inherit it via PUBLIC — so the
-- security advisor still flags `refresh_cheapest_offers()` as anon-executable
-- over /rest/v1/rpc (WARN: a caller could force an expensive matview refresh).
-- Revoking from PUBLIC actually closes it. The app calls this only from the
-- service role (which bypasses these grants), so nothing breaks. Founder-run.
-- ---------------------------------------------------------------------------

begin;

revoke execute on function public.refresh_cheapest_offers() from public, anon, authenticated;

commit;

-- After running, re-run the security advisor: the
-- anon_security_definer_function_executable +
-- authenticated_security_definer_function_executable warnings should clear.
