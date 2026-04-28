import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

/* Kara (kara.com.ng) — Next.js / React SPA. Products load
   client-side via API calls after hydration, so we have to wait for
   React to populate the DOM (waitUntil networkidle + waitForSelector
   for any product link).

   URL structure verified 2026-04: paths are FLAT (e.g. /mobile-phones,
   /laptops) — no /electronics/<sub> nesting. The www subdomain 301-
   redirects to the apex; we use apex directly. */
const KARA_COLLECTIONS = [
  { url: "https://kara.com.ng/mobile-phones",     cat: "phones" },
  { url: "https://kara.com.ng/laptops",           cat: "computing" },
  { url: "https://kara.com.ng/tablets",           cat: "phones" },
  { url: "https://kara.com.ng/televisions",       cat: "televisions" },
  { url: "https://kara.com.ng/home-audio",        cat: "audio" },
  { url: "https://kara.com.ng/cameras",           cat: "electronics" },
  { url: "https://kara.com.ng/gaming",            cat: "gaming" },
  { url: "https://kara.com.ng/smartwatch",        cat: "electronics" },
  { url: "https://kara.com.ng/refrigerator",      cat: "appliances" },
  { url: "https://kara.com.ng/washing-machine",   cat: "appliances" },
  { url: "https://kara.com.ng/air-conditioner",   cat: "appliances" },
  { url: "https://kara.com.ng/kitchen-appliances",cat: "appliances" },
  { url: "https://kara.com.ng/health-and-beauty", cat: "beauty" },
  { url: "https://kara.com.ng/sale",              cat: "electronics" },
];

export async function scrapeKara(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Kara (Magento)...");

  for (const { url, cat } of KARA_COLLECTIONS) {
    try {
      /* Use `load` not `networkidle`. Kara polls APIs forever (analytics,
         live inventory) so networkidle never resolves and the 35s timeout
         fires for every category. `load` waits for window.onload then we
         poll for product links explicitly. */
      try {
        await page.goto(url, { waitUntil: "load", timeout: 20000 });
      } catch {
        console.warn(`    Kara ${url}: load timeout — skipping`);
        continue;
      }
      try {
        await page.waitForSelector("a[href*='/product']", { timeout: 6000 });
      } catch {
        // Page rendered but no product links — empty category or layout shift
      }
      await page.waitForTimeout(1000);

      /* SPA pages don't follow Magento link conventions — anchor on
         any product-link pattern + walk up to find a container with ₦. */
      const items = await page.$$eval(
        "a[href*='/product'], a[href^='/'][class*='card'], a[href^='/'][class*='Card']",
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

            // Walk up to find container with ₦
            let container: Element | null = link.parentElement;
            for (let i = 0; i < 8; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("₦")) {
                const fullText = text.replace(/\s+/g, " ").trim();
                const prices = [...fullText.matchAll(/₦([\d,]+)/g)]
                  .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
                  .filter((n) => n > 0);

                const salePrice     = prices.length > 0 ? Math.min(...prices) : 0;
                const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                const heading = container.querySelector("h2, h3, h4, .product-name, .product-item-name, [class*='title']");
                const title   = (heading?.textContent ?? link.textContent ?? "")
                  .replace(/\s+/g, " ").trim().slice(0, 100);

                const imgEl = container.querySelector("img.product-image-photo, img[src*='kara'], img");
                const rawSrc = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? "";

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

      const slug = url.split("kara.com.ng/")[1]?.split("?")[0] ?? "page";
      console.log(`    Kara ${slug}: ${items.length} products`);

      for (const item of items) {
        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://kara.com.ng${item.href.startsWith("/") ? "" : "/"}${item.href}`;
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
          description: `${item.title} — shop at Kara, NG electronics retailer.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "kara",
          storeName: "Kara",
          originalPrice,
          salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Kara", resolved.category],
        });
      }
    } catch (err) {
      console.warn(`    Kara collection failed: ${err}`);
    }
  }

  console.log(`  ✓ Kara: ${deals.length} deals`);
  return deals;
}
