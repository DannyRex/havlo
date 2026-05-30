/* Per-product metadata fetcher (description + commerce identifiers).

   Source: the `products` table, fetched by id on the PDP route only.
   Pulls the columns the PDP needs but the product_best_offers view
   intentionally omits to keep its hot-path projection slim:

     • description — merchant body captured at ingest (Shopify-JSON
       paths like 3CHub / PayPorte / Konga / Slot reliably carry one;
       SerpAPI rows usually do not). 1–5KB per row, so it's never
       joined into the view that every PDP + browse-db call routes
       through.
     • gtin / mpn  — commerce identifiers used to enrich the Product
       JSON-LD (Google Shopping rich results). Sparse today (~100–120
       of ~15k products) but real where present; the PDP validates
       them before emitting.

   One round trip pulls all three (same row), so adding the identifiers
   costs nothing beyond the description fetch that already ran here.

   UUID-guarded so curated synthetic-id PDPs (amazon-us-…, serp-…)
   skip the round trip — they have no DB row by construction.

   Every field is null when missing / empty / DB unreachable; callers
   degrade gracefully (ProductAbout omits the merchant block, the
   JSON-LD omits the identifier). */

import { getSupabaseAdmin } from "@/lib/providers/db-client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProductMeta {
  description: string | null;
  gtin:        string | null;
  mpn:         string | null;
}

const none = (): ProductMeta => ({ description: null, gtin: null, mpn: null });

/** Normalize a raw text column to a trimmed non-empty string or null. */
function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

export async function fetchProductMeta(productId: string): Promise<ProductMeta> {
  if (!productId || !UUID_RE.test(productId)) return none();
  const supa = getSupabaseAdmin();
  if (!supa) return none();
  try {
    const { data } = await supa
      .from("products")
      .select("description, gtin, mpn")
      .eq("id", productId)
      .maybeSingle();
    const row = data as { description: unknown; gtin: unknown; mpn: unknown } | null;
    if (!row) return none();
    return {
      description: clean(row.description),
      gtin:        clean(row.gtin),
      mpn:         clean(row.mpn),
    };
  } catch {
    return none();
  }
}
