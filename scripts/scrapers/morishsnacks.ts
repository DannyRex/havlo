/* MORiSH Snacks (morishsnacks.co.uk) — UK Shopify-hosted own-brand
   snacks / gift hampers, approved via Awin. Own-brand catalog, so the
   value is in the affiliate click path, not in cross-store price
   comparison. (Awin 5 ingest, June 2026.) */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

export async function scrapeMorishSnacks(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:           "MORiSH Snacks",
    storeId:        "morishsnacks",
    baseUrl:        "https://morishsnacks.co.uk",
    nativeCurrency: "GBP",
    storeCountry:   "uk",
    collections:    [{ handle: "all", cat: "food" }],
    pageLimit:      2,
  });
}
