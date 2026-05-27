/* ─────────────────────────────────────────────────────────────────
   0050 — Image perceptual hash (Phase 2 product-match upgrade)
   ─────────────────────────────────────────────────────────────────

   Adds `image_phash` to products. Stores a 64-bit perceptual hash
   (dHash variant: difference between consecutive pixels in a 9x8
   grayscale downscale, packed into a 64-bit integer). Same product
   photo across different stores produces near-identical hashes;
   Hamming distance &le; 6 between two hashes is a strong same-product
   signal.

   Why dHash and not pHash (DCT):
     dHash is faster, has no native deps beyond image decoding,
     and empirically matches DCT-pHash on cross-store product
     photos (which are usually the manufacturer's stock image
     republished by every retailer — high similarity, low
     transformation noise). DCT-pHash buys robustness against
     rotation/crop/recompression, none of which matter here.

   Stored as BIGINT, not bytea or text:
     - 64 bits fits exactly in PostgreSQL bigint (signed int64).
       Reinterpret-cast at the boundary; we never do arithmetic
       on the value, only XOR for Hamming.
     - Indexing is straightforward (btree on bigint).
     - Hamming distance via popcount() on the XOR is two
       arithmetic ops, no string parsing.

   Hamming distance function:
     `int8` doesn't have a native popcount, so we wrap the
     bit_count() function (PG 14+). Returns the number of 1-bits
     in the XOR of two hashes = number of bit positions where
     they differ. 0 = identical, 64 = fully inverted.

   Index strategy:
     A naive btree on image_phash supports point lookup ("two
     products with exactly this hash") but NOT range/proximity
     queries that Hamming requires. For 12k products we just
     do a sequential scan in the query path — acceptable at
     this scale. If we ever cross 100k products we'll need
     either a BK-tree extension or LSH bucketing — defer until
     that's a real problem. */

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_phash BIGINT;

CREATE INDEX IF NOT EXISTS idx_products_image_phash
  ON products (image_phash)
  WHERE image_phash IS NOT NULL;

COMMENT ON COLUMN products.image_phash IS
  '64-bit perceptual hash (dHash) of the product image, packed as signed bigint. NULL when image_url was missing/unfetchable. Two products with Hamming distance <= 6 are likely the same product photo.';

/* Hamming distance over the XOR of two 64-bit hashes. Uses
   PostgreSQL 14+ bit_count() on bigint via a cast to bit string.
   IMMUTABLE so it can be used in indexes / generated columns
   later if we want.

   Why IMMUTABLE: bit_count() depends only on the inputs (no
   timezone, no random source, no session state). Marking it
   PARALLEL SAFE lets the planner parallel-scan large products
   tables when the query is bounded by other predicates. */
CREATE OR REPLACE FUNCTION phash_hamming(a BIGINT, b BIGINT)
RETURNS INT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT bit_count((a # b)::bit(64))::INT
$$;

COMMENT ON FUNCTION phash_hamming(BIGINT, BIGINT) IS
  'Hamming distance between two 64-bit perceptual hashes. Returns 0-64; lower means more similar. Two product photos with distance <= 6 are likely the same image.';
