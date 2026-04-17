import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

export async function scrapeSpar(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Spar Nigeria...");

  const pages = [
    { url: "https://www.spar.com.ng/specials/",      cat: "supermarket" },
    { url: "https://www.spar.com.ng/product-category/food-cupboard/", cat: "supermarket" },
    { url: "https://www.spar.com.ng/product-category/beverages/",     cat: "supermarket" },
  ];

  for (const { url, cat } of pages) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2000);

      const items = await page.$$eval(
        ".product, li.product, .product-small",
        (cards) =>
          cards.slice(0, 30).map((card) => {
            const titleEl  = card.querySelector("h2, h3, .name, .product-title");
            const origEl   = card.querySelector("del .amount, del bdi, del");
            const saleEl   = card.querySelector("ins .amount, ins bdi, ins, .price .amount");
            const linkEl   = card.querySelector("a");

            return {
              title:    titleEl?.textContent?.trim() ?? "",
              origText: origEl?.textContent?.trim() ?? "",
              saleText: saleEl?.textContent?.trim() ?? "",
              href:     linkEl?.getAttribute("href") ?? "",
            };
          })
      );

      for (const item of items) {
        if (!item.title || !item.href) continue;
        if (seenUrls.has(item.href)) continue;

        const salePrice     = parseNaira(item.saleText || item.origText);
        const originalPrice = item.origText ? parseNaira(item.origText) : salePrice;
        if (!salePrice || salePrice <= 0) continue;

        const discountPercent = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        seenUrls.add(item.href);
        const resolved = resolveCategory(cat);

        deals.push({
          title: item.title,
          description: `${item.title} — available in-store and online at Spar Nigeria.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "spar",
          storeName: "Spar Nigeria",
          originalPrice,
          salePrice,
          discountPercent,
          imageEmoji: "🛒",
          imageGradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
          url: item.href,
          tags: ["Spar", "Supermarket", "Grocery"],
        });
      }

      console.log(`    ${url.split("/").slice(-2, -1)[0]}: ${items.length} items`);
    } catch (err) {
      console.warn(`    Spar page failed: ${err}`);
    }
  }

  console.log(`  ✓ Spar: ${deals.length} deals`);
  return deals;
}
