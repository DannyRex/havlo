import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

function inferCategoryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/\btv\b|television|smart tv|qled|oled|led tv|home theatre|theater|sound bar|soundbar/.test(t)) return "televisions";
  if (/phone|smartphone|infinix|tecno|itel|samsung.*a\d|galaxy.*a|redmi|poco|iphone/.test(t)) return "phones";
  if (/laptop|macbook|notebook|chromebook/.test(t)) return "computing";
  if (/earb|headphone|speaker|airpods|earphone/.test(t)) return "audio";
  if (/fridge|refrigerator|freezer|washing|microwave|cooker|oven/.test(t)) return "appliances";
  if (/fan|solar|inverter|power bank|power station|generator/.test(t)) return "electronics";
  if (/shoe|sneaker|cloth|shirt|dress|bag/.test(t)) return "fashion";
  if (/cream|serum|lotion|hair|clipper|shaver/.test(t)) return "beauty";
  if (/tablet|ipad/.test(t)) return "phones";
  return "";
}

// Konga confirmed selector: article (40 items)
// Text format: "- X%TITLE₦SALE₦ORIGINALSame Day..."
/* Broad sweep — every Konga department where deals appear. Konga's
   internal slugs are a `<name>-<numeric_id>` format, fragile if they
   re-id; tested as of 2026-04 build. Page counts tuned per dept. */
const KONGA_BASE = [
  { slug: "phones-tablets-5261",              cat: "phones",      pages: 4 },
  { slug: "televisions-2713",                 cat: "televisions", pages: 2 },
  { slug: "home-appliances-4181",             cat: "appliances",  pages: 3 },
  { slug: "computing-5263",                   cat: "computing",   pages: 3 },
  { slug: "home-kitchen-4186",                cat: "home",        pages: 3 },
  { slug: "fashion-4191",                     cat: "fashion",     pages: 4 },
  { slug: "audio-headphones-2709",            cat: "audio",       pages: 2 },
  { slug: "gaming-5411",                      cat: "gaming",      pages: 2 },
  { slug: "cameras-2699",                     cat: "electronics", pages: 1 },
  { slug: "generators-inverters-4183",        cat: "electronics", pages: 1 },
  { slug: "health-beauty-personal-care-4180", cat: "beauty",      pages: 3 },
  { slug: "baby-products-4187",               cat: "home",        pages: 2 },
  /* Newly added — broader coverage of Konga deal-bearing departments */
  { slug: "automotive-4189",                  cat: "automotive",  pages: 2 },
  { slug: "books-music-movies-4190",          cat: "books",       pages: 1 },
  { slug: "groceries-4192",                   cat: "groceries",   pages: 1 },
  { slug: "office-products-4193",             cat: "home",        pages: 1 },
  { slug: "garden-outdoors-4194",             cat: "garden",      pages: 1 },
  { slug: "pet-supplies-4195",                cat: "pets",        pages: 1 },
  { slug: "musical-instruments-4196",         cat: "music",       pages: 1 },
  { slug: "industrial-scientific-4197",       cat: "industrial",  pages: 1 },
  { slug: "sports-outdoors-4198",             cat: "sports",      pages: 2 },
];

const KONGA_PAGES = KONGA_BASE.flatMap(({ slug, cat, pages }) =>
  Array.from({ length: pages }, (_, i) => ({
    url: `https://www.konga.com/category/${slug}${i === 0 ? "" : `?page=${i + 1}`}`,
    cat,
  })),
);

export async function scrapeKonga(page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Konga...");

  for (const { url, cat } of KONGA_PAGES) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      // Konga renders cards with next/image — the real Cloudinary src is only
      // injected after Next.js's IntersectionObserver fires for that specific card.
      // Scroll EACH card into view individually (don't scroll back to top — that
      // can re-virtualize images back to placeholder), then wait briefly per card.
      await page.evaluate(async () => {
        const cards = Array.from(document.querySelectorAll("article"));
        for (const card of cards) {
          card.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
          await new Promise((r) => setTimeout(r, 120));
        }
        // Final settle so the last batch's images can resolve
        await new Promise((r) => setTimeout(r, 800));
      });

      const items = await page.$$eval("article", (cards) =>
        cards.slice(0, 50).map((card) => {
          // Text: "- 4%TITLE₦268,300₦278,300Same Day..."
          const fullText = card.textContent?.replace(/\s+/g, " ").trim() ?? "";

          // Extract discount
          const discMatch = fullText.match(/^-\s*(\d+)%/);
          const discount  = discMatch ? parseInt(discMatch[1], 10) : 0;

          // Extract all Naira prices (₦X,XXX,XXX pattern)
          const priceMatches = [...fullText.matchAll(/₦([\d,]+)/g)];
          const prices = priceMatches
            .map((m) => parseInt(m[1].replace(/,/g, ""), 10))
            .filter((n) => n > 100);

          // Sale price = smallest, original = largest
          const salePrice     = prices.length > 0 ? Math.min(...prices) : 0;
          const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

          // Title: text between discount% and first ₦
          const afterDiscount = fullText.replace(/^-\s*\d+%/, "").trim();
          const titleMatch    = afterDiscount.match(/^([^₦]+)/);
          const title         = titleMatch ? titleMatch[1].replace(/\.\.\.$/, "").trim() : "";

          // Link
          const linkEl = card.querySelector("a[href*='/product/'], a[href*='konga.com']");
          const href   = linkEl?.getAttribute("href") ?? "";

          // Image — Konga lazy-loads, so check every common lazy-load attribute.
          // Skip 1×1 placeholders / data: URIs / blank gifs.
          const imgEl = card.querySelector("img");
          const candidates = [
            imgEl?.getAttribute("src"),
            imgEl?.getAttribute("data-src"),
            imgEl?.getAttribute("data-original"),
            imgEl?.getAttribute("data-lazy"),
            imgEl?.getAttribute("data-original-src"),
            // srcset: take the first URL
            (imgEl?.getAttribute("srcset") || imgEl?.getAttribute("data-srcset") || "")
              .split(",")[0]?.trim().split(" ")[0],
            // Some templates wrap the <img> in a <picture> with <source srcset>
            card.querySelector("picture source")?.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0],
          ].filter((u): u is string => !!u && u.length > 10 && !u.startsWith("data:"));
          const imageUrl = candidates[0] ?? "";

          return { title, discount, salePrice, originalPrice, href, imageUrl };
        })
      );

      let pageDeals = 0;
      for (const item of items) {
        if (!item.title || !item.href || !item.salePrice) continue;

        const fullUrl = item.href.startsWith("http")
          ? item.href
          : `https://www.konga.com${item.href}`;

        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        const discountPercent = item.discount ||
          (item.originalPrice > item.salePrice
            ? Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)
            : 0);

        const resolved = resolveCategory(inferCategoryFromTitle(item.title) || cat);

        deals.push({
          title: item.title,
          description: `${item.title} — shop on Konga Nigeria.`,
          category: resolved.category,
          categorySlug: resolved.slug,
          storeId: "konga",
          storeName: "Konga",
          originalPrice: item.originalPrice,
          salePrice: item.salePrice,
          discountPercent,
          imageUrl: item.imageUrl || undefined,
          imageEmoji: resolved.emoji,
          imageGradient: resolved.gradient,
          url: fullUrl,
          tags: ["Konga", resolved.category],
        });
        pageDeals++;
      }

      const slug = url.split("/").pop() ?? "";
      console.log(`    Konga ${slug}: ${items.length} cards → ${pageDeals} deals`);
    } catch (err) {
      console.warn(`    Konga failed: ${err}`);
    }
  }

  console.log(`  ✓ Konga: ${deals.length} deals`);
  return deals;
}
