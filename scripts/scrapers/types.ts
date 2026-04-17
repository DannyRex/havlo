export interface RawDeal {
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  storeId: string;
  storeName: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  imageUrl?: string;
  imageEmoji: string;
  imageGradient: string;
  url: string;
  tags: string[];
}

// Category mapping from store-specific labels → Dealesty slugs
export const CATEGORY_MAP: Record<string, { category: string; slug: string; emoji: string; gradient: string }> = {
  "phones":        { category: "Phones & Tablets", slug: "phones",      emoji: "📱", gradient: "linear-gradient(135deg, #396afc 0%, #2948ff 100%)" },
  "tablets":       { category: "Phones & Tablets", slug: "phones",      emoji: "📱", gradient: "linear-gradient(135deg, #396afc 0%, #2948ff 100%)" },
  "laptops":       { category: "Computing",         slug: "computing",   emoji: "💻", gradient: "linear-gradient(135deg, #0a3d62 0%, #1e3799 100%)" },
  "computing":     { category: "Computing",         slug: "computing",   emoji: "💻", gradient: "linear-gradient(135deg, #0a3d62 0%, #1e3799 100%)" },
  "televisions":   { category: "Electronics",       slug: "electronics", emoji: "📺", gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)" },
  "electronics":   { category: "Electronics",       slug: "electronics", emoji: "⚡", gradient: "linear-gradient(135deg, #141e30 0%, #243b55 100%)" },
  "audio":         { category: "Audio",             slug: "audio",       emoji: "🎧", gradient: "linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)" },
  "appliances":    { category: "Appliances",        slug: "appliances",  emoji: "🏠", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  "home":          { category: "Home & Kitchen",    slug: "home",        emoji: "🍳", gradient: "linear-gradient(135deg, #e44d26 0%, #f16529 100%)" },
  "fashion":       { category: "Fashion",           slug: "fashion",     emoji: "👗", gradient: "linear-gradient(135deg, #f953c6 0%, #b91d73 100%)" },
  "beauty":        { category: "Beauty",            slug: "beauty",      emoji: "✨", gradient: "linear-gradient(135deg, #f953c6 0%, #b91d73 100%)" },
  "sports":        { category: "Sports",            slug: "sports",      emoji: "⚽", gradient: "linear-gradient(135deg, #1a1a1a 0%, #434343 100%)" },
  "gaming":        { category: "Gaming",            slug: "gaming",      emoji: "🎮", gradient: "linear-gradient(135deg, #000428 0%, #004e92 100%)" },
  "supermarket":   { category: "Supermarket",       slug: "home",        emoji: "🛒", gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  "default":       { category: "Electronics",       slug: "electronics", emoji: "🛍️", gradient: "linear-gradient(135deg, #141e30 0%, #243b55 100%)" },
};

export function resolveCategory(raw: string): { category: string; slug: string; emoji: string; gradient: string } {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_MAP["default"];
}

export function parseNaira(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0;
}
