/* ─────────────────────────────────────────────────────────────────
   Perceptual image hashing (dHash) for cross-store product matching.

   Why dHash:
     dHash = "difference hash". Resize the image to (W+1)×H grayscale,
     then for each row compute pixel[c] > pixel[c+1] for c in 0..W-1.
     Pack the W*H boolean comparisons into a 64-bit integer when
     W=8, H=8 → 64 bits exactly. Fast, robust to scaling/recompression,
     and especially well-suited to product photography (where the
     same manufacturer image is rebroadcast by every retailer).

     pHash (DCT-based) is more robust to rotation/crop but slower
     and overkill for our domain. dHash matches DCT-pHash quality
     on stock product images while costing ~3x less compute.

   Hash representation:
     64 bits packed into BigInt internally, then reinterpret-cast to
     signed int64 for PostgreSQL bigint storage. JavaScript's Number
     type loses precision past 53 bits, so all bit operations stay
     in BigInt until the final cast.

   Hamming distance:
     The DB has phash_hamming() (migration 0050) for query-path use.
     This module exposes hammingDistance() for any JS-side comparison
     that doesn't want a round-trip.

   Dependencies:
     `sharp` (native, fast) for decoding + downsampling. Already
     in deps as of Phase 2.
   ───────────────────────────────────────────────────────────────── */

import sharp from "sharp";

/* dHash grid dimensions. 9x8 = 72 pixels, producing 8*8=64
   comparisons after the row-pair difference, packing exactly
   into a 64-bit integer. */
const HASH_W = 9;
const HASH_H = 8;

/* Cap fetch size at 5MB. Product images are typically 50-500KB;
   anything larger is likely an editorial image or a misrouted
   asset. Reject early to keep the backfill worker pool healthy. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/* Cap fetch time at 8s per image. Slow CDNs (Kara's R2, some
   AWS S3 buckets in distant regions) routinely take 3-4s; 8s is
   generous without blocking the worker pool. */
const FETCH_TIMEOUT_MS = 8_000;

/** Convert a 64-bit unsigned bigint to its signed-int64 representation
    so it round-trips through PostgreSQL's BIGINT column. JS bigints
    are arbitrary-precision so the cast is just "if top bit set,
    subtract 2^64". */
function uint64ToSignedBigInt(u: bigint): bigint {
  return u >= BigInt(1) << BigInt(63) ? u - (BigInt(1) << BigInt(64)) : u;
}

/** Reverse of the above — signed bigint from DB → unsigned for
    bit-twiddling. Useful for hammingDistance below. */
function signedToUint64(s: bigint): bigint {
  return s < BigInt(0) ? s + (BigInt(1) << BigInt(64)) : s;
}

/** Compute the dHash of an image buffer. Returns a signed 64-bit
    BigInt suitable for direct insert into a PostgreSQL BIGINT
    column, or null if the buffer isn't decodable as an image.

    Pipeline:
      1. Decode + resize to 9x8 grayscale (sharp does both in one
         GPU/SIMD pass when available).
      2. Read raw 72-byte pixel array.
      3. For each row r in 0..7, for each col c in 0..7: bit at
         position (r*8 + c) = 1 iff pixel[r][c] > pixel[r][c+1].
      4. Pack into a 64-bit bigint.
      5. Convert to signed-int64 representation for PG. */
export async function computeImagePHash(imageBuffer: Buffer): Promise<bigint | null> {
  try {
    const pixels = await sharp(imageBuffer)
      .resize(HASH_W, HASH_H, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();
    /* Sanity: sharp must return exactly W*H bytes for 8-bit greyscale. */
    if (pixels.length !== HASH_W * HASH_H) return null;

    let hash = BigInt(0);
    let bit = 0;
    for (let r = 0; r < HASH_H; r++) {
      for (let c = 0; c < HASH_W - 1; c++) {
        const left  = pixels[r * HASH_W + c];
        const right = pixels[r * HASH_W + c + 1];
        if (left > right) {
          hash |= BigInt(1) << BigInt(bit);
        }
        bit++;
      }
    }
    return uint64ToSignedBigInt(hash);
  } catch {
    /* Decode failure (corrupt image, unsupported format, truncated
       fetch). Caller should retry with a different source if
       available, or fall back to NULL. */
    return null;
  }
}

/** Fetch + hash in one call. Returns null on any failure (network
    timeout, non-2xx, oversize body, decode error). All exceptions
    are swallowed — the backfill caller treats failure as "no hash
    for this product" and moves on. */
export async function fetchAndHashImage(imageUrl: string): Promise<bigint | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, {
      headers: {
        /* Real-browser UA — some retailer CDNs (especially Amazon /
           ASOS / AliExpress) 403 on obvious bot UAs. */
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 " +
          "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) return null;

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_IMAGE_BYTES) return null;
    return await computeImagePHash(Buffer.from(arrayBuf));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** JS-side Hamming distance between two signed-int64 hashes (as
    PG returns them). Returns 0-64; lower = more similar.

    Mirrors the DB function `phash_hamming(BIGINT, BIGINT)` so
    code paths that already have both hashes in memory don't have
    to round-trip to the database. */
export function hammingDistance(a: bigint, b: bigint): number {
  const ua = signedToUint64(a);
  const ub = signedToUint64(b);
  let xor = ua ^ ub;
  let count = 0;
  while (xor !== BigInt(0)) {
    xor &= xor - BigInt(1);
    count++;
  }
  return count;
}

/** Threshold below which two images are considered "same product".
    6 / 64 bits = ~10% bit-difference — empirically the right cut
    for stock product photos. Tighter (<= 3) misses recompression
    artifacts; looser (> 8) admits visually-similar-but-different
    items (e.g. two different colorways of the same shoe). */
export const PHASH_SAME_PRODUCT_THRESHOLD = 6;
