-- ──────────────────────────────────────────────────────────────────
-- Migration 0046: products.title_key column for title-based dedup
--
-- Phase 2 comparison audit (May 2026) found a critical ingest bug:
-- ingestion.ts only deduplicates products when buildSignature
-- successfully extracts BOTH brand AND model. With ~50% of titles
-- failing to parse either component, every re-ingest of the same
-- product creates a fresh products.id row. Audit found:
--   • 4,810 normalized-title collisions (= ~10,000 split products)
--   • One product duplicated 135 times (the Beats earphone-cover)
--   • 35 different Dell products all colliding on signature 'dell|?'
--
-- Fix: add products.title_key as a stored, indexed, normalized form
-- of the title (lowercased, alphanumeric-only, capped at 120 chars).
-- Ingest then uses this as a third dedup pass after URL match and
-- signature match. Same-titled products from any store pool into
-- one products.id row.
--
-- Why 120 chars: long titles ("Suitable for Beats Studio Pro DETOX
-- Recorder Professional Edition Earphone Cover Sponge Cover...")
-- often have identical first 120 chars across store variants; the
-- cap also bounds the key size and keeps the b-tree index lean.
--
-- Why alphanumeric-only: strips punctuation, spaces, smart quotes,
-- emoji, parentheses — any non-content drift between store-format
-- titles. The ingest computes the same normalisation in JS so the
-- key matches on both sides.
--
-- Idempotent — IF NOT EXISTS / IF NOT EXISTS on the index.
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS title_key text;

-- Backfill existing rows. regexp_replace removes everything that
-- isn't a-z/0-9 (after lowercase). Cap at 120 chars to match the
-- JS-side normaliseTitleKey.
UPDATE products
   SET title_key = SUBSTRING(
         LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '', 'g'))
         FROM 1 FOR 120
       )
 WHERE title_key IS NULL;

-- Index for fast equality lookups. Non-unique because two genuinely
-- distinct products CAN normalize to the same key (rare but
-- possible with very generic titles like "Universal Phone Case").
-- The ingest layer combines this with store-scoped checks, so
-- duplicates within a store get caught while genuine cross-store
-- collisions for different products stay separate.
CREATE INDEX IF NOT EXISTS products_title_key_idx
  ON products(title_key);

-- ── Verify after applying ─────────────────────────────────────────
-- Count NULL title_key (should be 0 after backfill):
--   SELECT count(*) FROM products WHERE title_key IS NULL;
--
-- Top duplicated title_keys (= the products we'd merge):
--   SELECT title_key, count(*) FROM products WHERE title_key IS NOT NULL
--    GROUP BY title_key HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 20;
