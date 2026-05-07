-- ──────────────────────────────────────────────────────────────────
-- Newsletter subscribers — daily deals digest list. Captured by the
-- 'Stay in the loop' EmailCapture component on the homepage and any
-- other surface that posts to /api/newsletter.
--
-- Separate from cashback_waitlist because the audiences and
-- expectations differ: waitlist gets one email at launch; newsletter
-- subscribers get a recurring digest. Lets us segment + suppress
-- correctly.
--
-- Idempotency: unique on (email, source) so a user can subscribe
-- from multiple surfaces (homepage strip + cashback page footer +
-- blog post end) and we track each touchpoint without dup-key noise.
-- ──────────────────────────────────────────────────────────────────

create table if not exists newsletter_subscribers (
  id              bigserial primary key,
  email           text not null,
  source          text default 'homepage',           -- 'homepage' | 'blog-post' | etc.
  country         text,                               -- iso 3166-1 alpha-2 (lowercase)
  status          text not null default 'active',    -- 'active' | 'unsubscribed' | 'bounced'
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (email, source)
);

create index if not exists newsletter_status_idx on newsletter_subscribers (status);
create index if not exists newsletter_country_idx on newsletter_subscribers (country) where status = 'active';
create index if not exists newsletter_created_idx on newsletter_subscribers (created_at desc);
