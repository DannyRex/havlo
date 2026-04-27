/* Middleware — keeps the country cookie in sync with the URL.

   When the URL has a /[country]/ prefix and the cookie doesn't match,
   we mutate the request cookie store (so getServerCountry() in this
   render sees the new value) AND set the response cookie (so future
   requests carry it).

   Only fires on top-level country routes; static assets and APIs are
   excluded via the matcher. */

import { NextResponse, type NextRequest } from "next/server";

const SUPPORTED = new Set(["ng", "us", "ae", "de", "in", "za"]);
const COUNTRY_COOKIE = "havlo-country";

/* Pages that exist under /[country]/ and should be redirected to the
   user's country prefix when accessed bare (e.g. /deals → /uk/deals).
   Anything not in this list passes through untouched. */
const COUNTRY_SCOPED = new Set(["", "deals", "compare"]);

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
     to /{cookieCountry}/<rest>. Lets existing internal Links keep using
     unprefixed hrefs while the URL stays canonical.

     IMPORTANT: 307 (temporary) NOT 308 (permanent). Browsers cache 308
     forever — once a user redirects /deals → /ng/deals as 308, switching
     country to UK and clicking /deals still routes to /ng/deals from
     cache without re-checking middleware. 307 + the no-cache header
     keeps the redirect dynamic. */
  if (COUNTRY_SCOPED.has(seg) && !GLOBAL_PAGES.has(seg)) {
    const cc = req.cookies.get(COUNTRY_COOKIE)?.value ?? "ng";
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
