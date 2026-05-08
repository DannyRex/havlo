/* Supermart Nigeria — online grocery + household at supermart.ng.
   Lagos-focused delivery network with fresh + dry goods + household
   essentials. Different audience from the Spar / Park n Shop pure
   hypermarket scrapers — Supermart has tighter SKU curation and
   surfaces deals on staples that bulk-shoppers price-track.

   Catalog notes:
     • WooCommerce-based but the theme uses '/shop/{slug}/' rather
       than '/product-category/{slug}/'. The default link selector
       ('a[href*="/product/"], a[href*="/shop/"]') already covers
       both — no per-store override needed.
     • Categories rotate seasonally (back-to-school, Christmas, etc.)
       so we stick to the always-on staples to keep the scrape stable
       across the year. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeSupermart(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Supermart",
    storeId: "supermart",
    baseUrl: "https://www.supermart.ng",
    pages: [
      { url: "https://www.supermart.ng/shop/groceries/",      cat: "groceries" },
      { url: "https://www.supermart.ng/shop/beverages/",      cat: "groceries" },
      { url: "https://www.supermart.ng/shop/household/",      cat: "home" },
      { url: "https://www.supermart.ng/shop/personal-care/",  cat: "beauty" },
      { url: "https://www.supermart.ng/shop/baby-care/",      cat: "home" },
      { url: "https://www.supermart.ng/shop/health/",         cat: "beauty" },
    ],
  });
}
