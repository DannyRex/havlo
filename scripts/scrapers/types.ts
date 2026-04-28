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
  currency?: "NGN" | "USD";
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
  /* Newly added — broader category coverage from the expanded scrapes.
     Map to existing slugs where they're conceptually adjacent (shoes →
     fashion, watches → fashion, bags → fashion) so the /deals filter
     bar doesn't sprout 10 extra category chips overnight. */
  "automotive":    { category: "Automotive",        slug: "automotive",  emoji: "🚗", gradient: "linear-gradient(135deg, #232526 0%, #414345 100%)" },
  "books":         { category: "Books",             slug: "books",       emoji: "📚", gradient: "linear-gradient(135deg, #d3cce3 0%, #e9e4f0 100%)" },
  "music":         { category: "Music",             slug: "music",       emoji: "🎵", gradient: "linear-gradient(135deg, #614385 0%, #516395 100%)" },
  "garden":        { category: "Garden & Outdoor",  slug: "garden",      emoji: "🌿", gradient: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)" },
  "industrial":    { category: "Industrial",        slug: "industrial",  emoji: "🔧", gradient: "linear-gradient(135deg, #485563 0%, #29323c 100%)" },
  "pets":          { category: "Pet Supplies",      slug: "pets",        emoji: "🐾", gradient: "linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)" },
  "watches":       { category: "Fashion",           slug: "fashion",     emoji: "⌚", gradient: "linear-gradient(135deg, #f953c6 0%, #b91d73 100%)" },
  "shoes":         { category: "Fashion",           slug: "fashion",     emoji: "👟", gradient: "linear-gradient(135deg, #f953c6 0%, #b91d73 100%)" },
  "bags":          { category: "Fashion",           slug: "fashion",     emoji: "👜", gradient: "linear-gradient(135deg, #f953c6 0%, #b91d73 100%)" },
  "groceries":     { category: "Supermarket",       slug: "home",        emoji: "🛒", gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
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
