import type { Category } from "@/types";

// `icon` references a lucide-react icon name, rendered dynamically by CategoryNav.
export const categories: Category[] = [
  { id: "all",         name: "All",              slug: "all",         icon: "LayoutGrid",   color: "#0057FF", dealCount: 120 },
  { id: "phones",      name: "Phones",           slug: "phones",      icon: "Smartphone",   color: "#8B5CF6", dealCount: 28  },
  { id: "electronics", name: "Electronics",      slug: "electronics", icon: "Cpu",          color: "#0057FF", dealCount: 43  },
  { id: "gaming",      name: "Gaming",           slug: "gaming",      icon: "Gamepad2",     color: "#EF4444", dealCount: 18  },
  { id: "fashion",     name: "Fashion",          slug: "fashion",     icon: "Shirt",        color: "#EC4899", dealCount: 24  },
  { id: "home",        name: "Home & Kitchen",   slug: "home",        icon: "Home",         color: "#10B981", dealCount: 16  },
  { id: "beauty",      name: "Beauty",           slug: "beauty",      icon: "Sparkles",     color: "#F59E0B", dealCount: 12  },
  { id: "sports",      name: "Sports",           slug: "sports",      icon: "Dumbbell",     color: "#22C55E", dealCount: 10  },
  { id: "computing",   name: "Computing",        slug: "computing",   icon: "Laptop",       color: "#06B6D4", dealCount: 20  },
  { id: "audio",       name: "Audio",            slug: "audio",       icon: "Headphones",   color: "#F97316", dealCount: 14  },
  /* Appliances merged into Electronics (May 2026) — fridges, washers,
     ACs, vacuums, kitchen appliances now live under the Electronics
     slug. Migration 0065 flipped existing rows; categorize.ts routes
     appliance titles to "electronics". No standalone Appliances tile. */
  /* Health & Wellness — pharmacy, OTC meds, supplements, vitamins,
     first aid, baby health (see categorize.ts health rules).
     Surfaced on the homepage grid May 2026: the Appliances→Electronics
     merge dropped the grid from 10 → 9 browsable tiles, so promoting
     Health restores a clean 10-tile grid (no orphaned tile on the 2-
     and 5-col breakpoints). Count on the tile is live per country. */
  { id: "health",      name: "Health",            slug: "health",     icon: "HeartPulse",  color: "#0EA5E9", dealCount: 0  },
];

export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug);
