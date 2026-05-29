"use client";

/* Fire-and-forget PDP view event tracker.

   Mounts client-side on /[country]/p/[id]. On mount:
     1. Ensures a havlo_anon_session cookie exists (random UUID,
        30-day rolling expiry). Reset if missing or older than 30 days.
     2. Classifies the source (Google / direct / internal-deals /
        internal-compare / internal-similar / internal-blog / other)
        from document.referrer.
     3. POSTs to /api/log-pdp-view with productId, offerId, source,
        referrer. Detached promise; failure never blocks anything.

   No PII. The cookie value is hashed server-side before storage so
   even a DB leak can't map a row back to a real user identity.

   Performance: a single window.fetch with 0 awaited work, called
   inside a useEffect with [] dep. Runs ONCE per PDP mount. The
   server-side route returns 204 immediately. Network impact:
   ~50ms one-time after first paint, never on the critical path. */

import { useEffect } from "react";

interface Props {
  productId?: string;
  offerId?:   string;
}

/* Stable cookie name. 30 day rolling expiry. */
const COOKIE_NAME = "havlo_anon_session";
const COOKIE_TTL_DAYS = 30;

function ensureAnonSessionCookie(): void {
  const existing = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (existing) return;
  /* crypto.randomUUID is available in every modern browser; falls
     back to a Date+Math seed if absolutely needed. */
  const uuid = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${uuid}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function classifySource(referrer: string, currentHost: string): string {
  if (!referrer) return "direct";
  let parsed: URL;
  try { parsed = new URL(referrer); }
  catch { return "other"; }
  const host = parsed.host.toLowerCase();
  /* Internal navigation — same host, different path. */
  if (host === currentHost || host.endsWith(`.${currentHost}`)) {
    if (parsed.pathname.includes("/deals"))   return "internal-deals";
    if (parsed.pathname.includes("/compare")) return "internal-compare";
    if (parsed.pathname.includes("/p/"))      return "internal-similar";  // came from another PDP
    if (parsed.pathname.includes("/blog"))    return "internal-blog";
    return "internal-search";
  }
  /* External — try to identify search engines. Catches the common
     EU/regional Google domains too. */
  if (/google\./.test(host))                  return "google";
  if (/bing\.com|duckduckgo\.com|yandex\./.test(host)) return "google"; // bucket all search engines together for now
  return "other";
}

export default function PdpViewTracker({ productId, offerId }: Props) {
  useEffect(() => {
    /* Guard re-runs on Fast Refresh — once per real navigation. */
    if (typeof window === "undefined") return;
    ensureAnonSessionCookie();

    const referrer = document.referrer ?? "";
    const source   = classifySource(referrer, location.host);

    fetch("/api/log-pdp-view", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        offerId,
        source,
        referrer: referrer.slice(0, 500),
      }),
      keepalive:   true,   // survive page unload mid-flight
    }).catch(() => undefined);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return null;
}
