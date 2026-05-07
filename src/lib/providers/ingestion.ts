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
  return {
    title: d.title,
    description: d.description ?? null,
    category: d.category,
    category_slug: d.categorySlug,
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

function dealToOfferRow(d: Deal, productId: string, sourceProvider: string, sourceQuery: string) {
  return {
    product_id: productId,
    store_id: d.storeId,
    url: d.url,
    current_price: d.salePrice,
    original_price: d.originalPrice ?? null,
    discount_percent: d.discountPercent ?? null,
    currency: d.currency,
    in_stock: true,
    source_provider: sourceProvider,
    source_query: sourceQuery,
    source_country: inferSourceCountry(d, sourceQuery),
    scraped_at: new Date().toISOString(),
  };
}

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
): Promise<IngestResult> {
  const result: IngestResult = { fetched: deals.length, upserted: 0, errors: [] };
  const supa = getSupabaseAdmin();

  if (!supa) {
    result.errors.push("Supabase client not configured (need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
    return result;
  }
  if (deals.length === 0) return result;

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

      /* Skip dedup entirely when brand or model couldn't be parsed.
         The fallback key '?|?' would otherwise collapse every
         unbranded product into a single row, which is worse than
         keeping them separate. Treat as always-new instead. */
      const tryDedup = sig.brand !== null && sig.model !== null;

      // Find existing product by signature (only if dedup is safe)
      const { data: existing } = tryDedup
        ? await supa
            .from("products")
            .select("id, image_url")
            .eq("signature", sigStr)
            .limit(1)
            .maybeSingle()
        : { data: null };

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
        .upsert(dealToOfferRow(d, productId, sourceProvider, sourceQuery), {
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

  // 3. Close the run record
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
