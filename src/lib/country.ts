/* ──────────────────────────────────────────────────────────────────
   Country preference — single source of truth for which countries
   Havlo supports + helpers to read the user's choice on the server.

   Contract:
     - Country code is ISO 3166-1 alpha-2 lowercase (matches SerpAPI's
       `gl` param so ingestion + UI can share one identifier).
     - Stored in a first-party cookie `havlo-country` (set client-side
       by CountryProvider).
     - Default is "ng" — Havlo is Nigeria-first.
     - Server reads the cookie via getServerCountry() in RSC trees.
   ────────────────────────────────────────────────────────────────── */

import { cookies } from "next/headers";

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

/* ── Server-side helpers ────────────────────────────────────────── */

/** Read the user's country from the cookie in a Server Component.
    Falls back to DEFAULT_COUNTRY when unset or unrecognised. */
export function getServerCountry(): Country {
  const raw = cookies().get(COUNTRY_COOKIE)?.value;
  return getCountry(raw);
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
