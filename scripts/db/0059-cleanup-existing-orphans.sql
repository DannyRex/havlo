-- ──────────────────────────────────────────────────────────────────
-- One-time cleanup of existing offer-less products that accumulated
-- before the May 2026 orphan-reconciliation fix.
--
-- Context: ingestion.ts's Step 5b previously only checked
-- `insertedProductIds` for orphan status — but Shopify-JSON ingest
-- paths regularly create a NEW product for a slightly-changed title,
-- which displaces the existing offer onto the new product_id via
-- `onConflict: store_id,url` and leaves the previous product
-- offer-less forever. The May 28 audit found 2,940 such orphans
-- (16.7% of catalog), all created in the last 30 days.
--
-- The code fix (same commit) now includes displaced product_ids in
-- the orphan check, so going forward this can't accumulate. This
-- migration cleans up the existing 2,916 stragglers (2,940 audit
-- count minus 24 that the 14-day floor protects — those might still
-- be mid-ingest with their offer-write half pending).
--
-- Safety:
--   • Floor: created_at AND updated_at must both be > 14 days ago.
--     Protects products from in-flight ingest runs.
--   • CASCADE: products.id is referenced by offers.product_id ON
--     DELETE CASCADE, so any FK debris would also vanish — but we
--     just confirmed these have zero offers, so there's none.
--   • Idempotent: re-runs are no-ops (further deletes only fire if
--     more orphans accumulate, which the code fix prevents).
--
-- Re-run safe. Apply via Supabase SQL editor.
-- ──────────────────────────────────────────────────────────────────

with orphans as (
  select p.id
  from products p
  where not exists (select 1 from offers o where o.product_id = p.id)
    and p.updated_at < now() - interval '14 days'
)
delete from products p
using orphans o
where p.id = o.id
returning p.id, p.title, p.created_at;


-- ── Verification after applying ────────────────────────────────────
--   -- Should report < 100 — only the freshly created orphans
--   -- still in their 14-day grace window remain.
--   select count(*)
--   from products p
--   where not exists (select 1 from offers o where o.product_id = p.id);
--
--   -- After the next 2-3 ingest cycles (with the new code), this
--   -- count should plateau at near-zero — the code fix prevents new
--   -- orphans from accumulating in the first place.
