/* MedPlus Nigeria — second-largest NG pharmacy chain, online at
   medplusnig.com (note the .com, not .com.ng — pre-empts a common
   404). Site runs custom-themed WooCommerce; the generic walk-up
   template handles it without per-page selector tuning.

   Catalog notes:
     • Beauty + skincare share the heaviest deal flow
     • Baby + family wellness are smaller but distinct catalogs
     • Same Naira-only pricing convention as HealthPlus
     • One known quirk: some category pages render seasonal
       headers above the product grid — the generic runner walks
       UP from the product link so the header doesn't pollute
       title extraction. */

import type { Page } from "playwright";
import { RawDeal } from "./types.js";
import { scrapeNairaWoo } from "./_generic-naira.js";

export async function scrapeMedPlus(page: Page): Promise<RawDeal[]> {
  return scrapeNairaWoo(page, {
    name:    "MedPlus",
    storeId: "medplus",
    baseUrl: "https://www.medplusnig.com",
    pages: [
      { url: "https://www.medplusnig.com/product-category/beauty/",         cat: "beauty" },
      { url: "https://www.medplusnig.com/product-category/personal-care/",  cat: "beauty" },
      { url: "https://www.medplusnig.com/product-category/skin-care/",      cat: "beauty" },
      { url: "https://www.medplusnig.com/product-category/baby-mother/",    cat: "home" },
      { url: "https://www.medplusnig.com/product-category/wellness/",       cat: "beauty" },
      { url: "https://www.medplusnig.com/product-category/vitamins-supplements/", cat: "beauty" },
    ],
  });
}
