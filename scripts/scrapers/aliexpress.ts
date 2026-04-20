import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// AliExpress affiliate: AliExpress Portals (portals.aliexpress.com) or Admitad
//
// Scrape notes (learned the hard way, mirrors the DHgate hardening):
//   • AliExpress serves product hrefs in three shapes on the same page:
//       - absolute     "https://www.aliexpress.com/item/1005006XXXXX.html?spm=…"
//       - protocol-rel "//www.aliexpress.com/item/1005006XXXXX.html?…"
//       - protocol-rel "//www.aliexpress.us/item/3256807XXXXX.html?…"
//     We must NOT force the `.com` host — `.us` listings exist only on that
//     localized subdomain and 404 on `.com`. We also MUST handle the
//     protocol-relative case or we emit malformed URLs like
//     `https://www.aliexpress.com//www.aliexpress.com/item/…` which 404.
//
//   • Price extraction absolutely cannot be done from card-level textContent.
//     A single card's text typically contains:
//       - real sale price          ($4.50)
//       - strikethrough original   ($45.99)
//       - coupon amount            (Coupon $2)
//       - coin discount            (Coins $0.50)
//       - shipping cost            (Shipping $0.39)
//       - multi-variant range      ($4.50 – $45.99, one ad for all variants)
//       - installment text         (3x $1.50)
//       - "Choice" promo line
//     The old scraper did `Math.min(allDollarNumbers)` as sale and
//     `Math.max(...)` as original, which handed out fake "95% off $4" deals
//     everywhere. We now look for semantic price elements only (class tokens
//     containing `price-sale` / `price-original`), reject any candidate
//     whose ancestor is a coupon / shipping / coin / cart / installment
//     container, detect multi-variant ranges, and cap any discount > 80%.

const ALIEXPRESS_PAGES = [
  { url: "https://www.aliexpress.com/wholesale?SearchText=electronics&SortType=total_tranpro_desc",   cat: "electronics" },
  { url: "https://www.aliexpress.com/wholesale?SearchText=smartphone&SortType=total_tranpro_desc",    cat: "phones" },
  { url: "https://www.aliexpress.com/wholesale?SearchText=fashion+dress&SortType=total_tranpro_desc", cat: "fashion" },
  { url: "https://www.aliexpress.com/wholesale?SearchText=hair+wig&SortType=total_tranpro_desc",      cat: "beauty" },
];

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|smartphone|iphone|samsung|xiaomi|redmi|poco|earb|airpod|earbud|headphone|speaker|powerbank|power bank/.test(t)) return "phones";
  if (/laptop|notebook|tablet|ipad/.test(t)) return "computing";
  if (/\btv\b|television|smart tv/.test(t)) return "televisions";
  if (/dress|shirt|blouse|trouser|jeans|skirt|cloth|fashion|sneaker|shoe|bag|purse/.test(t)) return "fashion";
  if (/wig|hair|lace|bundle|curl|weave|extension/.test(t)) return "beauty";
  if (/cream|serum|lipstick|mascara|foundation|skin|make.?up|nail/.test(t)) return "beauty";
  if (/fridge|washing|microwave|cooker|blender|iron|vacuum/.test(t)) return "appliances";
  return "electronics";
}

/**
 * Resolve a raw href from AliExpress markup to a clean absolute URL.
 * Handles all three shapes we see on search pages (see file header). Keeps
 * the domain intact — never forces `.com` — so `.us`-served listings resolve.
 * Strips query + fragment so downstream dedupe keys are stable.
 */
function absolutizeHref(rawHref: string, pageOrigin: string): string {
  const clean = rawHref.split("#")[0].split("?")[0];
  if (!clean) return "";
  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
  if (clean.startsWith("//")) return `https:${clean}`;
  if (clean.startsWith("/")) return `${pageOrigin}${clean}`;
  return `${pageOrigin}/${clean}`;
}

export async function scrapeAliExpress(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → AliExpress...");

  // Same `__name` shim we use in the DHgate scraper — see that file for the
  // full rationale. tl;dr: tsx+esbuild sprinkles `__name(fn, "fn")` after every
  // named declaration, and those references blow up inside a Playwright
  // $$eval callback because the helper lives at module scope. We pass the
  // script as a STRING so it bypasses TS/JS transformation, and
  // addInitScript reruns on every navigation in the loop below.
  await page.addInitScript(
    "if (typeof globalThis.__name === 'undefined') { globalThis.__name = function (fn) { return fn; }; }"
  );

  for (const { url, cat } of ALIEXPRESS_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });

      const productSel = "a[href*='/item/']";
      const captchaSel = "[class*='captcha'], [id*='captcha'], [class*='punish']";

      const result = await Promise.race([
        page.waitForSelector(productSel, { timeout: 12000 }).then(() => "products"),
        page.waitForSelector(captchaSel, { timeout: 12000 }).then(() => "captcha"),
      ]).catch(() => "timeout");

      if (result === "captcha" || result === "timeout") {
        const title = await page.title();
        console.warn(`    AliExpress blocked (${result}): ${title}`);
        continue;
      }

      // Nudge the lazy-loaded bottom half of the grid.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1500);

      // Capture the final page origin (AliExpress occasionally redirects
      // `.com` → `.us` or to a regional subdomain) so root-relative hrefs
      // on the page resolve against the right host.
      const pageOrigin = new URL(page.url()).origin;

      const items = await page.$$eval(
        "a[href*='/item/']",
        (links) => {
          // `__name` is shimmed on globalThis via page.addInitScript — safe to
          // define named helpers here despite esbuild's keepNames wrapping.

          // Class-token regex for rejection: any price candidate whose
          // ancestor chain names one of these is NOT the product's list price.
          // We want coupons, coin redemption, shipping estimates, cart hints,
          // installments, and the "also bought" strip out of the picture.
          const NOISE_RE =
            /coupon|coin|shipping|delivery|cart|saved|bundle|installment|tax|\bfee\b|recommend|related|similar|plus-?bundle|choice/i;

          function isNoiseEl(el: Element | null): boolean {
            if (!el) return true;
            let cur: Element | null = el;
            for (let i = 0; i < 6 && cur; i++) {
              const cls = cur.getAttribute ? (cur.getAttribute("class") ?? "") : "";
              if (NOISE_RE.test(cls)) return true;
              cur = cur.parentElement;
            }
            return false;
          }

          // Pull `$X.XX` numbers out of a tightly-scoped price element's text.
          // We keep 0.5 as the floor (some AliExpress items really are that
          // cheap) and 10k as the ceiling to toss anything that smells like a
          // SKU number or a review count accidentally prefixed with `$`.
          function extractNums(text: string): number[] {
            const out: number[] = [];
            const matches = text.matchAll(/\$\s*([\d,]+\.?\d*)/g);
            for (const m of matches) {
              const n = parseFloat(m[1].replace(/,/g, ""));
              if (Number.isFinite(n) && n >= 0.5 && n < 10000) out.push(n);
            }
            return out;
          }

          const seen = new Set<string>();
          const out: Array<{
            title: string;
            salePrice: number;
            origPrice: number;
            isRange: boolean;
            rawHref: string;
            imgSrc: string;
          }> = [];

          for (const link of links) {
            const rawHref = link.getAttribute("href") ?? "";
            if (!rawHref.includes("/item/")) continue;
            const cleanHref = rawHref.split("#")[0].split("?")[0];
            if (seen.has(cleanHref)) continue;

            // Walk up to find the tightest "card" that owns a semantic
            // price element. We cap the walk at 8 ancestors so we can't
            // accidentally consume a neighbour's sale price.
            let card: Element | null = link.parentElement;
            let salePriceEl: Element | null = null;
            for (let i = 0; i < 8 && card; i++) {
              // Preferred class tokens, in priority order. AliExpress ships
              // build-hashed class names (`multi--price-sale--U-S0jtj`),
              // which is why we match on the substring rather than the full
              // class. Tokens are listed most-specific first.
              const candidates: (Element | null)[] = [
                card.querySelector("[class*='multi--price-sale']"),
                card.querySelector("[class*='es--price-sale']"),
                card.querySelector("[class*='manhattan--price-sale']"),
                card.querySelector("[class*='price-sale']"),
                card.querySelector("[class*='priceSale']"),
                // Last-resort: any price-classed element that isn't flagged
                // as "original" or "old". We slice so a card with 10 price
                // spans doesn't cost us quadratic time.
                ...Array.from(
                  card.querySelectorAll(
                    "[class*='price']:not([class*='riginal']):not([class*='Old']):not([class*='old'])",
                  ),
                ).slice(0, 3),
              ];
              for (const c of candidates) {
                if (c && !isNoiseEl(c)) { salePriceEl = c; break; }
              }
              if (salePriceEl) break;
              card = card.parentElement;
            }
            if (!card || !salePriceEl) continue;
            seen.add(cleanHref);

            const saleText = (salePriceEl.textContent ?? "").replace(/\s+/g, " ").trim();
            const saleNums = extractNums(saleText);
            if (saleNums.length === 0) continue;

            // Multi-variant range like "$4.50 – $45.99": the low number is
            // just the cheapest variant (often a tiny accessory), not a
            // "was price". We record the UPPER bound as the headline price
            // and never claim a discount from the spread.
            const isRange = /[-–—]/.test(saleText) && saleNums.length >= 2;
            const salePrice = isRange ? Math.max(saleNums[0], saleNums[1]) : saleNums[0];

            // Original price: explicit semantic element only (<del>, <s>, or
            // a class name containing `price-original`). We do NOT scan
            // card-level text — that's exactly what produced the fake
            // "$4 95% off" listings on the old scraper.
            const origEl = card.querySelector(
              "del, s, " +
                "[class*='multi--price-original'], [class*='es--price-original']," +
                "[class*='manhattan--price-original'], [class*='price-original']," +
                "[class*='priceOriginal']",
            );
            let origPrice = salePrice;
            if (origEl && !isNoiseEl(origEl)) {
              const origNums = extractNums(origEl.textContent ?? "");
              if (origNums.length > 0 && origNums[0] > salePrice) origPrice = origNums[0];
            }

            // Title: prefer the link's `title` attribute (usually the full
            // product name), fall back to heading text, then link text.
            const titleAttr = link.getAttribute("title") ?? "";
            const heading = card.querySelector(
              "h1,h2,h3,[class*='multi--title'],[class*='es--title'],[class*='manhattan--title']," +
                "[class*='title'],[class*='Title'],[class*='name'],[class*='Name']",
            );
            const headingText = (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
            const linkText = (link.textContent ?? "").replace(/\s+/g, " ").trim();
            const titleCandidates = [titleAttr, headingText, linkText].filter(Boolean);
            const title = (titleCandidates.sort((a, b) => b.length - a.length)[0] ?? "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 120);
            if (!title) continue;

            const img = card.querySelector("img") as HTMLImageElement | null;
            const imgSrc =
              img?.getAttribute("src") ??
              img?.getAttribute("data-src") ??
              img?.getAttribute("data-image") ??
              "";

            out.push({ title, salePrice, origPrice, isRange, rawHref: cleanHref, imgSrc });
            if (out.length >= 40) break;
          }
          return out;
        },
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title) continue;
        // $1 floor mirrors the post-validation we do on DHgate. Anything
        // below this is almost always a parse artefact — a coupon amount
        // or a per-pack unit price — rather than a real AliExpress listing.
        if (!item.salePrice || item.salePrice < 1) continue;

        const href = absolutizeHref(item.rawHref, pageOrigin);
        if (!href.includes("/item/")) continue;
        if (seenUrls.has(href)) continue;
        seenUrls.add(href);

        let discountPercent =
          item.origPrice > item.salePrice
            ? Math.round(((item.origPrice - item.salePrice) / item.origPrice) * 100)
            : 0;

        // Range cards advertise the upper bound AS the price — there's no
        // meaningful "original", so never claim a discount.
        if (item.isRange) discountPercent = 0;
        // Belt-and-braces: any remaining discount above 80% is almost
        // always a parsing artefact (coupon text that slipped through the
        // noise filter, or a ghost element). Drop the discount label
        // rather than the listing itself.
        if (discountPercent > 80) discountPercent = 0;

        const imageUrl = item.imgSrc.startsWith("//")
          ? `https:${item.imgSrc}`
          : item.imgSrc;
        const catKey = inferCategory(item.title) || cat;
        const resolved = resolveCategory(catKey);

        deals.push({
          title: item.title,
          description: `${item.title} — shop on AliExpress with worldwide shipping.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "aliexpress",
          storeName: "AliExpress",
          // If we didn't find a real strike-through original, mirror
          // salePrice so the UI doesn't draw a bogus strikethrough.
          originalPrice: discountPercent > 0 ? item.origPrice : item.salePrice,
          salePrice: item.salePrice,
          discountPercent,
          currency: "USD",
          imageUrl: imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: href,
          tags: ["AliExpress", "International", resolved.category],
        });
        pageDeals++;
      }

      const q = new URL(url).searchParams.get("SearchText") ?? "page";
      console.log(`    AliExpress "${q}": ${items.length} candidates → ${pageDeals} deals`);

      // Polite delay — AliExpress rate-limits aggressive scrapers hard.
      await page.waitForTimeout(2500);
    } catch (err) {
      console.warn(`    AliExpress failed: ${err}`);
    }
  }

  console.log(`  ✓ AliExpress: ${deals.length} deals`);
  return deals;
}
