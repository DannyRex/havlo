import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// DHgate affiliate: DHgate.com Affiliate Program (partner.dhgate.com)
// Ultra-cheap wholesale goods — same audience as Temu, much better accessibility.
//
// Markup notes (verified via scripts/inspect-dh.ts artifact, Apr 2026):
//   • Each product card in the main grid is `div.gitem` (id="product-N").
//     Two auxiliary card layouts also appear on category pages:
//       - `div.b-productitem`             top-of-page picks
//       - `li.slide-item.video-item`      "newArrival" carousels
//   • The PRICE is exposed in dedicated semantic elements per layout:
//       - .gitem            →  `.pro-price strong`     ("US $330.91 - 339.44")
//       - .b-productitem    →  `.price strong`         ("US $25.65")
//       - slide-item        →  `.prod-price .price`    ("US $165.15")
//     We read ONLY from those — never from card-level textContent — because
//     DHgate sprinkles coupon nodes across every card:
//       - `.j-new-coupon`             ("$12" from a sitewide "New User" popup)
//       - `.amount-left`              ("$12")
//       - `.sale-item`                ("Save $1 With Coupon", "Per $100 Save 10")
//     Earlier versions text-mined the whole card and the coupon strings won,
//     producing bogus "$1" sale prices and "90% OFF" discounts.
//   • DHgate range prices are MOQ tier ranges. The LOWER bound is the
//     ~100-piece per-unit price; the UPPER bound is what a buyer of 1 unit
//     actually pays. We record the upper bound and never claim a discount
//     from the spread.
//   • Strikethrough originals (<s>, <del>, .old/.crossed/.through, .originPrice)
//     do appear on some categories. We honour those when present, never invent.

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

      const found = await page
        .waitForSelector("div.gitem, div.b-productitem, li.slide-item.video-item", { timeout: 10000 })
        .then(() => true)
        .catch(() => false);

      if (!found) {
        console.warn(`    DHgate: no products found at ${url}`);
        continue;
      }

      // Lazy-load: scroll once to wake up the bottom half of the grid.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1000);

      const items = await page.$$eval(
        "div.gitem, div.b-productitem, li.slide-item.video-item",
        (cards) => {
          const out: Array<{
            title: string;
            salePrice: number;
            origPrice: number;
            isRange: boolean;
            href: string;
            imageUrl: string;
          }> = [];

          const toNum = (s: string) => parseFloat(s.replace(/,/g, ""));

          // Pull numbers out of a single price string like "US $25.65" or
          // "US $330.91 - 339.44" or "$165.15". Returns numbers in order.
          const extractNums = (text: string): number[] =>
            [...text.matchAll(/[\d,]+\.?\d*/g)]
              .map((m) => toNum(m[0]))
              .filter((n) => Number.isFinite(n) && n >= 1 && n < 100000);

          for (const card of cards) {
            // Resolve the price element using DHgate's actual semantic
            // selectors. Order matters: most specific first.
            const priceEl =
              card.querySelector(".pro-price strong") ??
              card.querySelector(".prod-price .price") ??
              card.querySelector(".prod-price strong") ??
              card.querySelector(".price strong") ??
              card.querySelector(".b-productitem .price") ??
              card.querySelector(".price");
            if (!priceEl) continue;

            const priceText = (priceEl.textContent ?? "").replace(/\s+/g, " ").trim();
            const nums = extractNums(priceText);
            if (nums.length === 0) continue;

            // Range like "US $20 - $30" → buyer of 1 unit pays the upper bound.
            const isRange = /[-–—]/.test(priceText) && nums.length >= 2;
            const salePrice = isRange ? Math.max(nums[0], nums[1]) : nums[0];

            // Strikethrough/original — ONLY from a real semantic element.
            const origEl = card.querySelector(
              "s, del, [class*='old'], [class*='Old'], [class*='crossed'], [class*='Crossed'], [class*='through'], [class*='Through'], [class*='originPrice'], [class*='OriginPrice']"
            );
            let origPrice = salePrice;
            if (origEl) {
              const o = extractNums(origEl.textContent ?? "")[0];
              if (Number.isFinite(o) && o > salePrice) origPrice = o;
            }

            // Link + title
            const linkEl = card.querySelector(
              "p.pro-title a, a.subject.prod, a.pic, a[href*='/product/']"
            ) as HTMLAnchorElement | null;
            if (!linkEl) continue;

            const rawHref = (linkEl.getAttribute("href") ?? "").split("#")[0].split("?")[0];
            if (!rawHref.includes("/product/")) continue;
            const href = rawHref.startsWith("http") ? rawHref : `https://www.dhgate.com${rawHref}`;

            const imgEl = card.querySelector(
              ".photo img.lthumbnail, .photo img, img.lthumbnail, img"
            ) as HTMLImageElement | null;
            const altTitle = imgEl?.getAttribute("alt") ?? "";
            const linkTitle = (linkEl.textContent ?? "").replace(/\s+/g, " ").trim();
            // The img alt is usually a richer description than the visible link
            // text on DHgate ("Android Phone - Large Screen Smartphone with HD
            // Display..." vs the same).
            const title = (altTitle.length > linkTitle.length ? altTitle : linkTitle)
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 120);
            if (!title) continue;

            const imgSrc =
              imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? "";
            const imageUrl = imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc;

            out.push({ title, salePrice, origPrice, isRange, href, imageUrl });
            if (out.length >= 40) break;
          }
          return out;
        }
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href) continue;
        // Defensive floor — the structural fix above already excludes coupon
        // noise, but keep a low floor as a backstop. Genuine wholesale items
        // below $1.50 effectively do not exist on DHgate.
        if (!item.salePrice || item.salePrice < 1.5) continue;
        if (seenUrls.has(item.href)) continue;
        seenUrls.add(item.href);

        let discountPercent =
          item.origPrice > item.salePrice
            ? Math.round(((item.origPrice - item.salePrice) / item.origPrice) * 100)
            : 0;

        // Range cards use the upper bound AS the displayed price — there is
        // no meaningful "original", so never claim a discount.
        if (item.isRange) discountPercent = 0;
        // Belt-and-braces: any computed discount above 80% is almost always a
        // parsing artefact. Drop the discount label rather than the listing.
        if (discountPercent > 80) discountPercent = 0;

        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} — wholesale prices on DHgate with worldwide shipping.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "dhgate",
          storeName: "DHgate",
          // If we ended up with no real discount, mirror salePrice as
          // originalPrice so the UI doesn't show a strikethrough at all.
          originalPrice: discountPercent > 0 ? item.origPrice : item.salePrice,
          salePrice: item.salePrice,
          discountPercent,
          currency: "USD",
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: item.href,
          tags: ["DHgate", "International", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("/wholesale/")[1]?.split(".")[0] ?? "page";
      console.log(`    DHgate "${slug}": ${items.length} cards → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    DHgate failed: ${err}`);
    }
  }

  console.log(`  ✓ DHgate: ${deals.length} deals`);
  return deals;
}
