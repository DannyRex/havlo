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
   Google relay. Used as a pre-filter so deals with un-clickable URLs
   never reach the user.

   Cases handled:
     1. /api/go?url=https://google.com/...    → reject
     2. /api/go?url=https://merchant.com/... → keep
     3. https://google.com/...               → reject
     4. https://merchant.com/...             → keep
     5. malformed / weird URLs               → keep (defensive — let
        /api/go's downstream logic handle it rather than over-filter) */
export function isUsableMerchantUrl(url: string): boolean {
  /* Internal /api/go redirect — peek at the underlying URL and reject
     when it points at Google. */
  if (url.startsWith("/api/go?url=")) {
    try {
      const encoded = url.slice("/api/go?url=".length).split("&")[0];
      const inner   = decodeURIComponent(encoded);
      const host    = new URL(inner).hostname.toLowerCase();
      return host !== "google.com" && !host.endsWith(".google.com");
    } catch {
      return true; // malformed → keep, /api/go can still handle it
    }
  }
  /* Direct Google URL (shouldn't appear in the DB but defend anyway). */
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host !== "google.com" && !host.endsWith(".google.com");
  } catch {
    return true;
  }
}
