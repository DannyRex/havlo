import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// DHgate affiliate: DHgate.com Affiliate Program (partner.dhgate.com)
// Ultra-cheap wholesale goods — same audience as Temu, much better accessibility.
//
// Markup notes (verified via scripts/inspect-dh.ts artifact, Apr 2026):
//   • DHgate uses at least three card layouts across categories:
//       - main grid        `div.gitem` (id="product-N")
//       - top-of-page      `div.b-productitem`
//       - carousels        `li.slide-item.video-item`
//     plus probably more we haven't catalogued. We therefore iterate on the
//     one stable signal — anchor tags with `/product/<id>.html` hrefs — and
//     walk up to find each link's nearest card-like container.
//   • Within a card we extract the PRICE ONLY from a dedicated semantic
//     element, never from card-level textContent. Priority:
//       - `.pro-price strong`       (gitem, e.g. "US $330.91 - 339.44")
//       - `.prod-price .price`      (carousel, e.g. "US $165.15")
//       - `.prod-price strong`      (carousel variant)
//       - `.price strong`           (b-productitem, e.g. "US $25.65")
//       - `.b-productitem .price`
//       - any `.price` not inside a coupon container
//     This matters because DHgate sprinkles coupon nodes across every card:
//       - `.j-new-coupon`    ("$12" sitewide "New User" popup mirrored into cards)
//       - `.amount-left`     ("$12")
//       - `.sale-item`       ("Save $1 With Coupon", "Per $100 Save 10")
//     Earlier versions text-mined the whole card and the coupon strings won,
//     producing bogus "$1" sale prices and "90% OFF" discounts. `isCouponEl()`
//     rejects price candidates whose ancestor chain names any of these.
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

      // Robust readiness signal: any product link. DHgate uses at least three
      // card layouts across categories (div.gitem on main grids, div.b-productitem
      // for top picks, li.slide-item for carousels), plus ad-hoc layouts we
      // haven't catalogued. Waiting on a specific card class would time out on
      // a category whose layout we haven't seen. Every layout wraps a product
      // in an anchor to /product/<id>.html, so that's the stable signal.
      const found = await page
        .waitForSelector("a[href*='/product/']", { timeout: 15000 })
        .then(() => true)
        .catch(() => false);

      if (!found) {
        console.warn(`    DHgate: no products found at ${url}`);
        continue;
      }

      // Lazy-load: scroll once to wake up the bottom half of the grid.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1200);

      const items = await page.$$eval(
        "a[href*='/product/']",
        (links) => {
          const seen = new Set<string>();
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

          // The cheap-coupon nodes that previously polluted our extraction are:
          //   .j-new-coupon   ("$12" NEW USER popup)
          //   .amount-left    ("$12")
          //   .sale-item      ("Save $1 With Coupon", "Per $100 Save 10")
          // We never want to treat any of these as a product price. When we pick
          // a price element we explicitly prefer semantic product-price selectors
          // and reject these by class/ancestor.
          const isCouponEl = (el: Element | null): boolean => {
            if (!el) return true;
            // Walk up a short distance — if any ancestor is a coupon container,
            // this isn't a real product price.
            let cur: Element | null = el;
            for (let i = 0; i < 4 && cur; i++) {
              const cls = cur.getAttribute?.("class") ?? "";
              if (/j-new-coupon|amount-left|sale-item|sale-tag|J-proSale|coupon|srp-coupon/i.test(cls)) return true;
              cur = cur.parentElement;
            }
            return false;
          };

          for (const link of links) {
            const rawHref = link.getAttribute("href") ?? "";
            if (!rawHref.includes("/product/")) continue;
            const cleanHref = rawHref.split("#")[0].split("?")[0];
            if (seen.has(cleanHref)) continue;

            // Walk up to find the nearest ancestor that contains a real price
            // element. We do NOT touch the ancestor's textContent — only the
            // price element's own textContent — so coupon/MOQ siblings can't
            // pollute the read.
            let card: Element | null = link.parentElement;
            let priceEl: Element | null = null;
            for (let i = 0; i < 12 && card; i++) {
              // Try semantic product-price selectors in priority order.
              const candidates: (Element | null)[] = [
                card.querySelector(".pro-price strong"),
                card.querySelector(".prod-price .price"),
                card.querySelector(".prod-price strong"),
                card.querySelector(".price strong"),
                card.querySelector(".b-productitem .price"),
                // Last-resort: any .price that isn't inside a coupon block.
                ...Array.from(card.querySelectorAll(".price")).slice(0, 3),
              ];
              for (const c of candidates) {
                if (c && !isCouponEl(c)) { priceEl = c; break; }
              }
              if (priceEl) break;
              card = card.parentElement;
            }
            if (!card || !priceEl) continue;

            // Only dedupe after we actually found a price — don't burn slots
            // on link copies that fail to yield a price.
            seen.add(cleanHref);

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
            if (origEl && !isCouponEl(origEl)) {
              const o = extractNums(origEl.textContent ?? "")[0];
              if (Number.isFinite(o) && o > salePrice) origPrice = o;
            }

            const href = cleanHref.startsWith("http")
              ? cleanHref
              : `https://www.dhgate.com${cleanHref}`;

            const imgEl = card.querySelector(
              ".photo img.lthumbnail, .photo img, img.lthumbnail, img"
            ) as HTMLImageElement | null;
            const altTitle = imgEl?.getAttribute("alt") ?? "";
            const linkTitle = (link.textContent ?? "").replace(/\s+/g, " ").trim();
            const titleAttr = link.getAttribute("title") ?? "";
            // img alt is usually the richest description; fall back to link
            // title attr, then link text.
            const candidates = [altTitle, titleAttr, linkTitle].filter(Boolean);
            const title = (candidates.sort((a, b) => b.length - a.length)[0] ?? "")
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
      console.log(`    DHgate "${slug}": ${items.length} candidates → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    DHgate failed: ${err}`);
    }
  }

  console.log(`  ✓ DHgate: ${deals.length} deals`);
  return deals;
}
