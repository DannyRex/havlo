/* Supermart Nigeria — Lagos-focused online grocery + household at
   supermart.ng. Runs on Shopify, so we hit the public catalog JSON
   endpoint via _shopify-json.ts (no Playwright needed).

   /collections/all gets the full catalog in one chain of paginated
   fetches. Shopify's product_type values bucket items into Havlo
   categories automatically (no per-collection config). */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

/* Page param unused — Shopify path is fetch-only. */
export async function scrapeSupermart(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:    "Supermart",
    storeId: "supermart",
    baseUrl: "https://www.supermart.ng",
    collections: [
      { handle: "all", cat: "groceries" },
    ],
    pageLimit: 6, // Supermart's catalog is broader (groceries + household + alcohol + appliances)
  });
}
