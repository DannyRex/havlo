/* Curated Amazon catalog — manually-maintained baseline of high-intent
   products across 5 marketplaces (US, UK, DE, AE, IN).

   Why this exists: a guaranteed always-present Amazon baseline that
   needs no API credits, so every country's homepage shows a storefront
   even if a cron run fails or SerpAPI is paused. The live Amazon
   catalogue is now grown by the SerpAPI engine=amazon INGEST
   (scripts/ingest-amazon-serpapi.ts, Wednesday cron) — that replaced the
   retired Amazon PA-API path (engine deprecated May 2026). This curated
   set remains the dependency-free floor under that live data. Each
   product is replicated across the 5 marketplaces so every country's
   homepage sees the right storefront.

   Why search URLs instead of /dp/ASIN URLs: ASINs rotate (regional
   variants, refurb editions, deprecations). A bad ASIN produces a
   broken Amazon page. Search URLs always 200 OK and Amazon's
   relevance scoring lands the user on the canonical product. The
   affiliate tag still attributes correctly because tag attribution
   works on any amazon.{tld} URL.

   Maintenance:
     - Refresh prices quarterly (or whenever a product moves more
       than 20% off the listed value)
     - Add new products to PRODUCTS — each one auto-expands across
       all marketplaces with the FX-converted USD baseline price
     - Remove EOL products (e.g. when a successor launches and the
       old SKU goes deep discount stays on Amazon)

   Currency note: Deal type only allows "NGN" | "USD". Using "USD"
   here as the locality signal — matches the rest of the intl pool.
   Prices stored as USD; per-marketplace display layer can convert
   to local currency if needed. */

import type { Deal } from "@/types";

interface CuratedProduct {
  /** Stable slug used in the deal id. */
  slug:        string;
  /** Display title. */
  title:       string;
  /** One-sentence description shown on cards. */
  description: string;
  category:    string;
  categorySlug: string;
  /** Search query for Amazon's search URL. URL-encoded at build time. */
  searchQuery: string;
  /** Approx. USD price (sale). FX gets applied per-marketplace if needed. */
  salePriceUsd:     number;
  /** Approx. USD original price (pre-discount). */
  originalPriceUsd: number;
  /** Optional: real product photo URL. We use Wikipedia / Wikimedia
      Commons URLs since they're stable, accessible, no bot detection,
      and the images are CC-licensed. When omitted, the card renders
      the Havlo logo fallback (see components/ui/HavloLogoFallback). */
  imageUrl?:    string;
  /** Mark a few flagship items as featured / hot to surface them
      prominently in TrendingDeals + the "hot" view filters. */
  isFeatured?: boolean;
}

/* ── 15 products spanning every category Havlo covers ─────────────── */
const PRODUCTS: CuratedProduct[] = [
  /* ── Phones ── */
  {
    slug: "iphone-15-pro-max",
    title: "Apple iPhone 15 Pro Max 256GB",
    description: "A17 Pro chip, titanium frame, 5x optical zoom - Apple's current flagship phone.",
    category: "Phones",
    categorySlug: "phones",
    searchQuery: "iPhone 15 Pro Max 256GB",
    salePriceUsd: 1099,
    originalPriceUsd: 1199,
    imageUrl: "https://m.media-amazon.com/images/I/81UKVHM77GL._AC_SL1500_.jpg",
    isFeatured: true,
  },
  {
    slug: "galaxy-s24-ultra",
    title: "Samsung Galaxy S24 Ultra 256GB",
    description: "Snapdragon 8 Gen 3, 200MP camera, S Pen, 6.8\" Dynamic AMOLED 2X.",
    category: "Phones",
    categorySlug: "phones",
    searchQuery: "Samsung Galaxy S24 Ultra 256GB",
    salePriceUsd: 1099,
    originalPriceUsd: 1299,
    imageUrl: "https://m.media-amazon.com/images/I/51A-Q4eMBxL._AC_SL1000_.jpg",
  },

  /* ── Computing ── */
  {
    slug: "macbook-air-m3-13",
    title: "Apple MacBook Air M3 13\" 256GB",
    description: "Apple Silicon M3, 8GB unified memory, 18-hour battery, fanless silent design.",
    category: "Laptops",
    categorySlug: "computing",
    searchQuery: "MacBook Air M3 13 inch 256GB",
    salePriceUsd: 999,
    originalPriceUsd: 1099,
    imageUrl: "https://m.media-amazon.com/images/I/71-D1xCuVwL._AC_SL1500_.jpg",
    isFeatured: true,
  },
  {
    slug: "ipad-air-m2",
    title: "Apple iPad Air M2 11\" 128GB",
    description: "M2 chip, Liquid Retina display, Apple Pencil Pro support, USB-C.",
    category: "Tablets",
    categorySlug: "computing",
    searchQuery: "iPad Air M2 11 inch 128GB",
    salePriceUsd: 549,
    originalPriceUsd: 599,
    imageUrl: "https://m.media-amazon.com/images/I/41meTpiX+8L._AC_.jpg",
  },
  {
    slug: "dell-xps-13",
    title: "Dell XPS 13 (2024) Intel Core Ultra 7",
    description: "Intel Core Ultra 7, 16GB RAM, 512GB SSD, 13.4\" InfinityEdge display.",
    category: "Laptops",
    categorySlug: "computing",
    searchQuery: "Dell XPS 13 Core Ultra 7 16GB 512GB",
    salePriceUsd: 1099,
    originalPriceUsd: 1399,
    imageUrl: "https://m.media-amazon.com/images/I/71ZktZ8Wn8L._AC_SL1500_.jpg",
  },

  /* ── Audio ── */
  {
    slug: "airpods-pro-2",
    title: "Apple AirPods Pro 2 with USB-C",
    description: "Active noise cancellation, adaptive audio, USB-C charging case, MagSafe.",
    category: "Earbuds",
    categorySlug: "audio",
    searchQuery: "AirPods Pro 2 USB-C",
    salePriceUsd: 199,
    originalPriceUsd: 249,
    imageUrl: "https://m.media-amazon.com/images/I/51NRGHU2NoL._AC_SL1500_.jpg",
    isFeatured: true,
  },
  {
    slug: "airpods-max",
    title: "Apple AirPods Max",
    description: "Over-ear active noise cancellation, spatial audio, premium aluminum cups.",
    category: "Headphones",
    categorySlug: "audio",
    searchQuery: "AirPods Max",
    salePriceUsd: 449,
    originalPriceUsd: 549,
    imageUrl: "https://m.media-amazon.com/images/I/71umw2cCkOL._AC_SL1500_.jpg",
  },
  {
    slug: "sony-wh-1000xm5",
    title: "Sony WH-1000XM5 Wireless Headphones",
    description: "Industry-leading noise cancellation, 30-hour battery, multi-point connection.",
    category: "Headphones",
    categorySlug: "audio",
    searchQuery: "Sony WH-1000XM5",
    salePriceUsd: 329,
    originalPriceUsd: 399,
    imageUrl: "https://m.media-amazon.com/images/I/61vJtKbAssL._AC_SL1500_.jpg",
  },
  {
    slug: "bose-quietcomfort-ultra",
    title: "Bose QuietComfort Ultra Headphones",
    description: "Immersive audio with head tracking, world-class noise cancellation, 24-hour battery.",
    category: "Headphones",
    categorySlug: "audio",
    searchQuery: "Bose QuietComfort Ultra Headphones",
    salePriceUsd: 379,
    originalPriceUsd: 429,
    imageUrl: "https://m.media-amazon.com/images/I/61z+9dMt9vL._AC_SL1500_.jpg",
  },

  /* ── Gaming ── */
  {
    slug: "playstation-5-slim",
    title: "PlayStation 5 Slim Console",
    description: "Slim redesign of the PS5, 1TB SSD, 4K HDR gaming, DualSense controller included.",
    category: "Gaming",
    categorySlug: "gaming",
    searchQuery: "PlayStation 5 Slim Console",
    salePriceUsd: 449,
    originalPriceUsd: 499,
    imageUrl: "https://m.media-amazon.com/images/I/51tSjJJl82L._SL1500_.jpg",
    isFeatured: true,
  },
  {
    slug: "nintendo-switch-oled",
    title: "Nintendo Switch OLED Model",
    description: "7\" vibrant OLED screen, 64GB internal storage, enhanced audio, dock included.",
    category: "Gaming",
    categorySlug: "gaming",
    searchQuery: "Nintendo Switch OLED Model",
    salePriceUsd: 309,
    originalPriceUsd: 349,
    imageUrl: "https://m.media-amazon.com/images/I/61nqNujSF2L._SL1330_.jpg",
  },

  /* ── Electronics ── */
  {
    slug: "apple-watch-series-10",
    title: "Apple Watch Series 10 GPS 42mm",
    description: "Largest Apple Watch display ever, S10 chip, sleep apnea detection, 18-hour battery.",
    category: "Wearables",
    categorySlug: "electronics",
    searchQuery: "Apple Watch Series 10 GPS 42mm",
    salePriceUsd: 379,
    originalPriceUsd: 399,
    imageUrl: "https://m.media-amazon.com/images/I/6105jZyXyPL._AC_SL1500_.jpg",
  },
  {
    slug: "kindle-paperwhite",
    title: "Kindle Paperwhite (12th Gen) 16GB",
    description: "7\" anti-glare display, faster page turns, weeks of battery, waterproof.",
    category: "Electronics",
    categorySlug: "electronics",
    searchQuery: "Kindle Paperwhite 12th Generation 16GB",
    salePriceUsd: 159,
    originalPriceUsd: 199,
    imageUrl: "https://m.media-amazon.com/images/I/61lwtlaSiNL._AC_SL1000_.jpg",
  },

  /* ── Appliances ── */
  {
    slug: "dyson-v15-detect",
    title: "Dyson V15 Detect Cordless Vacuum",
    description: "Laser detect technology, anti-tangle motorbar, 60-min runtime, HEPA filtration.",
    category: "Vacuum",
    categorySlug: "electronics",
    searchQuery: "Dyson V15 Detect Cordless Vacuum",
    salePriceUsd: 649,
    originalPriceUsd: 749,
    imageUrl: "https://m.media-amazon.com/images/I/51d7OAeDG9L._SL1000_.jpg",
  },
  {
    slug: "ninja-foodi-air-fryer",
    title: "Ninja Foodi 8-Quart Air Fryer",
    description: "Dual-zone cooking, 8-quart capacity, 6 cooking functions, dishwasher-safe baskets.",
    category: "Kitchen",
    categorySlug: "electronics",
    searchQuery: "Ninja Foodi DualZone 8 Quart Air Fryer",
    salePriceUsd: 159,
    originalPriceUsd: 199,
    imageUrl: "https://m.media-amazon.com/images/I/61xMRA3NY4L._AC_SL1500_.jpg",
  },
];

/* ── 5 Amazon marketplaces ──────────────────────────────────────────
   Each marketplace gets its own copy of every product. Country tag
   gates filterDealsForCountry; storeId matches the substring patterns
   in COUNTRY_CROSS_BORDER + COUNTRY_STORES so each country's homepage
   sees the right storefront. */
interface Marketplace {
  countryCode: string;
  storeId:     string;
  storeName:   string;
  hostname:    string;
}

/* storeName values aligned with canonicaliseSource() output in
   search-serpapi.ts so the curated catalog and the SerpAPI ingest
   write the same display string to Deal.storeName for the same
   storeId. Without this alignment, /api/deals returns mixed names
   ("Amazon DE" from curated + "Amazon Germany" from SerpAPI) for
   the same amazon-de store — re-audit caught this directly with
   the 51 vs 15 split. Same applied to AE / IN for consistency. */
const MARKETPLACES: Marketplace[] = [
  { countryCode: "us", storeId: "amazon",       storeName: "Amazon",         hostname: "www.amazon.com" },
  { countryCode: "uk", storeId: "amazon-co-uk", storeName: "Amazon UK",      hostname: "www.amazon.co.uk" },
  { countryCode: "de", storeId: "amazon-de",    storeName: "Amazon Germany", hostname: "www.amazon.de" },
  { countryCode: "ae", storeId: "amazon-ae",    storeName: "Amazon UAE",     hostname: "www.amazon.ae" },
  { countryCode: "in", storeId: "amazon-in",    storeName: "Amazon India",   hostname: "www.amazon.in" },
];

/* Spread one product across all 5 marketplaces. */
function expandProduct(product: CuratedProduct): Deal[] {
  const today = new Date().toISOString().slice(0, 10);

  return MARKETPLACES.map((mp) => {
    const discountPercent = Math.round(
      ((product.originalPriceUsd - product.salePriceUsd) / product.originalPriceUsd) * 100,
    );
    const url = `https://${mp.hostname}/s?k=${encodeURIComponent(product.searchQuery)}`;

    return {
      id: `amazon-${mp.countryCode}-${product.slug}`,
      title: product.title,
      description: product.description,
      category: product.category,
      categorySlug: product.categorySlug,
      storeId: mp.storeId,
      storeName: mp.storeName,
      originalPrice: product.originalPriceUsd,
      salePrice: product.salePriceUsd,
      discountPercent,
      currency: "USD",
      /* Real product photo when available; cards fall through to the
         Havlo logo fallback (components/ui/HavloLogoFallback) when
         imageUrl is null. */
      imageUrl: product.imageUrl,
      url,
      expiresAt: null,
      isHot: discountPercent >= 20,
      isFeatured: product.isFeatured ?? false,
      tags: ["Amazon", `country:${mp.countryCode}`, "curated"],
      saves: 0,
      clicks: 0,
      postedAt: today,
    } satisfies Deal;
  });
}

/** All curated Amazon deals, expanded across marketplaces.
 *  Length: PRODUCTS.length × MARKETPLACES.length. */
export const curatedAmazonDeals: Deal[] = PRODUCTS.flatMap(expandProduct);
