import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

const JIJI_PAGES = [
  { url: "https://jiji.ng/nigeria/phones-and-tablets",  cat: "phones" },
  { url: "https://jiji.ng/nigeria/electronics",          cat: "electronics" },
  { url: "https://jiji.ng/nigeria/computers",            cat: "computing" },
  { url: "https://jiji.ng/nigeria/fashion",              cat: "fashion" },
  { url: "https://jiji.ng/nigeria/tv-audio-video",       cat: "electronics" },
  { url: "https://jiji.ng/nigeria/games-consoles",       cat: "gaming" },
];

export async function scrapeJiji(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Jiji.ng...");

  // Set a realistic user-agent to bypass Jiji's block
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-NG,en;q=0.9",
  });

  for (const { url, cat } of JIJI_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      // Scroll to trigger lazy load
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(1000);

      const items = await page.$$eval(
        "[class*='b-list-advert'], article[data-id], .b-advert-list__item",
        (cards) =>
          cards.slice(0, 40).map((card) => {
            const titleEl = card.querySelector("h3, .b-advert-title, [class*='title']");
            const priceEl = card.querySelector("[class*='price'], .qa-advert-price");
            const linkEl  = card.querySelector("a");

            return {
              title:     titleEl?.textContent?.trim() ?? "",
              priceText: priceEl?.textContent?.trim() ?? "",
              href:      linkEl?.getAttribute("href") ?? "",
            };
          })
      );

      for (const item of items) {
        if (!item.title || !item.href || item.priceText.toLowerCase().includes("call")) continue;

        const href = item.href.startsWith("http")
          ? item.href
          : `https://jiji.ng${item.href}`;

        if (seenUrls.has(href)) continue;

        const price = parseNaira(item.priceText);
        if (!price || price <= 1000) continue;

        seenUrls.add(href);
        const resolved = resolveCategory(cat);

        deals.push({
          title: item.title.slice(0, 80),
          description: `${item.title.slice(0, 80)} — listed on Jiji.ng, Nigeria's largest classifieds marketplace.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "jiji",
          storeName: "Jiji",
          originalPrice: price,
          salePrice: price,
          discountPercent: 0, // Jiji is classifieds — no original price
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: href,
          tags: ["Jiji", "Classifieds", resolved.category],
        });
      }

      console.log(`    ${url.split("/").pop()}: ${items.length} items`);
    } catch (err) {
      console.warn(`    Jiji ${cat} failed: ${err}`);
    }
  }

  console.log(`  ✓ Jiji: ${deals.length} listings`);
  return deals;
}
