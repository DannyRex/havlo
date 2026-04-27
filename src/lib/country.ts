/* ──────────────────────────────────────────────────────────────────
   Country preference — pure data + client-safe helpers.

   Contract:
     - Country code is ISO 3166-1 alpha-2 lowercase (matches SerpAPI's
       `gl` param so ingestion + UI can share one identifier).
     - Stored in a first-party cookie `havlo-country` (set client-side
       by CountryProvider).
     - Default is "ng" — Havlo is Nigeria-first.

   Server-only helpers (cookie read on RSC) live in country-server.ts
   so this file stays importable from client components without
   poisoning the client bundle with next/headers.
   ────────────────────────────────────────────────────────────────── */

export const COUNTRY_COOKIE = "havlo-country";
export const DEFAULT_COUNTRY = "ng";

export interface Country {
  /** ISO 3166-1 alpha-2 lowercase — used everywhere as the canonical id */
  code:        string;
  /** Display name */
  name:        string;
  /** Emoji flag — cheap, no asset shipping */
  flag:        string;
  /** ISO 4217 — drives currency formatting */
  currency:    "NGN" | "USD" | "GBP" | "EUR" | "AED" | "INR" | "ZAR";
  /** Human currency symbol (for compact tile layouts that can't fit Intl) */
  symbol:      string;
  /** SerpAPI gl param — usually identical to code, kept explicit so we
      don't accidentally couple the public country code to the search-engine
      knob if they diverge later (e.g. uk vs gb). */
  serpGl:      string;
}

/* MVP roster — every country here either:
   1. Is where Nigerians actually shop (NG, US, UK, AE, DE, IN, ZA), OR
   2. Is on the SerpAPI ingest country list so live data flows for it.
   Easy to extend — add a row here and the selector picks it up. */
export const COUNTRIES: Country[] = [
  { code: "ng", name: "Nigeria",        flag: "🇳🇬", currency: "NGN", symbol: "₦", serpGl: "ng" },
  { code: "us", name: "United States",  flag: "🇺🇸", currency: "USD", symbol: "$", serpGl: "us" },
  /* UK roster removed pending affiliate-program approvals — re-add the
     row above when Awin / Amazon UK Associates are wired so the URL,
     middleware, sitemap and store logos all light up together. */
  { code: "ae", name: "UAE",            flag: "🇦🇪", currency: "AED", symbol: "د.إ", serpGl: "ae" },
  { code: "de", name: "Germany",        flag: "🇩🇪", currency: "EUR", symbol: "€", serpGl: "de" },
  { code: "in", name: "India",          flag: "🇮🇳", currency: "INR", symbol: "₹", serpGl: "in" },
  { code: "za", name: "South Africa",   flag: "🇿🇦", currency: "ZAR", symbol: "R", serpGl: "za" },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string | undefined | null): Country {
  if (!code) return COUNTRY_BY_CODE.get(DEFAULT_COUNTRY)!;
  return COUNTRY_BY_CODE.get(code.toLowerCase()) ?? COUNTRY_BY_CODE.get(DEFAULT_COUNTRY)!;
}

/* ── Currency formatting ────────────────────────────────────────── */

/* Approximate FX → unit currency. Same as src/lib/utils.ts USD_TO_NGN
   pattern; refresh quarterly or wire a real FX feed later.
   Values are "1 USD = X local". */
export const USD_FX: Record<Country["currency"], number> = {
  USD: 1.00,
  NGN: 1600,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.67,
  INR: 83,
  ZAR: 18.5,
};

/** Convert a USD amount to the country's local currency. */
export function usdToLocal(usd: number, country: Country): number {
  return Math.round(usd * USD_FX[country.currency]);
}

/** Format a value already in the country's currency. */
export function formatLocal(amount: number, country: Country): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: country.currency,
    minimumFractionDigits: country.currency === "USD" ? 2 : 0,
    maximumFractionDigits: country.currency === "USD" ? 2 : 0,
  }).format(amount);
}

/* ── Per-country store filtering ────────────────────────────────────
   Goal: when a UK user lands on the homepage, they should see UK
   retailers (Amazon UK, ASOS, Argos, Currys…) and a few cross-border
   stores UK shoppers actually use (Shein, Temu, AliExpress) — NOT
   Konga / Jumia / 3C Hub which they can't buy from.

   The Deal.tags array carries `country:xx` for SerpAPI rows; native
   NG scraper rows are NGN-currency. Cross-border stores are matched
   by storeId fragments since they ingest under multiple country
   contexts (Shein.com surfaces under "us", "uk", "de" etc.). */

/* Default cross-border roster — stores that ship to most countries.
   Per-country overrides in COUNTRY_CROSS_BORDER for cases where this
   list is wrong for the local market (Shein is banned in India, etc.). */
const DEFAULT_CROSS_BORDER = [
  "aliexpress", "shein", "temu", "dhgate", "banggood", "lightinthebox", "geekbuying",
];

/* Per-country cross-border allowlist. Determines which "international"
   stores are appropriate for the country's audience.
     - NG: Amazon (US/UK) + AliExpress + ASOS + Shein + Temu + DHgate
           — what Nigerians actually use for cross-border shopping
     - IN: Amazon Global only — Shein is banned in India (since 2020)
     - US: Shein + Temu + AliExpress dominate; Wish declining
     - UK / DE / AE / ZA: similar global mix */
const COUNTRY_CROSS_BORDER: Record<string, string[]> = {
  ng: ["amazon", "amazon.com", "amazon.co.uk", "aliexpress", "asos",
       "shein", "temu", "dhgate", "ebay", "apple.com", "banggood"],
  // uk: removed from UI for now — see COUNTRIES roster
  us: ["aliexpress", "shein", "temu", "dhgate"],
  de: ["aliexpress", "shein", "temu", "dhgate", "banggood"],
  ae: ["aliexpress", "shein", "temu", "amazon.com", "amazon.co.uk"],
  // Shein officially banned in India since 2020. Import duties make
  // most Western cross-border purchases impractical except Amazon Global.
  in: ["aliexpress"],
  za: ["aliexpress", "shein", "temu", "amazon.com"],
};

function crossBorderListFor(countryCode: string): string[] {
  return COUNTRY_CROSS_BORDER[countryCode] ?? DEFAULT_CROSS_BORDER;
}

/* Stores that are NG-anchored — never appropriate outside Nigeria. */
const NG_STORES = [
  "konga", "jumia", "3c-hub", "3chub", "3c hub",
  "slot", "pointek", "fouani", "zit-trading", "hayathub",
  "ajebomarket", "kara", "obiwezy", "pricepally",
];

/* Per-country anchored stores. The filter doesn't strictly require
   these (untagged intl rows pass through too) but having them mapped
   lets future code prioritize "real" country stores in ranking +
   gives QA a clear list of who we expect to surface. Match is
   substring on storeId/storeName. */
export const COUNTRY_STORES: Record<string, string[]> = {
  /* uk: roster preserved here behind the scenes — re-enable in COUNTRIES
     roster + this map when affiliate programs land. Old list:
       amazon.co.uk, argos, currys, john lewis, very, asos, boots, next,
       m&s, selfridges, ao.com, screwfix, wickes, halfords, sports direct,
       river island, primark, matalan, house of fraser, debenhams,
       tesco, sainsbury, ebay.co.uk */
  us: [
    "amazon.com", "walmart", "best buy", "bestbuy", "target", "newegg",
    "ebay", "home depot", "homedepot", "macy", "kohl", "costco", "bjs",
    "nordstrom", "sephora", "ulta", "wayfair", "etsy", "lowes", "lowe's",
    "staples", "gap", "old navy", "oldnavy", "nike", "adidas",
  ],
  de: [
    "amazon.de", "mediamarkt", "media-markt", "saturn", "otto", "zalando",
    "idealo", "notebooksbilliger", "alternate", "cyberport", "lidl",
    "kaufland", "real.de", "tchibo",
  ],
  ae: [
    "amazon.ae", "noon", "sharaf dg", "sharafdg", "carrefour.ae",
    "lulu hypermarket", "luluhypermarket", "first cry", "firstcry.ae",
    "centrepoint", "namshi", "ounass", "6thstreet",
  ],
  in: [
    "amazon.in", "flipkart", "myntra", "ajio", "tata cliq", "tatacliq",
    "snapdeal", "nykaa", "firstcry", "meesho", "croma", "reliance digital",
    "reliancedigital", "vijay sales", "vijaysales", "shopclues",
  ],
  za: [
    "takealot", "makro", "game", "loot.co.za", "loot", "wantitall",
    "yuppiechef", "superbalist", "zando", "everyshop", "incredible connection",
    "incredibleconnection", "checkers", "pick n pay", "picknpay",
  ],
};

interface DealLike {
  storeId:    string;
  storeName:  string;
  currency:   string;
  tags:       string[];
}

/* Smaller shape for StoreOffer (in /compare anchor + dupe pipelines).
   Tags + currency aren't reliable here (offer prices are normalised to
   NGN for display) — we lean on isInternational instead. */
export interface OfferLike {
  storeId:          string;
  storeName:        string;
  isInternational?: boolean;
}

function lc(s: string): string { return s.toLowerCase(); }

function matchesAny(haystackLc: string, needles: string[]): boolean {
  return needles.some((n) => haystackLc.includes(n));
}

/** True if the deal's store is one of the cross-border / global retailers
    appropriate for the given country audience. When countryCode is
    omitted, uses the union of all per-country lists. */
export function isCrossBorderStore(d: DealLike, countryCode?: string): boolean {
  const list = countryCode ? crossBorderListFor(countryCode) : DEFAULT_CROSS_BORDER;
  const id   = lc(d.storeId);
  const name = lc(d.storeName);
  return matchesAny(id, list) || matchesAny(name, list);
}

/** True if the deal originates from an NG-anchored retailer. */
export function isNigerianStore(d: DealLike): boolean {
  const id   = lc(d.storeId);
  const name = lc(d.storeName);
  if (matchesAny(id, NG_STORES) || matchesAny(name, NG_STORES)) return true;
  // NGN-priced offers are NG by definition
  if (d.currency === "NGN") return true;
  // Tag-based country:ng signal
  if (d.tags.some((t) => lc(t) === "country:ng")) return true;
  return false;
}

/** Extract the country tag from Deal.tags, or null if not present. */
export function dealCountryTag(d: DealLike): string | null {
  const tag = d.tags.find((t) => lc(t).startsWith("country:"));
  return tag ? lc(tag).slice("country:".length) : null;
}

/** True if the deal's store belongs to the country's known retail roster. */
export function isStoreInCountry<T extends DealLike | OfferLike>(d: T, countryCode: string): boolean {
  const list = COUNTRY_STORES[countryCode];
  if (!list) return false;
  const id   = lc(d.storeId);
  const name = lc(d.storeName);
  return matchesAny(id, list) || matchesAny(name, list);
}

/** Filter a deals list for the given country preference.
    - For NG: drop nothing locally, but still trim cross-border noise
      (Indian Flipkart shouldn't show on a Nigerian homepage)
    - For non-NG: drop NG-only stores; keep country-appropriate
      cross-border, country-tagged matches, and known country-roster
      stores (Amazon UK / ASOS / Argos for UK, etc.). */
export function filterDealsForCountry<T extends DealLike>(deals: T[], country: Country): T[] {
  return deals.filter((d) => {
    /* NG path: keep all NG-anchored stores + only country-appropriate
       cross-border + Amazon. Drop foreign-country-anchored retailers
       that Nigerians can't actually use (Flipkart, Tata CLiQ, Walmart). */
    if (country.code === "ng") {
      if (isNigerianStore(d)) return true;
      if (isCrossBorderStore(d, "ng")) return true;
      const tag = dealCountryTag(d);
      // Untagged rows from the legacy intl pool — keep, broadly relevant
      if (tag === null) return true;
      // Tagged country:ng → keep (SerpAPI ingest)
      if (tag === "ng") return true;
      // Tagged for a foreign market — only keep if the store is known
      // cross-border-friendly for Nigerians (e.g. tagged country:us
      // but it's actually amazon.com which Nigerians use)
      return isCrossBorderStore(d, "ng");
    }

    /* Non-NG path */
    if (isNigerianStore(d)) return false;
    if (isCrossBorderStore(d, country.code)) return true;
    if (isStoreInCountry(d, country.code)) return true;
    const tag = dealCountryTag(d);
    if (tag === country.code) return true;
    if (tag === null) return true;
    return false;
  });
}

/** Variant for StoreOffer-style rows (compare anchor + dupes pipeline).
    Same intent as filterDealsForCountry but reads isInternational
    instead of currency/tags. */
export function isOfferAllowedForCountry<T extends OfferLike>(o: T, country: Country): boolean {
  const idLc   = lc(o.storeId);
  const nameLc = lc(o.storeName);
  const xb     = crossBorderListFor(country.code);

  // NG: keep all NG retailers + country-appropriate cross-border
  if (country.code === "ng") {
    if (matchesAny(idLc, NG_STORES) || matchesAny(nameLc, NG_STORES)) return true;
    if (matchesAny(idLc, xb) || matchesAny(nameLc, xb)) return true;
    if (o.isInternational === false) return true;        // NGN-priced row
    return matchesAny(idLc, xb) || matchesAny(nameLc, xb);
  }

  // Non-NG: cross-border per country + country-anchored retailers
  if (matchesAny(idLc, xb) || matchesAny(nameLc, xb)) return true;
  if (isStoreInCountry(o, country.code)) return true;

  // NG-anchored stores never for non-NG
  if (matchesAny(idLc, NG_STORES) || matchesAny(nameLc, NG_STORES)) return false;
  if (o.isInternational === false) return false;

  return true;
}
