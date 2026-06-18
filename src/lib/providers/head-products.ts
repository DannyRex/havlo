/* Head-product ingest spine — see docs/vertical-depth-plan.md.
   ────────────────────────────────────────────────────────────────────
   The comparison-DENSE vertical in every market is tech: phones (lead),
   then computing / audio / gaming, with electronics / appliances adjacent.
   This module is the curated list of popular MODELS to saturate, instead of
   broad category-name sweeps. One market-mode SerpAPI query per model returns
   many sellers + a google_shopping_id (the only cross-merchant match key we
   actually get — gtin/mpn are ~0% from our sources), so this is the highest
   comparison-density-per-credit ingest path.

   Consumed by scripts/ingest-head-products.ts (`npm run ingest:head`).
   `categorySlug` must be a real slug from src/lib/data/categories.ts. */

export interface HeadSeed {
  q:            string;
  categorySlug: string;
  categoryName: string;
}

/* Global core — flagship models sold in every market. Runs for every country. */
const GLOBAL_CORE: Array<{ q: string; cat: string }> = [
  // phones
  { q: "iPhone 16 Pro Max", cat: "phones" },
  { q: "iPhone 16", cat: "phones" },
  { q: "iPhone 15 Pro Max", cat: "phones" },
  { q: "iPhone 15", cat: "phones" },
  { q: "iPhone 14", cat: "phones" },
  { q: "Samsung Galaxy S25 Ultra", cat: "phones" },
  { q: "Samsung Galaxy S24", cat: "phones" },
  { q: "Samsung Galaxy A55", cat: "phones" },
  { q: "Samsung Galaxy A15", cat: "phones" },
  // computing
  { q: "MacBook Air M3", cat: "computing" },
  { q: "MacBook Pro M3", cat: "computing" },
  { q: "iPad Air", cat: "computing" },
  { q: "HP Pavilion laptop", cat: "computing" },
  { q: "Lenovo IdeaPad laptop", cat: "computing" },
  { q: "Dell Inspiron laptop", cat: "computing" },
  // audio
  { q: "AirPods Pro 2", cat: "audio" },
  { q: "AirPods 4", cat: "audio" },
  { q: "Sony WH-1000XM5", cat: "audio" },
  { q: "Bose QuietComfort Ultra", cat: "audio" },
  { q: "JBL Charge 5", cat: "audio" },
  { q: "JBL Flip 6", cat: "audio" },
  { q: "Samsung Galaxy Buds", cat: "audio" },
  // gaming
  { q: "PlayStation 5 Slim", cat: "gaming" },
  { q: "Xbox Series X", cat: "gaming" },
  { q: "Nintendo Switch OLED", cat: "gaming" },
  // electronics / wearables (high-ticket, cross-border-liftable)
  { q: "Apple Watch Series 10", cat: "electronics" },
  { q: "Samsung 55 inch QLED TV", cat: "electronics" },
  { q: "Anker power bank", cat: "electronics" },
];

/* Per-country budget / local brands that drive local volume. */
const BY_COUNTRY: Record<string, Array<{ q: string; cat: string }>> = {
  ng: [
    { q: "Tecno Spark 20", cat: "phones" }, { q: "Tecno Camon 30", cat: "phones" },
    { q: "Tecno Phantom V", cat: "phones" }, { q: "Infinix Hot 50", cat: "phones" },
    { q: "Infinix Note 40", cat: "phones" }, { q: "Infinix Zero 40", cat: "phones" },
    { q: "itel A70", cat: "phones" }, { q: "Redmi Note 13", cat: "phones" },
    { q: "Oraimo earbuds", cat: "audio" }, { q: "Oraimo power bank", cat: "electronics" },
    { q: "Oraimo smartwatch", cat: "electronics" },
  ],
  in: [
    { q: "Redmi Note 13", cat: "phones" }, { q: "Realme Narzo", cat: "phones" },
    { q: "OnePlus Nord", cat: "phones" }, { q: "Vivo Y28", cat: "phones" },
    { q: "Oppo Reno 12", cat: "phones" }, { q: "iQOO Z9", cat: "phones" },
    { q: "Samsung Galaxy M35", cat: "phones" }, { q: "boAt Airdopes", cat: "audio" },
    { q: "Noise smartwatch", cat: "electronics" },
  ],
  ae: [
    { q: "Huawei Pura 70", cat: "phones" }, { q: "Honor 200", cat: "phones" },
    { q: "Anker charger", cat: "electronics" },
  ],
  za: [
    { q: "Hisense 55 inch TV", cat: "electronics" }, { q: "Huawei nova 12", cat: "phones" },
    { q: "Oppo A60", cat: "phones" },
  ],
  uk: [
    { q: "Google Pixel 9", cat: "phones" }, { q: "Dyson V15", cat: "appliances" },
    { q: "Ninja air fryer", cat: "appliances" }, { q: "Sonos Era 100", cat: "audio" },
    { q: "Garmin watch", cat: "electronics" },
  ],
  us: [
    { q: "Google Pixel 9", cat: "phones" }, { q: "Motorola Edge", cat: "phones" },
    { q: "TCL 55 inch TV", cat: "electronics" }, { q: "Ninja air fryer", cat: "appliances" },
    { q: "iRobot Roomba", cat: "appliances" }, { q: "Beats Studio Pro", cat: "audio" },
  ],
};

const CATEGORY_NAMES: Record<string, string> = {
  phones: "Phones", computing: "Computing", audio: "Audio",
  gaming: "Gaming", electronics: "Electronics", appliances: "Appliances",
};

/* Build the seed list for one country: the global core plus that country's
   local additions. NG note: Google Shopping doesn't serve NG, so the
   ingest:head script targets the google_shopping markets; NG head products
   are pulled by the site-scoped NG-merchant lane (ingest:ng-serpapi). The
   ng entries here are kept for that lane / future use. */
export function headProductSeeds(country: string): HeadSeed[] {
  const cc = country.toLowerCase();
  const list = [...GLOBAL_CORE, ...(BY_COUNTRY[cc] ?? [])];
  return list.map(({ q, cat }) => ({
    q,
    categorySlug: cat,
    categoryName: CATEGORY_NAMES[cat] ?? cat,
  }));
}
