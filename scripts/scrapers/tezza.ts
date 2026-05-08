/* Tezza Nigeria — phone-focused reseller at tezza.com.ng. Strong
   coverage of Tecno / Infinix / Itel SKUs that mainstream Slot /
   3C Hub catalogs sometimes miss because they prioritise Apple +
   Samsung. Useful price-comparison anchor for the budget Android
   segment that's a big slice of the NG market.

   Catalog notes:
     • Custom-themed WooCommerce
     • Phone categories are the bulk; small electronics + audio is
       secondary surface
     • Some product pages fall back to a brand grid rather than
       /product-category/{slug}/ — covered with brand-prefixed URLs */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeTezza(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Tezza",
    storeId: "tezza",
    baseUrl: "https://www.tezza.com.ng",
    pages: [
      { url: "https://www.tezza.com.ng/product-category/phones/",        cat: "phones" },
      { url: "https://www.tezza.com.ng/product-category/tablets/",       cat: "phones" },
      { url: "https://www.tezza.com.ng/product-category/audio/",         cat: "audio" },
      { url: "https://www.tezza.com.ng/product-category/accessories/",   cat: "phones" },
      { url: "https://www.tezza.com.ng/product-category/laptops/",       cat: "computing" },
      { url: "https://www.tezza.com.ng/brand/tecno/",                    cat: "phones" },
      { url: "https://www.tezza.com.ng/brand/infinix/",                  cat: "phones" },
      { url: "https://www.tezza.com.ng/brand/itel/",                     cat: "phones" },
    ],
  });
}
