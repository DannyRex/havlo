// Jumia uses Cloudflare — Playwright gets blocked with "Just a moment..."
// Solution: plain Node fetch with a realistic UA works (SSR page, no JS required)
import { Page } from "playwright";
import { RawDeal, resolveCategory, parseNaira } from "./types.js";

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/phone|smartphone|iphone|samsung.*galaxy|techno|infinix|nokia|redmi|poco/.test(t)) return "phones";
  if (/laptop|macbook|notebook|chromebook/.test(t)) return "computing";
  if (/\btv\b|television|smart tv|qled|oled|led tv/.test(t)) return "televisions";
  if (/earb|headphone|speaker|airpods|earpod|earphone/.test(t)) return "audio";
  if (/fridge|refrigerator|freezer|washing|washer|microwave|cooker|oven/.test(t)) return "appliances";
  if (/fan|air con|inverter|solar|power station|power bank|generator/.test(t)) return "electronics";
  if (/shoe|sneaker|cloth|shirt|dress|trouser|jeans|bag/.test(t)) return "fashion";
  if (/cream|serum|lotion|hair|clipper|shaver|deodorant|perfume/.test(t)) return "beauty";
  if (/tablet|ipad/.test(t)) return "phones";
  return "electronics";
}

function extractDealsFromHtml(html: string, pageNum: number): RawDeal[] {
  const deals: RawDeal[] = [];

  // Jumia's SSR HTML contains product data in <article class="prd _fb col c-prd"> blocks
  // Each article has: .name (title), .prc (sale price), .old (original), .bdg._dsct (discount)
  const articleRegex = /<article[^>]*class="[^"]*prd[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[1];

    // Extract title
    const titleMatch = block.match(/class="[^"]*name[^"]*"[^>]*>([^<]+)</);
    const title = titleMatch?.[1]?.trim() ?? "";

    // Extract sale price (class="prc")
    const salePriceMatch = block.match(/class="[^"]*\bprc\b[^"]*"[^>]*>([^<]+)</);
    const saleText = salePriceMatch?.[1]?.trim() ?? "";

    // Extract original price (class="old")
    const origPriceMatch = block.match(/class="[^"]*\bold\b[^"]*"[^>]*>([^<]+)</);
    const origText = origPriceMatch?.[1]?.trim() ?? "";

    // Extract discount badge
    const discMatch = block.match(/class="[^"]*_dsct[^"]*"[^>]*>([^<]+)</);
    const discText = discMatch?.[1]?.replace(/-\s*/, "").replace(/%.*/, "").trim() ?? "0";

    // Extract product URL
    const linkMatch = block.match(/href="(\/[^"]+\.html[^"]*)"/);
    const href = linkMatch?.[1] ?? "";

    if (!title || !href) continue;

    const salePrice     = parseNaira(saleText);
    const originalPrice = parseNaira(origText) || salePrice;
    if (!salePrice || salePrice <= 0) continue;

    const discountPercent = originalPrice > salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : parseInt(discText, 10) || 0;

    if (discountPercent < 10) continue;

    const catKey  = inferCategory(title);
    const cat     = resolveCategory(catKey);

    deals.push({
      title,
      description: `${title} — flash sale on Jumia Nigeria. Limited time price.`,
      category: cat.category,
      categorySlug: cat.slug,
      storeId: "jumia",
      storeName: "Jumia",
      originalPrice,
      salePrice,
      discountPercent,
      imageEmoji: cat.emoji,
      imageGradient: cat.gradient,
      url: `https://www.jumia.com.ng${href}`,
      tags: ["Jumia", "Flash Sale", cat.category],
    });
  }

  return deals;
}

export async function scrapeJumia(_page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenUrls = new Set<string>();

  console.log("  → Jumia (fetch)...");

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-NG,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
  };

  // Flash sales + multi-page category coverage. Jumia exposes ?page=N reliably.
  const categoryBase: Array<{ slug: string; label: string; pages: number }> = [
    { slug: "phones-tablets",  label: "phones",      pages: 4 },
    { slug: "computing",       label: "computing",   pages: 3 },
    { slug: "electronics",     label: "electronics", pages: 3 },
    { slug: "televisions",     label: "televisions", pages: 2 },
    { slug: "appliances",      label: "appliances",  pages: 2 },
    { slug: "fashion",         label: "fashion",     pages: 3 },
    { slug: "health-beauty",   label: "beauty",      pages: 2 },
    { slug: "sporting-goods",  label: "sports",      pages: 1 },
    { slug: "gaming",          label: "gaming",      pages: 1 },
    { slug: "groceries",       label: "groceries",   pages: 1 },
    { slug: "baby-products",   label: "baby",        pages: 1 },
    { slug: "home-office",     label: "home",        pages: 2 },
  ];

  const pages = [
    ...Array.from({ length: 5 }, (_, i) => ({ url: `https://www.jumia.com.ng/flash-sales/?page=${i + 1}`, label: `flash-sales p${i + 1}` })),
    ...categoryBase.flatMap(({ slug, label, pages: n }) =>
      Array.from({ length: n }, (_, i) => ({
        url: `https://www.jumia.com.ng/${slug}/${i === 0 ? "" : `?page=${i + 1}`}`,
        label: n > 1 ? `${label} p${i + 1}` : label,
      })),
    ),
  ];

  for (const { url, label } of pages) {
    try {
      const res = await fetch(url, { headers });

      if (!res.ok) {
        console.warn(`    Jumia ${label}: HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();

      // Detect Cloudflare challenge
      if (html.includes("Just a moment") || html.includes("cf-browser-verification")) {
        console.warn(`    Jumia ${label}: Cloudflare challenge — skipping`);
        continue;
      }

      const pageDels = extractDealsFromHtml(html, 1);
      let newCount = 0;

      for (const deal of pageDels) {
        if (seenUrls.has(deal.url)) continue;
        seenUrls.add(deal.url);
        deals.push(deal);
        newCount++;
      }

      console.log(`    Jumia ${label}: ${newCount} deals`);

      // Polite delay
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.warn(`    Jumia ${label} error: ${err}`);
    }
  }

  console.log(`  ✓ Jumia: ${deals.length} deals`);
  return deals;
}
