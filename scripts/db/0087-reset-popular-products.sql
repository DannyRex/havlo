-- 0087-reset-popular-products.sql
-- Reset the click-driven "popular products" signal across ALL countries.
--
-- WHY: "Most popular" / trending ranking is computed LIVE from outbound_clicks
-- (there is no stored per-country popular-products table):
--   * popular_products() RPC  -> the /deals "Most popular" sort
--   * rowToDeal reads 30-day outbound_clicks into Deal.clicks, which
--     byClicksDesc uses to order the homepage trending buckets.
-- During launch prep every row is internal test/dev clicking (159 rows, all
-- inside the 30-day window), which skewed "popular" toward whatever happened to
-- get clicked while testing. Wiping it gives a clean baseline for real traffic.
--
-- SCOPE: outbound_clicks has NO country column — popularity is per-product and
-- applied in every market — so clearing it IS the all-country reset. The
-- separate resolved_clicks / click_resolutions tables are the Google-Shopping
-- click-RESOLUTION pipeline (10k+/29k+ rows, NOT read by popular_products);
-- they are LEFT INTACT on purpose.
--
-- This is destructive + irreversible (it also discards the raw outbound-click
-- analytics history). Safe to run anytime — popularity simply rebuilds from new
-- clicks, and trending falls back to its discount/recency order in the
-- meantime (already rotated hourly so it won't freeze on one product).

begin;
delete from outbound_clicks;
commit;
