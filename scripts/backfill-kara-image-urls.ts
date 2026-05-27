/* Backfill: set products.image_url = the Kara product PAGE URL for every
   Kara-anchored product whose image_url is currently NULL.
   ─────────────────────────────────────────────────────────────────
   The img-proxy's HTML_PAGE_HOSTS handler resolves these to a fresh
   og:image at request time, so a kara.com.ng product page URL now
   "is" a valid image URL from the rendering layer's perspective. This
   one-shot backfill recovers the 48 existing Kara products that the
   previous (correct) "no signed URLs" filter left image-less.

   Future Kara ingests already pick up this behaviour via the
   storeId === "kara" fallback in search-ng-merchant-serpapi.ts.

   Idempotent — only updates rows currently NULL. Safe to re-run.

   Usage:  npx tsx scripts/backfill-kara-image-urls.ts
*/

try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("Missing Supabase env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  /* Pull every offer from Kara, joined to its product, where the product's
     image_url is currently NULL. One offer per product (Kara is the only
     store anchoring these — single-store catalog). */
  const { data, error } = await supa
    .from("offers")
    .select("url, product_id, products!inner(id, title, image_url)")
    .eq("store_id", "kara")
    .is("products.image_url", null);

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log("No Kara products with NULL image_url. Nothing to backfill.");
    return;
  }

  console.log(`Backfilling ${data.length} Kara products...`);

  let updated = 0;
  let skipped = 0;
  for (const r of data as Array<{ url: string; product_id: string }>) {
    if (!r.url || !r.url.startsWith("https://kara.com.ng/")) {
      skipped++;
      continue;
    }
    const { error: updateErr } = await supa
      .from("products")
      .update({ image_url: r.url })
      .eq("id", r.product_id);
    if (updateErr) {
      console.error(`  FAIL ${r.product_id}: ${updateErr.message}`);
      continue;
    }
    updated++;
  }

  console.log(`Done. Updated ${updated} products${skipped > 0 ? ` (${skipped} skipped — non-kara URL)` : ""}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
