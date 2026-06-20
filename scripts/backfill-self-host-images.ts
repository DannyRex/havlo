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
import { isPlaceholderImageUrl } from "../src/lib/utils";

const SITE = process.env.SITE ?? "https://havlo.io";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith("--limit="));
  return a ? Math.max(0, parseInt(a.split("=")[1], 10) || 0) : 0; // 0 = no cap
})();
const CONCURRENCY = 32;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15";

/* Referer-gated merchant image hosts (the non-empty subset of
   /api/img-proxy's HOST_REFERER). Fetching these direct needs the merchant's
   own domain as Referer or they 4xx; everything else fetches with no Referer. */
const HOST_REFERER: Record<string, string> = {
  "m.media-amazon.com":              "https://www.amazon.com/",
  "images-na.ssl-images-amazon.com": "https://www.amazon.com/",
  "images-eu.ssl-images-amazon.com": "https://www.amazon.co.uk/",
  "media-amazon.com":                "https://www.amazon.com/",
  "images.asos-media.com":           "https://www.asos.com/",
  "ae-pic-a1.aliexpress-media.com":  "https://www.aliexpress.com/",
  "ae-pic-a1.aliexpress.com":        "https://www.aliexpress.com/",
  "ae01.alicdn.com":                 "https://www.aliexpress.com/",
  "i5.walmartimages.com":            "https://www.walmart.com/",
  "i5.walmartimages.ca":             "https://www.walmart.ca/",
  "pisces.bbystatic.com":            "https://www.bestbuy.com/",
  "media.currys.biz":                "https://www.currys.co.uk/",
  "johnlewis.scene7.com":            "https://www.johnlewis.com/",
  "media.johnlewiscontent.com":      "https://www.johnlewis.com/",
  "media.4rgos.it":                  "https://www.argos.co.uk/",
  "i.dell.com":                      "https://www.dell.com/",
  "image.boohooamplience.com":       "https://www.boohoo.com/",
  "img.shopstyle.com":               "https://www.shopstyle.com/",
};

function refererFor(host: string): string | null {
  if (host in HOST_REFERER) return HOST_REFERER[host];
  for (const [h, ref] of Object.entries(HOST_REFERER)) {
    if (host.endsWith("." + h)) return ref;
  }
  return null;
}

/* Fetch image bytes. DIRECT from the merchant (spreads connections across many
   origins -> real concurrency, and avoids the Vercel proxy round-trip) with
   the correct per-host Referer. Falls back to the production img-proxy for
   Kara (whose image_url is a PAGE URL the proxy resolves to a fresh og:image)
   and for any direct fetch that fails or returns non-image bytes. */
/* Returns the image bytes, plus `nonImage` = true when a fetch returned 200 with
   a NON-image content-type (i.e. the "image_url" is actually a PAGE URL, not an
   image). That case is permanent — it can never become an image — so the caller
   nulls it. A failed/blocked fetch (403, timeout) leaves nonImage=false so it's
   retried next run instead of being thrown away. */
async function fetchImage(merchantUrl: string): Promise<{ bytes: Buffer | null; nonImage: boolean }> {
  let host = "";
  try { host = new URL(merchantUrl).hostname; } catch { return { bytes: null, nonImage: false }; }
  let nonImage = false;
  const isPageCt = (ct: string) => !ct.startsWith("image/") && (ct.startsWith("text/") || ct.includes("html") || ct.includes("json"));

  const karaPage = host === "kara.com.ng" || host.endsWith(".kara.com.ng");
  if (!karaPage) {
    try {
      const headers: Record<string, string> = {
        "user-agent": BROWSER_UA,
        "accept": "image/avif,image/webp,image/*,*/*",
      };
      const ref = refererFor(host);
      if (ref) headers["referer"] = ref;
      const res = await fetch(merchantUrl, { headers, redirect: "follow", signal: AbortSignal.timeout(15_000) });
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && ct.startsWith("image/")) {
        const ab = await res.arrayBuffer();
        if (ab.byteLength > 0 && ab.byteLength <= 8_000_000) return { bytes: Buffer.from(ab), nonImage: false };
      } else if (res.ok && isPageCt(ct)) {
        nonImage = true;   // a product PAGE served where an image was expected
      }
    } catch { /* transient — fall through to the proxy */ }
  }

  /* Proxy fallback (Kara og:image, or a direct fetch that didn't yield an image). */
  try {
    const res = await fetch(`${SITE}/api/img-proxy?url=${encodeURIComponent(merchantUrl)}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "havlo-image-rehost/1.0" },
    });
    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.startsWith("image/")) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 0 && ab.byteLength <= 8_000_000) return { bytes: Buffer.from(ab), nonImage: false };
      return { bytes: null, nonImage };
    }
    if (res.ok && isPageCt(ct)) nonImage = true;
    return { bytes: null, nonImage };
  } catch {
    return { bytes: null, nonImage };
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
    /* A literal "no image" placeholder (older ingest, or a feed not guarded at
       ingest time) must never be hosted -- it would leak a foreign placeholder
       into our cards and collide dozens of unrelated products to one hash.
       Null the pointer so the Havlo fallback renders, and clear any phash so it
       can't drive pooling. */
    if (isPlaceholderImageUrl(row.image_url)) {
      if (!DRY_RUN) {
        await supa!.from("products").update({ image_url: null, image_phash: null }).eq("id", row.id);
      }
      skipped++;
      return;
    }
    const { bytes, nonImage } = await fetchImage(row.image_url);
    if (!bytes) {
      /* A URL that resolves to a PAGE (HTML), not an image, can never become an
         image (the Kara product-page-URL class). Null it so the card shows the
         clean empty-state instead of a broken image, and clear any phash. A
         transient/blocked fetch (403/timeout) is left for the next run to retry. */
      if (nonImage && !DRY_RUN) {
        await supa!.from("products").update({ image_url: null, image_phash: null }).eq("id", row.id);
      }
      skipped++;
      return;
    }
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
