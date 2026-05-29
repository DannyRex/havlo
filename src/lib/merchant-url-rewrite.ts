/* Per-merchant URL rewriter for known-broken click destinations.

   Background: SerpAPI's `link` field for some merchants returns
   affiliate/lander URLs that don't resolve to the actual product
   page. The clearest case so far is The Range — SerpAPI returns
   `https://therange.com/lander` (wrong domain — .com not .co.uk,
   and `/lander` is an internal affiliate redirect that no longer
   routes), so every click lands the user on an error page.

   Strategy: pure functional rewriter, keyed by storeId. Called at
   ingest time (before the row hits the offers table) so the
   broken URL never makes it into the DB. Idempotent — already-
   correct URLs pass through unchanged.

   Falls back to a search URL on the merchant's real domain using
   the deal title. Less precise than a direct product link but
   guaranteed to land the user on a relevant page at the right
   merchant. Better UX than a 404.

   Add new entries here when a merchant's SerpAPI URL pattern is
   identified as systematically broken. Each entry is a function
   that takes the raw URL + deal title and returns either the
   corrected URL or the input unchanged. */

type MerchantUrlRewriter = (rawUrl: string, dealTitle: string) => string;

const REWRITERS: Record<string, MerchantUrlRewriter> = {
  /* The Range (UK home + lifestyle).
     SerpAPI returns: https://therange.com/lander?...
     Correct domain: https://www.therange.co.uk/...
     Rewrite to:     https://www.therange.co.uk/search?q=<title>
     A search-by-title URL is the safest fallback — Range's search
     reliably matches single-product queries, and the alternative
     (homepage) loses the visitor at click time. */
  "the-range": (rawUrl, dealTitle) => {
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      if (host === "therange.com" || host === "www.therange.com") {
        const q = encodeURIComponent(dealTitle.trim());
        return `https://www.therange.co.uk/search?q=${q}`;
      }
    } catch {
      /* Malformed URL — leave it alone. Downstream filters
         (isUsableMerchantUrl) will catch it. */
    }
    return rawUrl;
  },
};

/** Rewrite a merchant URL when the storeId has a known-broken
    URL pattern. Returns the input unchanged for stores without
    a registered rewriter. Pure function, idempotent. */
export function rewriteMerchantUrl(
  rawUrl: string,
  storeId: string,
  dealTitle: string,
): string {
  const fn = REWRITERS[storeId];
  return fn ? fn(rawUrl, dealTitle) : rawUrl;
}
