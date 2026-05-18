-- ──────────────────────────────────────────────────────────────────
-- Migration 0036: cleanup the amazon-germany / amazon-india / amazon-uae
-- duplicates that the May 18 manual cron run created BEFORE the
-- inferStoreId code fix landed in b578c78.
--
-- Why this is separate from 0033:
--   0033 cleaned the pre-existing duplicates. b578c78 fixed the
--   code path (inferStoreId now produces canonical short IDs) so
--   future ingests won't re-create them. But the May 18 manual
--   trigger ran on the pre-fix code and freshly created these
--   IDs ONE LAST TIME before the fix shipped:
--     amazon-germany (5 offers)
--     amazon-india   (3 offers)
--     amazon-uae     (8 offers)
--
-- This migration consolidates them into canonical amazon-de /
-- amazon-in / amazon-ae using the exact same pattern as 0033.
-- It's a one-shot — once applied, no future cron should re-create
-- the verbose forms because the code is fixed.
--
-- Idempotent — DO blocks skip when the source id doesn't exist.
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('amazon-germany', 'amazon-de', 'Amazon DE', 'DE'),
      ('amazon-uae',     'amazon-ae', 'Amazon AE', 'AE'),
      ('amazon-india',   'amazon-in', 'Amazon IN', 'IN')
    ) AS t(src_id, canonical_id, canonical_name, country_code)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM stores WHERE id = pair.src_id) THEN
      CONTINUE;
    END IF;

    /* Ensure canonical row exists. 0033 should have created it
       already, but be defensive. */
    INSERT INTO stores (id, name, country, url, logo_url, is_international, trusted)
    SELECT
      pair.canonical_id,
      pair.canonical_name,
      pair.country_code,
      url,
      '/logos/' || pair.canonical_id || '.png',
      is_international,
      trusted
      FROM stores WHERE id = pair.src_id
    ON CONFLICT (id) DO NOTHING;

    /* Move offers: drop URL-collision dupes first, then UPDATE. */
    DELETE FROM offers
     WHERE store_id = pair.src_id
       AND url IN (SELECT url FROM offers WHERE store_id = pair.canonical_id);

    UPDATE offers
       SET store_id = pair.canonical_id
     WHERE store_id = pair.src_id;

    DELETE FROM stores WHERE id = pair.src_id;

    RAISE NOTICE 'Consolidated % → %', pair.src_id, pair.canonical_id;
  END LOOP;
END $$;

-- ── Sanity check (run after applying) ─────────────────────────────
-- SELECT id, name, country FROM stores WHERE id LIKE 'amazon%' ORDER BY id;
--   → expect only: amazon, amazon-ae, amazon-co-za-seller, amazon-de,
--     amazon-in, amazon-uk (no amazon-germany / amazon-india / amazon-uae)
