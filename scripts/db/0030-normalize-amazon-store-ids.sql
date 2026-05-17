-- ──────────────────────────────────────────────────────────────────
-- Normalize Amazon store_id variants in DB.
--
-- Background: pre-canonicaliseSource() ingest runs created stores
-- with raw SerpAPI source strings as the id:
--   amazon-co-uk-amazon-co-uk-seller
--   amazon-co-uk-seller
--   amazon-ae-seller
--   amazon-de-retail
--   amazon-de-seller
--   amazon-in-seller
--
-- canonicaliseSource() now collapses these at ingest time, so new
-- rows land as clean amazon-uk / amazon-de / amazon-ae / amazon-in.
-- But existing rows escaped. Display-side displayStoreName() already
-- normalises the NAME for user-facing surfaces, but the id stays
-- ugly in URLs, API responses, and any code path that reads
-- store_id directly.
--
-- This migration:
--   1. For each ugly Amazon storeId variant, ensure a canonical
--      target store exists (insert if missing — copies metadata
--      from the ugly variant)
--   2. Reattach all offers from the ugly variant → canonical
--   3. Drop the ugly variant from the stores table
--
-- Pattern: amazon-{country}-anything → amazon-{country}
--   amazon-co-uk-* → amazon-uk
--   amazon-de-*    → amazon-de
--   amazon-ae-*    → amazon-ae
--   amazon-in-*    → amazon-in
--   amazon-ca-*    → amazon-ca
--
-- Safe to re-run: idempotent. After the first run, ugly variants
-- are gone; subsequent runs find nothing to do.
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  ugly RECORD;
  canonical_id TEXT;
  canonical_name TEXT;
BEGIN
  /* Loop over every store whose id matches the ugly Amazon-variant
     pattern. The map below produces the canonical id + display name
     for each match. */
  FOR ugly IN
    SELECT id, name, country, url, logo_url, is_international, trusted
      FROM stores
     WHERE id LIKE 'amazon-co-uk-%'
        OR id LIKE 'amazon-uk-%'
        OR id LIKE 'amazon-de-%'
        OR id LIKE 'amazon-ae-%'
        OR id LIKE 'amazon-in-%'
        OR id LIKE 'amazon-ca-%'
        OR id LIKE 'amazon-com-%'
        OR id LIKE 'amazon-us-%'
  LOOP
    canonical_id :=
      CASE
        WHEN ugly.id LIKE 'amazon-co-uk-%' OR ugly.id LIKE 'amazon-uk-%' THEN 'amazon-uk'
        WHEN ugly.id LIKE 'amazon-de-%' THEN 'amazon-de'
        WHEN ugly.id LIKE 'amazon-ae-%' THEN 'amazon-ae'
        WHEN ugly.id LIKE 'amazon-in-%' THEN 'amazon-in'
        WHEN ugly.id LIKE 'amazon-ca-%' THEN 'amazon-ca'
        WHEN ugly.id LIKE 'amazon-com-%' OR ugly.id LIKE 'amazon-us-%' THEN 'amazon'
      END;

    /* Skip if the id is already canonical (defensive — the LIKE
       patterns above shouldn't match the canonical ids but we want
       to be sure). */
    IF canonical_id = ugly.id THEN CONTINUE; END IF;

    canonical_name :=
      CASE canonical_id
        WHEN 'amazon-uk' THEN 'Amazon UK'
        WHEN 'amazon-de' THEN 'Amazon Germany'
        WHEN 'amazon-ae' THEN 'Amazon UAE'
        WHEN 'amazon-in' THEN 'Amazon India'
        WHEN 'amazon-ca' THEN 'Amazon Canada'
        WHEN 'amazon'    THEN 'Amazon'
      END;

    /* Ensure canonical store exists. INSERT ... ON CONFLICT DO NOTHING
       so if the canonical row is already present we just keep using
       it without overwriting. */
    INSERT INTO stores (id, name, country, url, logo_url, is_international, trusted)
    VALUES (
      canonical_id,
      canonical_name,
      ugly.country,
      ugly.url,
      '/logos/' || canonical_id || '.png',
      ugly.is_international,
      ugly.trusted
    )
    ON CONFLICT (id) DO NOTHING;

    /* Move all offers from ugly variant to canonical. The offers
       table has UNIQUE (store_id, url) — if a duplicate URL already
       exists under the canonical id, drop the ugly variant's offer
       to avoid the conflict. */
    DELETE FROM offers
     WHERE store_id = ugly.id
       AND url IN (
         SELECT url FROM offers WHERE store_id = canonical_id
       );

    UPDATE offers
       SET store_id = canonical_id
     WHERE store_id = ugly.id;

    /* Now safe to drop the ugly store row. */
    DELETE FROM stores WHERE id = ugly.id;

    RAISE NOTICE 'Normalized: % → %', ugly.id, canonical_id;
  END LOOP;
END $$;

-- ── Sanity checks (run after applying) ────────────────────────────
-- SELECT id, name FROM stores WHERE id LIKE 'amazon%' ORDER BY id;
--   → expect only clean ids: amazon, amazon-uk, amazon-de, amazon-ae,
--     amazon-in, amazon-ca (no -seller / -retail / -amazon-co-uk-...
--     suffixes)
--
-- SELECT store_id, count(*) FROM offers WHERE store_id LIKE 'amazon%'
--   GROUP BY store_id ORDER BY 2 DESC;
--   → all offers attributed to clean ids
