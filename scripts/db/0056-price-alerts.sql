-- ──────────────────────────────────────────────────────────────────
-- price_alerts — "notify me when this product hits £X" subscriptions.
--
-- Triggered from the PDP via a "Set price alert" button. Stores the
-- user's email, the product (or fallback query), the target NGN
-- price, and the country context. A cron job (check-price-alerts)
-- scans pending rows daily, fires Resend emails when the cheapest
-- in-country offer is at or below the user's target, and stamps
-- notified_at to prevent re-firing.
--
-- Different from product_requests:
--   • product_requests is "tell me when Havlo finds X" — empty-state
--     recovery for products NOT in the catalogue.
--   • price_alerts is "tell me when X drops to my target price" —
--     the product IS in the catalogue; user wants a price-trigger
--     notification.
--   Both use waitlist-pattern email confirmations; both are
--   service-role-locked. Different intent, different table.
--
-- Identity key:
--   • product_id when known (PDP has the UUID).
--   • query as fallback when product_id is missing (live-search PDPs,
--     curated synthetic-id PDPs).
--   UNIQUE on (email, product_id, target_ngn) AND (email, query,
--   target_ngn) — re-submitting the same alert (same email, same
--   product, same target) no-ops cleanly.
--
-- Cooldown logic for the cron:
--   notified_at non-null = already fired. Don't re-fire unless
--   reset_at is in the future (manual reset; out of scope for v1).
--   For v1: once an alert fires, it's done. User can create another
--   if they want continuous monitoring at a lower target.
--
-- Unsubscribe:
--   token column = random UUID per row. Emails carry a link
--   https://havlo.io/unsubscribe-alert?token=... that DELETEs the
--   row. No login required — token possession is auth.
--
-- IDEMPOTENT — create-if-not-exists across the board.
-- ──────────────────────────────────────────────────────────────────

create table if not exists price_alerts (
  id              uuid        primary key default gen_random_uuid(),
  email           text        not null,
  /* product_id is nullable because some PDPs (live-search, curated
     synthetic-id) don't have a stable products.id UUID. In those
     cases the cron falls back to running query as a /api/deals
     search to find the cheapest match. */
  product_id      uuid        references products(id) on delete cascade,
  /* Fallback identifier for product_id-less alerts. Lowercased + trimmed
     in the API layer for consistent dedup. */
  query           text,
  /* Target price in NGN. USD targets get normalised at the API
     layer via usdToNgn before INSERT so the cron's comparison logic
     is currency-uniform. */
  target_ngn      numeric(12,2) not null check (target_ngn > 0),
  /* Country context — alert only fires when a country-appropriate
     offer hits the target. NG-only user doesn't want an alert
     because Amazon DE dropped 30%. */
  country         text          not null,
  /* Unsubscribe token — random UUID per row. Emails carry a
     /unsubscribe-alert?token=... link. */
  token           uuid        not null default gen_random_uuid() unique,
  /* Source surface — 'pdp' | 'deals' | 'compare'. Lets us see which
     surfaces drive alert creation in analytics. */
  source          text        not null default 'pdp',
  user_agent      text,
  /* Cron stamps these when it fires the email. */
  notified_at     timestamptz,
  last_checked_at timestamptz,
  created_at      timestamptz not null default now()
);

-- Two unique indexes to dedup both shapes of alert. PostgreSQL allows
-- partial UNIQUE constraints, which is exactly the shape we want:
-- one constraint applies when product_id is non-null, the other when
-- product_id is null and query is non-null.
create unique index if not exists price_alerts_email_product_target_idx
  on price_alerts (email, product_id, target_ngn)
  where product_id is not null;

create unique index if not exists price_alerts_email_query_target_idx
  on price_alerts (email, query, target_ngn)
  where product_id is null;

-- Cron-scan lookup index. WHERE notified_at IS NULL because the cron
-- only processes un-fired alerts. Partial index keeps the leaderboard
-- of pending rows small even when the table grows.
create index if not exists price_alerts_pending_idx
  on price_alerts (created_at asc)
  where notified_at is null;

-- Token lookup for unsubscribe — high cardinality, point-query only.
create index if not exists price_alerts_token_idx
  on price_alerts (token);

-- RLS: service-role only. Same posture as product_requests — emails
-- are PII, we don't expose them to anon / authenticated roles.
alter table price_alerts enable row level security;
-- No policies = no anon/authenticated access. Service-role bypasses.

-- ── Cron-scan RPC: pending_price_alerts() ─────────────────────────
-- Returns alerts whose current cheapest in-country offer is at or
-- below target_ngn AND haven't been notified yet. Cron iterates the
-- result, sends email, then bulk-updates notified_at for the fired
-- ids.
--
-- For alerts with product_id:
--   Cheapest = MIN(current_price_ngn) across offers joined to that
--   product, filtered to is_international=false OR country match.
--   USD prices normalised at 1650 NGN (same rate as elsewhere).
--
-- For alerts without product_id:
--   Returns null offer_id — the cron falls back to a /api/deals
--   search using the alert's query string. JS-side handles those.
create or replace function pending_price_alerts()
returns table (
  alert_id      uuid,
  email         text,
  product_id    uuid,
  query         text,
  target_ngn    numeric(12,2),
  country       text,
  token         uuid,
  cheapest_ngn  numeric(12,2),
  cheapest_offer_id uuid,
  cheapest_store_name text
)
language sql
stable
as $$
  with cheapest as (
    select
      a.id           as alert_id,
      a.email,
      a.product_id,
      a.query,
      a.target_ngn,
      a.country,
      a.token,
      (
        select min(case
          when o.currency = 'USD' then o.current_price * 1650
          else o.current_price
        end)
        from offers o
        join stores s on s.id = o.store_id
        where o.product_id = a.product_id
          and o.in_stock = true
          and (s.country = a.country or s.country is null or s.country = 'INTL')
      ) as cheapest_ngn,
      (
        select o.id
        from offers o
        join stores s on s.id = o.store_id
        where o.product_id = a.product_id
          and o.in_stock = true
          and (s.country = a.country or s.country is null or s.country = 'INTL')
        order by case
          when o.currency = 'USD' then o.current_price * 1650
          else o.current_price
        end asc
        limit 1
      ) as cheapest_offer_id,
      (
        select s.name
        from offers o
        join stores s on s.id = o.store_id
        where o.product_id = a.product_id
          and o.in_stock = true
          and (s.country = a.country or s.country is null or s.country = 'INTL')
        order by case
          when o.currency = 'USD' then o.current_price * 1650
          else o.current_price
        end asc
        limit 1
      ) as cheapest_store_name
    from price_alerts a
    where a.notified_at is null
      and a.product_id is not null
  )
  select
    alert_id, email, product_id, query, target_ngn, country, token,
    cheapest_ngn, cheapest_offer_id, cheapest_store_name
  from cheapest
  where cheapest_ngn is not null
    and cheapest_ngn <= target_ngn;
$$;

-- ── Sanity checks ───────────────────────────────────────────────────
--   -- Verify pending scan returns the right shape
--   select * from pending_price_alerts() limit 5;
--
--   -- Inspect cron-firing candidates
--   select email, target_ngn, cheapest_ngn, cheapest_store_name
--   from pending_price_alerts();
