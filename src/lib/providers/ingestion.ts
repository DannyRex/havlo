/* ──────────────────────────────────────────────────────────────────
   Ingestion writer — takes Deal[] from any provider and upserts into
   products + offers tables.

   Used by:
     • scripts/ingest-providers.ts (cron-runnable)
     • Future API routes that want to persist live results
   ────────────────────────────────────────────────────────────────── */

import type { Deal } from "@/types";
import { getSupabaseAdmin } from "./db-client";
import { buildSignature } from "@/lib/search/normalize";
import { inferStoreCountry } from "@/lib/country";
import { categoryDisagreesWithTitle } from "@/lib/categorize";
import { categories } from "@/lib/data/categories";

export interface IngestResult {
  fetched: number;
  upserted: number;
  errors: string[];
}

/* ── Helpers ──────────────────────────────────────────────────────── */

interface StoreRow {
  id: string;
  name: string;
  country: string | null;
  url: string | null;
  logo_url: string | null;
  is_international: boolean;
  trusted: boolean;
}

function dealToStoreRow(d: Deal): StoreRow {
  /* `is_international` retains its original currency-based heuristic
     (USD = international price tag) since downstream filters lean on
     it as a proxy for 'has cross-border price'.

     `country` now uses the COUNTRY_STORES roster via inferStoreCountry
     so a UK retailer (ASOS, Currys, Argos) tags as 'UK' and a US
     retailer (Walmart, Best Buy, Macy's) tags as 'US' instead of
     null. The previous 'NGN → NG, USD → null' rule left every
     non-NG retailer untagged, which broke per-country queries like
     the chip pool RPC. Truly global cross-border stores (AliExpress,
     DHGate, Shein, Temu) still tag null because they don't have a
     native market. */
  const isIntl = d.currency === "USD";
  return {
    id:               d.storeId,
    name:             d.storeName,
    country:          inferStoreCountry(d.storeId, d.storeName),
    url:              null,
    logo_url:         `/logos/${d.storeId}.png`,
    is_international: isIntl,
    trusted:          true,
  };
}

function dealToProductRow(d: Deal, signature: string) {
  /* Auto-correct mistagged categories at ingest time.

     Why: ingest-providers.ts tags every result from a 'phones' query
     with categorySlug='phones', regardless of whether the actual
     result is a phone. SerpAPI's match for the query 'Phones' will
     occasionally return a Bluetooth speaker or AI sunglasses, and
     before this fix those rows landed in the Phones filter on /deals.
     The QA agent flagged this as a top-of-funnel trust killer.

     Logic: if title-based inference disagrees with the source slug,
     OVERRIDE to the inferred slug. If inference returns null
     (unrecognised), keep the source slug — better to over-tag than
     to lose the data. */
  const { disagrees, inferred } = categoryDisagreesWithTitle(d.categorySlug, d.title);
  const correctedSlug = disagrees && inferred ? inferred : d.categorySlug;
  const correctedCategory = disagrees && inferred
    ? (categories.find((c) => c.slug === inferred)?.name ?? d.category)
    : d.category;

  return {
    title: d.title,
    description: d.description ?? null,
    category: correctedCategory,
    category_slug: correctedSlug,
    brand: null,
    model: null,
    image_url: d.imageUrl ?? null,
    signature,
  };
}

/* Extract the country code from either:
   1. The Deal.tags array (`country:xx` — set by SerpAPI provider)
   2. The sourceQuery suffix (e.g. "phones:uk" — set by ingest CLI)
   3. NGN-currency offers default to "ng" (scraper-sourced)
   Returns null when no signal is available — the offer becomes "global"
   from the country-filter's perspective (cross-border like Shein/Temu). */
function inferSourceCountry(d: Deal, sourceQuery: string): string | null {
  const tag = d.tags.find((t) => t.startsWith("country:"));
  if (tag) return tag.slice("country:".length).toLowerCase();
  const m = sourceQuery.match(/:([a-z]{2})$/i);
  if (m) return m[1].toLowerCase();
  if (d.currency === "NGN") return "ng";
  return null;
}

function dealToOfferRow(
  d: Deal,
  productId: string,
  sourceProvider: string,
  sourceQuery: string,
  runStartedAt: string,
) {
  return {
    product_id: productId,
    store_id: d.storeId,
    url: d.url,
    current_price: d.salePrice,
    original_price: d.originalPrice ?? null,
    discount_percent: d.discountPercent ?? null,
    currency: d.currency,
    /* Always (re)mark as in_stock on a successful upsert. The
       staleness sweep below flips offers that DIDN'T get touched
       this run, so re-stamping here is the "I saw this URL this
       run" half of the contract. */
    in_stock: true,
    source_provider: sourceProvider,
    source_query: sourceQuery,
    source_country: inferSourceCountry(d, sourceQuery),
    scraped_at: new Date().toISOString(),
    /* last_seen_at uses the RUN-START timestamp, not now(), so every
       offer touched in the same run shares a single stamp. The sweep
       below selects `last_seen_at < runStartedAt`, so using `now()`
       per-row would make that boundary fuzzy (an offer upserted at
       run+30s would be 30s newer than the run start and could leak
       into a future run's sweep window). Migration 0018 adds the
       column with default now() for safety; we override here. */
    last_seen_at: runStartedAt,
  };
}

/* Options bag for ingestDeals. Most callers don't need this — the
   defaults are conservative (no staleness sweep, no destructive
   side-effects). */
export interface IngestOptions {
  /** When the caller has just walked a store's FULL public catalog,
      pass `{ store: storeId }` so ingestDeals can soft-delete offers
      that weren't seen this run (mark them in_stock=false). The
      sweep is only safe for full-catalog scrapers — per-category /
      per-SKU ingest must leave this undefined. */
  sweepScope?: { store: string };
}

/** Minimum deal count BEFORE the sweep is allowed to run. Catches
    the catastrophic case where a Playwright run breaks partway and
    only returns a handful of items — without this threshold we'd
    mark the rest of the catalog as out of stock. */
const MIN_DEALS_FOR_SWEEP = 10;

/** Sweep is skipped when the new batch is smaller than this
    fraction of the existing in-stock count for the store. A 60%
    drop in catalog size between runs is almost always a scraper
    regression, not a genuine delisting wave. */
const MIN_BATCH_FRACTION_OF_EXISTING = 0.4;

/* ── Main ingestion function ──────────────────────────────────────── */

/**
 * Upsert a batch of Deals from a provider into the DB.
 *
 * Strategy:
 *   1. Upsert all unique stores in one batch
 *   2. For each deal:
 *      a. Compute its signature
 *      b. Look up existing product by signature (or insert new)
 *      c. Upsert offer (unique by store_id + url)
 *   3. Record an ingestion_run row for telemetry
 */
export async function ingestDeals(
  sourceProvider: string,
  sourceQuery: string,
  deals: Deal[],
  options: IngestOptions = {},
): Promise<IngestResult> {
  const result: IngestResult = { fetched: deals.length, upserted: 0, errors: [] };
  const supa = getSupabaseAdmin();

  if (!supa) {
    result.errors.push("Supabase client not configured (need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
    return result;
  }
  if (deals.length === 0) return result;

  /* Pinned at the start of the run. Every offer upserted below
     gets this exact stamp as `last_seen_at`, so the post-loop
     sweep can cleanly select `last_seen_at < runStartedAt` without
     race conditions between upserts and the sweep. */
  const runStartedAt = new Date().toISOString();

  // Open a run record
  const { data: run, error: runErr } = await supa
    .from("ingestion_runs")
    .insert({ provider: sourceProvider, query: sourceQuery, status: "running" })
    .select("id")
    .single();

  if (runErr || !run) {
    result.errors.push(`Could not open ingestion_run: ${runErr?.message ?? "unknown"}`);
    return result;
  }

  // 1. Upsert stores
  const uniqueStores = new Map<string, StoreRow>();
  for (const d of deals) uniqueStores.set(d.storeId, dealToStoreRow(d));
  const { error: storeErr } = await supa
    .from("stores")
    .upsert(Array.from(uniqueStores.values()), { onConflict: "id" });
  if (storeErr) result.errors.push(`Store upsert: ${storeErr.message}`);

  // 2. Per-deal: find/create product, upsert offer
  for (const d of deals) {
    try {
      const sig = buildSignature(d.title);

      /* Use the compact `key` (brand|model[|size]) for dedup, NOT the
         full JSON-stringified signature. The full JSON includes `norm`
         and `tokens` which vary literally with the title text — so
         the same iPhone 15 listed by Konga and Amazon never matched
         even though the canonical key was identical. Caused the
         catalog to balloon to 980 single-store products + only 2
         multi-store. */
      const sigStr = sig.key;

      const tryDedup = sig.brand !== null && sig.model !== null;

      /* Dedup lookup order (round-4 audit fix):
           1. ALWAYS check (store_id, url) first. If this exact
              merchant URL is already in the offers table, reuse
              the product it points at — no matter what signature
              dedup would say. This catches the catastrophic case
              the audit surfaced: 26k products vs 11k offers,
              4302 titles with 2+ product_ids, 15k orphan products.
              Root cause was that signature-based dedup failed for
              unbranded titles AND the fallback was an else-branch,
              so when sig.brand/model parsed but signature didn't
              match an existing product, we still inserted a fresh
              product and re-pointed the offer. Result: the offer
              upserted (single offer row, store_id+url unique key)
              but the OLD product became an orphan.
           2. If (store_id, url) didn't find an existing offer,
              fall back to signature dedup when brand+model parsed.
           3. If neither matches, create a new product. */
      let existing: { id: string; image_url: string | null } | null = null;

      const offerUrl = (d.url ?? "").trim();
      if (offerUrl && d.storeId) {
        const { data: existingOffer } = await supa
          .from("offers")
          .select("product_id")
          .eq("store_id", d.storeId)
          .eq("url", offerUrl)
          .limit(1)
          .maybeSingle();
        if (existingOffer?.product_id) {
          const { data: existingProduct } = await supa
            .from("products")
            .select("id, image_url")
            .eq("id", existingOffer.product_id)
            .maybeSingle();
          existing = existingProduct ?? null;
        }
      }

      /* Step 2: signature-based dedup, only when (a) we didn't
         find an existing offer above and (b) brand+model parsed. */
      if (!existing && tryDedup) {
        const { data } = await supa
          .from("products")
          .select("id, image_url")
          .eq("signature", sigStr)
          .limit(1)
          .maybeSingle();
        existing = data ?? null;
      }

      let productId: string;
      if (existing?.id) {
        productId = existing.id;
        // Backfill image if the existing row didn't have one
        if (!existing.image_url && d.imageUrl) {
          await supa.from("products").update({ image_url: d.imageUrl }).eq("id", productId);
        }
      } else {
        const { data: created, error: createErr } = await supa
          .from("products")
          .insert(dealToProductRow(d, sigStr))
          .select("id")
          .single();
        if (createErr || !created) {
          result.errors.push(`Insert product '${d.title}': ${createErr?.message}`);
          continue;
        }
        productId = created.id;
      }

      const { error: offerErr } = await supa
        .from("offers")
        .upsert(dealToOfferRow(d, productId, sourceProvider, sourceQuery, runStartedAt), {
          onConflict: "store_id,url",
        });

      if (offerErr) {
        result.errors.push(`Upsert offer '${d.title}' @ ${d.storeName}: ${offerErr.message}`);
      } else {
        result.upserted += 1;
      }
    } catch (err) {
      result.errors.push(`Deal '${d.title}': ${(err as Error).message}`);
    }
  }

  // 3a. Full-catalog sweep — only when the caller asserts scope.
  //     Aggressive: marks every offer in the store NOT seen this run.
  if (options.sweepScope?.store) {
    await sweepStaleOffers(supa, {
      storeId: options.sweepScope.store,
      runStartedAt,
      batchSize: result.upserted,
      result,
    });
  }

  /* 3b. TTL sweep — runs on EVERY ingest path regardless of source.
        Conservative: marks offers whose `last_seen_at` is older than
        TTL_DAYS for stores we touched THIS run. Catches the gap that
        per-category SerpAPI / per-SKU UK retailer / curated ingest
        used to leave open: their offers had no sweep wired in, so
        delisted SKUs sat in_stock=true forever.

        Why per-store and not catalog-wide: a UK retailer ingest
        run shouldn't accidentally touch Konga rows — only the
        stores actually present in `deals` get swept. The cron
        `npx tsx scripts/sweep-stale-offers.ts --apply` covers
        whole-catalog cleanup for stores that nothing's ingesting.

        Conservative threshold (30 days) so a normal scrape cadence
        miss doesn't trigger false flips; the per-store sweep above
        handles fast-moving full catalogs. */
  if (result.upserted > 0) {
    const touchedStores = Array.from(new Set(deals.map((d) => d.storeId).filter(Boolean)));
    /* Skip stores already covered by the full-catalog sweep above
       (it ran a more aggressive flip already; the TTL pass would
       be a no-op anyway). */
    const sweepedAlready = options.sweepScope?.store ? new Set([options.sweepScope.store]) : new Set<string>();
    const stores = touchedStores.filter((s) => !sweepedAlready.has(s));
    if (stores.length > 0) {
      await ttlSweepForStores(supa, stores, runStartedAt, result);
    }
  }

  // 4. Close the run record
  await supa
    .from("ingestion_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.errors.length === 0 ? "success" : (result.upserted > 0 ? "partial" : "error"),
      items_fetched: result.fetched,
      items_upserted: result.upserted,
      errors: result.errors.length > 0 ? result.errors : null,
    })
    .eq("id", run.id);

  return result;
}

/* ── Staleness sweep ──────────────────────────────────────────────── */

interface SweepParams {
  storeId:       string;
  runStartedAt:  string;
  /** How many offers the run successfully upserted. Used as a sanity
      guard against partially-broken scrapes. */
  batchSize:     number;
  /** Mutated to record the outcome of the sweep (count flipped,
      reasons skipped, etc.) on result.errors when relevant. */
  result:        IngestResult;
}

/**
 * Mark offers belonging to `storeId` that were NOT touched in this
 * run as in_stock=false. The product_best_offers view filters
 * in_stock=true, so flipped offers immediately drop out of /deals
 * and the per-product price comparisons without us deleting any
 * rows (historical data preserved for audit).
 *
 * Guards (skips sweep + logs a warning, no errors raised):
 *   1. batchSize < MIN_DEALS_FOR_SWEEP — almost certainly a broken
 *      scrape, not a real "merchant has 9 products" catalog.
 *   2. batchSize < MIN_BATCH_FRACTION_OF_EXISTING × current in-stock
 *      count — a >60% drop in catalog size is much more likely a
 *      scraper regression than mass delisting.
 */
async function sweepStaleOffers(
  supa:   NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  params: SweepParams,
): Promise<void> {
  const { storeId, runStartedAt, batchSize, result } = params;

  if (batchSize < MIN_DEALS_FOR_SWEEP) {
    console.warn(
      `[ingest] sweep skipped for ${storeId}: only ${batchSize} deals upserted (< ${MIN_DEALS_FOR_SWEEP}). Looks like a broken scrape — leaving existing offers untouched.`,
    );
    return;
  }

  /* Compare the new batch size to the store's CURRENT in-stock
     offer count. If we're seeing a giant drop, abort the sweep —
     way more likely the scraper broke than the merchant lost 80%
     of their catalog overnight. */
  const { count: existingCount, error: countErr } = await supa
    .from("offers")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("in_stock", true);

  if (countErr) {
    /* If we can't read the count, fail open — don't sweep, log it.
       Better to leave a stale row in for one cycle than risk nuking
       a healthy catalog on a transient PostgREST hiccup. */
    console.warn(
      `[ingest] sweep skipped for ${storeId}: count probe failed (${countErr.message}). Will retry next run.`,
    );
    return;
  }

  if (existingCount && batchSize < existingCount * MIN_BATCH_FRACTION_OF_EXISTING) {
    console.warn(
      `[ingest] sweep skipped for ${storeId}: batch (${batchSize}) is < ${Math.round(MIN_BATCH_FRACTION_OF_EXISTING * 100)}% of existing in-stock (${existingCount}). Looks like a partial scrape — leaving existing offers untouched.`,
    );
    return;
  }

  /* All checks passed — run the sweep. Single statement, indexed by
     (store_id, last_seen_at). Returns the affected rows via a
     count=exact hint so we can log how many vanished. */
  const { data: flipped, error: sweepErr } = await supa
    .from("offers")
    .update({ in_stock: false })
    .eq("store_id", storeId)
    .eq("in_stock", true)
    .lt("last_seen_at", runStartedAt)
    .select("id");

  if (sweepErr) {
    result.errors.push(`Staleness sweep for ${storeId}: ${sweepErr.message}`);
    return;
  }

  const flippedCount = flipped?.length ?? 0;
  if (flippedCount > 0) {
    console.log(
      `[ingest] sweep ${storeId}: ${flippedCount} offer(s) marked out-of-stock (not seen in run starting ${runStartedAt}).`,
    );
  }
}

/* ── TTL sweep for partial-scope ingest paths ────────────────────── */

/** Days before a non-touched offer (per touched-store) gets flipped
    to in_stock=false by the auto-TTL pass. Conservative — should be
    much longer than the typical scrape cadence so a single missed
    run can't nuke an active catalogue. The whole-catalog cron
    (scripts/sweep-stale-offers.ts) covers stores nothing's
    ingesting. */
const TTL_DAYS = 30;

/**
 * Per-store TTL sweep. For each store the caller touched in this
 * run, flip offers older than TTL_DAYS to in_stock=false.
 *
 * Single SQL UPDATE per store. No per-row guard like the full-catalog
 * sweep — TTL is conservative enough (30 days) that we trust it
 * regardless of batch size. SerpAPI / UK retailer / curated ingest
 * paths all benefit automatically; they don't need to know about it.
 */
async function ttlSweepForStores(
  supa:         NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  storeIds:     string[],
  runStartedAt: string,
  result:       IngestResult,
): Promise<void> {
  const threshold = new Date(
    new Date(runStartedAt).getTime() - TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  let totalFlipped = 0;
  for (const storeId of storeIds) {
    const { data: flipped, error: sweepErr } = await supa
      .from("offers")
      .update({ in_stock: false })
      .eq("store_id", storeId)
      .eq("in_stock", true)
      .lt("last_seen_at", threshold)
      .select("id");
    if (sweepErr) {
      result.errors.push(`TTL sweep for ${storeId}: ${sweepErr.message}`);
      continue;
    }
    const n = flipped?.length ?? 0;
    if (n > 0) {
      totalFlipped += n;
      console.log(
        `[ingest] TTL sweep ${storeId}: ${n} offer(s) older than ${TTL_DAYS}d marked out-of-stock.`,
      );
    }
  }
  if (totalFlipped > 0) {
    console.log(`[ingest] TTL sweep total: ${totalFlipped} offers across ${storeIds.length} stores.`);
  }
}
