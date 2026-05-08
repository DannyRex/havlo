/* Generic Shopify catalog fetcher.

   Why this file exists, and why it's a bigger deal than it looks:

   Every Shopify store exposes a public, no-auth JSON endpoint that
   returns its full catalog as structured data:

       https://{store}/collections/{handle}/products.json?limit=250&page=N

   No Playwright, no HTML scraping, no CSS selectors that break on
   theme updates, no Cloudflare challenge pages. Just structured JSON
   with title, price, vendor, product_type, variants, images, and
   handles. Pagination is built in.

   This makes Shopify-based stores DRAMATICALLY cheaper to ingest
   than WordPress / WooCommerce / custom platforms. NG retailers on
   Shopify (HealthPlus, Supermart, plenty more) plug in via a 6-line
   config block.

   This scraper deliberately doesn't take a Playwright `Page` — it's
   a pure node-fetch path. scrape.ts wraps it so the orchestrator
   contract stays uniform, but at runtime no browser is launched.
   The savings: ~30s per Shopify store vs. the Playwright path. */

import { RawDeal, resolveCategory } from "./types.js";

export interface ShopifyConfig {
  /** Display name shown in scrape logs. */
  name:    string;
  /** storeId used on the resulting RawDeal. Stable across runs because
      dedup matches on it. */
  storeId: string;
  /** Public domain root (no trailing slash). */
  baseUrl: string;
  /** Collections to fetch. Use {handle: "all", cat: "default"} as the
      catch-all bucket — every Shopify store has /collections/all that
      lists every product. Alternatively list specific handles to
      bias category coverage (e.g. only health/beauty). */
  collections: Array<{ handle: string; cat: string }>;
  /** Per-collection page cap. Default 2 pages × 250 products =
      500 max per collection. Most NG retailer catalogs fit easily
      below that ceiling. */
  pageLimit?: number;
}

/* Shopify products.json schema — only the fields we use. There's a
   lot more in the response (created_at, options, etc.) we ignore. */
interface ShopifyVariant {
  id:               number;
  title:            string;
  sku:              string | null;
  available:        boolean;
  price:            string;          // decimal as string ("24650.00")
  compare_at_price: string | null;
}
interface ShopifyImage {
  src:    string;
  width:  number;
  height: number;
}
interface ShopifyProduct {
  id:           number;
  title:        string;
  handle:       string;
  body_html:    string;
  vendor:       string;
  product_type: string;
  tags:         string[] | string;
  variants:     ShopifyVariant[];
  images:       ShopifyImage[];
}
interface ShopifyResponse {
  products: ShopifyProduct[];
}

export async function scrapeShopifyCatalog(cfg: ShopifyConfig): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenHandles = new Set<string>();
  const pageLimit = cfg.pageLimit ?? 2;

  console.log(`  → ${cfg.name} (Shopify JSON)...`);

  for (const { handle, cat } of cfg.collections) {
    let pageDeals = 0;
    for (let page = 1; page <= pageLimit; page++) {
      const url = `${cfg.baseUrl}/collections/${handle}/products.json?limit=250&page=${page}`;
      let data: ShopifyResponse;
      try {
        const res = await fetch(url, {
          headers: {
            /* Real-browser UA + Accept header. Shopify's public JSON
               endpoint doesn't gate on these but a few storefronts'
               edge configs do. Cheap insurance. */
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 " +
              "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Accept": "application/json,text/plain,*/*",
          },
          /* Shopify's JSON endpoint is fast — 8s is generous. Slow
             responses usually indicate a blocked store; fail soft. */
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          console.warn(`    ${cfg.name} ${handle} page ${page}: HTTP ${res.status}`);
          break;
        }
        data = (await res.json()) as ShopifyResponse;
      } catch (err) {
        console.warn(`    ${cfg.name} ${handle} page ${page}: ${(err as Error).message}`);
        break;
      }

      const products = data.products ?? [];
      if (products.length === 0) break;

      for (const p of products) {
        if (seenHandles.has(p.handle)) continue;
        seenHandles.add(p.handle);

        /* Shopify lists multiple variants (size, colour) per product;
           we represent the cheapest available variant as the deal,
           with the highest variant's compare_at_price as the
           original price for discount math. Skip products with no
           in-stock variant. */
        const inStockVariants = p.variants.filter((v) => v.available);
        if (inStockVariants.length === 0) continue;

        const cheapest = inStockVariants.reduce((best, v) =>
          parseFloat(v.price) < parseFloat(best.price) ? v : best,
        );
        const salePrice     = parseFloat(cheapest.price);
        const compareAt     = cheapest.compare_at_price ? parseFloat(cheapest.compare_at_price) : 0;
        const originalPrice = compareAt > salePrice ? compareAt : salePrice;
        const discountPercent = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        if (salePrice <= 0) continue;

        /* Category: prefer Shopify's own product_type when it's set
           (e.g. "Vitamins", "Skincare"). Fall back to the config's
           collection category when product_type is missing. */
        const catRaw = p.product_type || cat;
        const resolved = resolveCategory(catRaw);

        const tagList = Array.isArray(p.tags)
          ? p.tags
          : typeof p.tags === "string" && p.tags
            ? p.tags.split(",").map((t) => t.trim())
            : [];

        deals.push({
          title:           p.title,
          description:     p.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || `${p.title} — shop on ${cfg.name}.`,
          category:        resolved.category,
          categorySlug:    resolved.slug,
          storeId:         cfg.storeId,
          storeName:       cfg.name,
          originalPrice,
          salePrice,
          discountPercent,
          currency:        "NGN",
          imageUrl:        p.images[0]?.src,
          imageEmoji:      resolved.emoji,
          imageGradient:   resolved.gradient,
          url:             `${cfg.baseUrl}/products/${p.handle}`,
          tags:            [cfg.name, resolved.category, p.vendor, ...tagList].filter(Boolean),
        });
        pageDeals++;
      }

      /* Shopify returns up to limit=250 per page; if we got less, we're
         on the last page. Saves a useless second request. */
      if (products.length < 250) break;
    }
    console.log(`    ${cfg.name} ${handle}: ${pageDeals} deals`);
  }

  console.log(`  ✓ ${cfg.name}: ${deals.length} deals`);
  return deals;
}
