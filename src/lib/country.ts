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
  { code: "uk", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£", serpGl: "uk" },
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

/* Stores that ship globally — appropriate to show under any country.
   Match is case-insensitive substring on storeId or storeName. */
const CROSS_BORDER_STORES = [
  "shein", "temu", "aliexpress", "wish", "dhgate", "banggood", "lightinthebox",
];

/* Stores that are NG-anchored — never appropriate outside Nigeria. */
const NG_STORES = [
  "konga", "jumia", "3c-hub", "3chub", "3c hub",
  "slot", "pointek", "fouani", "zit-trading", "hayathub",
];

interface DealLike {
  storeId:    string;
  storeName:  string;
  currency:   string;
  tags:       string[];
}

function lc(s: string): string { return s.toLowerCase(); }

function matchesAny(haystackLc: string, needles: string[]): boolean {
  return needles.some((n) => haystackLc.includes(n));
}

/** True if the deal's store is one of the cross-border / global retailers. */
export function isCrossBorderStore(d: DealLike): boolean {
  const id   = lc(d.storeId);
  const name = lc(d.storeName);
  return matchesAny(id, CROSS_BORDER_STORES) || matchesAny(name, CROSS_BORDER_STORES);
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

/** Filter a deals list for the given country preference.
    - For NG: return everything (no filter; quota handles the mix)
    - For non-NG: drop NG-only stores; keep country-tagged matches +
      cross-border stores. Untagged intl rows are kept (better than
      hiding them — most are still relevant globally). */
export function filterDealsForCountry<T extends DealLike>(deals: T[], country: Country): T[] {
  if (country.code === "ng") return deals;
  return deals.filter((d) => {
    if (isNigerianStore(d)) return false;
    if (isCrossBorderStore(d)) return true;
    const tag = dealCountryTag(d);
    if (tag === country.code) return true;
    if (tag === null) return true;       // untagged intl — keep, broadly relevant
    return false;                         // tagged but for a different country
  });
}
