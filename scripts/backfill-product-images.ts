#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Generic product-image backfill via SerpAPI google_images.

   Scans the products table for rows with image_url=null and tries
   to fill them by querying Google Images for each product's title
   (with a store-domain site: filter when known). Works for any
   store — Konga, Jumia, HealthPlus, etc. Uses the SAME approach
   as the per-Jumia backfill in ingest-jumia.ts but is store-agnostic.

   Why this exists: ingest paths are heterogeneous — some scrape
   og:image directly (Konga, AliExpress), some pull from API
   responses (curated Amazon, AliExpress affiliate), some derive
   from search results (SerpAPI Google rich-snippets — no image).
   When any of those paths skip the image, the product lands
   imageless. This sweeps the gaps.

   Usage:
     npm run backfill:images                 # all stores, all gaps
     npm run backfill:images -- --store=konga  # one store
     npm run backfill:images -- --limit=20     # cap calls per run
                                                (cost guard)

   Cost: one SerpAPI credit per product (~$0.005 on Plus). Typical
   run: 30-50 missing products = $0.15-$0.25. Cheaper than the
   per-store ingest backfills since this batches everything in
   one pass. ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+ built-in
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

/* Map store_id → site:filter domain. When unknown, fall back to a
   bare title query (less precise but still useful — Google often
   returns the right product image as the top result). */
const STORE_DOMAINS: Record<string, string> = {
  jumia:        "jumia.com.ng",
  konga:        "konga.com",
  ajebomarket:  "ajebomarket.com",
  medplus:      "medplusng.com",
  healthplus:   "healthplus.ng",
  bitmarte:     "bitmartestores.com",
  supermart:    "supermart.ng",
  pricepally:   "pricepally.com",
  threechub:    "3chub.com",
  "3c-hub":     "3chub.com",
  "3chub":      "3chub.com",
  slot:         "slot.ng",
  obiwezy:      "obiwezy.com",
  pointek:      "pointek.com",
  spar:         "sparng.com",
  "spar-ng":    "sparng.com",
  yudala:       "yudala.com",
  switz:        "switzelectronics.com",
  tezza:        "tezzaboutique.com",
  fouani:       "fouani.com",
  argos:        "argos.co.uk",
  currys:       "currys.co.uk",
  asos:         "asos.com",
  "john-lewis-partners": "johnlewis.com",
  "marks-spencer":       "marksandspencer.com",
};

interface CliArgs {
  storeId?: string;
  limit?:   number;
  dryRun?:  boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--store=")) args.storeId = arg.slice("--store=".length);
    else if (arg.startsWith("--limit=")) args.limit = parseInt(arg.slice("--limit=".length), 10);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  return args;
}

interface GoogleImagesResult {
  link?:     string;
  original?: string;
}

async function fetchImageForTitle(
  title: string,
  domain: string | undefined,
  apiKey: string,
): Promise<string | null> {
  /* Build the query: prefer site:filter when the domain is known
     (more precise — returns images from that exact store). When
     unknown, use the bare title — Google's product knowledge is
     usually strong enough to surface the right image. */
  const q = domain ? `${title} site:${domain}` : title;
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", q);
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);
  /* No gl= — image search isn't market-scoped; we want any
     authoritative image for the product. */

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json() as { images_results?: GoogleImagesResult[]; error?: string };
    if (data.error) return null;
    /* Prefer images on the merchant's own CDN when site filter
       was used — they're stable. Fall back to any returned
       original. */
    if (domain) {
      for (const img of data.images_results ?? []) {
        if (img.original?.toLowerCase().includes(domain.split(".")[0])) return img.original;
      }
    }
    for (const img of data.images_results ?? []) {
      if (img.original) return img.original;
    }
    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) {
    console.error("✗ SERPAPI_KEY not set in env. Aborting.");
    process.exit(1);
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase admin not configured. Aborting.");
    process.exit(1);
  }

  /* Find products missing image_url. When --store= is set, scope to
     products that have at least one in-stock offer at that store. */
  let productIds: string[] | null = null;
  if (args.storeId) {
    const { data: offers } = await supa
      .from("offers")
      .select("product_id")
      .eq("store_id", args.storeId)
      .eq("in_stock", true);
    productIds = Array.from(new Set((offers ?? []).map((o: { product_id: string }) => o.product_id)));
    if (productIds.length === 0) {
      console.log(`No in-stock offers found for store ${args.storeId}. Nothing to backfill.`);
      return;
    }
  }

  /* Pull missing rows. Chunk the IN() filter to avoid Postgres's
     ~32k parameter limit when productIds is large. */
  let missing: Array<{ id: string; title: string }> = [];
  const chunkSize = 200;
  if (productIds) {
    for (let i = 0; i < productIds.length; i += chunkSize) {
      const chunk = productIds.slice(i, i + chunkSize);
      const { data } = await supa
        .from("products")
        .select("id, title")
        .in("id", chunk)
        .is("image_url", null);
      if (data) missing.push(...(data as Array<{ id: string; title: string }>));
    }
  } else {
    /* All-store sweep. */
    const { data } = await supa
      .from("products")
      .select("id, title")
      .is("image_url", null)
      .limit(args.limit ?? 200);
    if (data) missing = data as Array<{ id: string; title: string }>;
  }

  if (args.limit) missing = missing.slice(0, args.limit);

  if (missing.length === 0) {
    console.log("✓ No products missing images. Nothing to do.");
    return;
  }

  /* For per-product domain inference: look up each product's
     dominant store via offers. Cheaper than joining at query time. */
  const productStoreId = new Map<string, string>();
  if (!args.storeId) {
    const ids = missing.map((p) => p.id);
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data: offers } = await supa
        .from("offers")
        .select("product_id, store_id")
        .in("product_id", chunk)
        .eq("in_stock", true);
      for (const o of (offers ?? []) as Array<{ product_id: string; store_id: string }>) {
        if (!productStoreId.has(o.product_id)) productStoreId.set(o.product_id, o.store_id);
      }
    }
  }

  console.log(`▶ Backfilling images for ${missing.length} products${args.storeId ? ` from ${args.storeId}` : ""}${args.dryRun ? " (DRY RUN)" : ""}`);
  console.log("");

  let filled = 0;
  let unmatched = 0;
  let errors = 0;
  for (const p of missing) {
    const storeId = args.storeId ?? productStoreId.get(p.id);
    const domain  = storeId ? STORE_DOMAINS[storeId] : undefined;
    const img = await fetchImageForTitle(p.title, domain, apiKey);
    const title = p.title.slice(0, 70);
    const storeLabel = storeId ? `[${storeId}]` : "";

    if (!img) {
      unmatched++;
      console.log(`  · ${storeLabel.padEnd(15)} ${title} — no image found`);
      continue;
    }

    if (args.dryRun) {
      console.log(`  → ${storeLabel.padEnd(15)} ${title}`);
      console.log(`        would set: ${img.slice(0, 90)}`);
      filled++;
      continue;
    }

    const { error } = await supa.from("products").update({ image_url: img }).eq("id", p.id);
    if (error) {
      errors++;
      console.warn(`  ✗ ${storeLabel.padEnd(15)} ${title} — update failed: ${error.message}`);
    } else {
      filled++;
      console.log(`  ✓ ${storeLabel.padEnd(15)} ${title}`);
    }
  }

  console.log("");
  console.log(`✓ Backfill complete — filled=${filled} unmatched=${unmatched} errors=${errors}`);
}

main().catch((err) => {
  console.error("✗ Fatal error:", err);
  process.exit(1);
});
