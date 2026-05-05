import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

/* Amazon scraper — multi-marketplace, best-sellers based.

   Why this rewrite (vs the prior "Today's Deals" version):
     - The deal-page URLs (?rh=p_n_deal_type:23566064011) are heavily
       bot-detected and were returning 0 cards consistently
     - Best-Sellers pages (zgbs/{category}) ship lighter HTML, are
       less aggressively gatekept, and the data we need (title, sale
       price, link) is the same shape
     - Original prices are rarer on best-sellers vs deals, but
       Amazon often shows "Limited time deal" badges + struck prices
       on a meaningful share of items, so we still get discount %
       on ~20-40% of cards

   Reliability honesty:
     Amazon scraping at scale is fundamentally unreliable. This
     scraper will return 0 deals for entire runs when Amazon's bot
     defenses serve a captcha or modified HTML. That's expected.
     The curated catalog (src/lib/data/curated-amazon.ts) is the
     primary source of Amazon inventory; this scraper is a bonus
     on the days it works.

     Run-time toggle: the orchestrator only calls scrapeAmazon when
     AMAZON_SCRAPER_ENABLED=true is set. Off by default so a
     blocked run doesn't pollute logs in production.

   Multi-marketplace: scrapeAmazon(page, "us") | "uk" | "de" | "ae"
   | "in". Each marketplace returns its own RawDeal[] with the
   right storeId / storeName / URL host so /api/go can pick up the
   right affiliate tag (AMAZON_ASSOC_TAG_US/UK/DE/AE/IN). */

export type AmazonMarketplace = "us" | "uk" | "de" | "ae" | "in";

interface MarketplaceConfig {
  hostname: string;
  storeId:  string;
  storeName: string;
  /** Currency reported by the site — used purely as a label.
      Deal.currency only allows "NGN" | "USD" so we always store USD
      and rely on the country-aware display layer for local format. */
  currencyLabel: string;
  /** Best-Sellers paths per category. zgbs = "Get Bestsellers". */
  pages: Array<{ path: string; cat: string }>;
}

const MARKETPLACES: Record<AmazonMarketplace, MarketplaceConfig> = {
  us: {
    hostname: "www.amazon.com",
    storeId: "amazon",
    storeName: "Amazon",
    currencyLabel: "USD",
    pages: [
      { path: "/Best-Sellers-Electronics/zgbs/electronics/",                cat: "electronics" },
      { path: "/Best-Sellers-Cell-Phones-Accessories/zgbs/wireless/",       cat: "phones" },
      { path: "/Best-Sellers-Computers-Accessories/zgbs/computers/",        cat: "computing" },
      { path: "/Best-Sellers-Home-Audio-Theater/zgbs/electronics/667846011/", cat: "audio" },
      { path: "/Best-Sellers-Video-Games/zgbs/videogames/",                 cat: "gaming" },
      { path: "/Best-Sellers-Home-Kitchen/zgbs/home-garden/",               cat: "home" },
      { path: "/Best-Sellers-Beauty/zgbs/beauty/",                          cat: "beauty" },
    ],
  },
  uk: {
    hostname: "www.amazon.co.uk",
    storeId: "amazon-co-uk",
    storeName: "Amazon UK",
    currencyLabel: "GBP",
    pages: [
      { path: "/gp/bestsellers/electronics/",       cat: "electronics" },
      { path: "/gp/bestsellers/electronics-mobile/", cat: "phones" },
      { path: "/gp/bestsellers/computers/",         cat: "computing" },
      { path: "/gp/bestsellers/videogames/",        cat: "gaming" },
      { path: "/gp/bestsellers/kitchen/",           cat: "home" },
    ],
  },
  de: {
    hostname: "www.amazon.de",
    storeId: "amazon-de",
    storeName: "Amazon DE",
    currencyLabel: "EUR",
    pages: [
      { path: "/gp/bestsellers/electronics/",  cat: "electronics" },
      { path: "/gp/bestsellers/computers/",    cat: "computing" },
      { path: "/gp/bestsellers/videogames/",   cat: "gaming" },
    ],
  },
  ae: {
    hostname: "www.amazon.ae",
    storeId: "amazon-ae",
    storeName: "Amazon AE",
    currencyLabel: "AED",
    pages: [
      { path: "/gp/bestsellers/electronics/",  cat: "electronics" },
      { path: "/gp/bestsellers/computers/",    cat: "computing" },
    ],
  },
  in: {
    hostname: "www.amazon.in",
    storeId: "amazon-in",
    storeName: "Amazon IN",
    currencyLabel: "INR",
    pages: [
      { path: "/gp/bestsellers/electronics/",  cat: "electronics" },
      { path: "/gp/bestsellers/computers/",    cat: "computing" },
    ],
  },
};

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|iphone|samsung|pixel|oneplus|airpod|earbud|earphone|headphone/.test(t)) return "phones";
  if (/laptop|macbook|notebook|chromebook|tablet|ipad/.test(t)) return "computing";
  if (/\btv\b|television|monitor|smart tv/.test(t)) return "electronics";
  if (/dress|shirt|blouse|trouser|jeans|skirt|cloth|sneaker|shoe|bag/.test(t)) return "fashion";
  if (/cream|serum|perfume|cologne|skin|hair|make.?up|beauty/.test(t)) return "beauty";
  if (/fridge|washer|microwave|cooker|blender/.test(t)) return "appliances";
  if (/playstation|xbox|nintendo|switch|console|controller/.test(t)) return "gaming";
  return "electronics";
}

/* Detect bot-block / captcha responses so we don't waste time
   parsing nothing. Amazon returns either a captcha page or a
   "Robot Check" interstitial when it doesn't trust the client. */
async function isBlockedPage(page: Page): Promise<boolean> {
  try {
    const html = await page.content();
    return /captcha|robot check|enter the characters you see|to discuss automated access/i.test(html);
  } catch {
    return false;
  }
}

export async function scrapeAmazon(
  page: Page,
  marketplace: AmazonMarketplace = "us",
): Promise<RawDeal[]> {
  const config = MARKETPLACES[marketplace];
  const deals:    RawDeal[]      = [];
  const seenUrls: Set<string>    = new Set();

  console.log(`  → ${config.storeName}...`);

  for (const { path, cat } of config.pages) {
    const url = `https://${config.hostname}${path}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });

      /* Best-sellers cards take a moment to hydrate. waitForSelector
         is more reliable than a fixed sleep — we get the data the
         moment it's available, or time out cleanly when blocked. */
      try {
        await page.waitForSelector("#gridItemRoot, .zg-grid-general-faceout, [data-asin]", {
          timeout: 8000,
        });
      } catch {
        /* No cards rendered within timeout — probably bot-blocked.
           Confirm before logging a misleading "0 cards" message. */
        if (await isBlockedPage(page)) {
          console.warn(`    ${config.storeName} ${cat}: bot-blocked (captcha / robot check)`);
          continue;
        }
        /* Not blocked, just slow / empty page. Fall through and try
           parsing anyway — sometimes selectors hydrate just after. */
      }

      const items = await page.$$eval(
        /* Multi-selector fallback chain. Best-Sellers cards use any of
           these wrappers depending on Amazon's A/B variant served. */
        "#gridItemRoot, .zg-grid-general-faceout, [data-component-type='s-search-result'], [data-asin]:not([data-asin=''])",
        (cards) =>
          cards.slice(0, 25).map((card) => {
            /* Title — chase several possible nodes. */
            const titleEl =
              card.querySelector("[class*='-title'] a, .p13n-sc-truncate-desktop-type2, ._cDEzb_p13n-sc-css-line-clamp-3_g3dy1, h2 span, h2 a span, [class*='title'] span, .a-link-normal span");
            const title = (titleEl?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

            /* Sale price — Amazon's price-whole + price-fraction split,
               plus screen-reader fallback (.a-offscreen) which often
               carries the full formatted price. */
            const priceWhole = card.querySelector(".a-price-whole, [class*='price-whole']");
            const priceFrac  = card.querySelector(".a-price-fraction, [class*='price-fraction']");
            const offscreen  = card.querySelector(".a-price .a-offscreen, [class*='price'] .a-offscreen");
            let saleStr = "";
            if (priceWhole) {
              const whole = priceWhole.textContent?.replace(/[^0-9]/g, "") ?? "";
              const frac  = priceFrac?.textContent?.replace(/[^0-9]/g, "") ?? "00";
              if (whole) saleStr = `${whole}.${frac}`;
            }
            if (!saleStr && offscreen) {
              saleStr = (offscreen.textContent ?? "").replace(/[^0-9.]/g, "");
            }

            /* Original (struck) price. Best-Sellers pages don't always
               show it — when they do, it's via .a-text-price + offscreen. */
            const origEl =
              card.querySelector(".a-text-price .a-offscreen, [class*='basis-price'] .a-offscreen, [data-a-strike='true'] .a-offscreen");
            const origStr = (origEl?.textContent ?? "").replace(/[^0-9.]/g, "");

            /* Link — extract /dp/ASIN URL. */
            const linkEl =
              card.querySelector("a[href*='/dp/'], a.a-link-normal[href*='/dp/'], h2 a, [class*='-title'] a");
            const href = linkEl?.getAttribute("href") ?? "";

            /* Image — try multiple known classnames + lazy-load attrs. */
            const imgEl = card.querySelector("img.s-image, img.p13n-product-image, img[class*='product-image'], img[data-image-source-density]");
            const imageUrl =
              imgEl?.getAttribute("src") ??
              imgEl?.getAttribute("data-src") ??
              "";

            return { title, saleStr, origStr, href, imageUrl };
          }),
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href) continue;
        const salePrice = parseFloat(item.saleStr);
        const origPrice = parseFloat(item.origStr) || salePrice;
        if (!salePrice || salePrice < 1) continue;

        /* Build absolute URL. Amazon often uses relative /dp/ASIN paths
           on best-sellers; preserve the marketplace hostname. */
        const fullUrl = item.href.startsWith("http")
          ? item.href.split("?")[0]
          : `https://${config.hostname}${item.href.split("?")[0]}`;

        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const discountPercent = origPrice > salePrice
          ? Math.round(((origPrice - salePrice) / origPrice) * 100)
          : 0;

        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} on ${config.storeName}.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: config.storeId,
          storeName: config.storeName,
          originalPrice: origPrice,
          salePrice,
          discountPercent,
          /* Deal.currency type only allows NGN | USD. Use USD as the
             intl signal regardless of marketplace; display layer
             handles localized format. */
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Amazon", "International", resolved.category, `country:${marketplace}`],
        });
        pageDeals++;
      }

      console.log(`    ${config.storeName} ${cat}: ${items.length} cards → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    ${config.storeName} ${cat} failed: ${err}`);
    }
  }

  console.log(`  ✓ ${config.storeName}: ${deals.length} deals`);
  return deals;
}
