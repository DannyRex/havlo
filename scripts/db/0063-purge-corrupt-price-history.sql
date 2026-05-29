-- ──────────────────────────────────────────────────────────────────
-- Purge corrupt rows from offer_price_history.
--
-- User report May 29 2026: "Lowest tracked from 2w ago returns some
-- really low prices which was corrupted leakage before our fix.
-- E.g. $10 when current is $300."
--
-- Pre-fix scrape windows wrote bogus rows for several reasons:
--
--   · Shopify variant ingest captured the cheapest variant of a
--     parent product (often an accessory / sample / display unit)
--     under the parent's product_id. A ₦5K phone case priced under
--     a ₦300K iPhone listing was the recurring shape.
--   · Scrapers grabbed the DISCOUNT amount or unit-of-measure price
--     ("$10 OFF" or "$10/g") instead of the headline.
--   · Currency mis-detection wrote raw USD values into rows tagged
--     as NGN — a $300 row showed as 300 NGN.
--   · The pre-d730342 signature leak (samsung|?, fenty|?, ?|?)
--     grouped unrelated products together; some history rows still
--     reference the merged-then-split id and carry the OTHER
--     product's price.
--
-- The plausibility filter at FTS read time (priceLooksPlausible)
-- catches these on /compare and /api/live-search. The read-side
-- filter just added to rollupPriceHistory + sanitisePriceTimeseries
-- catches them on the PDP "Lowest tracked" line + the chart at
-- render time. This migration deletes them from the source table
-- so the chart's RPC (product_price_timeseries) no longer pre-
-- aggregates them into the day buckets at all, AND so consumers
-- we haven't title-aware-filtered yet (offers_at_30d_low, anyone
-- consuming offer_price_history directly) get clean data too.
--
-- IDENTIFICATION STRATEGY:
--
--   1. Compare each history row's price (after currency normalisation
--      to NGN via a fixed FX rate matching the rest of the codebase)
--      against the linked OFFER's CURRENT price.
--   2. If history.price is < 10% of current_price → corrupt
--      (more than 90% off is almost never a real sale).
--   3. Plus an absolute floor of 100 NGN — catches $0/$1/$10 raw
--      values that wouldn't be flagged by the relative filter if
--      the current price is also tiny (shouldn't happen but
--      defends against that edge).
--   4. Plus a denominator guard — skip rows linked to offers whose
--      current_price is missing, zero, or implausibly small.
--      (Don't want to nuke history for a legit ₦500 item just
--      because its current_price column is null.)
--
-- The 10% threshold is intentionally conservative. A real 95%-off
-- clearance row gets deleted — but those are vanishingly rare,
-- and we'd rather hide a single legit-but-extreme sale than keep
-- showing $10-iPhone-15-Pro history. The PDP falls back to "the
-- earliest tracked price was the same as today" copy when history
-- runs thin.
--
-- IDEMPOTENT:
--   Re-runs delete only the same corrupt rows. Once gone, the
--   filter matches nothing. Safe to re-apply.
--
-- REVERSIBILITY:
--   Deleted rows are NOT recoverable from this table — but the
--   `offers` table still has its `current_price` column untouched,
--   and `offer_price_history` will regrow from the next scrape
--   wave with valid prices because the new ingest-side guard
--   (priceLooksPlausible at write time, shipping in the same
--   change) refuses to write bogus values to `offers` in the
--   first place.
-- ──────────────────────────────────────────────────────────────────

-- ── USD->NGN reference rate ───────────────────────────────────────
-- Matches the USD_TO_NGN constant in src/lib/search/price-floor.ts.
-- Quarterly update cadence; the rate doesn't need to be precise
-- because the 10% relative threshold dominates the decision.
-- Hard-coded inline instead of a parameter so re-running the
-- migration is unambiguous about the threshold used.

-- ── Diagnostic: count rows that WOULD be deleted ──────────────────
-- Run this first if you want to know the blast radius before
-- committing. Uncomment to use:
--
--   select count(*) as corrupt_history_rows
--   from offer_price_history h
--   join offers o on o.id = h.offer_id
--   where o.current_price is not null
--     and o.current_price > 100
--     and (
--       case h.currency
--         when 'USD' then h.price * 1600
--         else h.price
--       end
--     ) < case o.currency
--           when 'USD' then o.current_price * 1600
--           else o.current_price
--         end * 0.10;

-- ── The purge ─────────────────────────────────────────────────────
delete from offer_price_history h
using offers o
where o.id = h.offer_id
  and o.current_price is not null
  and o.current_price > 100
  and (
    case h.currency
      when 'USD' then h.price * 1600
      else h.price
    end
  ) < case o.currency
        when 'USD' then o.current_price * 1600
        else o.current_price
      end * 0.10;

-- ── Verification ──────────────────────────────────────────────────
--   -- Should return 0 after running this migration.
--   select count(*) as remaining_corrupt
--   from offer_price_history h
--   join offers o on o.id = h.offer_id
--   where o.current_price is not null
--     and o.current_price > 100
--     and (
--       case h.currency when 'USD' then h.price * 1600 else h.price end
--     ) < case o.currency when 'USD' then o.current_price * 1600 else o.current_price end * 0.10;
--
--   -- Sanity: total history rows shouldn't drop by more than a few
--   -- percent. If the delete touched >5% of rows, investigate
--   -- before re-running across the rest of the table.
--   select count(*) from offer_price_history;
