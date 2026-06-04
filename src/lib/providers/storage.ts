/* Self-hosted product images in Supabase Storage.

   Re-host fragile merchant CDN images into our own public bucket
   ("product-images") so cards never break on hotlink failure, and so the
   image we hash/serve is a normalized, card-sized webp under our control.
   image_url is overwritten in place with the public Storage URL (see
   migration 0076); the merchant URL is kept in products.source_image_url.

   Server-only (sharp native binary + service-role Storage writes). Used by
   scripts/backfill-self-host-images.ts and the ingest post-pass. */

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGE_BUCKET = "product-images";

/* Decode any merchant image and re-encode to a small, card-appropriate webp:
   honour EXIF rotation, downscale to <=1000px (no enlargement), strip
   metadata, webp q82. Returns null on decode failure (corrupt bytes, an HTML
   error page, a non-image) so the caller can leave the row on its merchant
   URL rather than store garbage.

   Phase 2a will add `.trim()` here (behind a flag) to crop the uniform
   background so the product fills the frame and the dHash stops collapsing
   white-background shots to a degenerate value. */
export async function normalizeToWebp(buf: Buffer): Promise<Buffer | null> {
  try {
    const out = await sharp(buf)
      .rotate()
      .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/* Upload a processed image under a deterministic key (so re-processing
   overwrites in place) and return its public URL, or null on failure (the
   caller then leaves products.image_url on the merchant URL). */
export async function uploadProductImage(
  supa: SupabaseClient,
  productId: string,
  webp: Buffer,
): Promise<string | null> {
  const key = `${productId}.webp`;
  const { error } = await supa.storage.from(PRODUCT_IMAGE_BUCKET).upload(key, webp, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "2592000", // 30d; Storage sits behind a CDN so warm objects don't re-egress
  });
  if (error) return null;
  return supa.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(key).data.publicUrl;
}
