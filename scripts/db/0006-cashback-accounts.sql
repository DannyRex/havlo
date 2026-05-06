-- 0006-cashback-accounts.sql
-- Phase 2 cashback foundation: user accounts + click tracking +
-- pending cashback ledger. Apply this in Supabase SQL editor before
-- shipping any user-facing auth UI.
--
-- Tables:
--   1. cashback_waitlist  - email capture from /cashback page
--   2. user_clicks        - per-user outbound click log for attribution
--   3. cashback_ledger    - per-user balance: pending → confirmed → paid
--
-- Auth: Supabase Auth ships its own auth.users table. This migration
-- references auth.users(id) via FK so account creation flows through
-- Supabase Auth rather than us building bespoke user storage. Saves
-- weeks of work (password reset, email verification, OAuth, sessions
-- all handled by Supabase). Free tier covers up to 50K monthly active
-- users which is plenty for the first year.
--
-- After applying:
--   1. Enable Email auth in Supabase dashboard → Authentication
--   2. Configure email templates (verification, magic link)
--   3. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in
--      Vercel envs (separate from the service-role key already there)
--   4. Wire login/signup pages — see /app/[country]/account/

----------------------------------------------------------------------
-- 1. Cashback waitlist (Phase 1 capture, no auth required)
--    Replaces the mailto fallback on /cashback. Lets us see who's
--    interested before we ship full Phase 2 accounts.
----------------------------------------------------------------------
create table if not exists cashback_waitlist (
  id           bigserial primary key,
  email        text not null,
  country      text,                              -- iso 3166-1 alpha-2 (lowercase)
  source       text default 'cashback-page',     -- 'cashback-page' | 'profile' | etc.
  created_at   timestamptz default now(),
  -- Email is uniqued per-source so the same user can sign up via
  -- multiple surfaces (e.g. cashback page + footer prompt) and we
  -- track each touchpoint without duplicate noise.
  unique (email, source)
);

create index if not exists waitlist_country_idx on cashback_waitlist (country);
create index if not exists waitlist_created_idx on cashback_waitlist (created_at desc);

----------------------------------------------------------------------
-- 2. User clicks (per-user outbound click log)
--    Records every /api/go click made while signed in. The user_id
--    is the FK to auth.users. The deal_id + url + store_id let us
--    reconcile against affiliate-network reports later.
--
--    Anonymous clicks (no signed-in user) skip this table — affiliate
--    tag still fires, just no cashback attribution.
----------------------------------------------------------------------
create table if not exists user_clicks (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  deal_id      text,                              -- e.g. 'amazon-us-airpods-pro-2'
  store_id     text,                              -- e.g. 'amazon', 'konga'
  outbound_url text not null,                     -- the /api/go ?url= we redirected to
  clicked_at   timestamptz default now(),
  -- Country-at-click for multi-marketplace attribution
  country      text
);

create index if not exists clicks_user_idx     on user_clicks (user_id, clicked_at desc);
create index if not exists clicks_store_idx    on user_clicks (store_id, clicked_at desc);
create index if not exists clicks_recency_idx  on user_clicks (clicked_at desc);

----------------------------------------------------------------------
-- 3. Cashback ledger (pending → confirmed → paid)
--    Each row is a single cashback credit on a single confirmed
--    purchase. Lifecycle:
--
--      pending    : created when retailer reports a sale (estimated)
--      confirmed  : retailer confirms after their return window
--                   (60-90 days for Amazon)
--      paid       : we've paid the user (Paystack/PayPal payout)
--      voided     : retailer reversed the sale (return / refund)
--                   the credit expires
----------------------------------------------------------------------
create type cashback_status as enum ('pending', 'confirmed', 'paid', 'voided');

create table if not exists cashback_ledger (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  click_id     bigint references user_clicks(id) on delete set null,
  store_id     text not null,
  amount_usd   numeric(10, 2) not null,           -- always stored in USD
  rate_percent numeric(5, 2) not null,            -- the % rate applied (2.0 = 2%)
  status       cashback_status not null default 'pending',
  reason       text,                              -- voided reason, paid method, etc.
  created_at   timestamptz default now(),
  confirmed_at timestamptz,
  paid_at      timestamptz,
  -- One ledger entry per click. Later this could be relaxed for
  -- bonus-style cashback unconnected to a click (referral bonuses,
  -- promotional credits) but that's a Phase 4+ concern.
  unique (click_id)
);

create index if not exists ledger_user_status_idx on cashback_ledger (user_id, status);
create index if not exists ledger_status_idx      on cashback_ledger (status);
create index if not exists ledger_created_idx     on cashback_ledger (created_at desc);

----------------------------------------------------------------------
-- 4. Convenience view: per-user balance summary
----------------------------------------------------------------------
create or replace view user_cashback_balance as
select
  user_id,
  sum(case when status = 'pending'   then amount_usd else 0 end) as pending_usd,
  sum(case when status = 'confirmed' then amount_usd else 0 end) as confirmed_usd,
  sum(case when status = 'paid'      then amount_usd else 0 end) as paid_usd,
  count(*) filter (where status in ('pending', 'confirmed')) as active_credits
from cashback_ledger
group by user_id;

----------------------------------------------------------------------
-- 5. Row-Level Security
--    auth.users-keyed tables get RLS so users can only see their own
--    rows. The service-role key (used by /api/go and cron jobs)
--    bypasses RLS so server-side writes still work.
----------------------------------------------------------------------
alter table user_clicks      enable row level security;
alter table cashback_ledger  enable row level security;

-- Read-own policy: signed-in users see only their rows
create policy "users read own clicks"      on user_clicks      for select using (auth.uid() = user_id);
create policy "users read own ledger"      on cashback_ledger  for select using (auth.uid() = user_id);

-- Insert: only the service role (no client-side inserts)
-- (default-deny since no insert policy exists)

-- Waitlist is public-write because we need anonymous email capture
alter table cashback_waitlist enable row level security;
create policy "anyone can sign up to waitlist" on cashback_waitlist for insert with check (true);
-- Reads only by service role for now (no select policy = default deny)
