/* Zonky (zonky.uk) — UK Shopify-hosted micro-merchant, approved via
   Awin. Their public catalog is mostly PDF Lego-build instructions, a
   single-vendor digital-goods business. We include it so the Awin click
   path can monetise direct merchant URLs / paste-a-link sniffs landing
   here, but the goods rarely correspond to anything else in the catalog,
   so they'll surface on /deals as single-store rows without comparison
   value. (Awin 5 ingest, June 2026.) */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

export async function scrapeZonky(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:           "Zonky",
    storeId:        "zonky",
    baseUrl:        "https://zonky.uk",
    nativeCurrency: "GBP",
    storeCountry:   "uk",
    collections:    [{ handle: "all", cat: "general" }],
    pageLimit:      2,
  });
}
