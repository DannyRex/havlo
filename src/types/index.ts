export interface Store {
  id: string;
  name: string;
  slug: string;
  logo: string;
  color: string;
  url: string;
  country: "NG" | "INTL";
  rating: number;
  trusted: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  dealCount: number;
  /** When true, the category exists for ingest classification + the
      /deals CategoryNav chips, but is HIDDEN from the homepage
      CategoryGrid. Used for taxonomies that don't yet earn a homepage
      tile because adding a 9th/11th tile would leave the grid
      unbalanced on at least one breakpoint. */
  hidden?: boolean;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  storeId: string;
  storeName: string;
  /** ISO-2 country code of the store's anchor market (from
      stores.country in the DB, e.g. "NG", "UK", "ZA"). NULL for
      truly global stores (AliExpress / Shein / Temu) that aren't
      anchored to any single market. Optional because legacy Deal
      sources (curated catalogs, AliExpress search results) don't
      carry it. Added May 2026 launch-readiness re-audit so
      /api/deals isLocalToUser can correctly bucket country-tagged
      stores that aren't in the hardcoded JS roster. */
  storeCountry?: string | null;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  currency: "NGN" | "USD";
  imageUrl?: string;
  url: string;
  expiresAt: string | null;
  isHot: boolean;
  isFeatured: boolean;
  tags: string[];
  saves: number;
  clicks: number;
  postedAt: string;

  /* ── Structured product identifiers (Phase 1 product-match upgrade)
     ─────────────────────────────────────────────────────────────
     Each is OPTIONAL — providers that don't surface the field leave
     it undefined and ingestion falls back to the heuristic title-
     based signature. When ANY of these is present at ingest time,
     it's persisted to products and used as a high-confidence
     same-product signal (see isLikelySameProduct's fast-path and
     ingestion's identifier-based dedup pass). */

  /** GTIN / EAN / UPC (8/12/13/14 digits). Globally unique per
      physical product — two offers sharing a GTIN are the same
      product, period. String form preserves leading zeros. */
  gtin?: string;

  /** Manufacturer Part Number. Brand-scoped — equivalence key is
      (brand, mpn), since different brands can reuse part-number
      strings (e.g. "M1" means very different things across vendors). */
  mpn?: string;

  /** Google Shopping internal product_id from SerpAPI. Strong cross-
      merchant identifier returned for free with every shopping-
      search response — survives across stores when Google has
      canonicalised the listing. Populated by serpapi-search providers. */
  googleShoppingId?: string;

  /** True when this offer's current price equals (within 1%) the
      lowest price seen for the same product across any store in the
      last 30 days, AND the product has been tracked at ≥ 2 stores
      in that window. Drives the small "30d low" badge on
      MasonryCard / ListCard. Populated by the browse provider via
      a single offers_at_30d_low RPC call per fetchDeals invocation
      so card rendering doesn't trigger N+1 reads. Optional because
      providers without the price-history backbone (curated catalogs,
      live-search results) leave it undefined → no badge. */
  at30DayLow?: boolean;

  /** True when this listing is used / refurbished / open-box / pre-
      owned / second-hand, detected from the title or a refurb-only
      store (isUsedListing in price-floor.ts). Drives the small
      "Used / Refurbished" badge on deal + compare cards so a
      pre-owned iPhone or a renewed TV is never presented as if it
      were new — the whole-catalog incidence is tiny (~0.15%) but
      mislabelling a used item as a fresh "deal" is exactly the kind
      of trust break a sharp shopper screenshots. Optional: providers
      that don't run the check (curated catalog) leave it undefined →
      no badge. NOTE this is a TITLE/STORE heuristic only — open
      marketplaces (eBay) that sell used WITHOUT a condition word in
      the title can't be caught here; that needs ingest-time
      condition capture the read-only catalog doesn't expose yet. */
  isUsed?: boolean;

  /** Denoised extra product text the source returned beyond the title -- for
      SerpAPI Google Shopping that's `snippet` + the attribute `extensions`
      ("Black", "Leather", "Men's", a short description sentence), promo/shipping
      noise stripped. Persisted to products.attributes (migration 0077) and fed
      to BOTH the title embedding and the LLM match-judge so fashion/beauty
      pairs (where the title is thin) have more to match on. Optional: most
      providers echo the title and leave this undefined. */
  attributes?: string;
}

export interface PriceResult {
  storeId: string;
  storeName: string;
  storeLogo: string;
  storeColor: string;
  storeLogoUrl?: string;
  price: number;
  currency: "NGN";
  inStock: boolean;
  url: string;
  condition: "new" | "refurbished" | "used";
  deliveryDays: number;
  rating: number | null;
  imageUrl?: string;
}

export interface Alternative {
  id: string;
  title: string;
  brand: string;
  priceRange: { min: number; max: number };
  currency: "NGN";
  imageUrl?: string;
  category: string;
  similarity: number;
  savingsPercent: number;
  storeCount: number;
  topStore: string;
  topPrice: number;
  tags: string[];
}

export interface SearchResult {
  query: string;
  product: {
    title: string;
    category: string;
    imageUrl?: string;
  };
  prices: PriceResult[];
  alternatives: Alternative[];
  bestDeal: PriceResult;
  maxSavings: number;
}

export type DiscountTier = "all" | "10" | "20" | "30" | "50";

/* "popular" restored May 2026 (migration 0015 + lib/popularity.ts).
   Backed by the popular_products() RPC over a 30d rolling window. */
export type SortOption = "relevance" | "discount" | "price_asc" | "price_desc" | "newest" | "popular";

export type OriginFilter = "all" | "local" | "intl";
