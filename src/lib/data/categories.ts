import type { Category } from "@/types";

export const categories: Category[] = [
  { id: "all",        name: "All Deals",       slug: "all",        icon: "⚡", color: "#0057FF", dealCount: 120 },
  { id: "phones",     name: "Phones & Tablets", slug: "phones",    icon: "📱", color: "#8B5CF6", dealCount: 28  },
  { id: "electronics",name: "Electronics",      slug: "electronics",icon: "💻", color: "#0057FF", dealCount: 32  },
  { id: "gaming",     name: "Gaming",           slug: "gaming",     icon: "🎮", color: "#EF4444", dealCount: 18  },
  { id: "fashion",    name: "Fashion",          slug: "fashion",    icon: "👗", color: "#EC4899", dealCount: 24  },
  { id: "home",       name: "Home & Kitchen",   slug: "home",       icon: "🏠", color: "#10B981", dealCount: 16  },
  { id: "beauty",     name: "Beauty",           slug: "beauty",     icon: "✨", color: "#F59E0B", dealCount: 12  },
  { id: "sports",     name: "Sports",           slug: "sports",     icon: "⚽", color: "#22C55E", dealCount: 10  },
  { id: "computing",  name: "Computing",        slug: "computing",  icon: "🖥️", color: "#06B6D4", dealCount: 20  },
  { id: "audio",      name: "Audio",            slug: "audio",      icon: "🎧", color: "#F97316", dealCount: 14  },
  { id: "appliances", name: "Appliances",       slug: "appliances", icon: "🧊", color: "#6366F1", dealCount: 11  },
];

export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug);
