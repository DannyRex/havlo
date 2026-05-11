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
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  storeId: string;
  storeName: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  currency: "NGN" | "USD";
  imageUrl?: string;
  imageGradient: string;
  imageEmoji: string;
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
  imageGradient: string;
  imageEmoji: string;
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
    imageEmoji: string;
    imageGradient: string;
    imageUrl?: string;
  };
  prices: PriceResult[];
  alternatives: Alternative[];
  bestDeal: PriceResult;
  maxSavings: number;
}

export type DiscountTier = "all" | "10" | "20" | "30" | "50";

/* "popular" was removed in May 2026 — implementation was a placeholder
   (DB path fell back to scraped_at, JS path sorted by hardcoded
   clicks=0). Re-add when there's a coherent click-aggregation pipeline
   tied back to offer_id. */
export type SortOption = "relevance" | "discount" | "price_asc" | "price_desc" | "newest";

export type OriginFilter = "all" | "local" | "intl";
