#!/usr/bin/env tsx
/* One-off: lift blurry self-hosted eBay images to eBay's full-size render.

   The eBay SerpAPI ingest historically stored the small s-l140 thumbnail
   (~140px), which self-hosts as a blurry webp. ~274 catalogue products carry
   one. This re-fetches each at s-l1600 (upgradeEbayImageUrl), normalizes to a
   <=1000px webp, re-uploads to the product-images bucket, and repoints
   image_url + source_image_url. The ingest path (search-ebay-serpapi) now
   writes s-l1600 from the start, so this only clears the existing backlog.

   Idempotent: after a successful upgrade source_image_url carries s-l1600, so
   the row no longer matches the worklist. Safe to re-run; a row that fails to
   fetch (transient / 404) is left untouched for the next run. image_phash is
   nulled so the maintenance re-hash recomputes it from the new, sharper image
   (a stale low-res hash would mis-pool); image_processed=0 mirrors the
   self-host backfill so the trim pass re-runs.

   Run:  SITE=... npx tsx scripts/maint/upgrade-ebay-image-res.ts
         npx tsx scripts/maint/upgrade-ebay-image-res.ts --dry-run
*/
try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }

import { getSupabaseAdmin } from "../../src/lib/providers/db-client";
import { normalizeToWebp, uploadProductImage } from "../../src/lib/providers/storage";
import { upgradeEbayImageUrl } from "../../src/lib/utils";

const DRY_RUN = process.argv.includes("--dry-run");
const CONCURRENCY = 16;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15";

/* i.ebayimg.com is a public CDN — no Referer needed (unlike the merchant hosts
   in backfill-self-host-images). Plain direct fetch. */
async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_UA, accept: "image/avif,image/webp,image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > 8_000_000) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

interface Row { id: string; orig: string; }

async function main(): Promise<void> {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    process.exit(1);
  }

  /* Worklist: products whose ORIGINAL eBay image — source_image_url for
     already-hosted rows, else image_url — is an i.ebayimg.com URL below the
     s-l1600 render. Paged off the base table. */
  const work: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from("products")
      .select("id, image_url, source_image_url")
      .or("source_image_url.ilike.*i.ebayimg.com*,image_url.ilike.*i.ebayimg.com*")
      .range(from, from + PAGE - 1);
    if (error) { console.error("✗ worklist:", error.message); process.exit(1); }
    const rows = (data ?? []) as Array<{ id: string; image_url: string | null; source_image_url: string | null }>;
    for (const r of rows) {
      const orig =
        r.source_image_url && /i\.ebayimg\.com/i.test(r.source_image_url) ? r.source_image_url
        : r.image_url && /i\.ebayimg\.com/i.test(r.image_url)             ? r.image_url
        : null;
      if (!orig || /s-l1600/i.test(orig)) continue; // missing or already max-res
      work.push({ id: r.id, orig });
    }
    if (rows.length < PAGE) break;
  }
  console.log(`▶ ${work.length} eBay products to upgrade${DRY_RUN ? " (DRY RUN)" : ""}`);

  let done = 0, upgraded = 0, skipped = 0, failed = 0;

  async function processOne(row: Row): Promise<void> {
    const hiRes = upgradeEbayImageUrl(row.orig);
    if (hiRes === row.orig) { skipped++; return; } // token already maxed / not rewritable
    const bytes = await fetchImage(hiRes);
    if (!bytes) { failed++; return; }              // transient / 404 — retry next run
    const webp = await normalizeToWebp(bytes);
    if (!webp) { failed++; return; }
    if (DRY_RUN) { upgraded++; return; }
    const storageUrl = await uploadProductImage(supa!, row.id, webp);
    if (!storageUrl) { failed++; return; }
    const { error } = await supa!
      .from("products")
      .update({
        image_url:        storageUrl,
        source_image_url: hiRes,
        stored_image_at:  new Date().toISOString(),
        image_processed:  0,
        image_phash:      null,
      })
      .eq("id", row.id);
    if (error) { failed++; return; }
    upgraded++;
  }

  for (let i = 0; i < work.length; i += CONCURRENCY) {
    await Promise.all(work.slice(i, i + CONCURRENCY).map(processOne));
    done = Math.min(done + CONCURRENCY, work.length);
    if (done % 64 === 0 || done === work.length) {
      console.log(`  ${done}/${work.length}  upgraded=${upgraded} skipped=${skipped} failed=${failed}`);
    }
  }
  console.log(`✓ Done. upgraded=${upgraded} skipped=${skipped} failed=${failed}${DRY_RUN ? " (dry run — no writes)" : ""}`);
}

main().catch((e) => { console.error("✗ Fatal:", e); process.exit(1); });
