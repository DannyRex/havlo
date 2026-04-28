import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

/* Obiwezy (obiwezy.com) — NG specialist in refurbished phones,
   laptops, and gadgets. Site is custom React-style; product cards
   are in .product-card with /product/<slug> links. Generic walk-up
   pattern used as fallback. */
const OBIWEZY_COLLECTIONS = [
  // Phones (their core)
  { url: "https://obiwezy.com/category/phones",         cat: "phones" },
  { url: "https://obiwezy.com/category/iphone",         cat: "phones" },
  { url: "https://obiwezy.com/category/samsung-phones", cat: "phones" },
  { url: "https://obiwezy.com/category/google-pixel",   cat: "phones" },
  { url: "https://obiwezy.com/category/refurbished-phones", cat: "phones" },
  // Computing
  { url: "https://obiwezy.com/category/laptops",        cat: "computing" },
  { url: "https://obiwezy.com/category/macbook",        cat: "computing" },
  { url: "https://obiwezy.com/category/tablets-ipads",  cat: "phones" },
  // Audio + electronics
  { url: "https://obiwezy.com/category/airpods-headphones", cat: "audio" },
  { url: "https://obiwezy.com/category/smartwatches",   cat: "electronics" },
  { url: "https://obiwezy.com/category/gaming",         cat: "gaming" },
  { url: "https://obiwezy.com/category/accessories",    cat: "electronics" },
  // Sale page (catches everything on promo)
  { url: "https://obiwezy.com/deals",                   cat: "phones" },
];

export async function scrapeObiwezy(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Obiwezy...");

  for (const { url, cat } of OBIWEZY_COLLECTIONS) {
    try {
      /* Wait for client-side render — Obiwezy is an SPA-style site. */
      await page.goto(url, { waitUntil: "networkidle", timeout: 35000 });
      try {
        await page.waitForSelector("a[href*='/product'], a[href*='/p/']", { timeout: 8000 });
      } catch {
        // empty / not loaded
      }
      await page.waitForTimeout(1500);

      const items = await page.$$eval(
        "a[href*='/product'], a[href*='/p/'], a[href*='/shop/']",
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

                const heading = container.querySelector("h2, h3, h4, .name, .title, [class*='title'], [class*='name']");
                const title = (heading?.textContent ?? link.textContent ?? "")
                  .replace(/\s+/g, " ").trim().slice(0, 100);

                const imgEl = container.querySelector("img");
                const rawSrc = imgEl?.getAttribute("src")
                  ?? imgEl?.getAttribute("data-src")
                  ?? imgEl?.getAttribute("data-lazy") ?? "";

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

      const slug = url.split("obiwezy.com/")[1] ?? "page";
      console.log(`    Obiwezy ${slug}: ${items.length} products`);

      for (const item of items) {
        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://obiwezy.com${item.href.startsWith("/") ? "" : "/"}${item.href}`;
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
          description: `${item.title} — refurbished + new at Obiwezy.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "obiwezy",
          storeName: "Obiwezy",
          originalPrice,
          salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Obiwezy", resolved.category],
        });
      }
    } catch (err) {
      console.warn(`    Obiwezy collection failed: ${err}`);
    }
  }

  console.log(`  ✓ Obiwezy: ${deals.length} deals`);
  return deals;
}
