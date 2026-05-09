/* Essenza Nigeria — Lagos-based fragrance + beauty retailer at
   essenza.ng. Confirmed Shopify-based (verified May 2026 against
   the public products.json endpoint), so plugs straight into the
   _shopify-json.ts template.

   Catalog skews fragrance / niche perfume — useful for the Beauty
   filter on /deals where the existing NG retailers (HealthPlus,
   MedPlus) lean wellness + skincare.

   Page param unused — Shopify path is fetch-only. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

export async function scrapeEssenza(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:    "Essenza",
    storeId: "essenza",
    baseUrl: "https://www.essenza.ng",
    collections: [
      { handle: "all", cat: "beauty" },
    ],
    pageLimit: 3,
  });
}
