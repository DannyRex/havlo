import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// DHgate affiliate: DHgate.com Affiliate Program (partner.dhgate.com)
// Ultra-cheap wholesale goods — same audience as Temu, much better accessibility

const DHGATE_PAGES = [
  { url: "https://www.dhgate.com/wholesale/electronics.html",       cat: "electronics" },
  { url: "https://www.dhgate.com/wholesale/cell+phones.html",       cat: "phones" },
  { url: "https://www.dhgate.com/wholesale/laptops.html",           cat: "computing" },
  { url: "https://www.dhgate.com/wholesale/women+clothing.html",    cat: "fashion" },
  { url: "https://www.dhgate.com/wholesale/hair+wig.html",          cat: "beauty" },
];

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|smartphone|iphone|samsung|xiaomi|redmi|poco|charger|cable|powerbank/.test(t)) return "phones";
  if (/laptop|notebook|tablet|keyboard|mouse|ssd|ram/.test(t)) return "computing";
  if (/earb|airpod|earbud|headphone|speaker|earphone/.test(t)) return "audio";
  if (/\btv\b|television|projector|monitor/.test(t)) return "televisions";
  if (/dress|shirt|blouse|trouser|jeans|skirt|suit|cloth|fashion|sneaker|shoe|bag|purse/.test(t)) return "fashion";
  if (/wig|hair|lace|bundle|weave|extension|curl/.test(t)) return "beauty";
  if (/cream|serum|lipstick|mascara|foundation|skin|make.?up|nail/.test(t)) return "beauty";
  if (/fridge|washer|microwave|cooker|blender|fan|solar|inverter/.test(t)) return "appliances";
  return "electronics";
}

export async function scrapeDHgate(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → DHgate...");

  for (const { url, cat } of DHGATE_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });

      // DHgate renders server-side — product links are present immediately
      const found = await page.waitForSelector("a[href*='/product/']", { timeout: 10000 })
        .then(() => true).catch(() => false);

      if (!found) {
        console.warn(`    DHgate: no products found at ${url}`);
        continue;
      }

      // Optional scroll to load more
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1000);

      const items = await page.$$eval(
        "a[href*='/product/']",
        (links) => {
          const seen = new Set<string>();
          const results: Array<{
            title: string; salePriceText: string; origPriceText: string;
            href: string; imageUrl: string;
          }> = [];

          for (const link of links) {
            const href = link.getAttribute("href") ?? "";
            if (!href.includes("/product/")) continue;
            const cleanHref = href.split("?")[0];
            if (seen.has(cleanHref)) continue;
            seen.add(cleanHref);

            // Walk up to find the product card with price
            let container: Element | null = link.parentElement;
            for (let i = 0; i < 10; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              // DHgate prices are USD: "$X.XX" or "US $X.XX"
              if (text.includes("$") && text.length < 2000) {
                const fullText = text.replace(/\s+/g, " ").trim();

                const priceMatches = [...fullText.matchAll(/\$\s*([\d,]+\.?\d*)/g)];
                const prices = priceMatches
                  .map((m) => parseFloat(m[1].replace(/,/g, "")))
                  .filter((n) => n > 0.1 && n < 10000);

                if (prices.length === 0) { container = container.parentElement; continue; }

                const salePrice = Math.min(...prices);
                const origPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                // Title: from the link text, img alt, or a heading
                const heading = container.querySelector(
                  "[class*='title'],[class*='name'],[class*='Title'],[class*='Name'],h2,h3"
                );
                const img = container.querySelector("img");
                const rawTitle = (
                  heading?.textContent ??
                  link.getAttribute("title") ??
                  img?.getAttribute("alt") ??
                  link.textContent ??
                  ""
                ).replace(/\s+/g, " ").trim().slice(0, 120);

                const imgSrc = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
                const imageUrl = imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc;

                if (rawTitle && salePrice > 0) {
                  const absoluteHref = href.startsWith("http") ? href : `https://www.dhgate.com${href}`;
                  results.push({
                    title: rawTitle, salePriceText: String(salePrice),
                    origPriceText: origPrice > salePrice ? String(origPrice) : "",
                    href: absoluteHref, imageUrl,
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
          ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0;

        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} — wholesale prices on DHgate with worldwide shipping.`,
          category: resolved.category, categorySlug: resolved.slug,
          storeId: "dhgate", storeName: "DHgate",
          originalPrice: origPrice, salePrice, discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji, imageGradient: resolved.gradient,
          url: item.href,
          tags: ["DHgate", "International", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("/wholesale/")[1]?.split(".")[0] ?? "page";
      console.log(`    DHgate "${slug}": ${items.length} links → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    DHgate failed: ${err}`);
    }
  }

  console.log(`  ✓ DHgate: ${deals.length} deals`);
  return deals;
}
