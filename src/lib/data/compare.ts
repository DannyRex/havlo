import type { SearchResult, PriceResult, Alternative } from "@/types";

const priceData: Record<string, SearchResult> = {
  "iphone 15": {
    query: "iPhone 15",
    product: {
      title: "Apple iPhone 15 128GB",
      category: "Phones & Tablets",
      imageEmoji: "📱",
      imageGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    },
    bestDeal: {
      storeId: "jumia", storeName: "Jumia", storeLogo: "J", storeColor: "#F97316",
      price: 749000, currency: "NGN", inStock: true, url: "#",
      condition: "new", deliveryDays: 2, rating: 4.3,
    },
    maxSavings: 231000,
    prices: [
      { storeId: "jumia",     storeName: "Jumia",      storeLogo: "J",  storeColor: "#F97316", price: 749000,  currency: "NGN", inStock: true,  url: "#", condition: "new",          deliveryDays: 2, rating: 4.3 },
      { storeId: "konga",     storeName: "Konga",      storeLogo: "K",  storeColor: "#EF4444", price: 780000,  currency: "NGN", inStock: true,  url: "#", condition: "new",          deliveryDays: 3, rating: 4.1 },
      { storeId: "slot",      storeName: "Slot",       storeLogo: "SL", storeColor: "#3B82F6", price: 769000,  currency: "NGN", inStock: true,  url: "#", condition: "new",          deliveryDays: 1, rating: 4.4 },
      { storeId: "threechub", storeName: "3C Hub",     storeLogo: "3C", storeColor: "#8B5CF6", price: 795000,  currency: "NGN", inStock: true,  url: "#", condition: "new",          deliveryDays: 2, rating: 4.2 },
      { storeId: "jiji",      storeName: "Jiji",       storeLogo: "JJ", storeColor: "#10B981", price: 690000,  currency: "NGN", inStock: true,  url: "#", condition: "refurbished",  deliveryDays: 1, rating: 3.8 },
      { storeId: "cartng",    storeName: "Cart.ng",    storeLogo: "CT", storeColor: "#14B8A6", price: 758000,  currency: "NGN", inStock: false, url: "#", condition: "new",          deliveryDays: 4, rating: 3.9 },
      { storeId: "pointek",   storeName: "Pointek",    storeLogo: "PT", storeColor: "#06B6D4", price: 810000,  currency: "NGN", inStock: true,  url: "#", condition: "new",          deliveryDays: 3, rating: 4.0 },
    ],
    alternatives: [
      {
        id: "a1", title: "Samsung Galaxy S24", brand: "Samsung",
        priceRange: { min: 620000, max: 750000 }, currency: "NGN",
        imageGradient: "linear-gradient(135deg, #1a1a2e 0%, #0d3b6e 100%)",
        imageEmoji: "📱", category: "Phones & Tablets",
        similarity: 91, savingsPercent: 17, storeCount: 6,
        topStore: "Jumia", topPrice: 620000,
        tags: ["Similar camera", "Android", "5G"],
      },
      {
        id: "a2", title: "Tecno Phantom X2 Pro", brand: "Tecno",
        priceRange: { min: 280000, max: 350000 }, currency: "NGN",
        imageGradient: "linear-gradient(135deg, #0f2027 0%, #203a43 100%)",
        imageEmoji: "📲", category: "Phones & Tablets",
        similarity: 78, savingsPercent: 63, storeCount: 4,
        topStore: "Konga", topPrice: 280000,
        tags: ["Great camera", "50MP", "Curved display"],
      },
      {
        id: "a3", title: "Google Pixel 8a", brand: "Google",
        priceRange: { min: 540000, max: 620000 }, currency: "NGN",
        imageGradient: "linear-gradient(135deg, #4776e6 0%, #8e54e9 100%)",
        imageEmoji: "📱", category: "Phones & Tablets",
        similarity: 85, savingsPercent: 28, storeCount: 3,
        topStore: "Slot", topPrice: 540000,
        tags: ["Pure Android", "AI features", "7yr updates"],
      },
    ],
  },

  "samsung tv": {
    query: "Samsung TV",
    product: {
      title: "Samsung 55\" QLED 4K Smart TV",
      category: "Electronics",
      imageEmoji: "📺",
      imageGradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)",
    },
    bestDeal: {
      storeId: "konga", storeName: "Konga", storeLogo: "K", storeColor: "#EF4444",
      price: 369000, currency: "NGN", inStock: true, url: "#",
      condition: "new", deliveryDays: 3, rating: 4.1,
    },
    maxSavings: 151000,
    prices: [
      { storeId: "konga",   storeName: "Konga",       storeLogo: "K",  storeColor: "#EF4444", price: 369000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 3, rating: 4.1 },
      { storeId: "jumia",   storeName: "Jumia",       storeLogo: "J",  storeColor: "#F97316", price: 389000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 2, rating: 4.2 },
      { storeId: "fouani",  storeName: "Fouani",      storeLogo: "FO", storeColor: "#6366F1", price: 399000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 2, rating: 4.3 },
      { storeId: "spar",    storeName: "Spar Nigeria",storeLogo: "SP", storeColor: "#22C55E", price: 420000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 1, rating: 4.1 },
      { storeId: "cartng",  storeName: "Cart.ng",     storeLogo: "CT", storeColor: "#14B8A6", price: 378000, currency: "NGN", inStock: false, url: "#", condition: "new", deliveryDays: 5, rating: 3.9 },
    ],
    alternatives: [
      {
        id: "b1", title: "LG OLED C3 55\"", brand: "LG",
        priceRange: { min: 420000, max: 550000 }, currency: "NGN",
        imageGradient: "linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)",
        imageEmoji: "📺", category: "Electronics",
        similarity: 88, savingsPercent: -14, storeCount: 4,
        topStore: "Fouani", topPrice: 420000,
        tags: ["OLED", "Better blacks", "Premium"],
      },
      {
        id: "b2", title: "Hisense 55\" ULED 4K", brand: "Hisense",
        priceRange: { min: 195000, max: 250000 }, currency: "NGN",
        imageGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        imageEmoji: "📺", category: "Electronics",
        similarity: 82, savingsPercent: 47, storeCount: 6,
        topStore: "Konga", topPrice: 195000,
        tags: ["Budget pick", "4K", "Dolby Vision"],
      },
    ],
  },

  "playstation 5": {
    query: "PlayStation 5",
    product: {
      title: "Sony PlayStation 5 Disc Edition",
      category: "Gaming",
      imageEmoji: "🎮",
      imageGradient: "linear-gradient(135deg, #000428 0%, #004e92 100%)",
    },
    bestDeal: {
      storeId: "threechub", storeName: "3C Hub", storeLogo: "3C", storeColor: "#8B5CF6",
      price: 499000, currency: "NGN", inStock: true, url: "#",
      condition: "new", deliveryDays: 2, rating: 4.2,
    },
    maxSavings: 121000,
    prices: [
      { storeId: "threechub", storeName: "3C Hub",  storeLogo: "3C", storeColor: "#8B5CF6", price: 499000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 2, rating: 4.2 },
      { storeId: "cartng",    storeName: "Cart.ng", storeLogo: "CT", storeColor: "#14B8A6", price: 449000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 3, rating: 4.0 },
      { storeId: "jumia",     storeName: "Jumia",   storeLogo: "J",  storeColor: "#F97316", price: 520000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 2, rating: 4.2 },
      { storeId: "konga",     storeName: "Konga",   storeLogo: "K",  storeColor: "#EF4444", price: 539000, currency: "NGN", inStock: false, url: "#", condition: "new", deliveryDays: 3, rating: 4.0 },
      { storeId: "jiji",      storeName: "Jiji",    storeLogo: "JJ", storeColor: "#10B981", price: 410000, currency: "NGN", inStock: true,  url: "#", condition: "used", deliveryDays: 1, rating: 3.7 },
    ],
    alternatives: [
      {
        id: "c1", title: "Xbox Series X", brand: "Microsoft",
        priceRange: { min: 449000, max: 580000 }, currency: "NGN",
        imageGradient: "linear-gradient(135deg, #107c10 0%, #052505 100%)",
        imageEmoji: "🎮", category: "Gaming",
        similarity: 90, savingsPercent: 10, storeCount: 3,
        topStore: "Cart.ng", topPrice: 449000,
        tags: ["Game Pass", "4K gaming", "Quick Resume"],
      },
      {
        id: "c2", title: "Nintendo Switch OLED", brand: "Nintendo",
        priceRange: { min: 200000, max: 260000 }, currency: "NGN",
        imageGradient: "linear-gradient(135deg, #e52d27 0%, #b31217 100%)",
        imageEmoji: "🕹️", category: "Gaming",
        similarity: 65, savingsPercent: 60, storeCount: 4,
        topStore: "Jumia", topPrice: 200000,
        tags: ["Portable", "Family friendly", "Unique games"],
      },
    ],
  },
};

const fallbackResult = (query: string): SearchResult => ({
  query,
  product: {
    title: query,
    category: "General",
    imageEmoji: "🛍️",
    imageGradient: "linear-gradient(135deg, #0A1428 0%, #0F1E3D 100%)",
  },
  bestDeal: {
    storeId: "jumia", storeName: "Jumia", storeLogo: "J", storeColor: "#F97316",
    price: 45000, currency: "NGN", inStock: true, url: "#",
    condition: "new", deliveryDays: 2, rating: 4.2,
  },
  maxSavings: 15000,
  prices: [
    { storeId: "jumia",   storeName: "Jumia",   storeLogo: "J",  storeColor: "#F97316", price: 45000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 2, rating: 4.2 },
    { storeId: "konga",   storeName: "Konga",   storeLogo: "K",  storeColor: "#EF4444", price: 48000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 3, rating: 4.0 },
    { storeId: "slot",    storeName: "Slot",    storeLogo: "SL", storeColor: "#3B82F6", price: 52000, currency: "NGN", inStock: false, url: "#", condition: "new", deliveryDays: 1, rating: 4.4 },
    { storeId: "jiji",    storeName: "Jiji",    storeLogo: "JJ", storeColor: "#10B981", price: 38000, currency: "NGN", inStock: true,  url: "#", condition: "used", deliveryDays: 1, rating: 3.8 },
    { storeId: "yaoota",  storeName: "Yaoota",  storeLogo: "Y",  storeColor: "#F59E0B", price: 47000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 4, rating: 3.7 },
    { storeId: "pointek", storeName: "Pointek", storeLogo: "PT", storeColor: "#06B6D4", price: 60000, currency: "NGN", inStock: true,  url: "#", condition: "new", deliveryDays: 3, rating: 4.0 },
  ],
  alternatives: [
    {
      id: "z1", title: `${query} — Budget Alternative`, brand: "Various",
      priceRange: { min: 25000, max: 35000 }, currency: "NGN",
      imageGradient: "linear-gradient(135deg, #396afc 0%, #2948ff 100%)",
      imageEmoji: "💡", category: "General",
      similarity: 75, savingsPercent: 35, storeCount: 5,
      topStore: "Jumia", topPrice: 25000,
      tags: ["Budget pick", "Similar specs", "Best value"],
    },
  ],
});

export function searchProducts(query: string): SearchResult {
  const key = query.toLowerCase().trim();
  for (const [k, v] of Object.entries(priceData)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return fallbackResult(query);
}

export const popularSearches = [
  "iPhone 15", "Samsung TV", "PlayStation 5", "MacBook Air",
  "Nike shoes", "Air Fryer", "Gaming Chair", "Headphones",
];
