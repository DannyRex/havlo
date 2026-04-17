import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// Temu affiliate: affiliate.temu.com
// Very popular with Nigerians for electronics, fashion, beauty at ultra-low prices

const TEMU_PAGES = [
  { url: "https://www.temu.com/bgn00004.html",          cat: "electronics" }, // Electronics deals
  { url: "https://www.temu.com/clothing-c8.html",       cat: "fashion" },
  { url: "https://www.temu.com/beauty-health-c7.html",  cat: "beauty" },
  { url: "https://www.temu.com/phones-c9.html",         cat: "phones" },
];

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|case|charger|cable|earb|airpod|earbud|headphone|speaker|powerbank|power bank/.test(t)) return "phones";
  if (/dress|shirt|blouse|trouser|jeans|skirt|cloth|fashion|sneaker|shoe|bag|purse/.test(t)) return "fashion";
  if (/wig|hair|lace|bundle|curl|weave/.test(t)) return "beauty";
  if (/cream|serum|lipstick|mascara|foundation|skin|make.?up|nail|brush/.test(t)) return "beauty";
  if (/fridge|washing|microwave|cooker|blender|iron|vacuum/.test(t)) return "appliances";
  return "electronics";
}

export async function scrapeTemu(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Temu...");

  for (const { url, cat } of TEMU_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(3000);

      // Scroll to load more products
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(2000);

      // Temu product links pattern
      const items = await page.$$eval(
        "a[href*='/goods.html'], a[href*='temu.com/goods']",
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
            const cleanHref = href.split("?")[0];
            if (!cleanHref || seen.has(cleanHref)) continue;
            seen.add(cleanHref);

            let container: Element | null = link.parentElement;
            for (let i = 0; i < 10; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("$") && text.length < 1500) {
                const fullText = text.replace(/\s+/g, " ").trim();

                const priceMatches = [...fullText.matchAll(/\$\s*([\d,]+\.?\d*)/g)];
                const prices = priceMatches
                  .map((m) => parseFloat(m[1].replace(/,/g, "")))
                  .filter((n) => n > 0.1 && n < 5000);

                if (prices.length === 0) { container = container.parentElement; continue; }

                const salePrice = Math.min(...prices);
                const origPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                // Title: from img alt or heading or link text
                const img = container.querySelector("img");
                const heading = container.querySelector("[class*='title'],[class*='name'],[class*='Title'],[class*='Name'],h2,h3");
                const rawTitle = (heading?.textContent ?? img?.getAttribute("alt") ?? link.textContent ?? "")
                  .replace(/\s+/g, " ").trim().slice(0, 120);

                const imgSrc = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
                const imageUrl = imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc;

                if (rawTitle && salePrice > 0) {
                  const absoluteHref = href.startsWith("http") ? href : `https://www.temu.com${href}`;
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
          description: `${item.title} — ultra-low prices on Temu with worldwide shipping.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "temu",
          storeName: "Temu",
          originalPrice: origPrice,
          salePrice,
          discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: item.href,
          tags: ["Temu", "International", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("temu.com/")[1]?.split("?")[0] ?? "page";
      console.log(`    Temu ${slug}: ${items.length} links → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    Temu failed: ${err}`);
    }
  }

  console.log(`  ✓ Temu: ${deals.length} deals`);
  return deals;
}
