#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   One-time (re-runnable) sweep: null the image pointer for products whose
   image is a literal "no image" placeholder graphic.

   Some merchant feeds hand us a single grey "no image available" PNG as the
   product image (a pharmacy Shopify template, medplus's image-place-holder.png,
   ...). The self-host backfill copied those into our Storage, so they LOAD and
   the UI shows the foreign placeholder instead of the Havlo fallback -- and the
   identical bytes collapse dozens of unrelated products to one perceptual-hash.

   Going forward this is blocked at the source: ingestion.ts drops placeholder
   URLs at upsert, and the self-host backfill nulls any that slip through. This
   script cleans the rows that were stored BEFORE those guards existed. It
   checks source_image_url (the original merchant URL, preserved when we
   re-hosted) AND image_url, and on a match sets image_url=NULL + image_phash=
   NULL so the Havlo fallback renders and the hash can't drive pooling.

   Idempotent. Usage:
     npm run cleanup:placeholder-images -- --dry-run
     npm run cleanup:placeholder-images
   ────────────────────────────────────────────────────────────────── */
try { /* @ts-expect-error Node 20.6+ */ process.loadEnvFile?.(".env.local"); } catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { isPlaceholderImageUrl } from "../src/lib/utils";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

  type Row = { id: string; title: string; image_url: string | null; source_image_url: string | null };
  const rows: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from("products")
      .select("id, title, image_url, source_image_url")
      .range(from, from + PAGE - 1);
    if (error) { console.error("✗ fetch:", error.message); process.exit(1); }
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const hits = rows.filter((r) => isPlaceholderImageUrl(r.source_image_url) || isPlaceholderImageUrl(r.image_url));
  console.log(`Scanned ${rows.length} products. ${hits.length} have a literal placeholder image.${DRY_RUN ? " (DRY RUN)" : ""}`);
  for (const h of hits.slice(0, 12)) console.log(`  - ${h.title.slice(0, 50).padEnd(50)} ${(h.source_image_url ?? h.image_url ?? "").slice(0, 70)}`);
  if (hits.length > 12) console.log(`  ... +${hits.length - 12} more`);

  if (DRY_RUN || hits.length === 0) { if (DRY_RUN) console.log("Dry run: no writes."); return; }

  let cleared = 0, failed = 0;
  const CONCURRENCY = 16;
  for (let i = 0; i < hits.length; i += CONCURRENCY) {
    await Promise.all(hits.slice(i, i + CONCURRENCY).map(async (h) => {
      /* Keep source_image_url as the record of what the feed gave us. */
      const { error } = await supa.from("products").update({ image_url: null, image_phash: null }).eq("id", h.id);
      if (error) failed++; else cleared++;
    }));
  }
  console.log(`✓ Cleared ${cleared} placeholder pointers (image_url + image_phash -> NULL). ${failed} failed.`);
  console.log("  Those products now render the Havlo logo fallback instead of a foreign placeholder.");
}

main().catch((e) => { console.error("✗ Fatal:", e); process.exit(1); });
