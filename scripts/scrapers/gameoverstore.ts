/* Game Over Store (gameoverstore.co.uk) — UK Shopify-hosted gaming
   furniture (chairs, desks, accessories), approved via Awin.
   Mostly own-brand product lines, so the value is in the affiliate
   click path. (Awin 5 ingest, June 2026.) */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

export async function scrapeGameOverStore(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:           "Game Over Store",
    storeId:        "gameoverstore",
    baseUrl:        "https://gameoverstore.co.uk",
    nativeCurrency: "GBP",
    storeCountry:   "uk",
    collections:    [{ handle: "all", cat: "gaming" }],
    pageLimit:      2,
  });
}
