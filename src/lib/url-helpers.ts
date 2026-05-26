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

/* Tracking-only query parameters that vary across scrapes for the
   same logical product. Stripping these at ingest time keeps the
   (store_id, url) uniqueness constraint from creating new offer rows
   every cron just because the tracking suffix rotated.

   Inclusion criteria for each entry:
     1. Carries no functional information (removing it lands the user
        on the SAME product page, not a different one).
     2. Observed to rotate across our scrapes (verified case-by-case
        before adding).
     3. Universal across merchants OR namespaced to a specific known-
        tracking class (Shopify pagination, UTM, common ad networks).

   Phase 3 audit (May 2026) found:
     - threechub stored 27 offers for one Infinix phone because every
       cron yielded different ?_pos=&_fid=&_ss= values
     - konga stored 25 offers per PS4 controller because ?cid= varied
     - currys / many SerpAPI ingest rows had different ?utm_* sources
   All driven by the same root cause. */
const STRIP_QUERY_PARAMS = new Set<string>([
  /* Shopify pagination + collection-position tracking */
  "_pos", "_fid", "_ss", "_psq", "_sid", "_pos_search",
  /* Universal UTM family */
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "utm_brand",
  /* Google Ads / Analytics click ids */
  "gclid", "gclsrc", "dclid", "wbraid", "gbraid",
  /* Facebook + Instagram click ids */
  "fbclid",
  /* Microsoft Ads */
  "msclkid",
  /* TikTok */
  "ttclid",
  /* Konga campaign id (rotates per ingest, not a product variant) */
  "cid",
  /* General affiliate / ref vectors */
  "ref", "ref_", "referrer", "refsrc", "refid", "ref_url",
  /* Mailchimp / email click tracking */
  "mc_eid", "mc_cid",
  /* Amazon affiliate tag — re-applied at click time via /api/go,
     not used for product identity */
  "tag", "linkCode", "psc", "ascsubtag",
  /* Trackonomics / impactRadius / rakuten-style affiliate ids */
  "irgwc", "irclickid", "rakuten_subid",
  /* SerpAPI source-of-traffic markers */
  "spm",
]);

/** Drop tracking-only query parameters from a URL. Preserves the path,
    hash, and any non-tracking params (which we assume carry product
    state). On parse failure (malformed URL, internal path like
    `/api/go?url=…`) returns the input unchanged — better to keep the
    original than risk mangling it.

    Pure function, idempotent, safe to call on already-canonical URLs. */
export function canonicaliseOfferUrl(raw: string): string {
  if (!raw) return raw;
  /* Don't touch internal /api/go wrappers — those need their query
     intact to route the click. */
  if (raw.startsWith("/api/go")) return raw;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return raw; }
  /* Iterate keys and delete those in the strip list (case-insensitive). */
  const toDelete: string[] = [];
  parsed.searchParams.forEach((_value, key) => {
    if (STRIP_QUERY_PARAMS.has(key.toLowerCase())) toDelete.push(key);
  });
  for (const k of toDelete) parsed.searchParams.delete(k);
  /* Drop trailing '?' if the strip emptied the query string entirely. */
  return parsed.toString().replace(/\?$/, "");
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
