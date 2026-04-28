import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

/* Kara (kara.com.ng) — strong NG electronics + mobile retailer.
   Site uses Magento; product cards live under .product-item, prices
   in .price-final_price / .price-old. Generic walk-up-DOM-find-price
   fallback handles layout drift. */
const KARA_COLLECTIONS = [
  // Electronics + tech
  { url: "https://www.kara.com.ng/electronics",            cat: "electronics" },
  { url: "https://www.kara.com.ng/electronics/mobile-phones-1", cat: "phones" },
  { url: "https://www.kara.com.ng/electronics/computers-laptops", cat: "computing" },
  { url: "https://www.kara.com.ng/electronics/televisions", cat: "televisions" },
  { url: "https://www.kara.com.ng/electronics/home-audio",  cat: "audio" },
  { url: "https://www.kara.com.ng/electronics/cameras-photo", cat: "electronics" },
  { url: "https://www.kara.com.ng/electronics/gaming",      cat: "gaming" },
  { url: "https://www.kara.com.ng/electronics/wearable-technology", cat: "electronics" },
  // Appliances
  { url: "https://www.kara.com.ng/home-appliances",         cat: "appliances" },
  { url: "https://www.kara.com.ng/home-appliances/refrigerators", cat: "appliances" },
  { url: "https://www.kara.com.ng/home-appliances/washing-machines", cat: "appliances" },
  // Home + lifestyle
  { url: "https://www.kara.com.ng/home-kitchen",            cat: "home" },
  { url: "https://www.kara.com.ng/health-beauty",           cat: "beauty" },
  { url: "https://www.kara.com.ng/fashion",                 cat: "fashion" },
  // Deals/sale page (catches everything on promo)
  { url: "https://www.kara.com.ng/sale",                    cat: "electronics" },
];

export async function scrapeKara(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Kara (Magento)...");

  for (const { url, cat } of KARA_COLLECTIONS) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      /* Magento: anchor on a.product-item-link first, fall back to
         walking up from any product link. Same generic pattern as
         3C Hub — finds container with ₦, extracts title + prices. */
      const items = await page.$$eval(
        "a.product-item-link, .product-item a[href*='.html'], a[href*='/product/']",
        (links) => {
          const seen = new Set<string>();
          const results: Array<{
            title: string; saleText: string; origText: string;
            href: string; imageUrl: string;
          }> = [];

          for (const link of links) {
            const href = link.getAttribute("href") ?? "";
            if (!href || seen.has(href)) continue;
            seen.add(href);

            // Walk up to find container with ₦
            let container: Element | null = link.parentElement;
            for (let i = 0; i < 8; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("₦")) {
                const fullText = text.replace(/\s+/g, " ").trim();
                const prices = [...fullText.matchAll(/₦([\d,]+)/g)]
                  .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
                  .filter((n) => n > 0);

                const salePrice     = prices.length > 0 ? Math.min(...prices) : 0;
                const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                const heading = container.querySelector("h2, h3, h4, .product-name, .product-item-name, [class*='title']");
                const title   = (heading?.textContent ?? link.textContent ?? "")
                  .replace(/\s+/g, " ").trim().slice(0, 100);

                const imgEl = container.querySelector("img.product-image-photo, img[src*='kara'], img");
                const rawSrc = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? "";

                if (title && salePrice > 0) {
                  results.push({
                    title,
                    saleText: String(salePrice),
                    origText: originalPrice > salePrice ? String(originalPrice) : "",
                    href,
                    imageUrl: rawSrc.startsWith("//") ? `https:${rawSrc}` : rawSrc,
                  });
                }
                break;
              }
              container = container.parentElement;
            }
          }
          return results;
        },
      );

      const slug = url.split("kara.com.ng/")[1]?.split("?")[0] ?? "page";
      console.log(`    Kara ${slug}: ${items.length} products`);

      for (const item of items) {
        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://www.kara.com.ng${item.href.startsWith("/") ? "" : "/"}${item.href}`;
        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const salePrice = parseNaira(item.saleText);
        const originalPrice = item.origText ? parseNaira(item.origText) : salePrice;
        if (!salePrice || salePrice <= 0) continue;

        const discountPercent = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        const resolved = resolveCategory(cat);
        deals.push({
          title: item.title,
          description: `${item.title} — shop at Kara, NG electronics retailer.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "kara",
          storeName: "Kara",
          originalPrice,
          salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Kara", resolved.category],
        });
      }
    } catch (err) {
      console.warn(`    Kara collection failed: ${err}`);
    }
  }

  console.log(`  ✓ Kara: ${deals.length} deals`);
  return deals;
}
