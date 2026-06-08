-- 2026-06-refresh-cheapest-offer-matview.sql
-- ONE-TIME maintenance — run once in the Supabase SQL editor.
--
-- WHY: the QA Jun 2026 round found 11.1% of best-prices on /deals and
-- PDPs were sold-out. Root cause: the weekly stale-offer TTL sweep
-- (scripts/sweep-stale-offers.ts) flipped offers to in_stock=false but
-- NEVER refreshed mv_cheapest_offer — the materialized view that
-- product_best_offers (and therefore browse_deals + PDP fetch) reads.
-- So an offer the sweep marked out-of-stock stayed the "cheapest
-- in-stock" row in the matview until the next post-dedup refresh.
--
-- The code fix (sweep-stale-offers.ts now calls refresh_cheapest_offers
-- after every apply) prevents this going forward. This file clears the
-- CURRENT backlog (~962 stale best-price rows measured) immediately,
-- rather than waiting for the next Sunday 04:00 UTC sweep.
--
-- SAFE: refresh_cheapest_offers() just rebuilds the matview from live
-- offers data (in-stock only, lowest current_price per product). It's
-- idempotent and read-only with respect to the base tables. Brief
-- AccessExclusive lock on the matview during the rebuild (a few seconds).

select refresh_cheapest_offers();

-- Verification (optional): expect 0 rows. Any row returned is a
-- product whose surfaced cheapest offer is still out-of-stock AFTER the
-- refresh — which should not happen, because the matview's lateral join
-- filters in_stock=true. A non-empty result means an offer's in_stock
-- flag changed between the refresh and this query (benign race) or a
-- deeper data issue worth investigating.
select pbo.product_id, pbo.offer_id, o.in_stock
from product_best_offers pbo
join offers o on o.id = pbo.offer_id
where o.in_stock = false
limit 50;
