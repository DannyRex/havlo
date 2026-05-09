/* MedPlus Nigeria — second-largest NG pharmacy chain. Custom-themed
   site at medplusnig.com (note .com — .com.ng was a wrong guess
   earlier).

   NOT on Shopify or WooCommerce. Server-renders Tailwind-themed
   product cards inside Bootstrap grid columns. The catch-all browse
   view at /products?page=N returns 20 products per page. Earlier
   the scraper used /products?data_from=discounted&page=N which
   only showed one featured discounted product per page (a hero
   surface, not a listing).

   Markup notes (verified May 2026):
     • Card container:  div.col-lg-3 (Bootstrap grid column)
     • Image side:      .inline_product (child of the col-lg-3)
     • Text side:       .single-product-details (sibling, not child)
     • Title:           .single-product-details a[href*='/product/']
     • Sale price:      .product-price .text-accent
     • Original price:  .product-price strike
     • Discount badge:  .bg-[#FFE5E5] text-[#FF0000] (when present)
     • Link target:     /product/{slug}
     • Image:           <img src=...> from DigitalOcean Spaces CDN

   20 products per page × 10 pages = up to 200 deals per cron run,
   which is plenty given the broader cron also pulls Konga / 3C Hub
   / Slot etc. Loop exits on the first empty page. */

import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

const PAGE_LIMIT = 10;

export async function scrapeMedPlus(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → MedPlus...");

  for (let pageNum = 1; pageNum <= PAGE_LIMIT; pageNum++) {
    /* Catch-all listing — 20 products per page. Was
       /products?data_from=discounted which only showed 1 featured
       product per page. */
    const url = `https://medplusnig.com/products?page=${pageNum}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2000);

      /* The actual product container is the Bootstrap grid column
         wrapping BOTH the .inline_product (image side) AND
         .single-product-details (title/price side). They're siblings
         inside a `col-*` div. Querying .inline_product directly
         missed the price/title because they're outside that node.

         IMPORTANT: NO inner helper functions, no default params, no
         destructuring of optional chains. tsx + esbuild desugars
         those into `__name()` calls that don't exist in Playwright's
         browser context, throwing ReferenceError when $$eval runs.
         Everything below is intentionally one inlined block. */
      const items = await page.$$eval(
        "div[class*='col-lg-3']:has(.inline_product)",
        (cards) => cards.map((card) => {
          /* Title — first /product/ link inside the card. The
             template renders the title as visible text inside that
             link in .single-product-details. */
          const titleLink = card.querySelector(".single-product-details a[href*='/product/']") as HTMLAnchorElement | null;
          const title = (titleLink && titleLink.textContent ? titleLink.textContent : "").replace(/\s+/g, " ").trim();
          const href  = titleLink ? (titleLink.getAttribute("href") || "") : "";

          /* Price extraction — sale in .product-price .text-accent,
             original in .product-price strike. Both render as
             '₦12,345.67'. Inlined parsing (no helper function). */
          const saleEl = card.querySelector(".product-price .text-accent") as HTMLElement | null;
          const origEl = card.querySelector(".product-price strike") as HTMLElement | null;
          const saleText = saleEl && saleEl.textContent ? saleEl.textContent : "";
          const origText = origEl && origEl.textContent ? origEl.textContent : "";
          const saleDigits = saleText.replace(/[^0-9]/g, "");
          const origDigits = origText.replace(/[^0-9]/g, "");
          /* MedPlus prices include kobo (12,345.67 → 1234567 raw).
             Divide by 100 to get back to whole Naira for storage. */
          const salePrice = saleDigits ? Math.round(parseInt(saleDigits, 10) / 100) : 0;
          const originalPrice = origDigits ? Math.round(parseInt(origDigits, 10) / 100) : salePrice;

          /* Image — inside the .inline_product child. MedPlus serves
             from DigitalOcean Spaces; src attribute is the real URL. */
          const imgEl = card.querySelector("img") as HTMLImageElement | null;
          const imageUrl = imgEl ? (imgEl.getAttribute("src") || "") : "";

          /* Discount badge — text like "-2.5% Off". Inline regex. */
          const discBadge = card.querySelector("span[class*='FFE5E5']") as HTMLElement | null;
          const discText = discBadge && discBadge.textContent ? discBadge.textContent : "";
          const discMatch = discText.match(/-?(\d+(?:\.\d+)?)\s*%/);
          const discountFromBadge = discMatch ? Math.round(parseFloat(discMatch[1])) : 0;

          return { title, href, salePrice, originalPrice, imageUrl, discountFromBadge };
        }),
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href || !item.salePrice) continue;
        const fullUrl = item.href.startsWith("http") ? item.href : `https://medplusnig.com${item.href}`;
        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const discountPercent = item.discountFromBadge > 0
          ? item.discountFromBadge
          : item.originalPrice > item.salePrice
            ? Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)
            : 0;

        /* Category — MedPlus is a pharmacy so most items are beauty
           / skincare / wellness. Title-based heuristic catches
           non-pharmacy items (electronic thermometers, baby gear). */
        const t = item.title.toLowerCase();
        const cat = /baby|infant|nappy|diaper|bottle/.test(t) ? "home"
          : /thermometer|monitor|digital|electronic/.test(t) ? "electronics"
          : "beauty";
        const resolved = resolveCategory(cat);

        deals.push({
          title:           item.title,
          description:     `${item.title} — shop on MedPlus.`,
          category:        resolved.category,
          categorySlug:    resolved.slug,
          storeId:         "medplus",
          storeName:       "MedPlus",
          originalPrice:   item.originalPrice,
          salePrice:       item.salePrice,
          discountPercent,
          currency:        "NGN",
          imageUrl:        item.imageUrl || undefined,
          imageEmoji:      resolved.emoji,
          imageGradient:   resolved.gradient,
          url:             fullUrl,
          tags:            ["MedPlus", resolved.category],
        });
        pageDeals++;
      }

      console.log(`    MedPlus page ${pageNum}: ${items.length} cards → ${pageDeals} deals`);
      /* Empty page → exit loop. MedPlus's pagination silently 200s on
         out-of-range pages with zero cards, so this is the natural
         stop signal. */
      if (items.length === 0) break;
    } catch (err) {
      console.warn(`    MedPlus page ${pageNum} failed: ${(err as Error).message}`);
      break; // network / timeout — abort the rest
    }
  }

  console.log(`  ✓ MedPlus: ${deals.length} deals`);
  return deals;
}
