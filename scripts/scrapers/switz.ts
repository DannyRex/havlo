/* Switz Electronics Nigeria — small Lagos-based reseller at
   switzelectronics.com (also serves switzelectronics.ng aliases).
   Niche but consistent on Apple + Samsung + JBL accessories at
   competitive prices.

   This is a smaller-catalog scrape — expect fewer deals per run
   than Slot / 3C Hub. Not currently a top-five NG retailer but
   the cross-store comparison surface benefits from ANY additional
   distinct catalog. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeSwitz(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Switz Electronics",
    storeId: "switz",
    baseUrl: "https://www.switzelectronics.com",
    pages: [
      { url: "https://www.switzelectronics.com/product-category/phones/",      cat: "phones" },
      { url: "https://www.switzelectronics.com/product-category/audio/",       cat: "audio" },
      { url: "https://www.switzelectronics.com/product-category/computing/",   cat: "computing" },
      { url: "https://www.switzelectronics.com/product-category/accessories/", cat: "phones" },
    ],
  });
}
