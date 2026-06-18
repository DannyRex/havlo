-- 0085 — Lock down anon/PostgREST read access to public tables
-- ---------------------------------------------------------------------------
-- Source: Supabase security advisor scan, 2026-06-18 (launch-readiness audit).
-- The advisor flagged 12 public tables with RLS DISABLED (ERROR / EXTERNAL),
-- meaning they are readable by the `anon` role over the PostgREST Data API
-- (/rest/v1). That includes PII (`newsletter_subscribers` = subscriber
-- emails) and behavioural/ops logs (`search_query_log`, `outbound_clicks`,
-- `click_resolutions`, `serpapi_usage`, …).
--
-- WHY THIS IS SAFE FOR THE APP:
--   Every DB call in the app uses the SERVICE ROLE key
--   (src/lib/providers/db-client.ts: SUPABASE_SERVICE_ROLE_KEY ?? ANON).
--   The service role BYPASSES RLS. There is no browser/anon Supabase client
--   — all client data flows through /api/* routes. So enabling RLS with NO
--   policy locks out the anon REST API while leaving the app fully working.
--
-- ALREADY SAFE (no change needed): the tables the advisor lists as
--   `rls_enabled_no_policy` (price_alerts, cashback_waitlist,
--   category_reach_counts, fx_rates, inventory_state_transitions,
--   match_decisions, merchant_inquiries, pdp_views, product_requests,
--   roadmap_votes) already have RLS ON with no policy → anon is denied.
--
-- HOW TO RUN (founder): paste in the Supabase SQL editor, or
--   `supabase db push`. Read-only audit by the agent could not apply it.
-- ---------------------------------------------------------------------------

begin;

-- 1. Enable RLS on every public table the advisor flagged as RLS-disabled.
--    No policies are created → anon & authenticated receive zero rows;
--    the service role bypasses RLS so the app is unaffected.
alter table public.products               enable row level security;
alter table public.offers                 enable row level security;
alter table public.offer_price_history    enable row level security;
alter table public.stores                 enable row level security;
alter table public.deals_index            enable row level security;
alter table public.newsletter_subscribers enable row level security;  -- PII (emails)
alter table public.search_query_log       enable row level security;
alter table public.outbound_clicks        enable row level security;
alter table public.click_resolutions      enable row level security;
alter table public.resolved_clicks        enable row level security;
alter table public.serpapi_usage          enable row level security;
alter table public.ingestion_runs         enable row level security;

-- 2. SECURITY DEFINER views bypass RLS, so close their API exposure directly.
revoke all on public.product_best_offers               from anon, authenticated;
revoke all on public.click_resolutions_recent_by_store from anon, authenticated;

-- 3. Materialized view selectable by anon/authenticated over the API.
revoke all on public.mv_cheapest_offer_usd from anon, authenticated;

-- 4. SECURITY DEFINER function callable by anon — could be triggered to force
--    an expensive matview refresh. App calls it via the service role.
revoke execute on function public.refresh_cheapest_offers() from anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- OPTIONAL HARDENING (WARN-level advisor items — defer to a follow-up; not
-- exposure, just best-practice). Left commented so this migration stays
-- focused on the public-read exposure:
--   * function_search_path_mutable on ~30 functions → `ALTER FUNCTION … SET
--     search_path = public, pg_temp;` per function.
--   * extension_in_public (vector, pg_trgm) → move to a dedicated `extensions`
--     schema.
-- After running, re-scan: the advisor's rls_disabled_in_public + the two
-- security_definer_view ERRORs should clear.
-- ---------------------------------------------------------------------------
