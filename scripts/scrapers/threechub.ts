/* 3C Hub — major NG electronics chain. Runs on Shopify at
   www.3chub.com.

   This used to be a Playwright collection-scrape, but the SPA-style
   theme rendering meant the per-collection card walk-up was timing
   out and producing only ~4 products per collection (56 deals from
   15 collections). The QA agent flagged the resulting flagship gap:
   "iPhone 15 Pro Max" had zero NG retailer coverage despite 3C Hub
   stocking the 17 series.

   Fixed by using the Shopify Public Storefront JSON endpoint (same
   path as HealthPlus, Supermart, Essenza, MedPlus). Same shape,
   structured pricing, no theme-render timing. Pulls every product
   in each named collection in one round-trip.

   Collection picks below are intentionally phone-and-electronics
   heavy — that's 3C Hub's core, and the remaining accessory /
   power-bank collections were producing low-quality cards in the old
   scraper anyway. Easy to extend if we want broader coverage later.

   The Page parameter is unused — kept to match scrape.ts's
   orchestrator signature. The runtime calls fetch, not Playwright,
   which saves ~30s per cron run vs. browser-based scraping. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeShopifyCatalog } from "./_shopify-json.js";

export async function scrapeThreeChub(_page: Page): Promise<RawDeal[]> {
  return scrapeShopifyCatalog({
    name:    "3C Hub",
    storeId: "threechub",
    baseUrl: "https://www.3chub.com",
    /* Phone collections first so iPhone / Galaxy / Tecno flagships
       are guaranteed to surface. Brand-specific handles take priority
       over the generic 'mobile-phones' bucket because they're cleaner
       (no spillover from other brands' returns). */
    collections: [
      // Apple iPhone — flagship coverage
      { handle: "iphone-17-series",       cat: "phones" },
      { handle: "iphone-16-series",       cat: "phones" },
      { handle: "iphone",                 cat: "phones" },
      // Samsung — S series, Z Fold/Flip, A series
      { handle: "samsung-mobile-phone",   cat: "phones" },
      // Top-3 NG-popular budget brands
      { handle: "tecno-mobile-phone",     cat: "phones" },
      { handle: "infinix-mobile-phone",   cat: "phones" },
      { handle: "itel-mobile-phone",      cat: "phones" },
      // Other budget brands
      { handle: "xiaomi-mobile-phone",    cat: "phones" },
      { handle: "oppo",                   cat: "phones" },
      { handle: "vivo",                   cat: "phones" },
      { handle: "honor",                  cat: "phones" },
      // Curated catch-all + bestsellers
      { handle: "top-smart-phone",        cat: "phones" },
      { handle: "smart-phone",            cat: "phones" },
      // Adjacent categories
      { handle: "tablets",                cat: "phones" },
      { handle: "tvs",                    cat: "electronics" },
      { handle: "earphone",               cat: "audio" },
    ],
    /* Each phone-brand collection at 3C Hub is small (3–25 products).
       1 page × 250 covers the entire active catalog per collection. */
    pageLimit: 1,
  });
}
