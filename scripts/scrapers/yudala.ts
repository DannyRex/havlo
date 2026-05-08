/* Yudala Nigeria — early-stage NG marketplace at yudala.com (the
   .com domain is canonical; .com.ng redirects). Catalog is electronics
   + home heavy; was a major Konga competitor in the late 2010s and
   has been quieter since. Worth scraping for the price-comparison
   surface even at lower volume — when a Yudala listing exists, it's
   often distinctly priced from the bigger players.

   Caveat: Yudala's online presence has been patchy across years.
   First-run failure is plausible if the site is down or has
   restructured. The runner's per-page try/catch covers this — a
   bad scrape doesn't cascade. If 30 days of zero results pass, just
   remove this scraper from scrape.ts. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeYudala(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Yudala",
    storeId: "yudala",
    baseUrl: "https://www.yudala.com",
    pages: [
      { url: "https://www.yudala.com/product-category/phones-tablets/",   cat: "phones" },
      { url: "https://www.yudala.com/product-category/electronics/",      cat: "electronics" },
      { url: "https://www.yudala.com/product-category/computing/",        cat: "computing" },
      { url: "https://www.yudala.com/product-category/home-living/",      cat: "home" },
      { url: "https://www.yudala.com/product-category/appliances/",       cat: "appliances" },
    ],
  });
}
