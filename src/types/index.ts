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
  price: number;
  currency: "NGN";
  inStock: boolean;
  url: string;
  condition: "new" | "refurbished" | "used";
  deliveryDays: number;
  rating: number | null;
}

export interface Alternative {
  id: string;
  title: string;
  brand: string;
  priceRange: { min: number; max: number };
  currency: "NGN";
  imageGradient: string;
  imageEmoji: string;
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
  };
  prices: PriceResult[];
  alternatives: Alternative[];
  bestDeal: PriceResult;
  maxSavings: number;
}

export type DiscountTier = "all" | "10" | "20" | "30" | "50";

export type SortOption = "discount" | "price_asc" | "price_desc" | "newest" | "popular";
