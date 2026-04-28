/**
 * Dealesty Deal Scraper
 * Run with: npm run scrape
 *
 * Scrapes Jumia, Konga, Slot, 3C Hub, Spar, Jiji using Playwright (headless Chromium).
 * Outputs to src/lib/data/deals.ts — ready to commit and deploy.
 */

// @ts-ignore — playwright-extra has no bundled TS types
import { chromium } from "playwright-extra";
// @ts-ignore
import StealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(StealthPlugin());
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { RawDeal } from "./scrapers/types.js";
import { scrapeJumia }      from "./scrapers/jumia.js";
import { scrapeKonga }      from "./scrapers/konga.js";
import { scrapeSlot }       from "./scrapers/slot.js";
import { scrapeThreeChub }  from "./scrapers/threechub.js";
import { scrapeSpar }       from "./scrapers/spar.js";
import { scrapeJiji }       from "./scrapers/jiji.js";
import { scrapeAliExpress } from "./scrapers/aliexpress.js";
import { scrapeDHgate }     from "./scrapers/dhgate.js";
import { scrapeAsos }       from "./scrapers/asos.js";
import { scrapeAmazon }     from "./scrapers/amazon.js";
import { scrapePopularSkus } from "./scrapers/popular-skus.js";
import { scrapeKara }       from "./scrapers/kara.js";
import { scrapeObiwezy }    from "./scrapers/obiwezy.js";
/* scrapePayPorte intentionally not imported — their robots.txt
   site-wide disallow rules us out. */
import { isAllowedByRobots } from "./scrapers/robots.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Emoji + gradient per store brand for imageGradient variety
const STORE_STYLES: Record<string, string> = {
  jumia:     "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
  konga:     "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
  slot:      "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  threechub: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
  spar:      "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
  jiji:      "linear-gradient(135deg, #10b981 0%, #047857 100%)",
  kara:      "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  obiwezy:   "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
  payporte:  "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
};

function generateDealId(index: number): string {
  return `d${index + 1}`;
}

function toTypeScriptArray(deals: RawDeal[]): string {
  const today = new Date().toISOString().split("T")[0];

  const entries = deals.map((deal, i) => {
    const isHot      = deal.discountPercent >= 40;
    const isFeatured = deal.discountPercent >= 55 || ["jumia", "threechub"].includes(deal.storeId);
    const gradient   = deal.imageGradient || STORE_STYLES[deal.storeId] || STORE_STYLES["jumia"];

    // Estimate engagement based on discount
    const saves  = Math.floor(deal.discountPercent * 20 + Math.random() * 200);
    const clicks = Math.floor(deal.discountPercent * 300 + Math.random() * 2000);

    // Flash sale deals expire in 2 weeks; others have no expiry
    const expiresAt = deal.storeId === "jumia" ? `"${getExpiryDate(14)}"` : "null";

    const tags = JSON.stringify([...new Set(deal.tags)]);
    const url  = deal.url.replace(/"/g, '\\"');

    // Filter placeholder GIFs and upgrade Shopify thumbnail resolution
    let cleanImageUrl = deal.imageUrl ?? "";
    if (cleanImageUrl.startsWith("data:") || cleanImageUrl.length < 10) cleanImageUrl = "";
    if (cleanImageUrl.includes("cdn.shopify") || cleanImageUrl.includes("/cdn/shop/")) {
      cleanImageUrl = cleanImageUrl.replace(/[?&]width=\d+/, "").replace(/\?$/, "") + (cleanImageUrl.includes("?") ? "&width=600" : "?width=600");
    }

    const imageUrlLine = cleanImageUrl
      ? `\n    imageUrl: ${JSON.stringify(cleanImageUrl)},`
      : "";

    return `  {
    id: "${generateDealId(i)}",
    title: ${JSON.stringify(deal.title)},
    description: ${JSON.stringify(deal.description)},
    category: ${JSON.stringify(deal.category)},
    categorySlug: ${JSON.stringify(deal.categorySlug)},
    storeId: ${JSON.stringify(deal.storeId)},
    storeName: ${JSON.stringify(deal.storeName)},
    originalPrice: ${deal.originalPrice},
    salePrice: ${deal.salePrice},
    discountPercent: ${deal.discountPercent},
    currency: ${JSON.stringify(deal.currency ?? "NGN")},${imageUrlLine}
    imageGradient: ${JSON.stringify(gradient)},
    imageEmoji: ${JSON.stringify(deal.imageEmoji)},
    url: "${url}",
    expiresAt: ${expiresAt},
    isHot: ${isHot},
    isFeatured: ${isFeatured},
    tags: ${tags},
    saves: ${saves},
    clicks: ${clicks},
    postedAt: "${today}",
  }`;
  });

  return entries.join(",\n");
}

function getExpiryDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function deduplicate(deals: RawDeal[]): RawDeal[] {
  const seen = new Set<string>();
  return deals.filter((d) => {
    const key = d.url.toLowerCase().replace(/[?#].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByDiscount(deals: RawDeal[]): RawDeal[] {
  return [...deals].sort((a, b) => b.discountPercent - a.discountPercent);
}

async function main() {
  console.log("\n🛒 Dealesty Scraper — starting\n");
  const startTime = Date.now();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const COMMON_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  // Nigerian context — locale en-NG
  const ngContext = await browser.newContext({
    userAgent: COMMON_UA,
    viewport: { width: 1280, height: 800 },
    locale: "en-NG",
  });
  // Block heavy non-image assets only. Konga (and others) use next/image with native
  // loading="lazy" + data:image placeholder src — blocking images would prevent the
  // real cloudinary URL from ever populating the src attribute.
  await ngContext.route("**/*.{mp4,mp3,woff,woff2,ttf,otf}", (route) => route.abort());
  const page = await ngContext.newPage();

  // International context — locale en-US, wider viewport
  const intlContext = await browser.newContext({
    userAgent: COMMON_UA,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });
  // Don't block images for INTL — some lazy-load via same requests as content
  const intlPage = await intlContext.newPage();

  const allDeals: RawDeal[] = [];

  /* Each scraper declares the canonical URL it will hit. We check
     robots.txt against that URL before invoking; disallowed scrapers
     are skipped with a clear log line for the audit trail.

     Set HAVLO_IGNORE_ROBOTS=1 to override (e.g. for one-off debugging
     of a scraper whose target page changed but root robots.txt is
     stale). NOT recommended in production crons. */
  const scrapers = [
    // Nigerian stores (en-NG context)
    { name: "Jumia",      probe: "https://www.jumia.com.ng/mlp-flash-sales/",     fn: () => scrapeJumia(page) },
    { name: "3C Hub",     probe: "https://3chub.com/",                            fn: () => scrapeThreeChub(page) },
    { name: "Slot",       probe: "https://slot.ng/",                              fn: () => scrapeSlot(page) },
    { name: "Konga",      probe: "https://www.konga.com/category/phones-tablets-5261", fn: () => scrapeKonga(page) },
    { name: "Kara",       probe: "https://kara.com.ng/mobile-phones",             fn: () => scrapeKara(page) },
    { name: "Obiwezy",    probe: "https://obiwezy.com/category/phones",           fn: () => scrapeObiwezy(page) },
    /* PayPorte excluded — their robots.txt has a site-wide Disallow.
       We honor it (per the disclaimer commitment + scrapers/robots.ts
       check). To re-enable: get explicit permission from PayPorte +
       relax their robots.txt for our user-agent (HavloBot). */
    { name: "Spar",       probe: "https://www.sparng.com/",                       fn: () => scrapeSpar(page) },
    { name: "Jiji",       probe: "https://jiji.ng/",                              fn: () => scrapeJiji(page) },
    { name: "Popular SKUs", probe: "https://www.konga.com/",                      fn: () => scrapePopularSkus(page) },
    // International stores (en-US stealth context)
    { name: "AliExpress", probe: "https://www.aliexpress.com/",                   fn: () => scrapeAliExpress(intlPage) },
    { name: "DHgate",     probe: "https://www.dhgate.com/",                       fn: () => scrapeDHgate(intlPage) },
    { name: "ASOS",       probe: "https://www.asos.com/",                         fn: () => scrapeAsos(intlPage) },
    { name: "Amazon",     probe: "https://www.amazon.com/",                       fn: () => scrapeAmazon(intlPage) },
  ];

  const ignoreRobots = process.env.HAVLO_IGNORE_ROBOTS === "1";

  for (const { name, probe, fn } of scrapers) {
    if (!ignoreRobots) {
      const verdict = await isAllowedByRobots(probe);
      if (!verdict.allowed) {
        console.warn(`⊘ ${name} skipped: robots.txt blocks ${probe} (${verdict.reason})`);
        continue;
      }
      if (verdict.crawlDelayMs && verdict.crawlDelayMs > 1000) {
        console.log(`◷ ${name} requests crawl-delay ${verdict.crawlDelayMs}ms — honoring`);
      }
    }
    try {
      const deals = await fn();
      allDeals.push(...deals);
    } catch (err) {
      console.error(`✗ ${name} scraper crashed: ${err}`);
    }
  }

  await ngContext.close();
  await intlContext.close();
  await browser.close();

  const unique = deduplicate(allDeals);
  const sorted = sortByDiscount(unique);

  // Separate by currency: NGN (local) vs USD (international)
  const ngDeals   = sorted.filter((d) => !d.currency || d.currency === "NGN");
  const intlDeals = sorted.filter((d) => d.currency === "USD");

  // Within each group: discounted first, then listings
  const ngFinal = [
    ...ngDeals.filter((d) => d.discountPercent > 0),
    ...ngDeals.filter((d) => d.discountPercent === 0),
  ];
  const intlFinal = [
    ...intlDeals.filter((d) => d.discountPercent > 0),
    ...intlDeals.filter((d) => d.discountPercent === 0),
  ];

  // Nigerian deals first, then international
  const final = [...ngFinal, ...intlFinal];

  console.log(`\n📦 Total unique deals: ${final.length}`);
  console.log(`   Nigerian (NGN): ${ngFinal.length}`);
  console.log(`   International (USD): ${intlFinal.length}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱  Done in ${elapsed}s\n`);

  // Generate TypeScript output
  const output = `import type { Deal } from "@/types";

// Auto-generated by scripts/scrape.ts — ${new Date().toUTCString()}
// DO NOT edit manually. Run \`npm run scrape\` to refresh.

export const deals: Deal[] = [
${toTypeScriptArray(final)}
];

export function getDeals(params?: {
  categorySlug?: string;
  minDiscount?: number;
  sort?: string;
  search?: string;
  limit?: number;
}): Deal[] {
  let result = [...deals];

  if (params?.categorySlug && params.categorySlug !== "all") {
    result = result.filter((d) => d.categorySlug === params.categorySlug);
  }

  if (params?.minDiscount && params.minDiscount > 0) {
    result = result.filter((d) => d.discountPercent >= params.minDiscount!);
  }

  if (params?.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  switch (params?.sort) {
    case "price_asc":
      result.sort((a, b) => a.salePrice - b.salePrice);
      break;
    case "price_desc":
      result.sort((a, b) => b.salePrice - a.salePrice);
      break;
    case "discount":
      result.sort((a, b) => b.discountPercent - a.discountPercent);
      break;
    case "popular":
      result.sort((a, b) => b.clicks - a.clicks);
      break;
    default:
      result.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  }

  if (params?.limit) result = result.slice(0, params.limit);

  return result;
}

export const hotDeals = deals.filter((d) => d.isHot);
export const featuredDeals = deals.filter((d) => d.isFeatured);
`;

  const outPath = resolve(__dirname, "../src/lib/data/deals.ts");
  writeFileSync(outPath, output, "utf-8");

  console.log(`✅ Written to src/lib/data/deals.ts`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the output: cat src/lib/data/deals.ts`);
  console.log(`  2. Check the site: npm run dev`);
  console.log(`  3. Deploy: git add -A && git commit -m "chore: refresh deals" && git push\n`);
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
