/* House of Sneakers (house-of-sneakers.de) — DE Shopify-hosted sneaker
   reseller, approved via Awin. THE one Awin-5 merchant with genuine
   cross-store price-comparison value: their catalog is real branded
   sneakers (Nike, Air Jordan, Adidas) that other stores in our index
   also carry. Stays dormant until DE leaves the deferred-launch list
   (ACTIVE_COUNTRIES excludes DE per task #44), at which point its
   offers surface on /de/deals + /de/compare automatically.
   (Awin 5 ingest, June 2026.) */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

export async function scrapeHouseOfSneakers(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:           "House of Sneakers",
    storeId:        "house-of-sneakers",
    baseUrl:        "https://house-of-sneakers.de",
    nativeCurrency: "EUR",
    storeCountry:   "de",
    collections:    [{ handle: "all", cat: "fashion" }],
    pageLimit:      4,
  });
}
