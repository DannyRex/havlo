import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

// 3C Hub is Shopify. Confirmed: a[href*='/products/'] links work.
// Product card text format: "TITLE [From] ₦SALE ₦ORIG ..."
const THREECHUB_COLLECTIONS = [
  { url: "https://www.3chub.com/collections/all?sort_by=best-selling&filter.p.m.custom.on_sale=true", cat: "electronics" },
  { url: "https://www.3chub.com/collections/samsung-mobile-phone",   cat: "phones" },
  { url: "https://www.3chub.com/collections/tecno-mobile-phone",     cat: "phones" },
  { url: "https://www.3chub.com/collections/infinix-mobile-phone",   cat: "phones" },
  { url: "https://www.3chub.com/collections/xiaomi-mobile-phone",    cat: "phones" },
  { url: "https://www.3chub.com/collections/solar-products",         cat: "electronics" },
  { url: "https://www.3chub.com/collections/iphone",                 cat: "phones" },
  { url: "https://www.3chub.com/collections/all?sort_by=best-selling", cat: "electronics" },
  { url: "https://www.3chub.com/collections/laptops",                cat: "computing" },
  { url: "https://www.3chub.com/collections/televisions",            cat: "electronics" },
  { url: "https://www.3chub.com/collections/audio",                  cat: "audio" },
  { url: "https://www.3chub.com/collections/smart-watches",          cat: "electronics" },
  { url: "https://www.3chub.com/collections/gaming",                 cat: "gaming" },
  { url: "https://www.3chub.com/collections/accessories",            cat: "electronics" },
  { url: "https://www.3chub.com/collections/tablets",                cat: "phones" },
];

export async function scrapeThreeChub(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → 3C Hub (Shopify)...");

  for (const { url, cat } of THREECHUB_COLLECTIONS) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Anchor on product links, then walk up to find the card container with price
      const items = await page.$$eval("a[href*='/products/']", (links) => {
        const seen = new Set<string>();
        const results: Array<{ title: string; origText: string; saleText: string; href: string; imageUrl: string }> = [];

        for (const link of links) {
          const href = link.getAttribute("href") ?? "";
          if (!href || seen.has(href)) continue;
          seen.add(href);

          // Walk up DOM to find a container that has a price (₦)
          let container: Element | null = link.parentElement;
          for (let i = 0; i < 8; i++) {
            if (!container) break;
            const text = container.textContent ?? "";
            if (text.includes("₦")) {
              // Found the card — parse title and prices
              const fullText = text.replace(/\s+/g, " ").trim();

              // Extract all Naira prices
              const prices = [...fullText.matchAll(/₦([\d,]+)/g)]
                .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
                .filter((n) => n > 0);

              const salePrice     = prices.length > 0 ? Math.min(...prices) : 0;
              const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

              // Title: from the link text or heading near it
              const heading = container.querySelector("h2, h3, h4, [class*='title'], [class*='name']");
              const title   = (heading?.textContent ?? link.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100);

              // Image: Shopify CDN images are in img[src*='cdn.shopify'] or img[srcset]
              const imgEl   = container.querySelector("img[src*='shopify'], img[src*='cdn'], img[src*='3chub'], img");
              const rawSrc  = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? "";
              // Shopify srcset often has better resolution — grab first entry
              const srcset  = imgEl?.getAttribute("srcset") ?? "";
              const srcsetFirst = srcset ? srcset.split(",")[0].trim().split(" ")[0] : "";
              const imageUrl = srcsetFirst || rawSrc;
              // Ensure absolute URL
              const absoluteImg = imageUrl.startsWith("//") ? `https:${imageUrl}` : imageUrl;

              if (title && salePrice > 0) {
                results.push({
                  title,
                  origText: originalPrice > salePrice ? String(originalPrice) : "",
                  saleText: String(salePrice),
                  href,
                  imageUrl: absoluteImg,
                });
              }
              break;
            }
            container = container.parentElement;
          }
        }

        return results;
      });

      const slug = url.split("/collections/")[1]?.split("?")[0] ?? "collection";
      console.log(`    3C Hub ${slug}: ${items.length} products`);

      for (const item of items) {
        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://www.3chub.com${item.href}`;

        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const salePrice     = parseNaira(item.saleText);
        const originalPrice = item.origText ? parseNaira(item.origText) : salePrice;
        if (!salePrice || salePrice <= 0) continue;

        const discountPercent = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        const resolved = resolveCategory(cat);

        deals.push({
          title: item.title,
          description: `${item.title} — shop at 3C Hub, Nigeria's trusted gadget store.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "threechub",
          storeName: "3C Hub",
          originalPrice,
          salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["3C Hub", resolved.category],
        });
      }
    } catch (err) {
      console.warn(`    3C Hub collection failed: ${err}`);
    }
  }

  console.log(`  ✓ 3C Hub: ${deals.length} deals`);
  return deals;
}
