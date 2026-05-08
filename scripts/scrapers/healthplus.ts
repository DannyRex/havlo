/* HealthPlus Nigeria — major NG pharmacy chain with online catalog
   at healthplus.com.ng. Runs WordPress + WooCommerce so the generic
   walk-up-DOM template handles the markup cleanly.

   Catalog notes (as of writing):
     • Categories live under /product-category/{slug}/
     • Beauty + skincare are deep verticals — surface most often
       on /deals once HealthPlus rows reach the DB
     • Pricing is consistent ₦ format with no foreign-currency mixing
     • No anti-bot wall observed at run-time (rapid retry friendly)

   Selectors and category slugs were sourced from a manual browse
   pass; the runner's defensive walk-up means small theme changes
   shouldn't break extraction. If a category yields 0 deals across
   multiple runs, swap the URL or remove. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeHealthPlus(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "HealthPlus",
    storeId: "healthplus",
    baseUrl: "https://www.healthplus.com.ng",
    pages: [
      { url: "https://www.healthplus.com.ng/product-category/beauty/",      cat: "beauty" },
      { url: "https://www.healthplus.com.ng/product-category/skincare/",    cat: "beauty" },
      { url: "https://www.healthplus.com.ng/product-category/hair-care/",   cat: "beauty" },
      { url: "https://www.healthplus.com.ng/product-category/babies/",      cat: "home" },
      { url: "https://www.healthplus.com.ng/product-category/wellness/",    cat: "beauty" },
      { url: "https://www.healthplus.com.ng/product-category/personal-care/", cat: "beauty" },
    ],
  });
}
