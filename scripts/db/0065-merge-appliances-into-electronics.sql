-- ──────────────────────────────────────────────────────────────────
-- Merge the "appliances" category into "electronics".
--
-- Founder direction May 2026: collapse Appliances and Electronics into
-- a single browsable category. Appliances (fridges, washers, ACs,
-- vacuums, kitchen appliances, generators) are now surfaced under the
-- Electronics slug, displayed as "Electronics & Appliances" in the UI.
--
-- Why: the two categories had thin, overlapping inventory and split the
-- catalog's cross-store comparison value across two tiles. One merged
-- category gives a denser, more useful browse + comparison surface.
--
-- This migration relabels every existing row. The application code
-- shipped in the same change routes all future ingest to "electronics":
--   · src/lib/categorize.ts            — appliance title rules now
--                                        return slug "electronics"
--                                        (+ washing-machine / AC /
--                                        generator / fan / iron rules)
--   · src/lib/providers/*              — provider category inference
--                                        returns "electronics"
--   · scripts/scrapers/types.ts        — CATEGORY_MAP "appliances" key
--                                        resolves to the electronics slug
--   · src/lib/data/categories.ts       — Appliances tile removed;
--                                        Electronics renamed
--                                        "Electronics & Appliances"
-- So no new "appliances" rows can be written after this applies.
--
-- SAFETY:
--   · Non-destructive: relabels category_slug only. No rows deleted,
--     no offers/price-history touched. Products keep every other field.
--   · Targets ONLY category_slug = 'appliances'. Every other category
--     is untouched.
--   · Idempotent. Re-runs update zero rows once the merge is done
--     (nothing matches 'appliances' anymore).
--   · NOTE (one-way): after this runs you can no longer distinguish
--     which electronics rows were formerly appliances — that's the
--     intended effect of a merge. If a future split is ever needed it
--     must be re-derived from titles via categorize.ts, not from a
--     preserved flag.
-- ──────────────────────────────────────────────────────────────────

-- Diagnostic (uncomment to size the blast radius first):
--
--   select count(*) as appliance_rows
--   from products
--   where category_slug = 'appliances';

update products
set category_slug = 'electronics'
where category_slug = 'appliances';


-- ── Verification ──────────────────────────────────────────────────
--   -- Should return 0 immediately after this migration applies.
--   select count(*)
--   from products
--   where category_slug = 'appliances';
--
--   -- The electronics bucket should have grown by the former
--   -- appliance count. Spot-check that fridges/washers/vacuums now
--   -- report category_slug = 'electronics'.
--   select category_slug, count(*)
--   from products
--   where title ~* '\m(fridge|refrigerator|washer|washing machine|vacuum|air fryer|microwave)\M'
--   group by category_slug;
