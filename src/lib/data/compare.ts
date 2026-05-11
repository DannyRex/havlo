import type { SearchResult, PriceResult, Alternative, Deal } from "@/types";
import { deals } from "./deals";
import { usdToNgn } from "@/lib/utils";
import { resolveStoreLogoUrl } from "@/lib/store-logo";

/* ── Store metadata (aligned with /public/logos/) ── */
const storeMeta: Record<
  string,
  { name: string; logo: string; color: string; rating: number; deliveryDays: number }
> = {
  threechub:  { name: "3C Hub",     logo: "3C", color: "#8B5CF6", rating: 4.1, deliveryDays: 2 },
  konga:      { name: "Konga",      logo: "K",  color: "#EF4444", rating: 4.0, deliveryDays: 3 },
  slot:       { name: "Slot",       logo: "SL", color: "#3B82F6", rating: 4.3, deliveryDays: 1 },
  dhgate:     { name: "DHgate",     logo: "DH", color: "#FF6B35", rating: 3.6, deliveryDays: 14 },
  amazon:     { name: "Amazon",     logo: "A",  color: "#F59E0B", rating: 4.5, deliveryDays: 10 },
  asos:       { name: "ASOS",       logo: "AS", color: "#1E1E1E", rating: 4.2, deliveryDays: 12 },
  jumia:      { name: "Jumia",      logo: "J",  color: "#F97316", rating: 4.2, deliveryDays: 2 },
  jiji:       { name: "Jiji",       logo: "JJ", color: "#10B981", rating: 3.8, deliveryDays: 1 },
  spar:       { name: "Spar",       logo: "SP", color: "#22C55E", rating: 4.0, deliveryDays: 1 },
  aliexpress: { name: "AliExpress", logo: "AE", color: "#E43225", rating: 3.7, deliveryDays: 18 },
  shein:      { name: "SHEIN",      logo: "SH", color: "#000000", rating: 3.9, deliveryDays: 14 },
  temu:       { name: "Temu",       logo: "TM", color: "#F97316", rating: 3.8, deliveryDays: 12 },
};

/* ── Helpers ── */

/** Normalise any deal price to NGN */
function toNgn(deal: Deal): number {
  return deal.currency === "USD" ? usdToNgn(deal.salePrice) : deal.salePrice;
}

/** Extract meaningful words from a string */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Score how well a deal title matches a query (0 = no match) */
function scoreMatch(dealTitle: string, query: string): number {
  const title = dealTitle.toLowerCase();
  const q = query.toLowerCase();
  const qWords = extractWords(q);
  if (qWords.length === 0) return 0;

  let score = 0;

  // Full query is a substring
  if (title.includes(q)) score += 100;
  // Title starts with query
  if (title.startsWith(q)) score += 30;

  // Word-level matching
  const titleWords = new Set(extractWords(title));
  const matched = qWords.filter((w) => titleWords.has(w));
  score += (matched.length / qWords.length) * 60;

  // Partial word matching (prefix) for remaining words
  const unmatched = qWords.filter((w) => !titleWords.has(w));
  const titleWordsArr = Array.from(titleWords);
  for (const uw of unmatched) {
    for (const tw of titleWordsArr) {
      if (tw.startsWith(uw) || uw.startsWith(tw)) {
        score += 15;
        break;
      }
    }
  }

  return score;
}

/** Calculate word overlap ratio between two titles */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(extractWords(a));
  const wordsB = new Set(extractWords(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  Array.from(wordsA).forEach((w) => {
    if (wordsB.has(w)) overlap++;
  });
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/** Build a PriceResult from a Deal */
function dealToPriceResult(deal: Deal): PriceResult {
  const meta = storeMeta[deal.storeId] ?? {
    name: deal.storeName,
    logo: deal.storeName.slice(0, 2).toUpperCase(),
    color: "#64748B",
    rating: 3.5,
    deliveryDays: 5,
  };

  return {
    storeId: deal.storeId,
    storeName: meta.name,
    storeLogo: meta.logo,
    storeColor: meta.color,
    storeLogoUrl: resolveStoreLogoUrl(deal.storeId),
    price: toNgn(deal),
    currency: "NGN",
    inStock: true,
    url: deal.url,
    condition: "new",
    deliveryDays: meta.deliveryDays,
    rating: meta.rating,
    imageUrl: deal.imageUrl,
  };
}

/* ── Main search function ── */

export function searchProducts(query: string): SearchResult | null {
  const q = query.trim();
  if (!q) return null;

  // 1. Score every deal
  const scored = deals
    .map((deal) => ({ deal, score: scoreMatch(deal.title, q) }))
    .filter((s) => s.score > 20)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  // 2. Primary product = best match
  const primary = scored[0].deal;

  // 3. Find cross-store prices (deals similar to the primary product)
  const similar: Deal[] = [];
  const rest: { deal: Deal; score: number }[] = [];

  for (const { deal, score } of scored) {
    if (deal.id === primary.id) {
      similar.push(deal);
      continue;
    }

    const sim = titleSimilarity(primary.title, deal.title);
    if (sim >= 0.35 || (score >= 80 && deal.categorySlug === primary.categorySlug)) {
      similar.push(deal);
    } else {
      rest.push({ deal, score });
    }
  }

  // 4. Deduplicate prices per store (keep lowest)
  const byStore = new Map<string, PriceResult>();
  for (const deal of similar) {
    const pr = dealToPriceResult(deal);
    const existing = byStore.get(pr.storeId);
    if (!existing || pr.price < existing.price) {
      byStore.set(pr.storeId, pr);
    }
  }

  const prices = Array.from(byStore.values()).sort((a, b) => a.price - b.price);
  const bestDeal = prices[0];
  const highestPrice = prices[prices.length - 1]?.price ?? bestDeal.price;
  const maxSavings = highestPrice - bestDeal.price;

  // 5. Build alternatives from remaining matched deals
  const altDeals = rest
    .filter(({ deal }) => deal.categorySlug === primary.categorySlug)
    .slice(0, 20);

  // Group alternatives by rough title (dedup similar alternatives)
  const altGroups = new Map<string, Deal[]>();
  for (const { deal } of altDeals) {
    let added = false;
    for (const [key, group] of Array.from(altGroups.entries())) {
      if (titleSimilarity(key, deal.title) >= 0.4) {
        group.push(deal);
        added = true;
        break;
      }
    }
    if (!added) {
      altGroups.set(deal.title, [deal]);
    }
  }

  const alternatives: Alternative[] = [];
  let altIndex = 0;
  for (const [, group] of Array.from(altGroups.entries())) {
    if (alternatives.length >= 4) break;

    const groupPrices = group.map(toNgn);
    const minPrice = Math.min(...groupPrices);
    const maxPrice = Math.max(...groupPrices);
    const cheapest = group.reduce((a, b) => (toNgn(a) <= toNgn(b) ? a : b));
    const cheapestStore = storeMeta[cheapest.storeId]?.name ?? cheapest.storeName;
    const similarity = Math.round(titleSimilarity(primary.title, cheapest.title) * 100);
    const savingsPercent =
      bestDeal.price > 0
        ? Math.round(((bestDeal.price - minPrice) / bestDeal.price) * 100)
        : 0;

    const storeIds = new Set(group.map((d) => d.storeId));

    alternatives.push({
      id: `alt-${altIndex++}`,
      title: cheapest.title,
      brand: cheapest.storeName,
      priceRange: { min: minPrice, max: maxPrice },
      currency: "NGN",
      imageGradient: cheapest.imageGradient,
      imageEmoji: cheapest.imageEmoji,
      imageUrl: cheapest.imageUrl,
      category: cheapest.category,
      similarity: Math.max(similarity, 40),
      savingsPercent,
      storeCount: storeIds.size,
      topStore: cheapestStore,
      topPrice: minPrice,
      tags: cheapest.tags.slice(0, 3),
    });
  }

  return {
    query: q,
    product: {
      title: primary.title,
      category: primary.category,
      imageEmoji: primary.imageEmoji,
      imageGradient: primary.imageGradient,
      imageUrl: primary.imageUrl,
    },
    prices,
    alternatives,
    bestDeal,
    maxSavings,
  };
}

export const popularSearches = [
  "TV", "Phone", "Laptop", "Sneakers", "Dress",
  "Headphones", "Solar", "Camera",
];
