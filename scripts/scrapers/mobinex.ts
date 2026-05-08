/* Mobinex Nigeria — phones-focused reseller at mobinex.ng. Smaller
   than Tezza but consistently has competitive Tecno + Infinix +
   Samsung mid-range pricing. Useful as a price-anchor for the
   ₦100k-₦300k phone segment that Slot / 3C Hub typically don't
   discount as aggressively.

   First-run note: this site has had intermittent uptime in past
   audits. The runner's per-page try/catch tolerates this — a
   transient down day produces a logged warning, not a crash. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeMobinex(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "Mobinex",
    storeId: "mobinex",
    baseUrl: "https://www.mobinex.ng",
    pages: [
      { url: "https://www.mobinex.ng/product-category/phones/",      cat: "phones" },
      { url: "https://www.mobinex.ng/product-category/tablets/",     cat: "phones" },
      { url: "https://www.mobinex.ng/product-category/accessories/", cat: "phones" },
      { url: "https://www.mobinex.ng/product-category/audio/",       cat: "audio" },
    ],
  });
}
