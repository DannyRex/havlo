/* ─────────────────────────────────────────────────────────────────
   0049 — Product identifiers (GTIN / MPN / Google Shopping ID)
   ─────────────────────────────────────────────────────────────────

   Adds three columns to `products` that carry structured product
   identifiers harvested at ingest time. Each is a much stronger
   sameness signal than the current heuristic brand|model signature:

     gtin                — GTIN-8/12/13/14, EAN, UPC. Globally unique
                           per physical product. When two offers share
                           a GTIN they ARE the same product, full stop.

     mpn                 — Manufacturer Part Number. Brand-scoped
                           (different brands can reuse a string), so
                           the equivalence key is (brand, mpn).

     google_shopping_id  — Google Shopping's `product_id`. Cross-
                           merchant identifier returned by SerpAPI's
                           shopping endpoint. Already in the SerpShoppingResult
                           interface but never previously persisted —
                           we were throwing away a strong free signal.
                           Globally unique per Google-canonicalised
                           product.

   Why three columns and not one `external_id JSONB`:
     - Each has different uniqueness semantics (GTIN globally unique,
       MPN brand-scoped, gsh globally unique).
     - Partial unique indexes need typed columns, not JSONB extracts.
     - Querying is straightforward without ->> casts.

   Why TEXT and not BIGINT for GTIN:
     Leading zeros matter. "0194253775647" and "194253775647" are
     different GTINs (the first is GTIN-13 starting with 0; the second
     would be GTIN-12). Storing as text preserves the canonical form.

   Indexes:
     - Partial UNIQUE on gtin (NULLS not in index) → ingestion bulk-
       lookup `WHERE gtin IN (...)` is index-only.
     - Partial UNIQUE on google_shopping_id → same.
     - Partial composite (brand, mpn) → MPN is brand-scoped so the
       composite is the natural equivalence key; partial because most
       rows will have mpn=NULL.

   Backfill: no historical data — these columns populate going
   forward as ingestion writes new product rows. Within ~7 days of
   cron runs, mainstream-brand coverage should reach ~50%+ from
   Google Shopping product_id alone. */

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gtin               TEXT,
  ADD COLUMN IF NOT EXISTS mpn                TEXT,
  ADD COLUMN IF NOT EXISTS google_shopping_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_gtin_unique
  ON products (gtin)
  WHERE gtin IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_google_shopping_id_unique
  ON products (google_shopping_id)
  WHERE google_shopping_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand_mpn
  ON products (brand, mpn)
  WHERE mpn IS NOT NULL AND brand IS NOT NULL;

COMMENT ON COLUMN products.gtin IS
  'Global Trade Item Number (GTIN-8/12/13/14, EAN, UPC). Universal product identifier — two offers sharing a GTIN are the same product. Stored as TEXT to preserve leading zeros.';

COMMENT ON COLUMN products.mpn IS
  'Manufacturer Part Number. Brand-scoped (equivalence key is (brand, mpn) — different brands may reuse strings).';

COMMENT ON COLUMN products.google_shopping_id IS
  'Google Shopping product_id from SerpAPI. Cross-merchant identifier that survives across stores when Google has canonicalised the listing. Strong same-product signal, populated for free from existing SerpAPI calls.';
