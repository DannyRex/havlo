-- ──────────────────────────────────────────────────────────────────
-- One-time cleanup of "give-up" signatures that the May 2026
-- signature-leak audit surfaced.
--
-- Context: previous buildSignature() wrote `brand|?` whenever it
-- could find a brand but not a model in the title ("Samsung 65"
-- Smart TV" → `samsung|?`) and `?|?` when neither extracted. The
-- audit found these wallpaper-pattern signatures grouping unrelated
-- products together:
--
--   sig="samsung|?"   70 products  (TVs + fridges + earbuds + ACs)
--   sig="fenty|?"     81 products  (Skin sets + lipsticks + glosses)
--   sig="puma|?"      62 products
--   sig="adidas|?"    61 products
--   sig="maybelline|?" 46 products
--   sig="lg|?"        37 products  (vacuums + soundbars + OLED TVs)
--   sig="apple|?"     29 products  (AirTag + 3rd-party trackers + iPhone SE)
--   sig="xiaomi|?"    29 products
--   sig="?|?"      12,250 products  (~69% of catalog — Fashion / Beauty)
--
-- Downstream consumers (similar-products rails, compare anchor pool,
-- FTS clustering by `signature`) trusted this grouping and surfaced
-- wrong "siblings" / wrong anchor candidates. Setting these to NULL
-- opts those rows out of heuristic clustering — they continue to
-- dedupe across stores via the `title_key` column, which is the
-- right signal for descriptive titles where the regex matcher
-- couldn't anchor on a known model.
--
-- The matching code path in src/lib/providers/ingestion.ts (Step 2,
-- "Bulk lookup by signature") already filters by `o.canDedup` which
-- requires non-null brand AND model in the parsed signature — so
-- nulling these rows doesn't break re-ingest dedup. The null rows
-- still get re-anchored by title_key in Step 2b.
--
-- Idempotent: re-runs are no-ops (the filter only matches the
-- "?" pattern).
-- ──────────────────────────────────────────────────────────────────

update products
set signature = null
where signature is not null
  and (
    signature = '?|?'
    or signature = '?'
    or signature like '%|?'   -- "brand|?" pattern (LG|?, samsung|?, etc.)
    or signature like '?|%'   -- "?|model" pattern (rare but possible)
  );


-- ── Verification after applying ────────────────────────────────────
--   -- Should report ~12,750 — the affected row count above
--   -- (12,250 "?|?" + the brand|? cluster total). After re-running,
--   -- should report 0.
--
--   select count(*)
--   from products
--   where signature like '%|?' or signature like '?|%' or signature = '?|?' or signature = '?';
--
--   -- Sanity check: count of products with usable rich signatures
--   -- (brand|model[|inches]) — this number should not have changed.
--
--   select count(*)
--   from products
--   where signature is not null and signature not like '%?%';
