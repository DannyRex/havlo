/* AddideMart Nigeria — Lagos online supermarket at addidemart.com.
   Small grocery + household catalog. Useful for price comparison
   against Supermart / Foodco / Spar on staples.

   Uncertainty noted: AddideMart's online presence has been
   variable; if the runner returns 0 deals across multiple cron
   cycles, removing the entry is a reasonable cleanup. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeAddideMart(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "AddideMart",
    storeId: "addidemart",
    baseUrl: "https://www.addidemart.com",
    pages: [
      { url: "https://www.addidemart.com/product-category/groceries/",     cat: "groceries" },
      { url: "https://www.addidemart.com/product-category/beverages/",     cat: "groceries" },
      { url: "https://www.addidemart.com/product-category/household/",     cat: "home" },
      { url: "https://www.addidemart.com/product-category/personal-care/", cat: "beauty" },
    ],
  });
}
