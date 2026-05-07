-- ──────────────────────────────────────────────────────────────────
-- Add category targeting to newsletter_subscribers.
--
-- Powers the "Get Phones deals in your inbox" subscribe widget on
-- /deals (visible whenever the user has filtered to a specific
-- category). Subscribers with a non-null `category` get only the
-- daily digest items in that category; null = standard catch-all
-- newsletter (existing behaviour preserved for all current rows).
--
-- Schema additions:
--   • category text — slug from src/lib/data/categories.ts (phones,
--     audio, computing, …) or null for catch-all.
--   • partial index on (category, country) where status='active' so
--     the daily send job can fan out efficiently per category.
--
-- Migration is idempotent — safe to re-run.
-- ──────────────────────────────────────────────────────────────────

alter table newsletter_subscribers
  add column if not exists category text;

create index if not exists newsletter_category_idx
  on newsletter_subscribers (category, country)
  where status = 'active';

comment on column newsletter_subscribers.category is
  'Category slug (phones / audio / computing / …) when subscriber wants only that category. NULL = catch-all daily roundup.';
