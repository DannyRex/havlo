/* Per-market content for the explainer. Stores are REAL (from the app's
   StoreLogos rosters); the Samsung Galaxy S26 Ultra prices are
   ILLUSTRATIVE flagship figures (a marketing example, not a live quote).
   Cross-border deltas are modest + believable per market (bigger for NG
   where import savings are real, smaller for UK/US). */

export type MarketKey = "agnostic" | "ng" | "uk" | "us";

export interface StoreRow {
  store: string;
  price: number;
}

export interface Market {
  key: MarketKey;
  cur: string;            // currency symbol
  locale: string;         // number formatting
  product: string;
  heroSub: string;        // Hero subhead trailer
  hook: StoreRow[];       // 4 stores, cheapest LAST
  localStore: string;
  localPrice: number;
  globalStore: string;
  globalPrice: number;
  trackFrom: number;
  trackTo: number;
  roster: string[];       // logos for the stores scene
}

export const MARKETS: Record<MarketKey, Market> = {
  agnostic: {
    key: "agnostic",
    cur: "$",
    locale: "en-US",
    product: "Samsung Galaxy S26 Ultra",
    heroSub: "Havlo finds it cheaper, wherever you shop.",
    hook: [
      { store: "Amazon", price: 1419 },
      { store: "eBay", price: 1389 },
      { store: "AliExpress", price: 1349 },
      { store: "Walmart", price: 1299 },
    ],
    localStore: "Local store",
    localPrice: 1399,
    globalStore: "Global store",
    globalPrice: 1279,
    trackFrom: 1299,
    trackTo: 1199,
    roster: ["Amazon", "eBay", "Walmart", "AliExpress", "Temu", "SHEIN", "Best Buy", "Argos"],
  },
  ng: {
    key: "ng",
    cur: "₦",
    locale: "en-NG",
    product: "Samsung Galaxy S26 Ultra",
    heroSub: "Havlo finds it cheaper in Nigeria.",
    hook: [
      { store: "Jumia", price: 2450000 },
      { store: "Konga", price: 2390000 },
      { store: "Slot", price: 2340000 },
      { store: "Amazon", price: 2180000 },
    ],
    localStore: "Jumia",
    localPrice: 2450000,
    globalStore: "Amazon",
    globalPrice: 2180000,
    trackFrom: 2180000,
    trackTo: 1990000,
    roster: ["Jumia", "Konga", "Jiji", "Slot", "Kara", "Temu", "AliExpress", "Amazon", "ASOS", "SHEIN"],
  },
  uk: {
    key: "uk",
    cur: "£",
    locale: "en-GB",
    product: "Samsung Galaxy S26 Ultra",
    heroSub: "Havlo finds it cheaper in the UK.",
    hook: [
      { store: "Currys", price: 1349 },
      { store: "Argos", price: 1329 },
      { store: "John Lewis", price: 1299 },
      { store: "Amazon UK", price: 1279 },
    ],
    localStore: "Currys",
    localPrice: 1349,
    globalStore: "Amazon",
    globalPrice: 1229,
    trackFrom: 1279,
    trackTo: 1199,
    roster: ["Amazon UK", "Argos", "Currys", "John Lewis", "Boots", "Next", "AliExpress", "SHEIN", "Temu"],
  },
  us: {
    key: "us",
    cur: "$",
    locale: "en-US",
    product: "Samsung Galaxy S26 Ultra",
    heroSub: "Havlo finds it cheaper in the US.",
    hook: [
      { store: "Amazon", price: 1419 },
      { store: "Best Buy", price: 1399 },
      { store: "Walmart", price: 1349 },
      { store: "Target", price: 1299 },
    ],
    localStore: "Best Buy",
    localPrice: 1399,
    globalStore: "Global retailer",
    globalPrice: 1279,
    trackFrom: 1299,
    trackTo: 1199,
    roster: ["Amazon", "Walmart", "Best Buy", "Target", "Newegg", "Costco", "eBay", "SHEIN", "Temu"],
  },
};

export const money = (m: Market, n: number) =>
  m.cur + n.toLocaleString(m.locale);
