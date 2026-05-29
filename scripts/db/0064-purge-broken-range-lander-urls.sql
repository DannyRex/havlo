-- ──────────────────────────────────────────────────────────────────
-- Purge broken-URL rows from store_id='the-range'.
--
-- User report May 29 2026: The Range's stored offer URLs all point
-- at `https://therange.com/lander` — wrong domain (.com not .co.uk)
-- and an internal affiliate landing path that no longer routes.
-- Every click 404s.
--
-- Root cause: SerpAPI returns this URL in the `link` field for The
-- Range, and the ingest path stored it verbatim. Code fix shipped
-- in the same change: src/lib/merchant-url-rewrite.ts now detects
-- therange.com hosts at ingest time and rewrites to
-- `https://www.therange.co.uk/search?q=<title>` — guaranteed-valid
-- domain that resolves to a relevant Range search page.
--
-- This migration nukes the existing broken rows. The next SerpAPI
-- scrape (Mon/Thu cron) will re-ingest with the rewriter applied,
-- so Range offers come back to the catalog with correct URLs
-- automatically — no backfill needed.
--
-- SAFETY:
--   · Targets ONLY rows whose URL matches the broken pattern.
--     Range rows with a different URL shape (none observed yet,
--     but defensive) survive untouched.
--   · CASCADE: offers.id references offer_price_history with
--     ON DELETE CASCADE, so the matching history rows vanish too.
--     That's correct — the history attached to a never-clickable
--     URL has zero analytical value.
--   · Idempotent. Re-runs delete zero additional rows once the
--     broken set is gone AND the new rewriter is in place.
-- ──────────────────────────────────────────────────────────────────

-- Diagnostic (uncomment to size the blast radius first):
--
--   select count(*) as broken_range_offers
--   from offers
--   where store_id = 'the-range'
--     and url ~* 'therange\.com/lander';

delete from offers
where store_id = 'the-range'
  and url ~* 'therange\.com/lander';


-- ── Verification ──────────────────────────────────────────────────
--   -- Should return 0 immediately after this migration applies.
--   select count(*)
--   from offers
--   where store_id = 'the-range'
--     and url ~* 'therange\.com/lander';
--
--   -- After the next Mon/Thu SerpAPI scrape, the row count for
--   -- the-range should be back near the pre-purge level — but
--   -- every new URL should now be therange.co.uk/search?q=...
--   -- instead of therange.com/lander.
--   select count(*), substring(url for 60) as url_sample
--   from offers
--   where store_id = 'the-range'
--   group by substring(url for 60);
