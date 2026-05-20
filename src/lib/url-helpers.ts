/* Shared URL helpers for outbound merchant routing.

   Both the /deals browse path (browse-db.ts) and the /compare matcher
   (pg-fts.ts) need to drop offers whose stored URL points at
   Google-relay URLs that we can't reliably resolve to a real merchant
   page at click time. Without this filter, users click an offer, /api/go
   fails to resolve, and bounces them back to the homepage with
   ?deal_unavailable=1 — confusing UX (open new tab, immediate redirect
   home).

   See /api/go/route.ts for the resolution flow this helper guards. */

/* True if the stored URL points at a real merchant rather than a
   Google relay we can't resolve. Used as a pre-filter so deals with
   un-clickable URLs never reach the user.

   Cases handled (May 2026 — relaxed wrapped-URL handling after
   round-3 QA):
     1. /api/go?url=...                       → keep (always)
     2. https://google.com/...   (unwrapped)  → reject
     3. https://merchant.com/... (unwrapped)  → keep
     4. malformed / weird URLs                → keep (defensive — let
        /api/go's downstream logic handle it rather than over-filter)

   Why /api/go?url=https://google.com/... is now KEPT:
   The /api/go route resolves Google relay URLs via SerpAPI's
   product-detail endpoint (cached 30 days in resolved_clicks), so
   the click flow lands users on the actual merchant page. The QA
   round-3 pass surfaced the cost of the previous strict reject:
   100+ UK retailer rows (Argos, Currys, JL, Very, Boots, AO, M&S,
   Selfridges) had Google-relay URLs as their offer URL because
   SerpAPI's `link` field was empty for those results. The strict
   reject hid every one of them from /uk/deals.

   With the resolver active, accepting these costs ~1 SerpAPI
   credit per unique URL per 30 days (~100 / month for the UK
   retailer pool, well within budget). The user-facing win: UK
   retailers finally surface on /uk/deals + /uk/compare. */
/* True if the URL is a Google relay (Shopping / ad-redirect /
   syndication / doubleclick). Used to short-circuit relay handling
   at multiple layers — /api/go's resolver, the SSR pre-resolve in
   getClickThroughUrl (which replaces the relay with the merchant
   search URL so the rendered CTA href doesn't contain google.com).
   Mirrors the isGoogleRelay() in /api/go/route.ts; kept in sync. */
export function isGoogleRelay(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    /* All Google country-specific Shopping domains. Re-audit
       May 2026 caught a broken PDP whose stored URL was
       `https://www.google.co.uk/search?ibp=oshop&q=...` — the
       previous .google.com-only check missed it, so the SSR
       pre-resolve never fired and the CTA passed the raw Google
       URL through /api/go's passthrough branch, landing users
       on Google's search results page instead of the merchant.

       Pattern matches:
         google.com, www.google.com, shopping.google.com
         google.co.uk, www.google.co.uk
         google.de, google.fr, google.it, ...
         google.co.in, google.com.au, google.com.br, ... */
    if (h === "google.com" || h.endsWith(".google.com")) return true;
    if (/^(www\.)?google\.[a-z.]{2,8}(\/|$)/.test(h + "/")) return true;
    if (h === "googleadservices.com" || h.endsWith(".googleadservices.com")) return true;
    if (h === "googlesyndication.com" || h.endsWith(".googlesyndication.com")) return true;
    if (h === "doubleclick.net" || h.endsWith(".doubleclick.net")) return true;
    return false;
  } catch {
    return false;
  }
}

export function isUsableMerchantUrl(url: string): boolean {
  /* Internal /api/go wrapper — always keep. Resolver handles
     relay URLs at click time. */
  if (url.startsWith("/api/go?url=")) {
    return true;
  }
  /* Direct Google URL (shouldn't appear in the DB but defend anyway). */
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host !== "google.com" && !host.endsWith(".google.com");
  } catch {
    return true;
  }
}
