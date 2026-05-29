/* Per-product description fetcher.

   Source: products.description column (populated by ingestion.ts
   from Deal.description where the scraper captured one — Shopify-
   JSON paths like 3CHub / PayPorte / Konga / Slot reliably carry
   the merchant body; SerpAPI rows usually do not).

   Why this isn't on product_best_offers: the view's projection is
   intentionally slim to keep the hot-path egress small (every
   PDP + every browse-db call routes through it). A description
   can be 1–5KB per row; joining it into the view would inflate
   the JSON payload across surfaces that don't render it. Single
   targeted fetch on the PDP route only.

   UUID-guarded so curated synthetic-id PDPs (amazon-us-…, serp-…)
   skip the round trip — they have no DB row by construction.

   Returns null when the column is null / empty / DB unreachable.
   ProductAbout silently omits the merchant block in that case
   and falls back to the templated intro line + spec chips. */

import { getSupabaseAdmin } from "@/lib/providers/db-client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchProductDescription(
  productId: string,
): Promise<string | null> {
  if (!productId || !UUID_RE.test(productId)) return null;
  const supa = getSupabaseAdmin();
  if (!supa) return null;
  try {
    const { data } = await supa
      .from("products")
      .select("description")
      .eq("id", productId)
      .maybeSingle();
    const raw = (data as { description: string | null } | null)?.description;
    if (!raw || raw.trim().length === 0) return null;
    return raw.trim();
  } catch {
    return null;
  }
}
