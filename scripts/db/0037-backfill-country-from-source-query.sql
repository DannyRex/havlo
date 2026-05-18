-- ──────────────────────────────────────────────────────────────────
-- Migration 0037: backfill stores.country from offer.source_query
--
-- Context: today's manual cron run added 1,745 new non-NG offers
-- across 6 countries, but most of them landed on stores with
-- country=NULL because inferStoreCountry (JS-side) doesn't recognize
-- the store IDs. Visible symptom: /za/deals shows total=4 even though
-- the SerpAPI ingest fetched 188 ZA deals — the other 184 are tied
-- to NULL-country stores and get filtered out of the local pool.
--
-- The SerpAPI provider writes offer.source_query in the form
-- `${category.slug}:${country}` — e.g. "phones:za", "audio:us". So
-- we KNOW which country each offer was queried from, even when the
-- store itself isn't in any JS roster.
--
-- This migration:
--   1. For every store with country=NULL,
--   2. Look at its offers' source_query values,
--   3. Extract the country suffixes (`:xx`),
--   4. If ALL source_queries point to the SAME country, tag the
--      store with that country.
--   5. If multiple countries seen (the store appeared in queries
--      for both US and UK, say), leave country=NULL (ambiguous —
--      that's a truly cross-border store and shouldn't be anchored
--      to one market).
--
-- Why "single-country-only" gate matters: Amazon.com appears in
-- queries for many markets (NG / US / UK / ZA / etc.) because every
-- country's SerpAPI ingest can surface Amazon.com results. We MUST
-- NOT tag Amazon.com with whichever country happened to be queried
-- first — that would mis-anchor a globally-relevant retailer.
--
-- Expected impact: most of the ~900 NULL-country stores were ingested
-- via SerpAPI in ONE country's run, so they pass the single-country
-- gate. AliExpress / Shein / Temu / Amazon variants appear in
-- multiple countries' runs and correctly stay NULL.
--
-- Idempotent — UPDATE only touches stores where country IS NULL.
-- ──────────────────────────────────────────────────────────────────

WITH single_country_stores AS (
  SELECT
    s.id AS store_id,
    /* Aggregate distinct country suffixes across all offers for this
       store. Format expected: "category:country" e.g. "phones:za".
       Anything that doesn't match the pattern (legacy ingests without
       country suffix) is filtered out by the regex. */
    array_agg(DISTINCT upper(split_part(o.source_query, ':', 2))) FILTER (
      WHERE o.source_query ~ ':[a-z]{2}$'
    ) AS countries
  FROM stores s
  JOIN offers o ON o.store_id = s.id
  WHERE s.country IS NULL
  GROUP BY s.id
)
UPDATE stores
   SET country = countries[1]
  FROM single_country_stores
 WHERE stores.id = single_country_stores.store_id
   AND stores.country IS NULL
   /* Single-country gate: only tag if every offer for this store
      came from the same country's ingest. Multi-country stores
      (truly global retailers) stay NULL — they should never be
      anchored to one market via a flaky inference. */
   AND array_length(countries, 1) = 1
   /* Defensive: country code must be a known launch market.
      Defends against malformed source_query values from older
      ingest paths leaking through. */
   AND countries[1] IN ('NG', 'UK', 'US', 'DE', 'AE', 'IN', 'ZA');

-- ── Sanity checks (run after applying) ────────────────────────────
-- 1. Count drop:
--    SELECT country, count(*) FROM stores GROUP BY country ORDER BY 2 DESC;
--    → expect NULL count significantly reduced from ~900 down to
--       ~250-400 (the residue is multi-market stores correctly
--       left untagged).
--
-- 2. Spot-check: stores that were ingested only for ZA should now
--    be country='ZA':
--    SELECT s.id, s.name, s.country
--      FROM stores s
--      JOIN offers o ON o.store_id = s.id
--     WHERE o.source_query LIKE '%:za'
--     LIMIT 20;
--    → most should have country='ZA' now.
--
-- 3. Multi-market stores stay NULL (this is correct):
--    SELECT s.id, s.country, array_agg(DISTINCT upper(split_part(o.source_query, ':', 2)))
--      FROM stores s
--      JOIN offers o ON o.store_id = s.id
--     WHERE o.source_query ~ ':[a-z]{2}$'
--     GROUP BY s.id, s.country
--    HAVING array_length(array_agg(DISTINCT upper(split_part(o.source_query, ':', 2))), 1) > 1
--     LIMIT 10;
--    → these stores (e.g. aliexpress / amazon / shein) appear in
--      multiple country ingests and should stay country=NULL.
