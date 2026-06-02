-- ──────────────────────────────────────────────────────────────────
-- Migration 0066: browse_deals — optional time-rotating seed (#17)
--
-- Problem (QA, June 2026): the homepage trending grid + /deals feed
-- "feel like the same things every time". The catalog is NOT the
-- limit — there are thousands of qualifying deals per market (UK 6,442
-- / 3,455 at >=15% off; NG 9,540 / 3,837). The limit is that every
-- fetch returns the SAME top-p_max_rows slice ranked by discount, and
-- discount % barely moves day to day, so the visible pool is static.
-- App-side widening (bigger pool caps + wider jitter) helped, but it
-- can only reshuffle the rows already fetched.
--
-- This migration lets the FETCH itself rotate across the catalog over
-- time, with NO extra egress per request (same p_max_rows), and WITHOUT
-- burying the best deals.
--
-- How: a new trailing parameter `p_rotate_seed bigint DEFAULT 0`.
--   • p_rotate_seed = 0  → behaviour IDENTICAL to 0042 (the default, so
--                          every existing 9-arg caller is unaffected).
--   • p_rotate_seed <> 0 → for the discount sort, the fine-grained
--                          "discount DESC" is replaced by a COARSE
--                          10-point discount BAND DESC (so a 45%-off
--                          deal still outranks a 15%-off one), and
--                          WITHIN each band rows are ordered by a stable
--                          hash of (offer_id, seed). Same seed → same
--                          order (cache-friendly); a new seed (the next
--                          time window) → a fresh draw of which deals in
--                          each quality band surface. Over a full cycle
--                          the whole catalog gets airtime.
--
-- Intended app wiring (apply AFTER this migration is live — see the
-- handoff note at the bottom): browse-db.ts passes
--   p_rotate_seed: <a per-time-window integer>, e.g.
--   Math.floor(Date.now() / 3_600_000)   // rotates hourly
-- so the seed advances once per window and lands cleanly on the edge
-- cache. A per-country component isn't required (the hash is on the
-- per-offer offer_id, so each country's pool already permutes
-- independently for the same seed), but folding it in is harmless.
--
-- Safety:
--   • Purely additive + backward-compatible (new param defaults to 0).
--   • STABLE, same as before — no writes, read-only.
--   • Uses hashtextextended (IMMUTABLE, Postgres 11+; Supabase is 15+).
--   • search_deals_fts is intentionally untouched (search wants exact
--     relevance, not rotation).
--
-- Idempotent — drops the prior 9-arg signature, then CREATEs the
-- 10-arg version. A 9-arg named call resolves to this function with
-- p_rotate_seed defaulting to 0, so nothing breaks pre-app-wiring.
-- ──────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS browse_deals(text, integer, text, text, text, text[], integer, boolean, text);

CREATE OR REPLACE FUNCTION browse_deals(
  p_category     text DEFAULT NULL,
  p_min_discount integer DEFAULT 0,
  p_sort         text DEFAULT 'discount',
  p_search       text DEFAULT NULL,
  p_origin       text DEFAULT 'all',
  p_store_ids    text[] DEFAULT NULL,
  p_max_rows     integer DEFAULT 6000,
  p_zero_discount_only boolean DEFAULT false,
  p_country      text DEFAULT NULL,
  p_rotate_seed  bigint DEFAULT 0          -- #17: 0 = legacy order; <>0 = rotate
)
RETURNS TABLE (
  product_id        uuid,
  title             text,
  category_slug     text,
  brand             text,
  image_url         text,
  offer_id          uuid,
  store_id          text,
  url               text,
  current_price     numeric(12,2),
  original_price    numeric(12,2),
  discount_percent  integer,
  currency          text,
  scraped_at        timestamptz,
  store_name        text,
  is_international  boolean,
  store_logo_url    text,
  store_country     text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pbo.product_id,
    pbo.title,
    pbo.category_slug,
    pbo.brand,
    pbo.image_url,
    pbo.offer_id,
    pbo.store_id,
    pbo.url,
    pbo.current_price,
    pbo.original_price,
    pbo.discount_percent,
    pbo.currency,
    pbo.scraped_at,
    pbo.store_name,
    pbo.is_international,
    pbo.store_logo_url,
    pbo.store_country
  FROM product_best_offers pbo
  WHERE (p_category IS NULL OR p_category = 'all' OR pbo.category_slug = p_category)
    AND (p_zero_discount_only = false OR COALESCE(pbo.discount_percent, 0) = 0)
    AND (p_zero_discount_only = true  OR COALESCE(p_min_discount, 0) = 0 OR COALESCE(pbo.discount_percent, 0) >= p_min_discount)
    AND (p_search IS NULL OR pbo.title ILIKE '%' || p_search || '%')
    AND (p_origin = 'all'
         OR (p_origin = 'local' AND (
              (p_country IS NOT NULL AND pbo.store_country = upper(p_country))
              OR (p_country IS NULL AND pbo.is_international = false)
            ))
         OR (p_origin = 'intl'  AND pbo.is_international = true))
    AND (p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL OR pbo.store_id = ANY(p_store_ids))
    AND (p_country IS NULL
         OR pbo.store_country = upper(p_country)
         OR (pbo.store_country IS NULL AND pbo.is_international = true))
  ORDER BY
    -- 1. Country-local stores first (unchanged).
    CASE WHEN p_country IS NOT NULL AND pbo.store_country = upper(p_country) THEN 0 ELSE 1 END,
    -- 2. Zero-discount-only fallback pool: newest first (unchanged).
    CASE WHEN p_zero_discount_only THEN pbo.scraped_at END DESC NULLS LAST,
    -- 3a. Discount sort, NOT rotating: full-resolution discount DESC
    --     (identical to 0042 — fires only when p_rotate_seed = 0).
    CASE WHEN p_sort = 'discount' AND p_rotate_seed = 0
         THEN COALESCE(pbo.discount_percent, 0) END DESC NULLS LAST,
    -- 3b. Discount sort, ROTATING: coarse 10-point discount band DESC so
    --     strong discounts still lead, then the seeded hash (term 5)
    --     reshuffles WITHIN each band per time window (#17).
    CASE WHEN p_sort = 'discount' AND p_rotate_seed <> 0
         THEN floor(COALESCE(pbo.discount_percent, 0) / 10.0)::int END DESC NULLS LAST,
    -- 4. Other sort dimensions (unchanged; rotation doesn't reorder
    --    these beyond ties, which the hash term handles).
    CASE WHEN p_sort = 'newest'     THEN pbo.scraped_at    END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc'  THEN pbo.current_price END ASC  NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN pbo.current_price END DESC NULLS LAST,
    -- 5. Rotation tiebreak: a STABLE hash of (offer_id, seed). Same seed
    --    → same order (so the response still caches cleanly); a new seed
    --    (next time window) → a fresh permutation. NULL when not rotating,
    --    so it has zero effect on the legacy path.
    CASE WHEN p_rotate_seed <> 0
         THEN hashtextextended(pbo.offer_id::text, p_rotate_seed) END ASC NULLS LAST,
    -- 6. Final stable tiebreak (also the full secondary order when seed = 0).
    COALESCE(pbo.discount_percent, 0) DESC NULLS LAST,
    pbo.offer_id ASC
  LIMIT p_max_rows;
$$;

-- ── Sanity checks (run manually in the Supabase SQL editor) ──────────
--   -- 1. Legacy path unchanged (seed defaults to 0): should match the
--   --    pre-migration top rows exactly.
--   SELECT offer_id, discount_percent FROM browse_deals(
--     p_country => 'uk', p_min_discount => 15, p_max_rows => 20);
--
--   -- 2. Two different seeds return DIFFERENT orderings of the SAME
--   --    quality bands (top discounts still lead in both):
--   SELECT offer_id, discount_percent FROM browse_deals(
--     p_country => 'uk', p_min_discount => 15, p_max_rows => 20, p_rotate_seed => 1);
--   SELECT offer_id, discount_percent FROM browse_deals(
--     p_country => 'uk', p_min_discount => 15, p_max_rows => 20, p_rotate_seed => 2);
--   -- Expect: top rows are still high-discount in both, but the specific
--   -- offer_ids within each ~10-point band differ between seed 1 and 2.
--
-- ── App handoff (do AFTER this migration is live) ───────────────────
-- In src/lib/providers/browse-db.ts, add `p_rotate_seed` to the
-- browse_deals .rpc({...}) calls (Pass A / Pass C), e.g.:
--     p_rotate_seed: Math.floor(Date.now() / 3_600_000)   // hourly
-- and include that window in the unstable_cache / edge-cache key so each
-- window gets one fresh shuffle. Trending (TrendingDeals.fetchPoolCached)
-- can pass the same seed. Until the app passes a non-zero seed, this
-- migration is a no-op — safe to apply on its own.
