/* Carfax Nigeria — Lagos electronics retailer at carfax.com.ng.
   NOT to be confused with the US automotive history service of the
   same name (different company, different domain — carfax.com).
   Catalog leans electronics + small appliances + audio.

   The .com.ng entry in NG_STORES protects against incidental
   matches on "carfax" if the US namesake ever shows up in a
   cross-border result; we only treat carfax.com.ng + carfax-ng
   as Nigerian-anchored. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeCarfax(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Carfax",
    storeId: "carfax-ng",
    baseUrl: "https://www.carfax.com.ng",
    pages: [
      { url: "https://www.carfax.com.ng/product-category/phones/",       cat: "phones" },
      { url: "https://www.carfax.com.ng/product-category/electronics/",  cat: "electronics" },
      { url: "https://www.carfax.com.ng/product-category/audio/",        cat: "audio" },
      { url: "https://www.carfax.com.ng/product-category/computing/",    cat: "computing" },
      { url: "https://www.carfax.com.ng/product-category/appliances/",   cat: "appliances" },
    ],
  });
}
