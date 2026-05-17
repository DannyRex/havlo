-- ──────────────────────────────────────────────────────────────────
-- Consolidate amazon-co-uk → amazon-uk
--
-- Migration 0030 cleaned amazon-co-uk-amazon-co-uk-seller (and other
-- ugly suffix variants) → amazon-uk. But it left BARE amazon-co-uk
-- intact because its LIKE pattern required a trailing suffix.
--
-- Post-0030, live audit showed both ids in NG pool:
--   amazon-co-uk:  15 offers
--   amazon-uk:      2 offers
--
-- Both display as 'Amazon UK' via displayStoreName, but they're
-- separate store rows in the DB — fragments the storeFilter pills,
-- splits analytics, makes the Store dropdown show 'Amazon UK'
-- twice. Same logic applies: pick amazon-uk as canonical (shorter,
-- matches the inferStoreId naming convention used by newer ingests).
--
-- Safe to re-run: idempotent.
-- ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  /* Skip cleanly if amazon-co-uk doesn't exist (idempotent). */
  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = 'amazon-co-uk') THEN
    RAISE NOTICE 'amazon-co-uk does not exist — nothing to consolidate';
    RETURN;
  END IF;

  /* Ensure amazon-uk exists. Copy metadata from amazon-co-uk if not. */
  INSERT INTO stores (id, name, country, url, logo_url, is_international, trusted)
  SELECT 'amazon-uk', 'Amazon UK', country, url, '/logos/amazon-uk.png', is_international, trusted
    FROM stores WHERE id = 'amazon-co-uk'
  ON CONFLICT (id) DO NOTHING;

  /* Move offers from amazon-co-uk → amazon-uk. Deduplicate first on
     the UNIQUE (store_id, url) constraint — if any URL is already
     present under amazon-uk, drop the amazon-co-uk copy. */
  DELETE FROM offers
   WHERE store_id = 'amazon-co-uk'
     AND url IN (SELECT url FROM offers WHERE store_id = 'amazon-uk');

  UPDATE offers SET store_id = 'amazon-uk' WHERE store_id = 'amazon-co-uk';

  /* Now safe to drop the old store row. */
  DELETE FROM stores WHERE id = 'amazon-co-uk';

  RAISE NOTICE 'Consolidated amazon-co-uk → amazon-uk';
END $$;

-- ── Sanity check (run after applying) ─────────────────────────────
-- SELECT id, name FROM stores WHERE id LIKE 'amazon%' ORDER BY id;
--   → expect only: amazon, amazon-uk, amazon-de, amazon-ae,
--     amazon-in, amazon-ca (no amazon-co-uk)
