/* Merchant configs for the NG retailers we ingest via SerpAPI
   instead of Playwright. Each config knows the merchant's domain,
   store identity, and how to recognise a product detail URL from
   the merchant's other URL shapes (category / search / cart / etc.).

   Adding a new merchant: append a config below. The ingest script
   loops over the export and runs each one through
   fetchMerchantDealsViaSerpapi, so no other code change is needed.

   Per-merchant query lists are kept here too — small, hand-picked
   sets that cover the merchant's strongest categories. Total
   credit cost per ingest run is (∑ queries) × 1 credit. */

import type { MerchantConfig } from "./search-ng-merchant-serpapi";

/* Shared product-URL helpers — kept inline so the config blocks
   stay tight + readable. */
const isShopifyProductUrl = (u: URL) => u.pathname.startsWith("/products/");
const hasNumericTail      = (u: URL) => /-\d+(?:\.html)?$/.test(u.pathname);

/* Common non-product path prefixes. Stores reused across configs:
   /category/, /collections/, /cart, /account, /search,
   /blog, /pages/, /faq, /about, /contact, /privacy, /terms,
   /shipping, /returns, /sitemap. */
const NON_PRODUCT_PREFIXES = [
  "/category/", "/categories/", "/collections/", "/cart",
  "/account", "/login", "/register", "/search",
  "/blog", "/blogs/", "/pages/", "/page/",
  "/catalogsearch/", "/customer/", "/checkout/",
];
const NON_PRODUCT_LEAVES = /\/(about|contact|faq|terms|privacy|shipping|returns|sitemap|stores|locations)\b/i;
function hasNonProductPath(u: URL): boolean {
  if (NON_PRODUCT_PREFIXES.some((p) => u.pathname.startsWith(p))) return true;
  if (NON_PRODUCT_LEAVES.test(u.pathname)) return true;
  return false;
}

/* ── Slot ─────────────────────────────────────────────────────────
   Phone/electronics retailer. NOT Shopify — uses bare slugs at
   root level: /apple-iphone-15-pro-max-256gb-ss-ch-a17, no
   /products/ prefix. Categories sit under /category/.

   Probed live (May 2026): SerpAPI returns real product URLs with
   prices in rich_snippet.detected_extensions for the main flagship
   phones. Coverage is good for iPhones, Samsung Galaxy, Tecno,
   Infinix. The original Playwright scraper had only 10 in-stock
   offers; this path should land 30-80+. */
const slotConfig: MerchantConfig = {
  storeId:   "slot",
  storeName: "Slot",
  domain:    "slot.ng",
  isProductUrl: (u) => {
    /* Reject the known non-product paths (categories, account, etc.). */
    if (hasNonProductPath(u)) return false;
    /* Root-level slug must have at least one hyphen or underscore
       (Slot's slugs are e.g. apple-iphone-15-pro-max-256gb-ss-ch).
       The hyphen check filters out single-segment landing pages like
       /flash-sale or /policies which would otherwise slip through. */
    const seg = u.pathname.replace(/^\/+|\/+$/g, "");
    if (seg.length < 8) return false;            // too short to be a product slug
    return /[-_]/.test(seg);                      // contains hyphen or underscore
  },
};

/* ── 3C Hub ───────────────────────────────────────────────────────
   Phone/electronics. Shopify-based: /products/<slug>. */
const threechubConfig: MerchantConfig = {
  storeId:   "threechub",
  storeName: "3C Hub",
  domain:    "3chub.com",
  isProductUrl: isShopifyProductUrl,
};

/* ── Jiji ─────────────────────────────────────────────────────────
   Classifieds marketplace. Product URLs end with /<slug>-<id>.html.
   Plenty of non-product URLs (/cars/, /properties/, /jobs/ as
   category roots; /a-Z/ as letter indexes). The product page
   pattern is distinct: ends in -.html with numeric id. */
const jijiConfig: MerchantConfig = {
  storeId:   "jiji",
  storeName: "Jiji",
  domain:    "jiji.ng",
  isProductUrl: (u) => {
    /* Path must end with .html AND contain a numeric id before .html */
    return /-\d{6,}\.html(?:\?|$)/.test(u.pathname);
  },
};

/* ── Spar Nigeria ─────────────────────────────────────────────────
   Supermarket. Spar.com.ng uses a CommerceTools-style PDP path
   /shop/<slug>-<id>. Force groceries category since SPAR is almost
   entirely food + household. */
const sparConfig: MerchantConfig = {
  storeId:   "spar",
  storeName: "Spar Nigeria",
  domain:    "spar.com.ng",
  isProductUrl: (u) => {
    return u.pathname.startsWith("/shop/") && hasNumericTail(u);
  },
  forcedCategory: "groceries",
};

/* ── Kara ─────────────────────────────────────────────────────────
   Electronics + appliances. PDP at root level with bare slug:
   /philips-blender-hr2106-01 (no .html extension, no /products/
   prefix). Probed live (May 2026): SerpAPI returns real product
   URLs with prices in rich_snippet for blender / iron / kettle /
   microwave / appliance queries. */
const karaConfig: MerchantConfig = {
  storeId:   "kara",
  storeName: "Kara",
  domain:    "kara.com.ng",
  isProductUrl: (u) => {
    if (hasNonProductPath(u)) return false;
    /* Root-level slug. Drop category index pages (single-word
       slugs like /blenders, /tvs) which surface in SerpAPI but
       carry no per-product price. Real product slugs are multi-
       token. */
    const seg = u.pathname.replace(/^\/+|\/+$/g, "");
    if (seg.length < 8) return false;
    if (!/[-_]/.test(seg)) return false;
    /* Single-token-with-trailing-s pluralised category. Drop. */
    if (/^[a-z]+s$/.test(seg)) return false;
    return true;
  },
};

/* ── Obiwezy ──────────────────────────────────────────────────────
   Refurbished phones + electronics. Shopify-based: /products/<slug>. */
const obiwezyConfig: MerchantConfig = {
  storeId:   "obiwezy",
  storeName: "Obiwezy",
  domain:    "obiwezy.com",
  isProductUrl: isShopifyProductUrl,
};

/* ── Konga ─────────────────────────────────────────────────────────
   General-merchandise marketplace (phones, electronics, appliances,
   fashion, beauty). Moved to SerpAPI in June 2026 after Konga added
   Cloudflare bot protection mid-May 2026 that defeats the Playwright
   scraper (scripts/scrapers/konga.ts now hits the challenge wall).

   URL shapes:
     Product detail : /product/<slug>            (carries price markup)
     Category        : /category/<slug>-<id>      (no per-product price)
     Search          : /search?...                (no per-product price)
   The Playwright scraper confirmed the product pattern via its
   a[href*='/product/'] selector, so the product-URL gate keys on the
   /product/ path prefix. Konga's rotating ?cid= campaign param is
   already stripped by canonicaliseOfferUrl at ingest, so two runs of
   the same SKU collapse onto one (store_id, url) row. */
const kongaConfig: MerchantConfig = {
  storeId:   "konga",
  storeName: "Konga",
  domain:    "konga.com",
  isProductUrl: (u) => {
    if (hasNonProductPath(u)) return false;
    /* Konga product detail pages live under /product/<slug>. Category
       pages (/category/<slug>-<id>) and search pages carry no
       per-product price markup, so gate strictly on /product/. */
    return u.pathname.startsWith("/product/");
  },
};

/* ── Public export ────────────────────────────────────────────────

   ACTIVE: slot + kara — probed live (May 2026), SerpAPI returns
   real product URLs with NGN prices in rich_snippet for these.

   NOT ACTIVE — kept here for reference + future probes when their
   surface changes:

     - threechub: SerpAPI returns the correct /products/<slug>
       URLs but Google rich_snippet.detected_extensions.price is
       NULL on ~95% of them (Shopify structured-data variation —
       3CHub publishes JSON-LD for Product but Google's organic-
       result parser doesn't surface the price). Approach to try
       later: hit Shopify's /products.json endpoint directly
       (the existing scripts/scrapers/_shopify-json.ts helper
       already has this shape).

     - jiji: SerpAPI returns category landing pages
       (/lagos/mobile-phones/apple), not individual classifieds.
       Per-ad pages have IDs in slug-NUMERIC format but Google's
       site:jiji.ng query lifts the category pages instead.
       Approach to try later: scrape via Jiji's category JSON
       endpoint (paginated, no auth required at low volume).

     - spar: SerpAPI returns ZERO results for the basket queries.
       Either spar.com.ng is poorly indexed by Google or its
       product pages aren't classified as Products. Approach to
       try later: direct CommerceTools API or a Playwright pass
       with manual selectors.

     - obiwezy: SerpAPI returns /catalogsearch/result/ pages
       (Magento search-results), not individual products. Same
       shape as Jiji. Approach to try later: direct
       /catalogsearch/result/?q=... call + HTML parse, or
       Magento's REST API. */
export const NG_MERCHANT_CONFIGS: MerchantConfig[] = [
  slotConfig,
  karaConfig,
  /* Konga — added June 2026 to replace the Cloudflare-walled Playwright
     scraper. Konga publishes structured-data price markup on its
     /product/ detail pages, so the SerpAPI google + site:konga.com
     path lifts (price, currency) the same way the Slot + Kara configs
     do. */
  kongaConfig,
];

/* Inactive configs surfaced separately so they're still accessible
   for ad-hoc probing without re-defining them. */
export const NG_MERCHANT_CONFIGS_INACTIVE: MerchantConfig[] = [
  threechubConfig,
  jijiConfig,
  sparConfig,
  obiwezyConfig,
];

/* ── Per-merchant query lists ─────────────────────────────────────
   Hand-picked queries that cover each merchant's strongest verticals.
   Small lists keep SerpAPI credit cost predictable; we can grow
   these as the catalog matures.

   Total per ingest run = sum of (config.queries.length) across the
   active configs, each query firing google + a google_images companion.
   Slot 12 + Kara 10 + Konga 14 = 36 queries x 2 = ~72 credits per run.
   Mon/Wed/Fri cron (~13 runs/mo) = ~940 credits/month, well under the
   5,000 Developer plan budget.

   Query design: lead with high-velocity SKUs that the merchant
   genuinely stocks. A query that returns 0 organic results still
   costs 1 credit, so prefer queries that exist in the merchant's
   catalog over speculative ones. */
export const NG_MERCHANT_QUERIES: Record<string, string[]> = {
  /* Slot is a phone-first retailer. iPhones, Samsung Galaxy,
     Tecno + Infinix (NG-favourite mid-range), accessories. */
  slot: [
    "iPhone 15",
    "iPhone 16",
    "Samsung Galaxy S24",
    "Samsung Galaxy A05",
    "Tecno Spark",
    "Tecno Camon",
    "Infinix Hot",
    "Infinix Note",
    "Xiaomi Redmi",
    "iPad",
    "MacBook",
    "AirPods",
  ],

  /* 3C Hub: phones + laptops + gaming + audio. */
  threechub: [
    "iPhone",
    "Samsung Galaxy",
    "MacBook",
    "iPad",
    "PlayStation 5",
    "Xbox Series",
    "Nintendo Switch",
    "AirPods Pro",
    "Sony WH-1000XM5",
    "JBL speaker",
    "Apple Watch",
    "Dell laptop",
  ],

  /* Jiji: classifieds — broader category queries pull more results.
     Limit to the categories where Jiji has dense legit listings
     (phones, electronics, beauty, fashion are noisy with private
     sellers but Havlo's audience can use them). */
  jiji: [
    "iPhone Jiji",
    "Samsung phone",
    "Tecno phone",
    "Infinix phone",
    "laptop Lagos",
    "PlayStation",
    "TV Lagos",
    "Generator",
    "Refrigerator",
    "Air conditioner",
  ],

  /* Spar Nigeria — supermarket. Lead with the high-frequency basket
     items NG households actually buy at SPAR. */
  spar: [
    "rice",
    "vegetable oil",
    "milk powder",
    "diapers",
    "detergent",
    "tomato paste",
    "noodles",
    "biscuits",
    "soap",
    "baby formula",
  ],

  /* Kara: electronics + appliances + small kitchen. */
  kara: [
    "iPhone",
    "Samsung Galaxy",
    "blender",
    "microwave",
    "iron",
    "kettle",
    "fan",
    "vacuum cleaner",
    "rice cooker",
    "deep freezer",
  ],

  /* Obiwezy: refurbished phones + laptops. The "UK used" qualifier
     is how NG shoppers signal refurbished — Obiwezy ranks well for it. */
  obiwezy: [
    "iPhone UK used",
    "iPhone London used",
    "Samsung Galaxy UK used",
    "MacBook UK used",
    "iPad UK used",
    "PlayStation UK used",
    "Apple Watch UK used",
    "AirPods UK used",
  ],

  /* Konga: broad general-merchandise marketplace. Lead with brand+model
     SKUs across the verticals Konga stocks deepest — phones, computing,
     TVs, appliances, audio, gaming, beauty. Brand+model queries surface
     /product/ detail pages (which carry price markup); bare category
     words ("Phones", "Smart TV") return Konga's category landings, which
     don't. 14 queries to match Konga's wider catalog vs the phone-first
     Slot/Kara lists. */
  konga: [
    "iPhone 15",
    "Samsung Galaxy A",
    "Tecno Spark",
    "Infinix Hot",
    "HP Pavilion laptop",
    "Dell Inspiron laptop",
    "Hisense TV",
    "LG TV",
    "Hisense fridge",
    "Scanfrost washing machine",
    "Oraimo earbuds",
    "JBL speaker",
    "PlayStation 5",
    "Nivea body lotion",
  ],
};
