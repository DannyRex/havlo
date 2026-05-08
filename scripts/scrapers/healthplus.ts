/* HealthPlus Nigeria — major NG pharmacy chain. Runs on Shopify at
   healthplusnigeria.com (NOT healthplus.com.ng — that domain is
   parked / different entity).

   Uses the public Shopify catalog JSON endpoint via
   _shopify-json.ts — no Playwright, no HTML parsing. Same approach
   gives Supermart its catalog too. The endpoint is unauthenticated,
   structured, paginated, and stable across theme updates.

   /collections/all is the catch-all — every Shopify store has it,
   it lists every product. We rely on Shopify's own product_type
   field to bucket items into Havlo categories so we don't have to
   maintain a list of HealthPlus's specific collection handles. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

/* The Page parameter is unused — kept to match scrape.ts's
   orchestrator signature. The runtime calls fetch, not Playwright,
   which saves ~30s per cron run vs. browser-based scraping. */
export async function scrapeHealthPlus(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:    "HealthPlus",
    storeId: "healthplus",
    baseUrl: "https://healthplusnigeria.com",
    collections: [
      { handle: "all", cat: "beauty" },
    ],
    pageLimit: 4, // HealthPlus has a fairly deep catalog
  });
}
