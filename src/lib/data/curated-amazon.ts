/* Curated Amazon catalog — manually-maintained baseline of high-intent
   products across 5 marketplaces (US, UK, DE, AE, IN).

   Why this exists: Amazon was previously ingested via SerpAPI's Google
   Shopping API. With SerpAPI disabled (out of credits), that ingest
   stopped and existing rows were filtered (Google-relay URLs the
   resolver couldn't unpack). Result: zero Amazon inventory in the
   feed, despite the affiliate tags being live across all 5 markets.

   This file is the bridge until either (a) SerpAPI credits return,
   (b) the Amazon scraper is fixed, or (c) we get PAAPI access. Each
   product is replicated across the 5 marketplaces so every
   country's homepage sees the right storefront.

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
  /** Visual treatment fallback when there's no imageUrl. */
  imageGradient: string;
  imageEmoji:    string;
  /** Optional: real product photo URL. We use Wikipedia / Wikimedia
      Commons URLs since they're stable, accessible, no bot detection,
      and the images are CC-licensed. When omitted, the card renders
      the gradient + emoji fallback instead. */
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
    description: "A17 Pro chip, titanium frame, 5x optical zoom — Apple's current flagship phone.",
    category: "Phones",
    categorySlug: "phones",
    searchQuery: "iPhone 15 Pro Max 256GB",
    salePriceUsd: 1099,
    originalPriceUsd: 1199,
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    imageEmoji: "📱",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/IPhone_15_Pro_Max.jpeg?width=500",
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
    imageGradient: "linear-gradient(135deg, #6b7280 0%, #1f2937 100%)",
    imageEmoji: "📱",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Samsung_Galaxy_S24%2C_Sperrbildschirm.JPG?width=500",
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
    imageGradient: "linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)",
    imageEmoji: "💻",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Macbook_Air_15_inch_-_2_%28blurred%29.jpg?width=500",
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
    imageGradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)",
    imageEmoji: "💻",
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
    imageGradient: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
    imageEmoji: "💻",
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
    imageGradient: "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)",
    imageEmoji: "🎧",
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
    imageGradient: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
    imageEmoji: "🎧",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Apple_airpods_max_1.jpg?width=500",
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
    imageGradient: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    imageEmoji: "🎧",
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
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    imageEmoji: "🎧",
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
    imageGradient: "linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)",
    imageEmoji: "🎮",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Black_and_white_Playstation_5_base_edition_with_controller.png?width=500",
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
    imageGradient: "linear-gradient(135deg, #ef4444 0%, #1e3a8a 100%)",
    imageEmoji: "🎮",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Nintendo_Switch_%E2%80%93_OLED-Modell%2C_Konsole_und_Dock_20230506.png?width=500",
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
    imageGradient: "linear-gradient(135deg, #94a3b8 0%, #1e293b 100%)",
    imageEmoji: "⌚",
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
    imageGradient: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
    imageEmoji: "📚",
  },

  /* ── Appliances ── */
  {
    slug: "dyson-v15-detect",
    title: "Dyson V15 Detect Cordless Vacuum",
    description: "Laser detect technology, anti-tangle motorbar, 60-min runtime, HEPA filtration.",
    category: "Vacuum",
    categorySlug: "appliances",
    searchQuery: "Dyson V15 Detect Cordless Vacuum",
    salePriceUsd: 649,
    originalPriceUsd: 749,
    imageGradient: "linear-gradient(135deg, #fbbf24 0%, #b45309 100%)",
    imageEmoji: "🧹",
  },
  {
    slug: "ninja-foodi-air-fryer",
    title: "Ninja Foodi 8-Quart Air Fryer",
    description: "Dual-zone cooking, 8-quart capacity, 6 cooking functions, dishwasher-safe baskets.",
    category: "Kitchen",
    categorySlug: "appliances",
    searchQuery: "Ninja Foodi DualZone 8 Quart Air Fryer",
    salePriceUsd: 159,
    originalPriceUsd: 199,
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #475569 100%)",
    imageEmoji: "🍳",
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

const MARKETPLACES: Marketplace[] = [
  { countryCode: "us", storeId: "amazon",       storeName: "Amazon",    hostname: "www.amazon.com" },
  { countryCode: "uk", storeId: "amazon-co-uk", storeName: "Amazon UK", hostname: "www.amazon.co.uk" },
  { countryCode: "de", storeId: "amazon-de",    storeName: "Amazon DE", hostname: "www.amazon.de" },
  { countryCode: "ae", storeId: "amazon-ae",    storeName: "Amazon AE", hostname: "www.amazon.ae" },
  { countryCode: "in", storeId: "amazon-in",    storeName: "Amazon IN", hostname: "www.amazon.in" },
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
         imageGradient + imageEmoji combination otherwise. */
      imageUrl: product.imageUrl,
      imageGradient: product.imageGradient,
      imageEmoji: product.imageEmoji,
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
