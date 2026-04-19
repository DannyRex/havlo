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
  { url: "https://www.dhgate.com/wholesale/headphones.html",        cat: "audio" },
  { url: "https://www.dhgate.com/wholesale/watches.html",           cat: "fashion" },
  { url: "https://www.dhgate.com/wholesale/shoes.html",             cat: "fashion" },
  { url: "https://www.dhgate.com/wholesale/bags.html",              cat: "fashion" },
  { url: "https://www.dhgate.com/wholesale/home+appliances.html",   cat: "appliances" },
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
            isRange: boolean; href: string; imageUrl: string;
          }> = [];

          // Match a single price token ($X.XX / US $X.XX). Captures the number.
          const PRICE_TOKEN = /(?:US\s*)?\$\s*([\d,]+\.?\d*)/gi;

          // Detect bulk-tier RANGE pricing on DHgate: "$2.50 - $8.99" or
          // "$2.50-$8.99" or even with US prefix. The lower bound is the
          // 100-piece MOQ rate; the buyer of 1 unit pays the UPPER bound.
          const RANGE = /(?:US\s*)?\$\s*([\d,]+\.?\d*)\s*[-–—]\s*(?:US\s*)?\$\s*([\d,]+\.?\d*)/i;

          // Convert a captured numeric string to a number, or NaN.
          const toNum = (s: string) => parseFloat(s.replace(/,/g, ""));

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
              if (!(text.includes("$") && text.length < 2000)) {
                container = container.parentElement; continue;
              }

              const fullText = text.replace(/\s+/g, " ").trim();

              // 1) Try semantic price elements first — much more reliable than
              //    text-mining the whole card. DHgate marks crossed-out/original
              //    prices with <s>, <del>, or class names containing "old"/"crossed"/"through".
              const origPriceEl = container.querySelector(
                "s, del, [class*='old'], [class*='Old'], [class*='crossed'], [class*='Crossed'], [class*='through'], [class*='Through'], [class*='originPrice'], [class*='OriginPrice']"
              );
              const origFromEl = (() => {
                if (!origPriceEl) return NaN;
                const m = (origPriceEl.textContent ?? "").match(/\$\s*([\d,]+\.?\d*)/);
                return m ? toNum(m[1]) : NaN;
              })();

              // 2) Look for a range like "$2.50 - $8.99" — these are bulk-tier
              //    products. We use the UPPER bound as the realistic single-item
              //    price and DON'T treat the spread as a discount.
              const rangeMatch = fullText.match(RANGE);
              const isRange = !!rangeMatch;
              const rangeUpper = rangeMatch ? toNum(rangeMatch[2]) : NaN;

              // 3) All remaining price tokens — used as a fallback.
              const allPrices = [...fullText.matchAll(PRICE_TOKEN)]
                .map((m) => toNum(m[1]))
                .filter((n) => Number.isFinite(n) && n >= 0.5 && n < 10000);

              if (allPrices.length === 0) { container = container.parentElement; continue; }

              // Pick the sale price.
              //   - Range card → use the upper bound (realistic single-item price).
              //   - Else → the first non-trivial price (skip $0.01/$1 coupon hooks).
              let salePrice: number;
              if (isRange && Number.isFinite(rangeUpper)) {
                salePrice = rangeUpper;
              } else {
                const meaningful = allPrices.filter((p) => p >= 2);
                salePrice = meaningful[0] ?? allPrices[0];
              }

              // Original price — ONLY if we found an explicit strikethrough element.
              // We deliberately do NOT infer "original" from "the biggest number in
              // the text" anymore — that's what produced the bogus 90% discounts.
              let origPrice = salePrice;
              if (Number.isFinite(origFromEl) && origFromEl > salePrice) {
                origPrice = origFromEl;
              }

              // Title
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
                  isRange,
                  href: absoluteHref, imageUrl,
                });
              }
              break;
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

        let discountPercent = origPrice > salePrice
          ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0;

        // Sanity caps — DHgate "discounts" above ~80% are almost always
        // bulk-vs-retail comparisons, not real deals. Drop the discount label
        // rather than mislead users with a fake 95% off.
        if (discountPercent > 80) discountPercent = 0;
        // Range-priced cards use the upper bound as sale price — there's no
        // meaningful "original" so never claim a discount.
        if (item.isRange) discountPercent = 0;

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
