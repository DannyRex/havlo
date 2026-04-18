import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// SHEIN affiliate: affiliate.shein.com
// SHEIN URL patterns: /p-sw{id}.html or newer /{name}-p-{id}.html

const SHEIN_PAGES = [
  { url: "https://www.shein.com/pdsearch/dress/?ici=s1`EditSearch`dress`d0`PageDress`PageNum1", cat: "fashion" },
  { url: "https://www.shein.com/pdsearch/tops/?ici=s1`EditSearch`tops`d0`PageTops`PageNum1",   cat: "fashion" },
  { url: "https://www.shein.com/pdsearch/wig/?ici=s1`EditSearch`wig`d0`PageWig`PageNum1",       cat: "beauty" },
  { url: "https://www.shein.com/pdsearch/skincare/?ici=s1`EditSearch`skincare`d0",              cat: "beauty" },
  { url: "https://www.shein.com/pdsearch/sneakers/?ici=s1`EditSearch`sneakers`d0",             cat: "fashion" },
];

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/wig|hair|lace|bundle|curl|weave|extension/.test(t)) return "beauty";
  if (/cream|serum|toner|moisturizer|sunscreen|skin|make.?up|lip|mascara|nail/.test(t)) return "beauty";
  if (/dress|blouse|top|shirt|trouser|jeans|skirt|bodysuit|jumpsuit|suit|co-ord/.test(t)) return "fashion";
  if (/shoe|sneaker|heel|boot|sandal|bag|purse|wallet|belt|jewelry|necklace|earring|ring|bracelet/.test(t)) return "fashion";
  return "fashion";
}

export async function scrapeShein(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → SHEIN...");

  for (const { url, cat } of SHEIN_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });

      // Detect risk/challenge redirect
      const currentUrl = page.url();
      if (currentUrl.includes("/risk/") || currentUrl.includes("/challenge") || currentUrl.includes("captcha")) {
        console.warn(`    SHEIN challenge hit — skipping`);
        continue;
      }

      // Wait for product cards (SHEIN renders them client-side)
      // SHEIN search results page: product links contain /p- or -p- in path
      const productSel = "a[href*='-p-'], a[href*='/p-sw'], .S-product-item a, [class*='product-item'] a, [class*='goods-item'] a";
      const found = await page.waitForSelector(productSel, { timeout: 15000 })
        .then(() => true).catch(() => false);

      if (!found) {
        // Try scrolling to trigger rendering
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(2000);
      }

      // Scroll to load lazy items
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1500);

      const items = await page.$$eval(
        "a[href*='-p-'], a[href*='/p-sw']",
        (links) => {
          const seen = new Set<string>();
          const results: Array<{
            title: string; salePriceText: string; origPriceText: string;
            href: string; imageUrl: string;
          }> = [];

          for (const link of links) {
            const href = link.getAttribute("href") ?? "";
            if (!href) continue;
            const cleanHref = href.split("?")[0];
            if (seen.has(cleanHref)) continue;
            seen.add(cleanHref);

            let container: Element | null = link.parentElement;
            for (let i = 0; i < 10; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("$") && text.length < 1200) {
                const fullText = text.replace(/\s+/g, " ").trim();

                const priceMatches = [...fullText.matchAll(/\$\s*([\d,]+\.?\d*)/g)];
                const prices = priceMatches
                  .map((m) => parseFloat(m[1].replace(/,/g, "")))
                  .filter((n) => n > 0.5 && n < 2000);

                if (prices.length === 0) { container = container.parentElement; continue; }

                const salePrice = Math.min(...prices);
                const origPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                // SHEIN title: from img alt, aria-label, or nearby text element
                const img = container.querySelector("img");
                const titleEl = container.querySelector(
                  "[class*='goods-title-link'],[class*='title'],[class*='name'],[class*='Title'],p"
                );
                const rawTitle = (
                  titleEl?.textContent ??
                  img?.getAttribute("alt") ??
                  link.getAttribute("aria-label") ??
                  link.textContent ??
                  ""
                ).replace(/\s+/g, " ").trim().slice(0, 120);

                const imgSrc = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
                const imageUrl = imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc;

                if (rawTitle && salePrice > 0) {
                  const absoluteHref = href.startsWith("http") ? href : `https://www.shein.com${href}`;
                  results.push({ title: rawTitle, salePriceText: String(salePrice),
                    origPriceText: origPrice > salePrice ? String(origPrice) : "",
                    href: absoluteHref, imageUrl });
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
          ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0;

        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} — trendy fashion & beauty on SHEIN with worldwide delivery.`,
          category: resolved.category, categorySlug: resolved.slug,
          storeId: "shein", storeName: "SHEIN",
          originalPrice: origPrice, salePrice, discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji, imageGradient: resolved.gradient,
          url: item.href,
          tags: ["SHEIN", "International", resolved.category],
        });
        pageDeals++;
      }

      const q = url.split("/pdsearch/")[1]?.split("/")[0] ?? "page";
      console.log(`    SHEIN "${q}": ${items.length} links → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    SHEIN failed: ${err}`);
    }
  }

  console.log(`  ✓ SHEIN: ${deals.length} deals`);
  return deals;
}
