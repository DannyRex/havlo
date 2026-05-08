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
  "contact", "privacy-policy", "terms-of-use", "disclaimer",
]);

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const seg = path.split("/")[1]?.toLowerCase() ?? "";

  /* Case 1: URL has a valid country prefix → sync cookie if it differs */
  if (SUPPORTED.has(seg)) {
    const cookieVal = req.cookies.get(COUNTRY_COOKIE)?.value;
    if (cookieVal === seg) return NextResponse.next();

    req.cookies.set(COUNTRY_COOKIE, seg);
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set({
      name:     COUNTRY_COOKIE,
      value:    seg,
      maxAge:   60 * 60 * 24 * 365,
      sameSite: "lax",
      path:     "/",
    });
    return res;
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
    const cc       = (cookieCc && SUPPORTED.has(cookieCc)) ? cookieCc : (geoCc ?? "ng");
    const target = req.nextUrl.clone();
    target.pathname = `/${cc}${path === "/" ? "" : path}`;
    const res = NextResponse.redirect(target, 307);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  /* Run on app routes; skip Next internals + API + static assets */
  matcher: ["/((?!_next|api|favicon|icon|apple-icon|robots|sitemap|opengraph-image|.*\\.).*)"],
};
