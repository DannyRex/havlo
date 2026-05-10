// Targeted SKU sweep — for the search/compare feature to be useful, the SAME
// product must exist at 2+ Nigerian stores. Crawling category pages alone leaves
// huge gaps (e.g. Konga's top-30 phones-tablets page may not include Galaxy A06
// even though Konga sells it). This scraper hits each store's SEARCH endpoint
// for a curated list of popular Nigerian SKUs and grabs the top 1–3 matching
// listings per store. Cheap, focused, and produces real cross-store overlap.

import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

// Curated list of products real Nigerian shoppers compare prices on.
// Add more here as needed — each one becomes one search query per store.
const POPULAR_SKUS: Array<{ q: string; cat: string }> = [
  // Phones
  { q: "Samsung Galaxy A06",       cat: "phones" },
  { q: "Samsung Galaxy A16",       cat: "phones" },
  { q: "Samsung Galaxy A26",       cat: "phones" },
  { q: "Samsung Galaxy S24",       cat: "phones" },
  { q: "Samsung Galaxy S25 Ultra", cat: "phones" },
  { q: "Tecno Spark 30",           cat: "phones" },
  { q: "Tecno Spark 40",           cat: "phones" },
  { q: "Tecno Camon 30",           cat: "phones" },
  { q: "Tecno Pop 10",             cat: "phones" },
  { q: "Infinix Hot 50",           cat: "phones" },
  { q: "Infinix Smart 10",         cat: "phones" },
  { q: "Infinix Note 40",          cat: "phones" },
  { q: "Itel A70",                 cat: "phones" },
  { q: "Itel P55",                 cat: "phones" },
  { q: "Redmi Note 14",            cat: "phones" },
  { q: "iPhone 15",                cat: "phones" },
  { q: "iPhone 15 Pro Max",        cat: "phones" },
  { q: "iPhone 16",                cat: "phones" },
  { q: "iPhone 16 Pro Max",        cat: "phones" },
  /* Current flagships as of May 2026 — added so Konga + Slot search
     surfaces them alongside the 3C Hub Shopify-JSON ingest. The QA
     report flagged "iPhone Pro Max" coverage gaps; the immediate
     fix landed via 3C Hub JSON, this widens it to the other two. */
  { q: "iPhone 17",                cat: "phones" },
  { q: "iPhone 17 Pro",            cat: "phones" },
  { q: "iPhone 17 Pro Max",        cat: "phones" },
  { q: "iPhone 17 Air",            cat: "phones" },
  { q: "Samsung Galaxy S26 Ultra", cat: "phones" },
  { q: "Samsung Galaxy Z Fold 7",  cat: "phones" },
  { q: "Samsung Galaxy Z Flip 7",  cat: "phones" },

  // TVs
  { q: "Hisense 43 inch TV",       cat: "televisions" },
  { q: "Hisense 50 inch TV",       cat: "televisions" },
  { q: "Hisense 65 inch TV",       cat: "televisions" },
  { q: "Samsung 43 inch TV",       cat: "televisions" },
  { q: "Samsung 55 inch TV",       cat: "televisions" },
  { q: "LG 43 inch TV",            cat: "televisions" },
  { q: "TCL 43 inch TV",           cat: "televisions" },
  { q: "Syinix 43 inch TV",        cat: "televisions" },

  // Audio
  { q: "JBL Clip 4",               cat: "audio" },
  { q: "JBL Go 4",                 cat: "audio" },
  { q: "Oraimo FreePods 4",        cat: "audio" },
  { q: "AirPods Pro 2",            cat: "audio" },
  { q: "Sony WH-1000XM5",          cat: "audio" },

  // Laptops — current Apple silicon flagships first, then NG-popular
  // mid-range laptops that Konga / Slot actually carry.
  { q: "MacBook Pro M4",           cat: "computing" },
  { q: "MacBook Air M3",           cat: "computing" },
  { q: "MacBook Air M2",           cat: "computing" },
  { q: "iPad Pro M4",              cat: "computing" },
  { q: "iPad Air M2",              cat: "computing" },
  { q: "HP Pavilion 15",           cat: "computing" },
  { q: "Dell Inspiron 15",         cat: "computing" },
  { q: "Lenovo IdeaPad 3",         cat: "computing" },

  // Gaming — added current Xbox flagship + Switch (Konga carries both).
  { q: "PlayStation 5",            cat: "electronics" },
  { q: "PlayStation 5 Slim",       cat: "electronics" },
  { q: "Xbox Series X",            cat: "electronics" },
  { q: "Xbox Series S",            cat: "electronics" },
  { q: "Nintendo Switch OLED",     cat: "electronics" },

  // Appliances
  { q: "Hisense Refrigerator",     cat: "appliances" },
  { q: "LG Washing Machine",       cat: "appliances" },
];

interface StoreSearchSpec {
  storeId: string;
  storeName: string;
  buildUrl: (q: string) => string;
  cardSelector: string;
  // Returns at most N items per query — we keep search noise out
  maxPerQuery: number;
  /* Time after domcontentloaded to wait before reading cards.
     Konga's lazy <img> next/image needs ~3.5s for the first six cards.
     Slot is a Vite SPA that fetches search results client-side after
     bundle execution; needs ~4s for the cards to paint. Tuned per
     store after observing flagship coverage gaps in production. */
  waitMs: number;
  /* Optional explicit selector to wait for. If present, Playwright
     races the selector against waitMs and returns whichever wins,
     so fast renders aren't artificially slowed. */
  waitForSelector?: string;
}

const STORES: StoreSearchSpec[] = [
  {
    storeId:         "konga",
    storeName:       "Konga",
    buildUrl:        (q) => `https://www.konga.com/search?search=${encodeURIComponent(q)}`,
    cardSelector:    "article",
    maxPerQuery:     2,
    /* Konga renders fast (server-side) but next/image lazy-loads the
       product photos. The post-load scroll loop below kicks the
       lazy-loader; 3.5s is enough for the first 6 images to settle. */
    waitMs:          3500,
    waitForSelector: "article",
  },
  {
    storeId:         "slot",
    storeName:       "Slot",
    buildUrl:        (q) => `https://www.slot.ng/?s=${encodeURIComponent(q)}&post_type=product`,
    cardSelector:    "[class*='item'][class*='product']",
    maxPerQuery:     2,
    /* Slot is a Vite SPA. Every URL returns the same 13KB shell HTML;
       the bundle then reads the URL, fetches search results from
       Slot's API, and renders product cards into the DOM. End-to-end
       this typically takes 3.5-4.5s on a clean Chromium. We wait up to
       4s OR until product cards appear, whichever comes first. */
    waitMs:          4000,
    waitForSelector: "[class*='item'][class*='product']",
  },
  /* 3C Hub removed from popular-skus search in May 2026.
     The bare host (3chub.com/search) returns 404, the www host's
     search is JS-rendered and the popular-skus Playwright wait
     window was too short to catch results. 3C Hub now ingests via
     the dedicated Shopify JSON path in scrapers/threechub.ts which
     gives full per-collection catalog coverage including all current
     iPhone / Galaxy flagships. */
];

// Generic card extractor — works with any of Konga/Slot/3C Hub since they all
// concatenate title + ₦price in the card's textContent.
async function extractCards(page: Page, selector: string, max: number): Promise<Array<{ title: string; salePrice: number; originalPrice: number; href: string; imageUrl: string }>> {
  return await page.$$eval(
    selector,
    (cards, max) => {
      return cards.slice(0, max * 3).map((card) => {
        const fullText = (card.textContent ?? "").replace(/\s+/g, " ").trim();
        // Discount prefix like "- 4%TITLE..."
        const afterDisc = fullText.replace(/^-\s*\d+%/, "").trim();

        // All ₦ prices — Slot/Konga style
        const priceMatches = [...fullText.matchAll(/₦\s*([\d,]+)/g)];
        const prices = priceMatches.map((m) => parseInt(m[1].replace(/,/g, ""), 10)).filter((n) => n > 100);
        const salePrice     = prices.length > 0 ? Math.min(...prices) : 0;
        const originalPrice = prices.length > 1 ? Math.max(...prices) : salePrice;

        // Title: text before first ₦
        const titleMatch = afterDisc.match(/^([^₦]+)/);
        const title = titleMatch ? titleMatch[1].slice(0, 120).replace(/\.\.\.$/, "").trim() : "";

        // First product link
        const links = card.querySelectorAll("a");
        let href = "";
        for (const a of Array.from(links)) {
          const h = a.getAttribute("href") ?? "";
          if (h.includes("/product") || h.includes("/p/") || h.includes(".html") || h.startsWith("http")) {
            href = h; break;
          }
        }
        if (!href) href = links[0]?.getAttribute("href") ?? "";

        const imgEl = card.querySelector("img");
        const imageCandidates = [
          imgEl?.getAttribute("src"),
          imgEl?.getAttribute("data-src"),
          imgEl?.getAttribute("data-lazy"),
          imgEl?.getAttribute("data-original"),
          (imgEl?.getAttribute("srcset") ?? "").split(",")[0]?.trim().split(" ")[0],
        ].filter((u): u is string => !!u && u.length > 10 && !u.startsWith("data:"));
        const imageUrl = imageCandidates[0] ?? "";

        return { title, salePrice, originalPrice, href, imageUrl };
      });
    },
    max,
  );
}

// Quick relevance check — search results often include irrelevant suggestions.
// Require at least one alphanumeric token from the query to appear in the title.
function isRelevant(query: string, title: string): boolean {
  const t = title.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  // Need at least 60% of query tokens in the title
  const hits = tokens.filter((w) => t.includes(w)).length;
  return hits >= Math.max(2, Math.ceil(tokens.length * 0.6));
}

export async function scrapePopularSkus(page: Page): Promise<RawDeal[]> {
  const out: RawDeal[] = [];
  const seen = new Set<string>();

  console.log("  → Popular SKU sweep (Konga/Slot/3C Hub)...");

  for (const store of STORES) {
    let storeAdded = 0;

    for (const sku of POPULAR_SKUS) {
      const url = store.buildUrl(sku.q);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

        /* Race a selector check against the per-store wait budget so
           fast renders aren't artificially slowed AND slow SPA renders
           still get a chance to paint. Without the selector race,
           Slot's 1.5s wait was missing the 3.5-4.5s bundle execution
           window and returning zero cards every time. */
        if (store.waitForSelector) {
          await page
            .waitForSelector(store.waitForSelector, { timeout: store.waitMs })
            .catch(() => { /* fall through to time-based wait */ });
        } else {
          await page.waitForTimeout(store.waitMs);
        }

        // For Konga's lazy-loaded next/image, scroll cards into view.
        // Bumped the per-card delay 100ms → 200ms because the lazy
        // loader was occasionally racing the next scroll.
        if (store.storeId === "konga") {
          await page.evaluate(async () => {
            const cards = Array.from(document.querySelectorAll("article")).slice(0, 6);
            for (const c of cards) {
              c.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
              await new Promise((r) => setTimeout(r, 200));
            }
          });
        }

        const items = await extractCards(page, store.cardSelector, store.maxPerQuery);
        let kept = 0;

        for (const item of items) {
          if (kept >= store.maxPerQuery) break;
          if (!item.title || !item.salePrice || !item.href) continue;
          if (!isRelevant(sku.q, item.title)) continue;

          /* threechub branch removed alongside the STORES entry — 3C
             Hub no longer ingests via this scraper. Slot + Konga stay. */
          const fullUrl = item.href.startsWith("http")
            ? item.href
            : `https://www.${store.storeId === "slot" ? "slot.ng" : "konga.com"}${item.href}`;

          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          const discountPercent = item.originalPrice > item.salePrice
            ? Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)
            : 0;

          const cat = resolveCategory(sku.cat);
          out.push({
            title: item.title,
            description: `${item.title} — search result from ${store.storeName}.`,
            category: cat.category,
            categorySlug: cat.slug,
            storeId: store.storeId,
            storeName: store.storeName,
            originalPrice: item.originalPrice,
            salePrice: item.salePrice,
            discountPercent,
            imageUrl: item.imageUrl || undefined,
            imageEmoji: cat.emoji,
            imageGradient: cat.gradient,
            url: fullUrl,
            tags: [store.storeName, cat.category],
          });
          kept++;
          storeAdded++;
        }
      } catch (err) {
        // Single failure shouldn't kill the sweep
        console.warn(`    ${store.storeName} "${sku.q}": ${String(err).slice(0, 60)}`);
      }
      await page.waitForTimeout(400);
    }

    console.log(`    ${store.storeName}: +${storeAdded} from ${POPULAR_SKUS.length} SKU searches`);
  }

  // Also try Jumia via fetch (no Playwright — Jumia blocks PW with Cloudflare)
  const jumiaHeaders = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-NG,en;q=0.9",
  };

  let jumiaAdded = 0;
  for (const sku of POPULAR_SKUS) {
    const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(sku.q)}`;
    try {
      const res = await fetch(url, { headers: jumiaHeaders });
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes("Just a moment") || html.includes("cf-browser-verification")) continue;

      const articleRe = /<article[^>]*class="[^"]*prd[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
      let m;
      let kept = 0;
      while ((m = articleRe.exec(html)) !== null && kept < 2) {
        const block = m[1];
        const title = block.match(/class="[^"]*name[^"]*"[^>]*>([^<]+)</)?.[1]?.trim() ?? "";
        const saleText = block.match(/class="[^"]*\bprc\b[^"]*"[^>]*>([^<]+)</)?.[1]?.trim() ?? "";
        const origText = block.match(/class="[^"]*\bold\b[^"]*"[^>]*>([^<]+)</)?.[1]?.trim() ?? "";
        const href = block.match(/href="(\/[^"]+\.html[^"]*)"/)?.[1] ?? "";
        const img = block.match(/data-src="([^"]+)"|src="(https:\/\/[^"]+\.jpg[^"]*)"/)?.[1] ?? "";

        const salePrice     = parseNaira(saleText);
        const originalPrice = parseNaira(origText) || salePrice;
        if (!title || !salePrice || !href) continue;
        if (!isRelevant(sku.q, title)) continue;
        const full = `https://www.jumia.com.ng${href}`;
        if (seen.has(full)) continue;
        seen.add(full);

        const cat = resolveCategory(sku.cat);
        const discountPercent = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;
        out.push({
          title, description: `${title} — search result from Jumia.`,
          category: cat.category, categorySlug: cat.slug,
          storeId: "jumia", storeName: "Jumia",
          originalPrice, salePrice, discountPercent,
          imageUrl: img || undefined, imageEmoji: cat.emoji, imageGradient: cat.gradient,
          url: full, tags: ["Jumia", cat.category],
        });
        kept++;
        jumiaAdded++;
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  console.log(`    Jumia: +${jumiaAdded} from ${POPULAR_SKUS.length} SKU searches`);

  console.log(`  ✓ Popular SKU sweep: ${out.length} cross-store deals`);
  return out;
}
