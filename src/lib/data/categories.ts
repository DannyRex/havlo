import type { Category } from "@/types";

// `icon` references a lucide-react icon name, rendered dynamically by CategoryNav.
export const categories: Category[] = [
  { id: "all",         name: "All",              slug: "all",         icon: "LayoutGrid",   color: "#0057FF", dealCount: 120 },
  { id: "phones",      name: "Phones",           slug: "phones",      icon: "Smartphone",   color: "#8B5CF6", dealCount: 28  },
  { id: "electronics", name: "Electronics",      slug: "electronics", icon: "Cpu",          color: "#0057FF", dealCount: 43  },
  /* Appliances — split back OUT of Electronics (June 2026). The May 2026
     0065 merge folded it in when both categories were thin; appliances
     has since grown to ~410 products (bigger than gaming / audio /
     phones / computing), so it earns its own tile again. categorize.ts
     routes fridge / washer / air-fryer / vacuum / AC / generator titles
     here, and migration 0068 re-tags the existing rows. */
  { id: "appliances",  name: "Appliances",       slug: "appliances",  icon: "Refrigerator", color: "#14B8A6", dealCount: 0   },
  { id: "gaming",      name: "Gaming",           slug: "gaming",      icon: "Gamepad2",     color: "#EF4444", dealCount: 18  },
  { id: "fashion",     name: "Fashion",          slug: "fashion",     icon: "Shirt",        color: "#EC4899", dealCount: 24  },
  { id: "home",        name: "Home & Kitchen",   slug: "home",        icon: "Home",         color: "#10B981", dealCount: 16  },
  { id: "beauty",      name: "Beauty",           slug: "beauty",      icon: "Sparkles",     color: "#F59E0B", dealCount: 12  },
  { id: "sports",      name: "Sports",           slug: "sports",      icon: "Dumbbell",     color: "#22C55E", dealCount: 10  },
  { id: "computing",   name: "Computing",        slug: "computing",   icon: "Laptop",       color: "#06B6D4", dealCount: 20  },
  { id: "audio",       name: "Audio",            slug: "audio",       icon: "Headphones",   color: "#F97316", dealCount: 14  },
  /* Health & Wellness — pharmacy, OTC meds, supplements, vitamins, first
     aid, baby health (see categorize.ts health rules). Stays a real
     category + /deals CategoryNav chip + hub, but `hidden` keeps it OFF
     the homepage grid: re-splitting Appliances (June 2026) pushed the
     grid back to 11 tiles, and Health is the one to drop (mostly
     unbranded OTC, weaker cross-store comparison) to restore a clean 10.
     CategoryNav ignores `hidden`, so it only loses the homepage tile. */
  { id: "health",      name: "Health",            slug: "health",     icon: "HeartPulse",  color: "#0EA5E9", dealCount: 0, hidden: true },
];

export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug);
