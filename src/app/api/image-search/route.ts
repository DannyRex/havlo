import { NextRequest, NextResponse } from "next/server";
import { computeImagePHash } from "@/lib/search/phash";
import { findNearestByPhash } from "@/lib/search/phash-index";

/* sharp is a native module — it can't run on the Edge runtime. Pin
   this route to Node so computeImagePHash can decode + downsample the
   uploaded image. */
export const runtime = "nodejs";

/* Uploads are unique per request; never cache. */
const NO_STORE = { "Cache-Control": "no-store" };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/* Accept threshold for an UPLOADED image.

   The variant matcher uses PHASH_SAME_PRODUCT_THRESHOLD = 6 for
   server-to-server comparison (two catalog images of the same
   product). An upload is noisier: the browser/OS may re-encode and
   resize the file the user picked, adding a few bits even when it's
   the SAME stock photo a retailer published. 10/64 absorbs that
   recompression while still cleanly rejecting a real-world camera
   photo of the product (different angle/lighting/background sits far
   past ~15 bits). This is inherent to dHash — it matches near-
   identical images (screenshots, saved product photos), not arbitrary
   snapshots. We do NOT fall back to a paid vision API to cover that
   gap; the local algorithm is the whole feature. */
const UPLOAD_MATCH_THRESHOLD = 10;

export async function POST(req: NextRequest) {
  /* Parse the multipart body. A malformed/non-multipart POST throws
     here — treat it as a bad request rather than a 500. */
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("image");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json(
      { error: "Send the image as multipart/form-data with an 'image' field." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!file) {
    return NextResponse.json({ error: "No image provided." }, { status: 400, headers: NO_STORE });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image is too large (5MB max)." }, { status: 413, headers: NO_STORE });
  }
  /* Some browsers omit type on drag-drop; only reject when a type is
     present AND clearly not an image. computeImagePHash is the real
     gate — it returns null for anything sharp can't decode. */
  if (file.type && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "That file is not an image." }, { status: 415, headers: NO_STORE });
  }

  let phash: bigint | null = null;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    phash = await computeImagePHash(buf);
  } catch {
    phash = null;
  }
  if (phash === null) {
    return NextResponse.json(
      { error: "Could not read that image. Try a JPG, PNG, or WebP." },
      { status: 422, headers: NO_STORE },
    );
  }

  try {
    const nearest = await findNearestByPhash(phash);
    const match =
      nearest && nearest.distance <= UPLOAD_MATCH_THRESHOLD
        ? { productId: nearest.productId, title: nearest.title, distance: nearest.distance }
        : null;
    return NextResponse.json({ match }, { headers: NO_STORE });
  } catch (err) {
    console.error("[/api/image-search]", err);
    return NextResponse.json(
      { error: "Image search is unavailable right now." },
      { status: 503, headers: NO_STORE },
    );
  }
}
