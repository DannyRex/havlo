import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

/* Bitmarte (bitmarte.com) — Nigerian SaaS-style marketplace.
   Apex 308-redirects to /customer (the JS-rendered storefront
   landing). /products.json doesn't exist (not Shopify); the
   storefront is a Next.js React app with hashed Tailwind
   utility classes.

   DOM structure verified May 2026:
     • Every product card IS the `<a href='/customer/product/...'>`
       element itself — it wraps the image, title heading, price
       block, and rating widget. No walk-up needed.
     • Above the card sits a Slick carousel (`.slick-track`)
       that aggregates 6+ cards into one container, so walking
       up the DOM cross-contaminates prices across products.
       The previous attempt got bitten by exactly this.
     • Image is rendered through Next.js's <Image> component:
       `srcset` lists `/_next/image?url=<encoded-S3-url>&w=...&q=75`
       entries. We decode the `url` param to grab the raw S3
       URL — sharper than the proxied 96w thumbnail and not
       coupled to Next.js's image optimizer.
     • Title lives in `img[alt]` — cleanest signal because the
       link's textContent also captures the "Quick Look" hover
       CTA and the star-rating widget ("1 Star2 Stars3 Stars...").

   Pagination: the deal pages (/alldiscounts etc.) and the
   /customer landing show a fixed set of featured items — no
   pagination control. We take what's rendered. */
const BITMARTE_COLLECTIONS = [
  { url: "https://bitmarte.com/customer/products/alldiscounts",     cat: "default" },
  { url: "https://bitmarte.com/customer/products/superdeals",       cat: "default" },
  { url: "https://bitmarte.com/customer/products/discountedoffers", cat: "default" },
  /* /customer landing is the densest single surface (~80
     product links across multiple Slick carousels). Caught
     even when the deal-specific pages render empty. */
  { url: "https://bitmarte.com/customer",                           cat: "default" },
];

/* Decode `/_next/image?url=<encoded>&w=...` into the underlying
   S3 (or other) image URL. Returns the input untouched if the
   shape doesn't match. Exported indirectly via the page.eval
   closure — keep pure / no closure vars. */
function unwrapNextImage(src: string): string {
  if (!src) return "";
  if (!src.includes("/_next/image")) return src;
  try {
    const q = src.split("?")[1] ?? "";
    const params = new URLSearchParams(q);
    const real = params.get("url");
    return real ? decodeURIComponent(real) : src;
  } catch {
    return src;
  }
}

export async function scrapeBitmarte(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Bitmarte (JS-rendered SaaS storefront)...");

  for (const { url, cat } of BITMARTE_COLLECTIONS) {
    try {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 });
      } catch {
        console.warn(`    Bitmarte ${url}: load timeout — skipping`);
        continue;
      }
      try {
        await page.waitForSelector("a[href*='/customer/product/']", { timeout: 4000 });
      } catch {
        // Empty deal page — fall through, will log 0 and move on.
      }

      const items = await page.$$eval(
        "a[href*='/customer/product/']",
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

            /* The link element IS the card — read everything
               from it directly. Walking up the DOM lands in
               the Slick carousel which merges N products. */
            const cardText = (link.textContent ?? "").replace(/\s+/g, " ").trim();
            if (!cardText.includes("₦")) continue;
            if (/out of stock|sold out|unavailable/i.test(cardText)) continue;

            /* Strict comma-grouped price regex: Bitmarte's
               rating widget renders as "1 Star2 Stars3 Stars..."
               glued directly onto the price (no space), so a
               lax `[\d,]+` swallows the leading rating digit
               (`₦23,0001 Star` → 230001). Anchoring to NG
               comma format (\d{1,3}(?:,\d{3})*) avoids that. */
            const prices = [...cardText.matchAll(/₦\s*(\d{1,3}(?:,\d{3})*)/g)]
              .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
              .filter((n) => n > 0);
            if (prices.length === 0) continue;

            const salePrice     = Math.min(...prices);
            const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

            const imgEl = link.querySelector("img");
            /* Title preference order: img.alt (clean, set by
               the product owner) → link.title → link text with
               "Quick Look" hover-CTA + rating widget stripped. */
            const altTitle = imgEl?.getAttribute("alt")?.trim() ?? "";
            const fallbackTitle = cardText
              .replace(/^Quick Look/i, "")
              .replace(/₦\s*[\d,]+/g, "")
              .replace(/\d+\s*Stars?/g, "")
              .replace(/\s+/g, " ")
              .trim();
            const title = (altTitle || fallbackTitle).slice(0, 120);

            /* Image: prefer raw src/data-src; otherwise pick the
               widest entry from the srcset; finally unwrap Next.js
               /_next/image proxying to get the underlying URL. */
            const srcsetEntries = (imgEl?.getAttribute("srcset") ?? "")
              .split(",")
              .map((s) => s.trim())
              .map((s) => {
                const [u, w] = s.split(/\s+/);
                const width = parseInt((w ?? "0").replace(/\D/g, ""), 10) || 0;
                return { u, width };
              })
              .filter((e) => e.u);
            srcsetEntries.sort((a, b) => b.width - a.width);

            let imageUrl =
              imgEl?.getAttribute("src") ??
              imgEl?.getAttribute("data-src") ??
              imgEl?.getAttribute("data-lazy-src") ??
              srcsetEntries[0]?.u ??
              "";
            if (imageUrl.includes("/_next/image")) {
              const qIdx = imageUrl.indexOf("?");
              if (qIdx >= 0) {
                const params = new URLSearchParams(imageUrl.slice(qIdx + 1));
                const real = params.get("url");
                if (real) imageUrl = decodeURIComponent(real);
              }
            }
            if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;
            if (imageUrl.startsWith("/"))  imageUrl = `https://bitmarte.com${imageUrl}`;

            if (title && salePrice > 0) {
              results.push({
                title,
                saleText: String(salePrice),
                origText: originalPrice > salePrice ? String(originalPrice) : "",
                href,
                imageUrl,
              });
            }
          }
          return results;
        },
      );

      const slug = url.split("bitmarte.com/")[1]?.split("?")[0] ?? "page";
      console.log(`    Bitmarte ${slug}: ${items.length} products`);

      for (const item of items) {
        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://bitmarte.com${item.href.startsWith("/") ? "" : "/"}${item.href}`;
        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const salePrice     = parseNaira(item.saleText);
        const originalPrice = item.origText ? parseNaira(item.origText) : salePrice;
        if (!salePrice || salePrice <= 0) continue;

        const discountPercent = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        const resolved = resolveCategory(cat);
        deals.push({
          title: item.title,
          description: `${item.title} — shop at Bitmarte, NG online marketplace.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "bitmarte",
          storeName: "Bitmarte",
          originalPrice,
          salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Bitmarte", resolved.category],
        });
      }
    } catch (err) {
      console.warn(`    Bitmarte collection failed: ${err}`);
    }
  }

  console.log(`  ✓ Bitmarte: ${deals.length} deals`);
  return deals;
}

/* Silence unused-export lint if/when tsconfig isolatedModules
   complains; the helper above is intentionally not exported but
   kept as a named local for clarity. */
void unwrapNextImage;
