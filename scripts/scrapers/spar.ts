import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

export async function scrapeSpar(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Spar Nigeria...");

  /* Broader Spar coverage. Spar NG is a hypermarket — sells well
     beyond groceries. Covers all WooCommerce category slugs we've
     verified surface deals. */
  /* Domain confirmed: sparnigeria.com (not spar.com.ng — that one is
     dead/parked). Verified 2026-04 via curl HEAD. */
  const pages = [
    { url: "https://sparnigeria.com/specials/",                       cat: "supermarket" },
    { url: "https://sparnigeria.com/product-category/food-cupboard/", cat: "supermarket" },
    { url: "https://sparnigeria.com/product-category/beverages/",     cat: "supermarket" },
    { url: "https://sparnigeria.com/product-category/dairy/",         cat: "supermarket" },
    { url: "https://sparnigeria.com/product-category/fresh-frozen/",  cat: "supermarket" },
    { url: "https://sparnigeria.com/product-category/household/",     cat: "home" },
    { url: "https://sparnigeria.com/product-category/health-beauty/", cat: "beauty" },
    { url: "https://sparnigeria.com/product-category/baby-care/",     cat: "home" },
    { url: "https://sparnigeria.com/product-category/electronics/",   cat: "electronics" },
    { url: "https://sparnigeria.com/product-category/home-living/",   cat: "home" },
  ];

  for (const { url, cat } of pages) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2000);

      /* Generic walk-up-DOM pattern (same as 3C Hub). Anchor on any
         /product/ link, walk up to find a container with ₦, extract
         title + min/max prices. Robust against unknown WooCommerce
         theme variations. */
      const items = await page.$$eval(
        "a[href*='/product/'], a[href*='/shop/'], .product a",
        (links) => {
          const seen = new Set<string>();
          const results: Array<{ title: string; saleText: string; origText: string; href: string }> = [];

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

                const salePrice     = prices.length > 0 ? Math.min(...prices) : 0;
                const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                const heading = container.querySelector("h2, h3, h4, .name, .product-title, [class*='title']");
                const title = (heading?.textContent ?? link.textContent ?? "")
                  .replace(/\s+/g, " ").trim().slice(0, 100);

                if (title && salePrice > 0) {
                  results.push({
                    title,
                    saleText: String(salePrice),
                    origText: originalPrice > salePrice ? String(originalPrice) : "",
                    href,
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

      const slug = url.split("sparnigeria.com/")[1]?.split("?")[0] ?? "page";
      console.log(`    Spar ${slug}: ${items.length} items`);

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
