/* Gardenista UK (gardenistauk.com) — UK Shopify-hosted garden / home
   accessories, approved via Awin. Mostly own-brand products (chair
   pads, planters, bundles), so the value is in the affiliate click
   path. (Awin 5 ingest, June 2026.) */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

export async function scrapeGardenistaUK(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:           "Gardenista UK",
    storeId:        "gardenistauk",
    baseUrl:        "https://gardenistauk.com",
    nativeCurrency: "GBP",
    storeCountry:   "uk",
    collections:    [{ handle: "all", cat: "home" }],
    pageLimit:      2,
  });
}
