import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// Amazon affiliate: Amazon Associates (affiliate-program.amazon.com)
// Tag: add affiliate tag to product URLs

const AMAZON_PAGES = [
  { url: "https://www.amazon.com/s?i=electronics&rh=n:172282,p_n_deal_type:23566064011&s=exact-aware-popularity-rank", cat: "electronics" },
  { url: "https://www.amazon.com/s?i=wireless&rh=n:2335752011,p_n_deal_type:23566064011&s=exact-aware-popularity-rank", cat: "phones" },
  { url: "https://www.amazon.com/s?i=fashion&rh=p_n_deal_type:23566064011&s=exact-aware-popularity-rank",              cat: "fashion" },
];

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|iphone|samsung|pixel|oneplus|airpod|earbud|earphone|headphone/.test(t)) return "phones";
  if (/laptop|macbook|notebook|chromebook|tablet|ipad/.test(t)) return "computing";
  if (/\btv\b|television|monitor|smart tv/.test(t)) return "televisions";
  if (/dress|shirt|blouse|trouser|jeans|skirt|cloth|sneaker|shoe|bag/.test(t)) return "fashion";
  if (/cream|serum|perfume|cologne|skin|hair|make.?up|beauty/.test(t)) return "beauty";
  if (/fridge|washer|microwave|cooker|blender/.test(t)) return "appliances";
  return "electronics";
}

export async function scrapeAmazon(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Amazon...");

  for (const { url, cat } of AMAZON_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(3000);

      // Amazon search result items
      const items = await page.$$eval(
        "[data-component-type='s-search-result']",
        (cards) =>
          cards.slice(0, 30).map((card) => {
            const fullText = card.textContent?.replace(/\s+/g, " ").trim() ?? "";

            // Title
            const titleEl = card.querySelector("h2 span, h2 a span, [class*='title'] span");
            const title   = (titleEl?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

            // Prices — Amazon uses whole + fraction format
            const priceWhole = card.querySelector(".a-price-whole, [class*='price-whole']");
            const priceFrac  = card.querySelector(".a-price-fraction, [class*='price-fraction']");
            const saleStr    = priceWhole
              ? `${priceWhole.textContent?.replace(/[^0-9]/g, "") ?? ""}.${priceFrac?.textContent?.replace(/[^0-9]/g, "") ?? "00"}`
              : "";

            // Original price (struck-through)
            const origEl  = card.querySelector(".a-text-price .a-offscreen, [class*='basis-price'] .a-offscreen");
            const origStr = (origEl?.textContent ?? "").replace(/[^0-9.]/g, "");

            // Link
            const linkEl = card.querySelector("a[href*='/dp/'], h2 a");
            const href   = linkEl?.getAttribute("href") ?? "";

            // Image
            const imgEl   = card.querySelector("img.s-image, img[class*='product-image']");
            const imageUrl = imgEl?.getAttribute("src") ?? "";

            return { title, saleStr, origStr, href, imageUrl };
          })
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href) continue;
        const salePrice = parseFloat(item.saleStr);
        const origPrice = parseFloat(item.origStr) || salePrice;
        if (!salePrice || salePrice < 1) continue;

        const fullUrl = item.href.startsWith("http")
          ? item.href.split("?")[0]
          : `https://www.amazon.com${item.href.split("?")[0]}`;

        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const discountPercent = origPrice > salePrice
          ? Math.round(((origPrice - salePrice) / origPrice) * 100)
          : 0;

        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} — shop on Amazon with global shipping.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "amazon",
          storeName: "Amazon",
          originalPrice: origPrice,
          salePrice,
          discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Amazon", "International", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.includes("electronics") ? "electronics" : url.includes("wireless") ? "phones" : "fashion";
      console.log(`    Amazon ${slug}: ${items.length} cards → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    Amazon failed: ${err}`);
    }
  }

  console.log(`  ✓ Amazon: ${deals.length} deals`);
  return deals;
}
