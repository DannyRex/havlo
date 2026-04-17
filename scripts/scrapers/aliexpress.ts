import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// AliExpress affiliate: Admitad / AliExpress Portals (portals.aliexpress.com)
// Popular categories Nigerians shop: electronics, phones, fashion, beauty

const ALIEXPRESS_PAGES = [
  { url: "https://www.aliexpress.com/category/200000343/consumer-electronics.html?SortType=total_tranpro_desc&page=1", cat: "electronics" },
  { url: "https://www.aliexpress.com/category/509/phones-telecommunications.html?SortType=total_tranpro_desc&page=1",  cat: "phones" },
  { url: "https://www.aliexpress.com/category/200003482/women-clothing.html?SortType=total_tranpro_desc&page=1",       cat: "fashion" },
  { url: "https://www.aliexpress.com/category/66/hair-extensions-wigs.html?SortType=total_tranpro_desc&page=1",        cat: "beauty" },
];

/** Parse a USD price string like "US $12.99", "$12.99", "12.99" */
function parseUSD(text: string): number {
  const m = text.match(/[\d,]+\.?\d*/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/,/g, ""));
}

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|smartphone|iphone|samsung|xiaomi|redmi|poco|earb|airpod|earphone|headphone|speaker/.test(t)) return "phones";
  if (/laptop|notebook|tablet|ipad/.test(t)) return "computing";
  if (/\btv\b|television|smart tv/.test(t)) return "televisions";
  if (/dress|shirt|blouse|trouser|jeans|skirt|cloth|wear|fashion|sneaker|shoe|bag/.test(t)) return "fashion";
  if (/wig|hair|lace|bundle|weave|curl/.test(t)) return "beauty";
  if (/cream|serum|lipstick|mascara|foundation|skin|make.?up/.test(t)) return "beauty";
  if (/fridge|washing|microwave|cooker|blender|iron/.test(t)) return "appliances";
  return "electronics";
}

export async function scrapeAliExpress(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → AliExpress...");

  for (const { url, cat } of ALIEXPRESS_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(3000);

      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1500);

      // AliExpress product cards — multiple selector strategies
      const items = await page.$$eval(
        "a[href*='/item/'], a[href*='aliexpress.com/item/']",
        (links) => {
          const seen = new Set<string>();
          const results: Array<{
            title: string;
            salePriceText: string;
            origPriceText: string;
            href: string;
            imageUrl: string;
          }> = [];

          for (const link of links) {
            const href = (link.getAttribute("href") ?? "").split("?")[0];
            if (!href || seen.has(href)) continue;
            seen.add(href);

            // Walk up to find card container with price
            let container: Element | null = link.parentElement;
            for (let i = 0; i < 10; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("$") && text.length < 2000) {
                const fullText = text.replace(/\s+/g, " ").trim();

                // Extract USD prices — "$12.99" or "US $12.99"
                const priceMatches = [...fullText.matchAll(/\$\s*([\d,]+\.?\d*)/g)];
                const prices = priceMatches
                  .map((m) => parseFloat(m[1].replace(/,/g, "")))
                  .filter((n) => n > 0.1 && n < 10000);

                if (prices.length === 0) { container = container.parentElement; continue; }

                const salePrice = Math.min(...prices);
                const origPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                // Title from heading or link text
                const heading = container.querySelector("h1,h2,h3,[class*='title'],[class*='name'],[class*='Title'],[class*='Name']");
                const rawTitle = (heading?.textContent ?? link.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

                // Image
                const img = container.querySelector("img");
                const imgSrc = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
                const imageUrl = imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc;

                if (rawTitle && salePrice > 0) {
                  results.push({
                    title: rawTitle,
                    salePriceText: String(salePrice),
                    origPriceText: origPrice > salePrice ? String(origPrice) : "",
                    href: href.startsWith("http") ? href : `https://www.aliexpress.com${href}`,
                    imageUrl,
                  });
                }
                break;
              }
              container = container.parentElement;
            }

            if (results.length >= 40) break;
          }

          return results;
        }
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href) continue;
        const salePrice = parseFloat(item.salePriceText);
        const origPrice = item.origPriceText ? parseFloat(item.origPriceText) : salePrice;
        if (!salePrice || salePrice < 0.5) continue;

        const fullUrl = item.href;
        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const discountPercent = origPrice > salePrice
          ? Math.round(((origPrice - salePrice) / origPrice) * 100)
          : 0;

        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} — shop on AliExpress with worldwide shipping.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "aliexpress",
          storeName: "AliExpress",
          originalPrice: origPrice,
          salePrice,
          discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["AliExpress", "International", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("/category/")[1]?.split("/")[1]?.split("?")[0] ?? "category";
      console.log(`    AliExpress ${slug}: ${items.length} links → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    AliExpress failed: ${err}`);
    }
  }

  console.log(`  ✓ AliExpress: ${deals.length} deals`);
  return deals;
}
