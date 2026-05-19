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
