import type { Deal } from "@/types";

/* ──────────────────────────────────────────────────────────────────
   Static seed catalog — outage-only fallback.

   This file used to be the auto-generated 3.3MB / 82,232-line scrape
   output. After the May 2026 perf investigation traced ~80% of
   homepage TTFB to dynamic SSR (cookies-in-render-tree) AND the
   server bundle bloat from this single file (~2.5MB chunk parsed on
   every cold start), the file was trimmed to a small hand-picked
   seed.

   Production never selects this provider — getActiveBrowseProvider
   prefers DB whenever Supabase has rows (see lib/providers/index.ts).
   The seed exists so:
     1. A Supabase outage during a cold cache window still shows a
        non-empty homepage instead of an "0 deals" empty state.
     2. Local dev without Supabase env vars set still has *something*
        to render (the registry falls back automatically).

   The scraper (scripts/scrape.ts) no longer overwrites this file.
   It writes to public/deals-runtime.json and only ingestDeals()
   uses that as input. To refresh the seed, edit it manually. The
   roster mirrors the per-country store-logo marquee so the outage
   page reads as legitimate "this is what Havlo covers" content
   rather than scraper exhaust.
   ────────────────────────────────────────────────────────────────── */

export const deals: Deal[] = [
  /* ── NG ── */
  { id: "seed-konga-1", title: "Samsung Galaxy A05 64GB", description: "Samsung Galaxy A05 64GB — shop on Konga.",
    category: "Phones", categorySlug: "phones", storeId: "konga", storeName: "Konga",
    originalPrice: 165000, salePrice: 145000, discountPercent: 12, currency: "NGN",
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)", imageEmoji: "📱",
    url: "https://www.konga.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Konga", "phones"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-slot-1", title: "Apple AirPods Pro 2", description: "Apple AirPods Pro (2nd gen) — Slot.",
    category: "Audio", categorySlug: "audio", storeId: "slot", storeName: "Slot",
    originalPrice: 320000, salePrice: 285000, discountPercent: 11, currency: "NGN",
    imageGradient: "linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)", imageEmoji: "🎧",
    url: "https://slot.ng/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Slot", "audio"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-3chub-1", title: "MacBook Air 13-inch M2", description: "Apple MacBook Air M2 — 3C Hub.",
    category: "Computing", categorySlug: "computing", storeId: "3c-hub", storeName: "3C Hub",
    originalPrice: 1850000, salePrice: 1650000, discountPercent: 11, currency: "NGN",
    imageGradient: "linear-gradient(135deg, #06B6D4 0%, #0EA5E9 100%)", imageEmoji: "💻",
    url: "https://www.3chub.com/", expiresAt: null, isHot: true, isFeatured: false,
    tags: ["3C Hub", "computing"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-healthplus-1", title: "Centrum Multivitamin 30 Tablets", description: "Centrum A-Z Multivitamins.",
    category: "Health & Wellness", categorySlug: "health", storeId: "healthplus", storeName: "HealthPlus",
    originalPrice: 9500, salePrice: 9500, discountPercent: 0, currency: "NGN",
    imageGradient: "linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)", imageEmoji: "💊",
    url: "https://healthplusnigeria.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["HealthPlus", "health"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-ajebomarket-1", title: "Sony WH-1000XM5 Headphones", description: "Sony noise-cancelling headphones.",
    category: "Audio", categorySlug: "audio", storeId: "ajebomarket", storeName: "Ajebomarket",
    originalPrice: 480000, salePrice: 395000, discountPercent: 18, currency: "NGN",
    imageGradient: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)", imageEmoji: "🎧",
    url: "https://ajebomarket.com/", expiresAt: null, isHot: true, isFeatured: false,
    tags: ["Ajebomarket", "audio"], saves: 0, clicks: 0, postedAt: "2026-05-12" },

  /* ── UK ── */
  { id: "seed-argos-1", title: "Nintendo Switch OLED", description: "Nintendo Switch OLED — Argos.",
    category: "Gaming", categorySlug: "gaming", storeId: "argos", storeName: "Argos",
    originalPrice: 309, salePrice: 279, discountPercent: 10, currency: "USD",
    imageGradient: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)", imageEmoji: "🎮",
    url: "https://www.argos.co.uk/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Argos", "gaming", "country:uk"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-currys-1", title: "Dyson V12 Cordless Vacuum", description: "Dyson V12 Detect Slim — Currys.",
    category: "Appliances", categorySlug: "appliances", storeId: "currys", storeName: "Currys",
    originalPrice: 549, salePrice: 449, discountPercent: 18, currency: "USD",
    imageGradient: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)", imageEmoji: "🧹",
    url: "https://www.currys.co.uk/", expiresAt: null, isHot: true, isFeatured: false,
    tags: ["Currys", "appliances", "country:uk"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-jl-1", title: "Bose QuietComfort Ultra Headphones", description: "Bose QC Ultra — John Lewis.",
    category: "Audio", categorySlug: "audio", storeId: "john-lewis", storeName: "John Lewis & Partners",
    originalPrice: 449, salePrice: 379, discountPercent: 16, currency: "USD",
    imageGradient: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)", imageEmoji: "🎧",
    url: "https://www.johnlewis.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["John Lewis", "audio", "country:uk"], saves: 0, clicks: 0, postedAt: "2026-05-12" },

  /* ── US ── */
  { id: "seed-walmart-1", title: "Apple Watch Series 10", description: "Apple Watch Series 10 — Walmart.",
    category: "Electronics", categorySlug: "electronics", storeId: "walmart", storeName: "Walmart",
    originalPrice: 399, salePrice: 349, discountPercent: 13, currency: "USD",
    imageGradient: "linear-gradient(135deg, #0057FF 0%, #1D4ED8 100%)", imageEmoji: "⌚",
    url: "https://www.walmart.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Walmart", "electronics", "country:us"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-bestbuy-1", title: "iPad Air 11-inch M2", description: "iPad Air with M2 chip — Best Buy.",
    category: "Computing", categorySlug: "computing", storeId: "best-buy", storeName: "Best Buy",
    originalPrice: 599, salePrice: 549, discountPercent: 8, currency: "USD",
    imageGradient: "linear-gradient(135deg, #06B6D4 0%, #0EA5E9 100%)", imageEmoji: "💻",
    url: "https://www.bestbuy.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Best Buy", "computing", "country:us"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-target-1", title: "Ninja Air Fryer 6QT", description: "Ninja Air Fryer 6-quart — Target.",
    category: "Appliances", categorySlug: "appliances", storeId: "target", storeName: "Target",
    originalPrice: 149, salePrice: 99, discountPercent: 34, currency: "USD",
    imageGradient: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)", imageEmoji: "🍳",
    url: "https://www.target.com/", expiresAt: null, isHot: true, isFeatured: false,
    tags: ["Target", "appliances", "country:us"], saves: 0, clicks: 0, postedAt: "2026-05-12" },

  /* ── Cross-border / global ── */
  { id: "seed-aliexpress-1", title: "Wireless Charger 15W", description: "Fast wireless charger — AliExpress.",
    category: "Electronics", categorySlug: "electronics", storeId: "aliexpress", storeName: "AliExpress",
    originalPrice: 25, salePrice: 12, discountPercent: 52, currency: "USD",
    imageGradient: "linear-gradient(135deg, #DC2626 0%, #F97316 100%)", imageEmoji: "🔌",
    url: "https://www.aliexpress.com/", expiresAt: null, isHot: true, isFeatured: false,
    tags: ["AliExpress", "electronics", "intl"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-shein-1", title: "Floral Maxi Dress", description: "Lightweight floral maxi dress — Shein.",
    category: "Fashion", categorySlug: "fashion", storeId: "shein", storeName: "Shein",
    originalPrice: 35, salePrice: 18, discountPercent: 49, currency: "USD",
    imageGradient: "linear-gradient(135deg, #EC4899 0%, #F472B6 100%)", imageEmoji: "👗",
    url: "https://www.shein.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Shein", "fashion", "intl"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-temu-1", title: "Smart Light Bulb 4-Pack", description: "WiFi smart bulbs — Temu.",
    category: "Home & Kitchen", categorySlug: "home", storeId: "temu", storeName: "Temu",
    originalPrice: 30, salePrice: 13, discountPercent: 57, currency: "USD",
    imageGradient: "linear-gradient(135deg, #10B981 0%, #34D399 100%)", imageEmoji: "💡",
    url: "https://www.temu.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Temu", "home", "intl"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
  { id: "seed-amazon-1", title: "Kindle Paperwhite", description: "Kindle Paperwhite (11th gen) — Amazon.",
    category: "Electronics", categorySlug: "electronics", storeId: "amazon", storeName: "Amazon",
    originalPrice: 159, salePrice: 119, discountPercent: 25, currency: "USD",
    imageGradient: "linear-gradient(135deg, #0057FF 0%, #1D4ED8 100%)", imageEmoji: "📚",
    url: "https://www.amazon.com/", expiresAt: null, isHot: false, isFeatured: false,
    tags: ["Amazon", "electronics", "intl"], saves: 0, clicks: 0, postedAt: "2026-05-12" },
];

/* getDeals — filter + sort facade for the static provider. Signature
   intentionally matches what browse-static.ts passes (categorySlug,
   not category; broader sort union to accept BrowseQuery's "relevance"
   / "newest" / etc. without TS errors). Sort options outside the
   explicit cases all fall through to the default postedAt-DESC sort. */
export function getDeals(params?: {
  categorySlug?: string;
  storeId?:      string;
  minDiscount?:  number;
  sort?:         string;
  search?:       string;
  limit?:        number;
}): Deal[] {
  let result = [...deals];

  if (params?.categorySlug && params.categorySlug !== "all") {
    result = result.filter((d) => d.categorySlug === params.categorySlug);
  }
  if (params?.storeId) {
    result = result.filter((d) => d.storeId === params.storeId);
  }
  if (typeof params?.minDiscount === "number") {
    result = result.filter((d) => d.discountPercent >= params.minDiscount!);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  switch (params?.sort) {
    case "price_asc":  result.sort((a, b) => a.salePrice - b.salePrice); break;
    case "price_desc": result.sort((a, b) => b.salePrice - a.salePrice); break;
    case "discount":   result.sort((a, b) => b.discountPercent - a.discountPercent); break;
    case "popular":    result.sort((a, b) => b.clicks - a.clicks); break;
    default:           result.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  }

  if (params?.limit) result = result.slice(0, params.limit);
  return result;
}

/* hotDeals + featuredDeals removed in May 2026 — no remaining callers
   (verified via repo-wide grep). If anything ever needs them again,
   `deals.filter(d => d.isHot)` is a one-liner at the call site. */
