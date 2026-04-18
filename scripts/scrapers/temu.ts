import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// Temu affiliate: affiliate.temu.com
const TEMU_PAGES = [
  { url: "https://www.temu.com/search_result.html?search_key=electronics&search_method=user", cat: "electronics" },
  { url: "https://www.temu.com/search_result.html?search_key=smartphone+case&search_method=user", cat: "phones" },
  { url: "https://www.temu.com/search_result.html?search_key=women+dress&search_method=user", cat: "fashion" },
  { url: "https://www.temu.com/search_result.html?search_key=hair+wig&search_method=user",   cat: "beauty" },
];

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|case|charger|cable|earb|airpod|earbud|headphone|speaker|powerbank/.test(t)) return "phones";
  if (/laptop|tablet|keyboard|mouse/.test(t)) return "computing";
  if (/dress|shirt|blouse|trouser|jeans|skirt|top|bodysuit|jumpsuit|fashion/.test(t)) return "fashion";
  if (/shoe|sneaker|heel|boot|sandal|bag|purse|wallet|belt|jewelry|necklace|earring/.test(t)) return "fashion";
  if (/wig|hair|lace|bundle|curl|weave|extension/.test(t)) return "beauty";
  if (/cream|serum|lipstick|mascara|foundation|skin|make.?up|nail|brush/.test(t)) return "beauty";
  return "electronics";
}

export async function scrapeTemu(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Temu...");

  for (const { url, cat } of TEMU_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });

      // Detect verification wall vs real products
      const verifyUrl = page.url();
      if (verifyUrl.includes("verification") || verifyUrl.includes("captcha") || verifyUrl.includes("challenge")) {
        console.warn(`    Temu verification wall hit — skipping`);
        continue;
      }

      // Wait for product cards to appear
      const productSel = "a[href*='/goods'], a[href*='subject_id'], [class*='goods-item'] a, [class*='product-item'] a";
      const found = await page.waitForSelector(productSel, { timeout: 12000 })
        .then(() => true).catch(() => false);

      if (!found) {
        const title = await page.title();
        console.warn(`    Temu: no products found — "${title}"`);
        continue;
      }

      // Scroll to load more
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(2000);

      const items = await page.$$eval(
        "a[href*='/goods'], a[href*='temu.com/goods']",
        (links) => {
          const seen = new Set<string>();
          const results: Array<{
            title: string; salePriceText: string; origPriceText: string;
            href: string; imageUrl: string;
          }> = [];

          for (const link of links) {
            const href = link.getAttribute("href") ?? "";
            if (!href || (!href.includes("/goods") && !href.includes("subject_id"))) continue;
            const cleanHref = href.split("?")[0];
            if (seen.has(cleanHref)) continue;
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

                const img = container.querySelector("img");
                const heading = container.querySelector(
                  "[class*='title'],[class*='name'],[class*='Title'],[class*='Name'],h2,h3,p"
                );
                const rawTitle = (
                  heading?.textContent ??
                  img?.getAttribute("alt") ??
                  link.textContent ??
                  ""
                ).replace(/\s+/g, " ").trim().slice(0, 120);

                const imgSrc = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
                const imageUrl = imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc;

                if (rawTitle && salePrice > 0) {
                  const absoluteHref = href.startsWith("http") ? href : `https://www.temu.com${href}`;
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
          description: `${item.title} — ultra-low prices on Temu with worldwide shipping.`,
          category: resolved.category, categorySlug: resolved.slug,
          storeId: "temu", storeName: "Temu",
          originalPrice: origPrice, salePrice, discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji, imageGradient: resolved.gradient,
          url: item.href,
          tags: ["Temu", "International", resolved.category],
        });
        pageDeals++;
      }

      const q = new URL(url).searchParams.get("search_key") ?? "page";
      console.log(`    Temu "${q}": ${items.length} links → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    Temu failed: ${err}`);
    }
  }

  console.log(`  ✓ Temu: ${deals.length} deals`);
  return deals;
}
