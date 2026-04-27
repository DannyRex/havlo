"use client";

/* Client-side country preference.
   - Reads the initial value from a server-rendered cookie so SSR + CSR
     agree on the first paint (no flash of "wrong country").
   - On change, writes the cookie + updates context + refreshes the
     route so server components (TrendingDeals, /deals) re-fetch with
     the new country biasing.

   The cookie is set with a 1-year expiry, lax SameSite, and no httpOnly
   so the client can read+write it. It's a UX preference, not auth — no
   need for the security overhead. */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  COUNTRIES, COUNTRY_COOKIE, DEFAULT_COUNTRY, getCountry,
  type Country,
} from "@/lib/country";

interface CountryContextValue {
  country:    Country;
  countries:  Country[];
  setCountry: (code: string) => void;
}

const CountryContext = createContext<CountryContextValue | null>(null);

interface Props {
  initialCode?: string;
  children:     ReactNode;
}

export function CountryProvider({ initialCode, children }: Props) {
  const router = useRouter();
  const [code, setCode] = useState<string>(initialCode ?? DEFAULT_COUNTRY);

  /* If the server didn't ship an initial code (e.g. first visit before
     middleware runs), hydrate from the cookie on the client. */
  useEffect(() => {
    if (initialCode) return;
    const c = readCookie(COUNTRY_COOKIE);
    if (c) setCode(c);
  }, [initialCode]);

  const setCountry = useCallback(
    (next: string) => {
      const normalized = next.toLowerCase();
      if (normalized === code) return;
      setCode(normalized);
      writeCookie(COUNTRY_COOKIE, normalized, 365);
      // Re-render server components so TrendingDeals etc. pick up the
      // new cookie via getServerCountry().
      router.refresh();
    },
    [code, router],
  );

  const value = useMemo<CountryContextValue>(
    () => ({ country: getCountry(code), countries: COUNTRIES, setCountry }),
    [code, setCountry],
  );

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry(): CountryContextValue {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error("useCountry must be used inside <CountryProvider>");
  return ctx;
}

/* ── Cookie helpers ─────────────────────────────────────────────── */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}
