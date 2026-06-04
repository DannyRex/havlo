-- 0074-offers-url-trgm-index.sql
-- The Google-relay resolver (scripts/resolve-relay-urls.ts, resolve-relays.yml
-- every 4h) finds unresolved relay offers with:
--   url ILIKE '%google.com/search%' OR url ILIKE '%google.com%2Fsearch%'
-- A leading-wildcard ILIKE cannot use a btree index, so this was a FULL
-- sequential scan of `offers` on every run. Fine on a healthy DB at small
-- scale, but it blew past the statement timeout once the DB was loaded
-- (the "canceling statement due to statement timeout" the run hit) and the
-- recurring scan is itself a load source on the Micro compute instance.
--
-- A pg_trgm GIN index makes the ILIKE index-assisted (trigram matching), so
-- the resolver does an index lookup instead of scanning 20k+ rows. Also
-- speeds any other url-substring search.
--
-- APPLY WHEN THE DB IS HEALTHY: CREATE INDEX scans the table once to build
-- and briefly locks writes. At ~23k rows that's a few seconds, but don't
-- run it while the instance is already saturated -- restart/clear the DB
-- first (see the resolver-timeout notes).

create extension if not exists pg_trgm;

create index if not exists idx_offers_url_trgm
  on offers using gin (url gin_trgm_ops);
