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
  const [code, setCode] = useState<string>(initialCode ?? DEFAULT_COUNTRY);

  /* Hydration order on mount: URL pathname → cookie → default.

     Why URL first: after the May 2026 perf fix the root layout no
     longer reads cookies() (so the layout stays ISR-able), which
     means initialCode is undefined for everyone on first render.
     The HTML emitted by the server uses the default country (NG).
     If we ONLY hydrated from cookie, a UK visitor on /uk would
     briefly flash NG in the navbar before the cookie kicked in.

     URL-first hydration eliminates that flash for country-scoped
     pages: a visitor on /uk/... gets the navbar updated to UK
     synchronously on first useEffect tick. Cookie is the fallback
     for global pages (/about, /contact) where the URL has no
     country segment. Default is the safety net.

     `initialCode` (when supplied) still wins so any caller that
     CAN provide a server-side country code (e.g. a future
     [country]/layout.tsx) isn't forced through this client path. */
  useEffect(() => {
    if (initialCode) return;
    /* URL pathname check — first segment is the country if it
       matches our supported set. Same logic the middleware uses. */
    if (typeof window !== "undefined") {
      const seg = window.location.pathname.split("/")[1]?.toLowerCase();
      if (seg && COUNTRY_CODES.has(seg)) {
        setCode(seg);
        return;
      }
    }
    const c = readCookie(COUNTRY_COOKIE);
    if (c && COUNTRY_CODES.has(c)) setCode(c);
  }, [initialCode]);

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

         New behaviour:
           1. If the URL has a country segment (/ng/deals, /uk/compare,
              etc.), REWRITE that segment to the new country and
              navigate. The /[country] route param is the source of
              truth so this swaps the entire page context.
           2. If no country segment is in the URL (rare — legal
              pages, the bare /), do a hard reload via
              window.location.reload() to bust any stale RSC payload
              in the client cache. router.refresh() was inconsistent
              about picking up the new cookie on these surfaces. */
      const segments = pathname.split("/");
      if (segments[1] && COUNTRY_CODES.has(segments[1])) {
        segments[1] = normalized;
        router.push(segments.join("/") || `/${normalized}`);
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
