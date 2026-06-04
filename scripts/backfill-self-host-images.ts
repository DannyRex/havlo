#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Self-host product images into Supabase Storage (Phase 1 of #133).

   For every product whose image_url is still a merchant CDN URL (not yet
   re-hosted), fetch the image THROUGH the production /api/img-proxy -- so we
   reuse its per-host Referer rewrites, Kara og:image resolution, and SSRF
   allowlist (one source of truth, zero duplicated fetch logic) -- normalize
   it to a <=1000px webp, upload to the "product-images" bucket, and overwrite
   image_url with the public Storage URL (preserving the merchant URL in
   source_image_url). Idempotent: only touches rows where stored_image_at IS
   NULL; safe to re-run; resumes where it left off.

   PREREQS (USER, one-time): apply migration 0076 AND create a PUBLIC Storage
   bucket named exactly "product-images". Without them the script exits with a
   clear message (missing column) or simply fails every upload (missing
   bucket) and leaves rows untouched.

   Usage:
     npm run backfill:self-host-images -- --dry-run        # fetch+encode only
     npm run backfill:self-host-images -- --limit=200      # first 200 rows
     SITE=https://havlo.io npm run backfill:self-host-images
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { normalizeToWebp, uploadProductImage } from "../src/lib/providers/storage";

const SITE = process.env.SITE ?? "https://havlo.io";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith("--limit="));
  return a ? Math.max(0, parseInt(a.split("=")[1], 10) || 0) : 0; // 0 = no cap
})();
const CONCURRENCY = 8;

/* Fetch image bytes via the production img-proxy (handles Referer + Kara
   page->og:image + the SSRF allowlist). Returns null on any failure so the
   row is left on its merchant URL. */
async function fetchViaProxy(merchantUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${SITE}/api/img-proxy?url=${encodeURIComponent(merchantUrl)}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "havlo-image-rehost/1.0" },
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > 8_000_000) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    process.exit(1);
  }

  /* Worklist — has an image, not yet re-hosted. Paged off the base table. */
  const work: Array<{ id: string; image_url: string }> = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supa
      .from("products")
      .select("id, image_url")
      .not("image_url", "is", null)
      .is("stored_image_at", null)
      .range(from, from + PAGE - 1);
    if (error) {
      if (/stored_image_at|column .* does not exist/i.test(error.message)) {
        console.error("✗ Column stored_image_at missing — apply migration 0076 first.");
        process.exit(1);
      }
      console.error("✗ worklist fetch:", error.message);
      process.exit(1);
    }
    const rows = (data ?? []) as Array<{ id: string; image_url: string }>;
    work.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
    if (LIMIT && work.length >= LIMIT) break;
  }
  const todo = LIMIT ? work.slice(0, LIMIT) : work;
  console.log(`▶ ${todo.length} products to re-host (SITE=${SITE}${DRY_RUN ? ", DRY RUN" : ""})`);

  let hosted = 0, skipped = 0, failed = 0, done = 0;

  async function processOne(row: { id: string; image_url: string }): Promise<void> {
    const bytes = await fetchViaProxy(row.image_url);
    if (!bytes) { skipped++; return; }
    const webp = await normalizeToWebp(bytes);
    if (!webp) { skipped++; return; }
    if (DRY_RUN) { hosted++; return; }
    const storageUrl = await uploadProductImage(supa!, row.id, webp);
    if (!storageUrl) { failed++; return; }
    const { error } = await supa!
      .from("products")
      .update({
        source_image_url: row.image_url, // keep the merchant URL as fallback
        image_url:        storageUrl,
        stored_image_at:  new Date().toISOString(),
        image_processed:  0,             // 0 = raw re-host (Phase 1); Phase 2a trims
      })
      .eq("id", row.id);
    if (error) { failed++; return; }
    hosted++;
  }

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(processOne));
    done = Math.min(done + CONCURRENCY, todo.length);
    if (done % 200 === 0 || done === todo.length) {
      console.log(`  ${done}/${todo.length}  hosted=${hosted} skipped=${skipped} failed=${failed}`);
    }
  }

  console.log("");
  console.log(`✓ Done. hosted=${hosted} skipped(no-image/decode)=${skipped} failed(upload/db)=${failed}`);
  if (DRY_RUN) console.log("  (dry run — no uploads or DB writes)");
}

main().catch((e) => {
  console.error("✗ Fatal:", e);
  process.exit(1);
});
