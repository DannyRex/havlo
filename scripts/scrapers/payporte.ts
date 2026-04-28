import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

/* PayPorte (payporte.com) — NG fashion + lifestyle marketplace.
   Site is Magento; product cards in .product-item. Generic walk-up
   pattern handles structure variations. */
const PAYPORTE_COLLECTIONS = [
  // Fashion (their core)
  { url: "https://www.payporte.com/women",                cat: "fashion" },
  { url: "https://www.payporte.com/women/clothing",       cat: "fashion" },
  { url: "https://www.payporte.com/women/shoes",          cat: "shoes" },
  { url: "https://www.payporte.com/women/bags",           cat: "bags" },
  { url: "https://www.payporte.com/men",                  cat: "fashion" },
  { url: "https://www.payporte.com/men/clothing",         cat: "fashion" },
  { url: "https://www.payporte.com/men/shoes",            cat: "shoes" },
  { url: "https://www.payporte.com/kids",                 cat: "fashion" },
  // Beauty + lifestyle
  { url: "https://www.payporte.com/beauty",               cat: "beauty" },
  { url: "https://www.payporte.com/health",               cat: "beauty" },
  { url: "https://www.payporte.com/jewelry-accessories",  cat: "fashion" },
  { url: "https://www.payporte.com/watches",              cat: "watches" },
  // Home
  { url: "https://www.payporte.com/home-living",          cat: "home" },
  // Sale page
  { url: "https://www.payporte.com/sale",                 cat: "fashion" },
];

export async function scrapePayPorte(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → PayPorte (Magento)...");

  for (const { url, cat } of PAYPORTE_COLLECTIONS) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

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

            let container: Element | null = link.parentElement;
            for (let i = 0; i < 8; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("₦")) {
                const fullText = text.replace(/\s+/g, " ").trim();
                const prices = [...fullText.matchAll(/₦([\d,]+)/g)]
                  .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
                  .filter((n) => n > 0);

                const salePrice = prices.length > 0 ? Math.min(...prices) : 0;
                const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                const heading = container.querySelector("h2, h3, h4, .product-name, .product-item-name, [class*='title']");
                const title = (heading?.textContent ?? link.textContent ?? "")
                  .replace(/\s+/g, " ").trim().slice(0, 100);

                const imgEl = container.querySelector("img.product-image-photo, img[src*='payporte'], img");
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

      const slug = url.split("payporte.com/")[1]?.split("?")[0] ?? "page";
      console.log(`    PayPorte ${slug}: ${items.length} products`);

      for (const item of items) {
        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://www.payporte.com${item.href.startsWith("/") ? "" : "/"}${item.href}`;
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
          description: `${item.title} — fashion + lifestyle at PayPorte.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "payporte",
          storeName: "PayPorte",
          originalPrice,
          salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["PayPorte", resolved.category],
        });
      }
    } catch (err) {
      console.warn(`    PayPorte collection failed: ${err}`);
    }
  }

  console.log(`  ✓ PayPorte: ${deals.length} deals`);
  return deals;
}
