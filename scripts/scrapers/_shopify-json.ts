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
  /** Currency the Shopify store prices in. NGN by default for the
      historical NG retailer use case; GBP / EUR / USD for the Awin UK +
      DE merchants the scraper now also serves. Prices are converted to
      USD at scrape time using a hard-coded FX table so the Deal pipeline
      (which only knows "NGN" | "USD") stays unchanged; the display layer
      then re-converts USD to the visitor's currency, so a UK shopper
      sees GBP, an NG shopper sees NGN, etc. */
  nativeCurrency?: "NGN" | "USD" | "GBP" | "EUR";
  /** Country code for the resulting offers (stored on the offer row
      via dealToOfferRow). Lets the country-resolver attribute a UK
      Shopify store to UK even if the store-domain registry hasn't
      caught up yet. Lowercase ISO 3166-1 alpha-2; defaults to "ng". */
  storeCountry?: string;
  /** When true, fetch /collections.json first to discover EVERY
      collection on the store, then walk each. The `collections`
      array above is then used only to assign per-handle category
      hints (when a discovered handle matches one of the configured
      hints, use that cat; otherwise fall through to product_type
      inference or "all" default). Auto-walk is the right call for
      stores where the merchant uses many collections to organize
      catalog but doesn't expose them all via /collections/all
      (rare, but common enough for stores with rich category trees).
      Costs more bandwidth (~1 extra HTTPS round trip + 1 fetch per
      collection) but typically 2-3x the product count vs walking
      just /collections/all. */
  autoWalkAllCollections?: boolean;
}

/** Shopify /collections.json response — public on every store.
    Returns the list of collections with handles + titles. */
interface ShopifyCollection {
  id:     number;
  handle: string;
  title:  string;
}
interface ShopifyCollectionsResponse {
  collections: ShopifyCollection[];
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

/* Auto-walk helper — fetch /collections.json, return an array of
   handle+cat entries. The cat is inferred from the configured
   collection hints when one matches; otherwise default to "all"
   and let downstream category inference (resolveCategory on
   product_type) handle it. */
async function discoverAllCollections(cfg: ShopifyConfig): Promise<Array<{ handle: string; cat: string }>> {
  const url = `${cfg.baseUrl}/collections.json?limit=250`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Accept": "application/json,text/plain,*/*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`    ${cfg.name} /collections.json: HTTP ${res.status}, falling back to configured collections`);
      return cfg.collections;
    }
    const data = (await res.json()) as ShopifyCollectionsResponse;
    const hints = new Map(cfg.collections.map((c) => [c.handle, c.cat]));
    /* Drop the bare "frontpage" handle — duplicates /collections/all
       on most Shopify storefronts and burns a fetch for no extra
       products. Drop "all" too if present in the auto-discovery
       output since we'll add it explicitly first. */
    const discovered = data.collections
      .filter((c) => c.handle !== "frontpage" && c.handle !== "all")
      .map((c) => ({ handle: c.handle, cat: hints.get(c.handle) ?? "all" }));
    /* Always include /collections/all first — it's the master pool
       and ensures we don't miss products that exist outside any
       merchant-defined collection. */
    const out = [{ handle: "all", cat: hints.get("all") ?? "all" }, ...discovered];
    console.log(`    ${cfg.name} auto-discovered ${out.length} collections (was ${cfg.collections.length} configured)`);
    return out;
  } catch (err) {
    console.warn(`    ${cfg.name} /collections.json: ${(err as Error).message}, falling back to configured`);
    return cfg.collections;
  }
}

export async function scrapeShopifyCatalog(cfg: ShopifyConfig): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const seenHandles = new Set<string>();
  const pageLimit = cfg.pageLimit ?? 2;

  console.log(`  → ${cfg.name} (Shopify JSON)...`);

  /* Resolve which collections to walk. Auto-discovery costs one
     extra /collections.json fetch but typically uncovers 5-20x more
     collections than a hand-curated list. The per-collection page
     cap + seenHandles dedup keep total cost bounded. */
  const collections = cfg.autoWalkAllCollections
    ? await discoverAllCollections(cfg)
    : cfg.collections;

  for (const { handle, cat } of collections) {
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

        /* Normalize to USD for non-NGN stores so the Deal pipeline
           (currency: "NGN" | "USD") stays unchanged. FX_PER_USD is a
           1 USD = X table; divide native by that to get USD. NGN keeps
           its raw value because the pipeline treats NGN as a first-class
           currency (no conversion). The display layer then converts USD
           back to the visitor's currency, so a UK shopper sees GBP, an
           NG shopper sees NGN, etc. */
        const nativeCurrency = cfg.nativeCurrency ?? "NGN";
        const storedCurrency: "NGN" | "USD" = nativeCurrency === "NGN" ? "NGN" : "USD";
        const FX_PER_USD: Record<string, number> = { USD: 1, GBP: 0.79, EUR: 0.92 };
        const fx = FX_PER_USD[nativeCurrency] ?? 1;
        const salePriceStored     = nativeCurrency === "NGN" ? salePrice     : Math.round((salePrice     / fx) * 100) / 100;
        const originalPriceStored = nativeCurrency === "NGN" ? originalPrice : Math.round((originalPrice / fx) * 100) / 100;

        /* Category: try Shopify's product_type first ("Vitamins",
           "Skincare", "Beverages"). If our resolver doesn't know that
           label, fall through to the config's collection category
           (which is always one of our known slugs).

           Was: const catRaw = p.product_type || cat;
           That always preferred product_type and hit the resolver's
           DEFAULT fallback ("electronics") for every Shopify-native
           label our map didn't have — so HealthPlus pharmacy items
           ("Vitamins", "Pain Relief") all bucketed as electronics,
           Supermart groceries too. Verified May 2026 via the
           per-store category breakdown:
             healthplus: 494/554 in "electronics" (should be beauty)
             supermart:  347/358 in "electronics" (should be home)
             essenza:    138/560 in "electronics" (should be beauty)
           This routes them correctly via the config-category fall-
           back. The ingest-time auto-correct in ingestion.ts then
           refines further via title-based inference. */
        const productTypeResolved = p.product_type ? resolveCategory(p.product_type) : null;
        const usedProductType = !!productTypeResolved && productTypeResolved.slug !== "electronics";
        const resolved = usedProductType
          ? productTypeResolved!
          : resolveCategory(cat);

        const tagList = Array.isArray(p.tags)
          ? p.tags
          : typeof p.tags === "string" && p.tags
            ? p.tags.split(",").map((t) => t.trim())
            : [];

        deals.push({
          title:           p.title,
          description:     p.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || `${p.title} - shop on ${cfg.name}.`,
          category:        resolved.category,
          categorySlug:    resolved.slug,
          storeId:         cfg.storeId,
          storeName:       cfg.name,
          originalPrice:   originalPriceStored,
          salePrice:       salePriceStored,
          discountPercent,
          currency:        storedCurrency,
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
