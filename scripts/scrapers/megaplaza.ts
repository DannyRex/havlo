/* Megaplaza Nigeria — Lagos-based electronics + home appliances
   retailer with online presence at megaplaza.com.ng. Smaller catalog
   than Slot or 3C Hub but fills the appliances + lifestyle gap that
   the bigger phone-focused stores under-serve.

   Catalog notes:
     • WooCommerce-based, /product-category/{slug}/ URL pattern
     • Larger appliance-side coverage (gen sets, ACs, fridges)
       relative to the phone-heavy Slot / 3C Hub catalogs
     • Has been seen to occasionally rate-limit aggressive scrapes
       — the runner's per-page try/catch covers this without
       tanking the run

   First-run verification: if any URL below 404s, the retailer may
   have re-slugged categories. Swap the slug or remove the entry. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeMegaplaza(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Megaplaza",
    storeId: "megaplaza",
    baseUrl: "https://www.megaplaza.com.ng",
    pages: [
      { url: "https://www.megaplaza.com.ng/product-category/phones-tablets/",   cat: "phones" },
      { url: "https://www.megaplaza.com.ng/product-category/electronics/",      cat: "electronics" },
      { url: "https://www.megaplaza.com.ng/product-category/home-appliances/",  cat: "appliances" },
      { url: "https://www.megaplaza.com.ng/product-category/computing/",        cat: "computing" },
      { url: "https://www.megaplaza.com.ng/product-category/audio/",            cat: "audio" },
      { url: "https://www.megaplaza.com.ng/product-category/televisions/",      cat: "televisions" },
    ],
  });
}
