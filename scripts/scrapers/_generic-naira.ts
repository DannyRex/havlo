/* Generic Naira-priced retailer scraper template.

   Most of the NG retailers we want to add (HealthPlus, MedPlus,
   Megaplaza, Tezza, Yudala, Supermart, etc.) run WordPress +
   WooCommerce or close-enough variants. The HTML markup varies but
   they share three reliable signals on a category page:

     1. Each product card contains a `<a>` linking to /product/...
        or /shop/... or a slug-style URL.
     2. The price renders with a literal '₦' followed by digits.
     3. There's a heading-tagged title near the link.

   spar.ts already exercises this pattern; this file extracts it into
   a reusable runner so a new retailer is one config block instead of
   100 lines of boilerplate. Custom selectors can override the
   defaults via config when a site needs them.

   What this template does NOT do:
     • Handle JavaScript-rendered card lazy-loading (Konga's
       per-card scroll trick). For sites that need it, write a
       bespoke scraper using konga.ts as the template instead.
     • Bypass Cloudflare bot challenges. Stealth is in scrape.ts;
       sites that wall harder than that need residential proxies. */

import type { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

export interface NairaSiteConfig {
  /** Display name shown in scrape logs. */
  name:      string;
  /** storeId stored on the resulting RawDeal — keep stable across
      runs because dedup matches on it. Lowercased, no spaces. */
  storeId:   string;
  /** Public domain root (no trailing slash). Used to absolute-resolve
      relative hrefs and to build the base for fallback paths. */
  baseUrl:   string;
  /** Category pages to scrape. Each entry is one page-load. */
  pages: Array<{ url: string; cat: string }>;
  /** CSS selector for the link element that anchors a product card.
      Defaults cover most WooCommerce sites; override for unusual
      themes. */
  linkSelector?: string;
  /** Title selector used inside the inferred container. Default
      matches WooCommerce's common heading patterns. */
  titleSelector?: string;
  /** Per-page wait after navigation. Some sites lazy-load below the
      fold; bumping this to 3-4s helps when the first run yields 0. */
  waitMs?: number;
}

const DEFAULT_LINK_SELECTOR  = "a[href*='/product/'], a[href*='/shop/'], .product a, .woocommerce-loop-product__link";
const DEFAULT_TITLE_SELECTOR = "h2, h3, h4, .name, .product-title, .woocommerce-loop-product__title, [class*='title']";

/* The shared runner. Returns RawDeal[] in the canonical Havlo shape.
   On per-page failure (timeout / navigation error), logs and keeps
   going — one bad URL never tanks an entire scrape. */
export async function scrapeNairaWoo(page: Page, cfg: NairaSiteConfig): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log(`  → ${cfg.name}...`);

  for (const { url, cat } of cfg.pages) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(cfg.waitMs ?? 2500);

      const items = await page.$$eval(
        cfg.linkSelector ?? DEFAULT_LINK_SELECTOR,
        (links, titleSel) => {
          const seen = new Set<string>();
          const results: Array<{ title: string; salePrice: number; originalPrice: number; href: string; imageUrl: string }> = [];

          for (const link of links) {
            const href = link.getAttribute("href") ?? "";
            if (!href || seen.has(href)) continue;
            seen.add(href);

            /* Walk up the DOM looking for the smallest container that
               has a Naira price. Bounded loop so we don't escape
               into the body. */
            let container: Element | null = link.parentElement;
            for (let i = 0; i < 8; i++) {
              if (!container) break;
              const text = container.textContent ?? "";
              if (text.includes("₦")) {
                const fullText = text.replace(/\s+/g, " ").trim();
                const prices = [...fullText.matchAll(/₦([\d,]+)/g)]
                  .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
                  .filter((n) => n > 0);
                if (prices.length === 0) {
                  container = container.parentElement;
                  continue;
                }
                const salePrice = Math.min(...prices);
                const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

                const heading = container.querySelector(titleSel as string);
                const title = (heading?.textContent ?? link.textContent ?? "")
                  .replace(/\s+/g, " ").trim().slice(0, 120);

                /* Image — try multiple lazy-load attributes used by
                   WordPress + WooCommerce themes. */
                const imgEl = container.querySelector("img");
                const candidates = [
                  imgEl?.getAttribute("src"),
                  imgEl?.getAttribute("data-src"),
                  imgEl?.getAttribute("data-lazy-src"),
                  imgEl?.getAttribute("data-original"),
                  (imgEl?.getAttribute("srcset") ?? "")
                    .split(",")[0]?.trim().split(" ")[0],
                ].filter((u): u is string => !!u && u.length > 10 && !u.startsWith("data:"));
                const imageUrl = candidates[0] ?? "";

                if (title && salePrice > 0) {
                  results.push({ title, salePrice, originalPrice, href, imageUrl });
                }
                break;
              }
              container = container.parentElement;
            }
          }
          return results;
        },
        cfg.titleSelector ?? DEFAULT_TITLE_SELECTOR,
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href || !item.salePrice) continue;

        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `${cfg.baseUrl}${item.href.startsWith("/") ? "" : "/"}${item.href}`;
        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const discountPercent = item.originalPrice > item.salePrice
          ? Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)
          : 0;

        const resolved = resolveCategory(cat);

        deals.push({
          title:           item.title,
          description:     `${item.title} — shop on ${cfg.name}.`,
          category:        resolved.category,
          categorySlug:    resolved.slug,
          storeId:         cfg.storeId,
          storeName:       cfg.name,
          originalPrice:   item.originalPrice,
          salePrice:       item.salePrice,
          discountPercent,
          imageUrl:        item.imageUrl || undefined,
          imageEmoji:      resolved.emoji,
          imageGradient:   resolved.gradient,
          url:             fullUrl,
          tags:            [cfg.name, resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("/").slice(3).join("/").slice(0, 40);
      console.log(`    ${cfg.name} ${slug}: ${items.length} cards → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    ${cfg.name} failed at ${url}: ${(err as Error).message}`);
    }
  }

  console.log(`  ✓ ${cfg.name}: ${deals.length} deals`);
  return deals;
}
