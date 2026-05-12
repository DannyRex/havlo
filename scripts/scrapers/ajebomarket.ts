/* Ajebomarket (ajebomarket.com) — Nigerian Shopify-hosted general
   marketplace. The robots.txt confirms Shopify ("we use Shopify as
   our ecommerce platform") and /products.json responds 200 with
   the standard Shopify catalog JSON shape — no Playwright needed.

   Following the same pattern Supermart / HealthPlus / Essenza use
   via _shopify-json.ts. /collections/all gives us the entire
   public catalog in one paginated chain of fetches; Shopify's own
   product_type field buckets items into Havlo categories. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

/* Page param unused — Shopify path is fetch-only, no browser needed. */
export async function scrapeAjebomarket(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:    "Ajebomarket",
    storeId: "ajebomarket",
    baseUrl: "https://ajebomarket.com",
    collections: [
      /* "all" is the canonical "every product" handle on every
         Shopify store. Pulls the whole catalog without per-
         category config drift. */
      { handle: "all", cat: "general" },
    ],
    /* Cap at 4 pages × 250 products = 1000 items. Ajebomarket's
       catalog is mid-size; 1000 covers it with headroom. Bump if
       /scripts/inspect-ng-deals.ts shows the cap is being hit. */
    pageLimit: 4,
  });
}
