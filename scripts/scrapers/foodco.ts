/* Foodco Nigeria — supermarket chain with online channel at
   foodco.ng. Focus is groceries + household + beverages. Smaller
   catalog than Supermart but distinct stocked SKUs (beer/wine
   selection in particular).

   Selectors and category slugs are inferred from common WooCommerce
   conventions; if the first cron yields zero deals across all
   pages, swap the slug pattern or remove the entry — the runner's
   per-page try/catch keeps a bad scrape from cascading. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeFoodco(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Foodco",
    storeId: "foodco",
    baseUrl: "https://www.foodco.ng",
    pages: [
      { url: "https://www.foodco.ng/product-category/groceries/",      cat: "groceries" },
      { url: "https://www.foodco.ng/product-category/beverages/",      cat: "groceries" },
      { url: "https://www.foodco.ng/product-category/household/",      cat: "home" },
      { url: "https://www.foodco.ng/product-category/personal-care/",  cat: "beauty" },
      { url: "https://www.foodco.ng/product-category/baby-care/",      cat: "home" },
    ],
  });
}
