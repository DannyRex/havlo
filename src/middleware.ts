/* Middleware — keeps the country cookie in sync with the URL.

   When the URL has a /[country]/ prefix and the cookie doesn't match,
   we mutate the request cookie store (so getServerCountry() in this
   render sees the new value) AND set the response cookie (so future
   requests carry it).

   Bare-path requests (/, /deals, /compare, /blog, /cashback) get
   redirected to /{country}/<rest>. The country is picked in priority
   order:
     1. Cookie (user previously chose explicitly)
     2. Geo-IP header (x-vercel-ip-country / cf-ipcountry)
     3. NG default

   Only fires on top-level country routes; static assets and APIs are
   excluded via the matcher. */

import { NextResponse, type NextRequest } from "next/server";

const SUPPORTED = new Set(["ng", "us", "uk", "ae", "de", "in", "za"]);
const COUNTRY_COOKIE = "havlo-country";

/* Countries DEFERRED from first launch — middleware redirects any
   /<cc>/ request for these to the user's next-best country (cookie
   or geo, else UK as a stable English-language EU adjacent default).
   Geo-IP signals matching a deferred country also fall through to
   the next-best inference.

   DE is deferred until the Impressum (legally required by German
   commercial-website law) is shipped with verified company-registration
   details. The /accessibility + /dsa-contact pages cover the other
   EU obligations; only the Impressum is missing. Re-enable by removing
   "de" here once the legal entity + address are confirmed.
   See task #42 + the chat thread on May 2026 launch compliance. */
const DEFERRED_LAUNCH = new Set(["de"]);
/* Fallback when a deferred country needs to be replaced — pick the
   nearest English-language market that's launched. UK works well for
   DACH visitors (the EU-adjacent + cross-border-friendly choice). */
const DEFERRED_FALLBACK = "uk";

/* Read country from the edge geo headers Vercel + Cloudflare set on
   incoming requests. Returns null when no header resolves to a
   supported country code. Used as the second-priority signal after
   the cookie when redirecting bare paths to /{country}/<rest>.

   Vercel's NextRequest also exposes `req.geo?.country` which
   normalises across providers — we try that first when available. */
function inferGeoCountry(req: NextRequest): string | null {
  const candidates: Array<string | undefined> = [
    req.geo?.country,
    req.headers.get("x-vercel-ip-country") ?? undefined,
    req.headers.get("cf-ipcountry") ?? undefined,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const code = raw.toLowerCase();
    /* Vercel/CF use ISO 'GB' for the UK; our internal id is 'uk'. */
    const remapped = code === "gb" ? "uk" : code;
    if (SUPPORTED.has(remapped)) return remapped;
  }
  return null;
}

/* Pages that exist under /[country]/ and should be redirected to the
   user's country prefix when accessed bare (e.g. /deals → /uk/deals).
   Anything not in this list passes through untouched.

   blog + cashback added because the navbar links to bare /blog and
   /cashback for cleanliness — middleware handles the country prefix
   so internal Links don't have to be country-aware. The legacy
   /blog page-level redirect is now redundant but kept so old
   Google-indexed /blog/{slug} URLs also work via that route. */
const COUNTRY_SCOPED = new Set(["", "deals", "compare", "blog", "cashback"]);

/* Pages that exist OUTSIDE /[country]/ — global, no redirect. */
const GLOBAL_PAGES = new Set([
  "about", "contact", "privacy-policy", "terms-of-use",
  "disclaimer", "how-we-make-money",
]);

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const seg = path.split("/")[1]?.toLowerCase() ?? "";

  /* Resolve the country for THIS request and attach it as the
     x-havlo-country request header, which the root layout reads to
     seed CountryProvider. URL /[country]/ segment wins, then cookie,
     then geo-IP, then ng. Without this the navbar rendered the
     cookie's country on the server and the URL's country on the
     client: a hydration mismatch that threw React #418/#423/#425 and
     flashed the wrong flag for several seconds before correcting. */
  const reqCountry = ((): string => {
    if (SUPPORTED.has(seg)) return seg;
    const ck = req.cookies.get(COUNTRY_COOKIE)?.value?.toLowerCase();
    if (ck && SUPPORTED.has(ck)) return ck;
    return inferGeoCountry(req) ?? "ng";
  })();
  const passThrough = (): NextResponse => {
    const fwd = new Headers(req.headers);
    fwd.set("x-havlo-country", reqCountry);
    return NextResponse.next({ request: { headers: fwd } });
  };

  /* Case 1: URL has a valid country prefix.

     Middleware does NOT touch the country cookie here. The cookie is
     the user's EXPLICIT preferred country, set only by the country
     picker (CountryProvider.setCountry). Letting middleware mirror
     the URL to the cookie meant a UK user who followed a shared
     /ng/deals link got their cookie pinned to NG forever — every
     subsequent visit to havlo.io/ then redirected them to /ng even
     though geo says UK. User report May 2026: "a UK user sees ng by
     default."

     Now: clicking /ng/deals just renders that page. Cookie is
     unchanged. Bare havlo.io/ then re-uses cookie → geo → ng default.

     Special-case for accidental /ng/about, /uk/contact etc. — those
     global pages don't have a /[country]/ variant. Strip the country
     prefix and redirect to the canonical /global-page so the user
     lands on a working page. */
  if (SUPPORTED.has(seg)) {
    /* DEFERRED-LAUNCH check — if this country is deferred (currently:
       DE, awaiting Impressum), redirect to the fallback country
       (UK) preserving the rest of the path so bookmarks + shared
       links don't 404. Use 307 (temporary) so we can re-enable
       cleanly later without browser cache friction. */
    if (DEFERRED_LAUNCH.has(seg)) {
      const target = req.nextUrl.clone();
      const restOfPath = path.split("/").slice(2).join("/");
      target.pathname = `/${DEFERRED_FALLBACK}${restOfPath ? `/${restOfPath}` : ""}`;
      const res = NextResponse.redirect(target, 307);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    const secondSeg = path.split("/")[2]?.toLowerCase() ?? "";
    if (secondSeg && GLOBAL_PAGES.has(secondSeg)) {
      const target = req.nextUrl.clone();
      target.pathname = `/${path.split("/").slice(2).join("/")}`;
      return NextResponse.redirect(target, 307);
    }
    return passThrough();
  }

  /* Case 2: bare country-scoped path (/, /deals, /compare) → redirect
     to /{country}/<rest>. Lets existing internal Links keep using
     unprefixed hrefs while the URL stays canonical.

     Country priority: cookie (explicit user choice) > geo-IP header
     (first-visit auto-detect) > NG default. Without the geo step a
     US-VPN user landing on havlo.io/ was redirected to /ng (and the
     cookie was then locked to ng by Case 1 above on the next request),
     so they never had a chance to be auto-routed to /us. The user
     reported this directly.

     IMPORTANT: 307 (temporary) NOT 308 (permanent). Browsers cache 308
     forever — once a user redirects /deals → /ng/deals as 308, switching
     country to UK and clicking /deals still routes to /ng/deals from
     cache without re-checking middleware. 307 + the no-cache header
     keeps the redirect dynamic. */
  if (COUNTRY_SCOPED.has(seg) && !GLOBAL_PAGES.has(seg)) {
    const cookieCc = req.cookies.get(COUNTRY_COOKIE)?.value;
    const geoCc    = inferGeoCountry(req);
    let cc         = (cookieCc && SUPPORTED.has(cookieCc)) ? cookieCc : (geoCc ?? "ng");
    /* If the resolved country is deferred (DE), substitute the
       fallback (UK). Same rationale as the prefixed-path branch
       above. */
    if (DEFERRED_LAUNCH.has(cc)) cc = DEFERRED_FALLBACK;
    const target = req.nextUrl.clone();
    target.pathname = `/${cc}${path === "/" ? "" : path}`;
    const res = NextResponse.redirect(target, 307);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  return passThrough();
}

export const config = {
  /* Run on app routes; skip Next internals + API + static assets */
  matcher: ["/((?!_next|api|favicon|icon|apple-icon|robots|sitemap|opengraph-image|.*\\.).*)"],
};
