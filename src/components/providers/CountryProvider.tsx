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
  COUNTRIES, COUNTRY_COOKIE, DEFAULT_COUNTRY, getCountry, USD_FX,
  type Country, type FxSnapshot,
} from "@/lib/country";

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

interface CountryContextValue {
  country:    Country;
  countries:  Country[];
  setCountry: (code: string) => void;
  /** "1 USD = X" rate table for price conversion. Always the SERVER's
      snapshot when the layout passed one (see fxSnapshot below) —
      read rates from here, never from an imported USD_FX, in any
      component whose converted price appears in SSR HTML. */
  fx:         FxSnapshot;
}

const CountryContext = createContext<CountryContextValue | null>(null);

interface Props {
  initialCode?: string;
  /** The server layout's resolved USD_FX, serialized through the RSC
      payload. CRITICAL (hydration): the FX mirror
      (fx-rates.generated.ts) is rewritten daily by the FX cron, and
      the server module graph and the browser's compiled chunks can
      hold DIFFERENT revisions of it — dev HMR across a rewrite, or a
      visitor hydrating around a deploy boundary. Each side's imported
      USD_FX is then a different table, and every converted price in
      SSR HTML mismatches on hydration by a few units (the June 2026
      "₦54,755 vs ₦54,738" TrendingDeals warning). A PROP can't drift:
      hydration replays the serialized value the server rendered with,
      byte-for-byte. Falls back to the bundled USD_FX only when no
      snapshot is passed (both app layouts pass one). */
  fxSnapshot?:  FxSnapshot;
  children:     ReactNode;
}

export function CountryProvider({ initialCode, fxSnapshot, children }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  /* First-render resolution order: URL pathname → initialCode →
     default. The cookie is resolved LATER, in the post-mount effect
     below — NOT here.

     CRITICAL (hydration): the useState initialiser runs on BOTH the
     server and the client's first render, so it MUST produce the same
     value on both or every country-derived node (currency, flags,
     country copy, conditional store rows) mismatches and React tears
     the tree down (#418 / #425 / #423) on the client's first paint.
     The previous version read window.location + document.cookie here,
     which are unavailable during SSR: the server emitted NG while the
     client's first render resolved the URL/cookie country, crashing
     hydration site-wide on every non-NG PDP and on / with a saved
     cookie. suppressHydrationWarning on the navbar flag can't absorb
     that — it only covers one element, and structural diffs throw.

     The fix is to read the path via Next's usePathname() (NOT
     window.location): usePathname() returns the SAME value during SSR
     and the client's first render, so /uk/… resolves "uk" on both
     sides — correct country in the initial HTML, no flash, no
     hydration mismatch. Bare/global paths (/, /about) have no country
     segment, so they fall back to initialCode/default for the first
     render and pick up the saved cookie in the effect below (a single
     post-hydration flag update on those surfaces only). usePathname()
     does NOT opt the route into dynamic server rendering the way
     cookies()/headers() would, so ISR is preserved.

     URL wins over initialCode: a user on /us is definitionally
     browsing US regardless of a stale cookie/initialCode. */
  const [code, setCode] = useState<string>(() => {
    const seg = pathname.split("/")[1]?.toLowerCase();
    if (seg && COUNTRY_CODES.has(seg)) return seg;
    return initialCode ?? DEFAULT_COUNTRY;
  });

  /* Pathname-tracked re-sync. Without this, an in-app client
     navigation from /uk/deals to /us/deals (via the country
     selector or a programmatic router.push) wouldn't update the
     state because useState's initialiser only runs once per mount.
     React's automatic re-rendering of the route DOESN'T re-mount
     the provider — it's persistent across child remounts. So the
     navbar flag would stay on the OLD country until a hard refresh.

     Effect dependency on pathname guarantees we resync to the URL
     on every navigation. Safe because setCode is a no-op when the
     value hasn't changed (React's bail-out heuristic).

     Cookie sync (May 2026): the cookie is the source of truth the
     middleware uses to resolve bare paths like /deals. If a user
     lands on /ng/ via a direct URL with a stale havlo-country=uk
     cookie, every bare-path link in the app (the "See all deals"
     CTA on the homepage, /about's "Compare a product", etc.) would
     bounce them back to /uk. Writing the cookie on every URL-driven
     country change keeps it in lockstep with the URL, so middleware
     redirects always resolve to the country the user is actually
     browsing. Defense in depth: hrefs in country-scoped components
     already carry an explicit country prefix; this fix protects
     anything that doesn't (global pages like /about). */
  useEffect(() => {
    const seg = pathname.split("/")[1]?.toLowerCase();
    if (seg && COUNTRY_CODES.has(seg)) {
      /* URL carries a country — the strongest signal. Re-sync on every
         navigation and keep the cookie in lockstep (middleware uses it
         to resolve bare-path links). */
      if (seg !== code) {
        setCode(seg);
        writeCookie(COUNTRY_COOKIE, seg, 365);
      }
      return;
    }
    /* Bare/global path (/, /about, legal pages): no country segment, so
       honor a returning visitor's saved cookie preference. This runs
       AFTER hydration, so it can't desync the server HTML — the cost is
       a single post-mount flag update on these surfaces for non-default
       visitors (absorbed by suppressHydrationWarning on the flag). The
       guard keeps it a no-op for the inner [country] provider
       (initialCode set) and when the cookie names the current country. */
    if (!initialCode) {
      const cookie = readCookie(COUNTRY_COOKIE)?.toLowerCase();
      if (cookie && COUNTRY_CODES.has(cookie)) {
        if (cookie !== code) setCode(cookie);
        /* Country awareness for the bare brand homepage `/` (now a real
           INDEXABLE page, not a redirect). Send a RETURNING visitor whose
           saved market isn't the NG default to their country homepage.
           Cookie-gated, so a crawler (which carries no cookie) is NEVER
           redirected and `/` stays indexable for the "havlo" brand search;
           no cloaking. Scoped to `/` exactly, so it cannot loop or touch any
           other surface; deeper bare paths (/deals) are handled by
           middleware. */
        if (pathname === "/" && cookie !== DEFAULT_COUNTRY) {
          router.replace(`/${cookie}`);
        }
      }
    }
  }, [pathname, code, initialCode, router]);

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
        /* Compare-page escape hatch (May 2026 mobile crash report).
           Swapping country on /[country]/compare while a search is
           loaded can surface a mobile-only client-side exception:
           the q/pid/oid in the URL resolve against the new country's
           catalog but downstream renders trip on country-mismatched
           data (a stale anchor UUID that doesn't exist in the new
           country, an offer pruned by isOfferAllowedForCountry while
           a child still references it, etc.). The key={params.country}
           remount on the page was a partial fix that holds on desktop
           but not on mobile under iOS Safari's tighter render budget.
           User direction: don't preserve the path + search, just drop
           the visitor on the new country's homepage. Loses the query
           but trades zero crashes for one extra click. */
        if (segments[2] === "compare") {
          router.push(`/${normalized}`);
          return;
        }
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

  /* The country picker uses `countries` to render its list — hide
     deferred-launch countries so users can't switch into a market
     we're not legally ready for (currently DE, awaiting Impressum).
     The full COUNTRIES list stays available to internal tools
     (sitemap, ingest scripts) via direct import. */
  const value = useMemo<CountryContextValue>(
    () => ({
      country:   getCountry(code),
      countries: COUNTRIES.filter((c) => !c.deferredLaunch),
      setCountry,
      fx:        fxSnapshot ?? USD_FX,
    }),
    [code, setCountry, fxSnapshot],
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
