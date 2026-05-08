/* MedPlus Nigeria — second-largest NG pharmacy chain. Custom-themed
   site at medplusnig.com (note .com — .com.ng was a wrong guess
   earlier).

   NOT on Shopify or WooCommerce. Server-renders Tailwind-themed
   product cards with the class `inline_product`. The "discounted"
   browse view at /products?data_from=discounted&page=N is the
   richest single source — it lists every product currently on sale
   across all categories. We paginate that until empty.

   Markup notes (verified May 2026):
     • Product card:    .inline_product
     • Title:           .single-product-details > div > a
     • Sale price:      .product-price .text-accent
     • Original price:  .product-price strike
     • Discount badge:  .bg-[#FFE5E5] text-[#FF0000]
     • Link target:     /product/{slug}
     • Image:           <img src=...> inside card

   Pagination caps at 5 pages (~120 deals) because MedPlus's
   discounted page-N urls eventually 200 with empty results — the
   loop exits early when a page yields zero new cards. */

import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

const PAGE_LIMIT = 5;

export async function scrapeMedPlus(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → MedPlus...");

  for (let pageNum = 1; pageNum <= PAGE_LIMIT; pageNum++) {
    const url = `https://medplusnig.com/products?data_from=discounted&page=${pageNum}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2000);

      const items = await page.$$eval(".inline_product", (cards) =>
        cards.map((card) => {
          /* Title — first <a> inside .single-product-details has the
             full product title as visible text. Trimmed because the
             template wraps it with whitespace. */
          const titleLink = card.querySelector(".single-product-details a[href*='/product/']") as HTMLAnchorElement | null;
          const title = (titleLink?.textContent ?? "").replace(/\s+/g, " ").trim();
          const href  = titleLink?.getAttribute("href") ?? "";

          /* Price extraction — sale in .product-price .text-accent,
             original in .product-price strike. Both render as
             '₦12,345.67' so we strip non-digits + parse. */
          const saleEl = card.querySelector(".product-price .text-accent") as HTMLElement | null;
          const origEl = card.querySelector(".product-price strike") as HTMLElement | null;
          const saleText = saleEl?.textContent ?? "";
          const origText = origEl?.textContent ?? "";
          const parseNgn = (s: string) => {
            const digits = s.replace(/[^0-9]/g, "");
            return digits ? parseInt(digits, 10) : 0;
          };
          /* MedPlus prices include kobo (₦12,345.67). The replace
             strips the decimal too, so 1234567 reads as 1234567 raw.
             Divide by 100 to get back to whole Naira for storage. */
          const salePriceRaw = parseNgn(saleText);
          const origPriceRaw = parseNgn(origText);
          const salePrice = Math.round(salePriceRaw / 100);
          const originalPrice = origPriceRaw > 0 ? Math.round(origPriceRaw / 100) : salePrice;

          /* Image — first <img> inside the card. MedPlus serves
             from DigitalOcean Spaces; the URL is the actual src
             attribute (no lazy-load hop). */
          const imgEl = card.querySelector("img") as HTMLImageElement | null;
          const imageUrl = imgEl?.getAttribute("src") ?? "";

          /* Discount badge — text like "-2.5% Off". When present,
             use it directly; otherwise derive from prices. */
          const discBadge = card.querySelector("span[class*='FFE5E5']") as HTMLElement | null;
          const discMatch = (discBadge?.textContent ?? "").match(/-?(\d+(?:\.\d+)?)\s*%/);
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
