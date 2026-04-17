import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

// Confirmed selector: [class*='item'][class*='product'] (60 cards per page)
// Card text format: "TITLE₦PRICE Quick View Wishlist"  (or "TITLE₦ORIG₦SALE Quick View...")
const SLOT_PAGES = [
  { url: "https://www.slot.ng/product-category/smartphones/",          cat: "phones" },
  { url: "https://www.slot.ng/product-category/laptops/",              cat: "computing" },
  { url: "https://www.slot.ng/product-category/tablets/",              cat: "phones" },
  { url: "https://www.slot.ng/product-category/smart-watches-bands/",  cat: "electronics" },
  { url: "https://www.slot.ng/product-category/earphones-headphones/", cat: "audio" },
];

export async function scrapeSlot(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Slot.ng...");

  for (const { url, cat } of SLOT_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      const items = await page.$$eval(
        "[class*='item'][class*='product']",
        (cards) =>
          cards.slice(0, 60).map((card) => {
            // Full text: "PRODUCT NAME₦12,345 Quick View Wishlist"
            // Or on sale: "PRODUCT NAME₦15,000₦12,345 Quick View Wishlist"
            const fullText = card.textContent?.replace(/\s+/g, " ").trim() ?? "";

            // Extract all Naira prices
            const priceMatches = [...fullText.matchAll(/₦([\d,]+)/g)];
            const prices = priceMatches
              .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
              .filter((n) => n > 0);

            const salePrice     = prices.length > 0 ? Math.min(...prices) : 0;
            const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

            // Title: everything before the first ₦
            const titleMatch = fullText.match(/^([^₦]+)/);
            const rawTitle   = titleMatch?.[1]?.trim() ?? "";
            // Remove leading/trailing noise, limit length
            const title = rawTitle.replace(/^\s*[-–]\s*/, "").slice(0, 100).trim();

            // Get link — Slot product URLs contain /product/ or slot.ng
            const links = card.querySelectorAll("a");
            let href = "";
            for (const a of links) {
              const h = a.getAttribute("href") ?? "";
              if (h.includes("/product") || (h.startsWith("http") && h.includes("slot.ng"))) {
                href = h;
                break;
              }
            }
            if (!href) {
              const firstLink = card.querySelector("a");
              href = firstLink?.getAttribute("href") ?? "";
            }

            // Image
            const imgEl   = card.querySelector("img");
            const imageUrl = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

            return { title, salePrice, originalPrice, href, imageUrl };
          })
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href || !item.salePrice) continue;
        if (item.salePrice < 1000) continue;

        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://www.slot.ng${item.href}`;

        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const discountPercent = item.originalPrice > item.salePrice
          ? Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)
          : 0;

        const resolved = resolveCategory(cat);

        deals.push({
          title: item.title,
          description: `${item.title} — available at Slot Nigeria, #1 phone retailer.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "slot",
          storeName: "Slot",
          originalPrice: item.originalPrice,
          salePrice: item.salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Slot", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("/").slice(-2, -1)[0];
      console.log(`    Slot ${slug}: ${items.length} cards → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    Slot failed: ${err}`);
    }
  }

  console.log(`  ✓ Slot: ${deals.length} deals`);
  return deals;
}
