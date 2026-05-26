-- ──────────────────────────────────────────────────────────────────
-- Migration 0047: one-shot merge of title_key + brand + model
--                 duplicates surfaced by Phase 2 audit
--
-- Audit numbers (May 2026, post-migration 0046):
--   Total products:           27,143
--   Duplicate groups:          4,805 (same title_key + brand + model)
--   Orphan rows to merge:     15,072  (56% of the catalog)
--   Worst group size:           168  duplicates of one product
--
-- Safety design:
--   1. Group only on (title_key, brand, model) ALL EQUAL — NULL brand
--      and NULL model are allowed AS LONG AS both products share that
--      NULL state. We never merge an Apple product with a Samsung one
--      just because they happen to share a title prefix.
--
--   2. Canonical selection is deterministic and explainable:
--        a. Product with the MOST offers wins (highest signal,
--           strongest commercial presence)
--        b. Tie-break by EARLIEST created_at (oldest = most established
--           identity, gets the longest history record continuity)
--
--   3. Foreign-key handling: offers + offer_price_history both
--      `ON DELETE CASCADE`. We MUST re-point before deleting the
--      orphan product, otherwise the cascade nukes the offers we
--      wanted to preserve.
--
--   4. The offers(store_id, url) UNIQUE constraint means a canonical
--      and orphan can't share the same offer URL — when they do
--      (because both got re-ingested from the same source under
--      different signature parses), we DROP the orphan's copy
--      before re-pointing. The canonical's row is the survivor.
--
--   5. RAISE NOTICE at each step gives a visible progress trail in
--      the Supabase SQL editor output so the run isn't a black box.
--
-- Idempotent — re-running after a successful pass finds zero
-- duplicates and is a no-op. Safe to retry on partial failure.
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  total_products_before  integer;
  orphan_count           integer;
  colliding_offers       integer;
  repointed_offers       integer;
  repointed_history      integer;
  deleted_orphans        integer;
  total_products_after   integer;
  has_price_history      boolean;
BEGIN
  SELECT COUNT(*) INTO total_products_before FROM products;
  RAISE NOTICE 'Products before merge: %', total_products_before;

  -- ── Build canonical map ──────────────────────────────────────
  -- Group by (title_key, brand, model). For each group with >1
  -- product, the canonical is the one with the most offers
  -- (tie-break: earliest created_at).
  CREATE TEMP TABLE _canonical_map ON COMMIT DROP AS
  WITH dupe_groups AS (
    SELECT
      title_key, brand, model,
      array_agg(id ORDER BY
        (SELECT COUNT(*) FROM offers WHERE product_id = products.id) DESC,
        created_at ASC
      ) AS ids
    FROM products
    WHERE title_key IS NOT NULL
    GROUP BY title_key, brand, model
    HAVING COUNT(*) > 1
  )
  SELECT
    ids[1] AS canonical_id,
    UNNEST(ids[2:]) AS orphan_id
  FROM dupe_groups;

  SELECT COUNT(*) INTO orphan_count FROM _canonical_map;
  RAISE NOTICE 'Orphan products to merge: %', orphan_count;

  IF orphan_count = 0 THEN
    RAISE NOTICE 'No duplicates found — nothing to do.';
    RETURN;
  END IF;

  -- ── Step 1: drop orphan offers that would collide with the
  --            canonical's existing (store_id, url) row. The
  --            canonical's offer is the survivor; the orphan's
  --            duplicate is the loser. ────────────────────────
  WITH colliding AS (
    DELETE FROM offers o
    USING _canonical_map cm,
          offers canonical_offer
    WHERE o.product_id           = cm.orphan_id
      AND canonical_offer.product_id = cm.canonical_id
      AND canonical_offer.store_id   = o.store_id
      AND canonical_offer.url        = o.url
    RETURNING o.id
  )
  SELECT COUNT(*) INTO colliding_offers FROM colliding;
  RAISE NOTICE 'Step 1: dropped % colliding orphan offers (would have violated UNIQUE on store_id+url)', colliding_offers;

  -- ── Step 2: re-point the remaining orphan offers to canonical ─
  WITH repointed AS (
    UPDATE offers o
    SET product_id = cm.canonical_id
    FROM _canonical_map cm
    WHERE o.product_id = cm.orphan_id
    RETURNING o.id
  )
  SELECT COUNT(*) INTO repointed_offers FROM repointed;
  RAISE NOTICE 'Step 2: re-pointed % offers from orphans to canonical', repointed_offers;

  -- ── Step 3: re-point offer_price_history if the table exists.
  --            Same logic — orphan's rows attach to canonical so
  --            the price-history series continues unbroken. ────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'offer_price_history'
  ) INTO has_price_history;

  IF has_price_history THEN
    WITH repointed AS (
      UPDATE offer_price_history h
      SET product_id = cm.canonical_id
      FROM _canonical_map cm
      WHERE h.product_id = cm.orphan_id
      RETURNING h.id
    )
    SELECT COUNT(*) INTO repointed_history FROM repointed;
    RAISE NOTICE 'Step 3: re-pointed % offer_price_history rows', repointed_history;
  ELSE
    RAISE NOTICE 'Step 3: offer_price_history table not present, skipping';
    repointed_history := 0;
  END IF;

  -- ── Step 4: delete the now-childless orphan products ────────
  -- Defensive: cascade is fine here because we already re-pointed
  -- the rows we wanted to keep. Any remaining cascade target is
  -- residue from a non-FK source we didn't anticipate.
  WITH deleted AS (
    DELETE FROM products
    WHERE id IN (SELECT orphan_id FROM _canonical_map)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_orphans FROM deleted;
  RAISE NOTICE 'Step 4: deleted % orphan products', deleted_orphans;

  SELECT COUNT(*) INTO total_products_after FROM products;
  RAISE NOTICE 'Products after merge: % (was %, delta = -%)',
    total_products_after, total_products_before,
    total_products_before - total_products_after;
END $$;

-- ── Post-run sanity (run after the DO block) ─────────────────────
-- Should report zero duplicate (title_key, brand, model) groups:
--   SELECT title_key, brand, model, COUNT(*)
--     FROM products WHERE title_key IS NOT NULL
--    GROUP BY title_key, brand, model
--   HAVING COUNT(*) > 1
--    ORDER BY COUNT(*) DESC LIMIT 10;
--
-- Confirm no orphan offers (every offer has a valid product):
--   SELECT COUNT(*) FROM offers o
--   WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = o.product_id);
