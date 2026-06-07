/* Per-market content for the explainer. Stores are REAL (from the app's
   StoreLogos rosters); the iPhone 17 Pro Max prices are ILLUSTRATIVE
   flagship figures (a marketing example, not a live quote). Cross-border
   deltas are modest + believable per market (bigger for NG where import
   savings are real, smaller for UK/US). */

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
    product: "iPhone 17 Pro Max",
    heroSub: "Havlo finds it cheaper, wherever you shop.",
    hook: [
      { store: "Amazon", price: 1319 },
      { store: "eBay", price: 1289 },
      { store: "AliExpress", price: 1249 },
      { store: "Walmart", price: 1199 },
    ],
    localStore: "Local store",
    localPrice: 1399,
    globalStore: "Global store",
    globalPrice: 1199,
    trackFrom: 1299,
    trackTo: 1149,
    roster: ["Amazon", "eBay", "Walmart", "AliExpress", "Temu", "SHEIN", "Best Buy", "Argos"],
  },
  ng: {
    key: "ng",
    cur: "₦",
    locale: "en-NG",
    product: "iPhone 17 Pro Max",
    heroSub: "Havlo finds it cheaper in Nigeria.",
    hook: [
      { store: "Jumia", price: 2980000 },
      { store: "Konga", price: 2890000 },
      { store: "Slot", price: 2790000 },
      { store: "Amazon", price: 2650000 },
    ],
    localStore: "Jumia",
    localPrice: 2980000,
    globalStore: "Amazon",
    globalPrice: 2650000,
    trackFrom: 2790000,
    trackTo: 2590000,
    roster: ["Jumia", "Konga", "Jiji", "Slot", "Kara", "Temu", "AliExpress", "Amazon", "ASOS", "SHEIN"],
  },
  uk: {
    key: "uk",
    cur: "£",
    locale: "en-GB",
    product: "iPhone 17 Pro Max",
    heroSub: "Havlo finds it cheaper in the UK.",
    hook: [
      { store: "Currys", price: 1299 },
      { store: "Argos", price: 1269 },
      { store: "John Lewis", price: 1239 },
      { store: "Amazon UK", price: 1199 },
    ],
    localStore: "Currys",
    localPrice: 1299,
    globalStore: "Amazon",
    globalPrice: 1149,
    trackFrom: 1249,
    trackTo: 1099,
    roster: ["Amazon UK", "Argos", "Currys", "John Lewis", "Boots", "Next", "AliExpress", "SHEIN", "Temu"],
  },
  us: {
    key: "us",
    cur: "$",
    locale: "en-US",
    product: "iPhone 17 Pro Max",
    heroSub: "Havlo finds it cheaper in the US.",
    hook: [
      { store: "Amazon", price: 1319 },
      { store: "Best Buy", price: 1299 },
      { store: "Walmart", price: 1249 },
      { store: "Target", price: 1199 },
    ],
    localStore: "Best Buy",
    localPrice: 1299,
    globalStore: "Global retailer",
    globalPrice: 1199,
    trackFrom: 1299,
    trackTo: 1149,
    roster: ["Amazon", "Walmart", "Best Buy", "Target", "Newegg", "Costco", "eBay", "SHEIN", "Temu"],
  },
};

export const money = (m: Market, n: number) =>
  m.cur + n.toLocaleString(m.locale);
