-- 0076-self-host-product-images.sql
-- Self-host product images in Supabase Storage (bucket "product-images").
--
-- Why: today products.image_url is a raw merchant CDN URL (Google Shopping
-- thumbnails, ASOS/AliExpress/Konga CDNs...). They are fragile (hotlink
-- breakage = black cards), referer-gated, and -- crucially for matching --
-- product-on-white-background photos make the perceptual hash (dHash)
-- degenerate (many unrelated products collapse to one bit-identical hash),
-- which is why image-based pooling is currently unsafe.
--
-- Design: image_url is OVERWRITTEN IN PLACE with the public Storage URL once
-- an image is re-hosted, so EVERY reader -- browse_deals, search_products_fts,
-- the materialized cheapest-offer view (0075), and all components -- serves
-- the Storage URL with ZERO RPC/view/component changes. The original merchant
-- URL is preserved in source_image_url for re-processing + dead-image recovery.
--
-- USER SETUP (besides applying this migration):
--   1. Create a PUBLIC Storage bucket named exactly "product-images"
--      (Supabase dashboard -> Storage -> New bucket -> tick "Public bucket").
--   2. Nothing else -- uploads use the existing SUPABASE_SERVICE_ROLE_KEY;
--      no new env var. Public-read is correct (these images are already
--      public on the merchant sites) and lets the Storage CDN cache them.
--
-- ROLLBACK: drop the three columns + the index below. image_url rows already
-- overwritten with Storage URLs keep working (the objects stay in the bucket);
-- to revert those, copy source_image_url back into image_url.

alter table products
  add column if not exists source_image_url text,         -- original merchant CDN URL (fallback / re-process source)
  add column if not exists stored_image_at  timestamptz,  -- when image_url was last re-hosted to Storage
  add column if not exists image_processed   smallint;    -- NULL=not hosted, 0=rehosted raw, 1=trimmed (P2a), 2=bg-removed (P2b)

comment on column products.source_image_url is
  'Original merchant CDN image URL. products.image_url is overwritten with the Supabase Storage public URL once re-hosted; this preserves the source for re-processing / dead-image recovery.';

-- Worklist index: rows that have an image but have not been re-hosted yet.
create index if not exists idx_products_unhosted
  on products (id) where image_url is not null and stored_image_at is null;
