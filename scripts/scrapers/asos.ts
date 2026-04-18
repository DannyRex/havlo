import { Page } from "playwright";
import { RawDeal, resolveCategory } from "./types.js";

// ASOS affiliate: ASOS Affiliate Program via Awin (awin.com)
// Very popular with Nigerians for fashion — ships to Nigeria
// Uses their internal product search API (same endpoint their website calls)

const ASOS_QUERIES = [
  { q: "women dress" },
  { q: "women shoes" },
  { q: "men shirt" },
  { q: "men sneakers" },
  { q: "women bag" },
  { q: "women jeans" },
  { q: "men jacket" },
  { q: "women tops" },
  { q: "men trousers" },
  { q: "women skirt" },
  { q: "men shorts" },
  { q: "women activewear" },
  { q: "men boots" },
  { q: "women sunglasses" },
];

interface ASOSProduct {
  id: number;
  name: string;
  url: string;
  imageUrl: string;
  price: {
    current: { value: number; text: string };
    previous: { value: number; text: string };
    rrp: { value: number; text: string };
    isMarkedDown: boolean;
    discountPercentage: number;
  };
  brand: { name: string };
}

export async function scrapeAsos(_page: Page): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenIds = new Set<number>();

  console.log("  → ASOS (API)...");

  for (const { q } of ASOS_QUERIES) {
    const cat = "fashion";
    try {
      // ASOS product search API — same endpoint their site uses
      const params = new URLSearchParams({
        country:  "US",
        currency: "USD",
        channel:  "desktop-web",
        lang:     "en-US",
        store:    "US",
        q,
        offset:   "0",
        limit:    "48",
        sort:     "freshness",
      });

      const apiUrl = `https://www.asos.com/api/product/search/v2/?${params.toString()}`;

      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.asos.com/",
          "Origin": "https://www.asos.com",
        },
      });

      if (!res.ok) {
        console.warn(`    ASOS API "${q}": HTTP ${res.status}`);
        continue;
      }

      const json = await res.json() as { products?: ASOSProduct[] };
      const products = json?.products ?? [];

      let pageDeals = 0;
      for (const p of products) {
        if (seenIds.has(p.id)) continue;
        seenIds.add(p.id);

        const salePrice = p.price?.current?.value ?? 0;
        const origPrice = p.price?.previous?.value || p.price?.rrp?.value || salePrice;
        if (!salePrice || salePrice <= 0) continue;

        const discountPercent = origPrice > salePrice
          ? p.price.discountPercentage ||
            Math.round(((origPrice - salePrice) / origPrice) * 100)
          : 0;

        // Include all products — Nigerians browse international stores even for non-sale items

        // Build absolute product URL — p.url may be relative without leading slash
        const productUrl = p.url.startsWith("http")
          ? p.url
          : `https://www.asos.com/${p.url.replace(/^\//, "")}`;

        // ASOS image CDN — ensure https:// prefix and bump resolution
        const rawImg = (p.imageUrl ?? "").replace(/\?.*$/, "");
        const imageUrl = rawImg
          ? rawImg.startsWith("http")
            ? rawImg + "?$n_320w$"
            : rawImg.startsWith("//")
              ? `https:${rawImg}?$n_320w$`
              : `https://${rawImg}?$n_320w$`
          : "";

        const resolved = resolveCategory(cat);

        deals.push({
          title: p.name,
          description: `${p.name} — shop on ASOS, ships to Nigeria from the UK.`,
          category: resolved.category, categorySlug: resolved.slug,
          storeId: "asos", storeName: "ASOS",
          originalPrice: origPrice, salePrice, discountPercent,
          currency: "USD",
          imageUrl: imageUrl || undefined,
          imageEmoji: resolved.emoji, imageGradient: resolved.gradient,
          url: productUrl,
          tags: ["ASOS", "International", resolved.category, p.brand?.name ?? ""],
        });
        pageDeals++;
      }

      console.log(`    ASOS "${q}": ${products.length} products → ${pageDeals} deals`);

      // Polite delay
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      console.warn(`    ASOS "${q}" failed: ${err}`);
    }
  }

  console.log(`  ✓ ASOS: ${deals.length} deals`);
  return deals;
}
