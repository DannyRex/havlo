import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// SHEIN affiliate: affiliate.shein.com
// Hugely popular with Nigerian women for fashion, beauty, accessories

const SHEIN_PAGES = [
  { url: "https://www.shein.com/Women-Dresses-c-1727.html",            cat: "fashion" },
  { url: "https://www.shein.com/Women-Tops-c-1740.html",               cat: "fashion" },
  { url: "https://www.shein.com/Accessories-c-2013.html",              cat: "fashion" },
  { url: "https://www.shein.com/Makeup-c-6007038.html",                cat: "beauty" },
  { url: "https://www.shein.com/Hair-c-2044.html",                     cat: "beauty" },
];

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/wig|hair|lace|bundle|weave|curl|extension/.test(t)) return "beauty";
  if (/lipstick|mascara|foundation|skin|make.?up|nail|brush|blush|eyeshadow/.test(t)) return "beauty";
  if (/dress|shirt|blouse|trouser|jeans|skirt|top|bodysuit|jumpsuit|set|suit/.test(t)) return "fashion";
  if (/shoe|sneaker|heel|boot|sandal|bag|purse|wallet|belt|jewelry|necklace|ring|earring/.test(t)) return "fashion";
  return "fashion";
}

export async function scrapeShein(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → SHEIN...");

  for (const { url, cat } of SHEIN_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(3500);

      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, 1200));
      await page.waitForTimeout(1500);

      // SHEIN product cards — anchor on product links
      const items = await page.$$eval(
        "a[href*='/p-'], a[href*='/product-'], a[href*='shein.com/p']",
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
            const href = link.getAttribute("href") ?? "";
            if (!href || seen.has(href)) continue;
            seen.add(href);

            let container: Element | null = link.parentElement;
            for (let i = 0; i < 8; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("$") && text.length < 1000) {
                const fullText = text.replace(/\s+/g, " ").trim();

                const priceMatches = [...fullText.matchAll(/\$\s*([\d,]+\.?\d*)/g)];
                const prices = priceMatches
                  .map((m) => parseFloat(m[1].replace(/,/g, "")))
                  .filter((n) => n > 0.5 && n < 2000);

                if (prices.length === 0) { container = container.parentElement; continue; }

                const salePrice = Math.min(...prices);
                const origPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                // Title from img alt, aria-label, or heading
                const img = container.querySelector("img");
                const heading = container.querySelector("[class*='goods-title-link'],[class*='title'],[class*='name'],p,span");
                const rawTitle = (
                  img?.getAttribute("alt") ??
                  link.getAttribute("aria-label") ??
                  heading?.textContent ??
                  link.textContent ??
                  ""
                ).replace(/\s+/g, " ").trim().slice(0, 120);

                const imgSrc = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
                const imageUrl = imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc;

                if (rawTitle && salePrice > 0) {
                  const absoluteHref = href.startsWith("http") ? href : `https://www.shein.com${href}`;
                  results.push({
                    title: rawTitle,
                    salePriceText: String(salePrice),
                    origPriceText: origPrice > salePrice ? String(origPrice) : "",
                    href: absoluteHref,
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

        if (seenUrls.has(item.href)) continue;
        seenUrls.add(item.href);

        const discountPercent = origPrice > salePrice
          ? Math.round(((origPrice - salePrice) / origPrice) * 100)
          : 0;

        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} — trendy fashion & beauty on SHEIN with worldwide delivery.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "shein",
          storeName: "SHEIN",
          originalPrice: origPrice,
          salePrice,
          discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: item.href,
          tags: ["SHEIN", "International", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("shein.com/")[1]?.split("-c-")[0] ?? "page";
      console.log(`    SHEIN ${slug}: ${items.length} links → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    SHEIN failed: ${err}`);
    }
  }

  console.log(`  ✓ SHEIN: ${deals.length} deals`);
  return deals;
}
