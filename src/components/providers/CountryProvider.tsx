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
import { useRouter, usePathname } from "next/navigation";
import {
  COUNTRIES, COUNTRY_COOKIE, DEFAULT_COUNTRY, getCountry,
  type Country,
} from "@/lib/country";

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

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
  const router   = useRouter();
  const pathname = usePathname();

  /* Resolution order: URL pathname → cookie → default.

     CRITICAL: this runs during the useState initialiser, NOT in a
     post-mount useEffect. The previous useEffect-based approach
     left the OUTER root-layout CountryProvider rendering NG on
     first paint (root layout has no initialCode, so initial state
     was DEFAULT_COUNTRY). Users saw an NG flag briefly flash in
     the navbar on country-scoped pages until the useEffect tick
     ran — visible to the user as a wrong-country flash.

     With the resolution in useState's lazy initialiser, the FIRST
     client render already has the right country. SSR still emits
     HTML using DEFAULT_COUNTRY (server has no window/cookie
     access in this provider; cookies() would break ISR), so the
     hydration produces a mismatch on country-derived UI — handled
     by suppressHydrationWarning on the navbar flag wrapper. */
  const [code, setCode] = useState<string>(() => {
    if (initialCode) return initialCode;
    if (typeof window !== "undefined") {
      const seg = window.location.pathname.split("/")[1]?.toLowerCase();
      if (seg && COUNTRY_CODES.has(seg)) return seg;
      const cookie = readCookie(COUNTRY_COOKIE);
      if (cookie && COUNTRY_CODES.has(cookie)) return cookie;
    }
    return DEFAULT_COUNTRY;
  });

  const setCountry = useCallback(
    (next: string) => {
      const normalized = next.toLowerCase();
      if (normalized === code) return;
      /* Fire GA4 'country_switch' before mutating state so the
         analytics call has access to BOTH the from- and to-country
         on the same event. Lazy-imported to avoid pulling the
         analytics module into the SSR bundle for a code path that
         only fires post-mount on user click. */
      import("@/lib/analytics").then(({ track }) => {
        track({
          name: "country_switch",
          props: { from: code, to: normalized, country: normalized },
        });
      }).catch(() => { /* analytics never breaks UX */ });
      setCode(normalized);
      writeCookie(COUNTRY_COOKIE, normalized, 365);

      /* Refresh strategy — was just router.refresh() but users
         reported that switching country left them on a stale page
         (server-rendered components served from CDN cache, client
         bundle pinned to the old country in some surfaces).

         Current behaviour:
           1. If the URL has a country segment (/ng/deals, /uk/compare,
              etc.), REWRITE that segment to the new country and
              navigate. The /[country] route param is the source of
              truth so this swaps the entire page context.

              SEARCH PARAMS preserved (May 2026 user report from the
              country-awareness audit: "Country switch loses URL
              state. I was on /ng/deals?category=beauty&minDiscount=20
              &sort=newest&origin=local, picked UK from the selector,
              landed on /uk/deals?origin=local — category,
              minDiscount, sort all silently stripped."). Users
              comparing the same category across markets shouldn't
              have to re-apply every filter after each swap.
           2. If no country segment is in the URL (rare — legal
              pages, the bare /), do a hard reload via
              window.location.reload() to bust any stale RSC payload
              in the client cache. router.refresh() was inconsistent
              about picking up the new cookie on these surfaces. */
      const segments = pathname.split("/");
      if (segments[1] && COUNTRY_CODES.has(segments[1])) {
        segments[1] = normalized;
        const newPath = segments.join("/") || `/${normalized}`;
        /* window.location.search includes the leading "?" or is
           "" when no params present, so concatenation is safe in
           both cases. The current-search read happens at click
           time so the very-latest URL state wins. */
        const currentSearch = typeof window !== "undefined" ? window.location.search : "";
        router.push(`${newPath}${currentSearch}`);
      } else if (typeof window !== "undefined") {
        window.location.reload();
      } else {
        router.refresh();
      }
    },
    [code, router, pathname],
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
