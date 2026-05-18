/* /api/go — outbound click redirector.
   Two responsibilities:
     1. Optional: log analytics about which deal was clicked
        (kept fire-and-forget so click latency isn't affected).
     2. Resolve Google-relay URLs (https://www.google.com/...&prds=...)
        to the actual merchant URL via SerpAPI's product-detail endpoint.
        Caches resolved URLs for 30 days so we only pay 1 credit per
        relay URL across all users.

   Request:
     GET /api/go?url=<encoded-target>&id=<optional-deal-id>

   Response:
     307 to the resolved merchant URL. Falls back to the input URL
     when resolution fails (better than 500-ing the click).
*/

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { wrapWithAffiliate } from "@/lib/affiliate";
import { convertAliexpressUrl, aliexpressApiActive } from "@/lib/aliexpress-converter";
import { getServerCountry } from "@/lib/country-server";
import { merchantSearchUrl, merchantHomepage, smartFallbackUrl, rewriteUbuyHostForCountry } from "@/lib/merchant-search-urls";

/* Click-resolution telemetry. Every redirect writes one row to
   click_resolutions so we can debug "this click went to the wrong
   URL" by querying the log instead of guessing from screenshots.
   See scripts/db/0021-click-resolutions.sql for the schema +
   convenience view (click_resolutions_recent_by_store). */
type ResolutionStep =
  | "passthrough"
  | "cache_hit"
  | "serpapi_resolved"
  | "merchant_search"
  | "smart_fallback"
  | "merchant_homepage"
  | "havlo_compare"
  | "havlo_deals"
  | "missing_url";

interface LogInput {
  offerId:        string | null;
  storeId:        string | null;
  storeName:      string | null;
  titleHint:      string | null;
  originalUrl:    string;
  resolvedUrl:    string;
  step:           ResolutionStep;
  country:        string | null;
  serpapiAttempted: boolean;
  serpapiResolved:  boolean;
  userAgent:      string | null;
  referer:        string | null;
}

/* Fire-and-forget — never await the insert from the request path so
   click latency stays at "one redirect". If the DB write fails the
   click still goes through; we lose the telemetry row, not the
   redirect. Errors swallowed so a transient Supabase blip never
   leaks a 500 to the user. */
function logResolution(input: LogInput): void {
  void (async () => {
    try {
      const supa = getSupabaseAdmin();
      if (!supa) return;
      await supa.from("click_resolutions").insert({
        offer_id:          input.offerId,
        store_id:          input.storeId,
        store_name:        input.storeName,
        title_hint:        input.titleHint,
        original_url:      input.originalUrl,
        resolved_url:      input.resolvedUrl,
        resolution_step:   input.step,
        country:           input.country,
        serpapi_attempted: input.serpapiAttempted,
        serpapi_resolved:  input.serpapiResolved,
        user_agent:        input.userAgent?.slice(0, 500) ?? null,
        referer:           input.referer?.slice(0, 500) ?? null,
      });
    } catch {/* swallow — telemetry must never break the redirect path */}
  })();
}

interface ResolvedRow {
  resolved_url: string;
  resolved_at:  string;
}

interface SerpProductSeller {
  link?:           string;
  direct_link?:    string;
  base_price?:     string;
  total_price?:    string;
  name?:           string;
}
interface SerpProductResponse {
  sellers_results?: { online_sellers?: SerpProductSeller[] };
  product_results?: { sellers?: SerpProductSeller[] };
}

function isGoogleRelay(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    /* google.com + subdomains — Google Shopping relays (?prds=...),
       Google's own /url?q= redirect wrapper. */
    if (h === "google.com" || h.endsWith(".google.com")) return true;
    /* Google's ad-redirect infrastructure. SerpAPI sometimes stores
       these as the offer URL when the click came from a Google
       Shopping ad rather than an organic listing. Without this
       branch, /api/go's passthrough sent the user to googleads
       (often a tracking pixel + bounce-back to a stale URL) and
       the audit caught the destination as "google.com" in the
       redirect chain. May 2026 launch-readiness audit B4 fix. */
    if (h === "googleadservices.com" || h.endsWith(".googleadservices.com")) return true;
    if (h === "googlesyndication.com" || h.endsWith(".googlesyndication.com")) return true;
    if (h === "doubleclick.net" || h.endsWith(".doubleclick.net")) return true;
    /* Google Shopping aggregator domains. */
    if (h === "shopping.google.com") return true;  // covered by .google.com above; explicit for grep
    return false;
  } catch {
    return false;
  }
}

/* Verify a URL's hostname matches the merchant the user clicked.
   SerpAPI's google_product resolver returns the FIRST online seller
   for a Google Shopping product, which is not necessarily the
   merchant whose card the user clicked on Havlo. User report May
   2026 (US retest): "View at Fashion Nova" outbound was routing
   somewhere other than fashionnova.com — likely because SerpAPI
   resolved the Google relay to a Walmart-third-party-seller URL
   (Walmart listing a Fashion Nova item) and we passed that through
   as "the resolved merchant link." The result: user clicks Fashion
   Nova, lands on Walmart, never reaches Fashion Nova.

   Fix: when we have a strong storeIdHint / storeNameHint and SerpAPI
   returns a URL, verify the URL's hostname matches the merchant the
   user clicked. On mismatch, treat the SerpAPI result as if it
   failed and fall through to merchant_search (which DOES route to
   the right merchant, just on their search page rather than the
   specific product page).

   Hostname comparison strips `www.` and accepts subdomain matches
   (so `shop.fashionnova.com` matches `fashionnova.com`). */
function hostnameMatchesStore(
  url: string,
  storeId: string | null | undefined,
  storeName: string | null | undefined,
): boolean {
  try {
    const got = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    /* Defensive: a Google relay URL is NEVER a valid resolved
       destination. Without this, cached google.com URLs were leaking
       through cache_hit when the merchant wasn't in our table:
       hostnameMatchesStore was returning true (permissive default),
       sendOut sent the user to Google instead of falling through to
       merchant_search / smart_fallback. Re-audit May 2026 caught
       9 of 15 US PDP CTAs landing on google.com because of this. */
    if (got === "google.com" || got.endsWith(".google.com")) return false;
    if (got === "googleadservices.com" || got.endsWith(".googleadservices.com")) return false;
    if (got === "googlesyndication.com" || got.endsWith(".googlesyndication.com")) return false;
    if (got === "doubleclick.net" || got.endsWith(".doubleclick.net")) return false;
    /* Reuse the curated merchant homepage as the source of truth for
       the expected hostname. If we don't know the merchant at all,
       skip the check (no signal to validate against). */
    const m = merchantHomepage(storeId ?? "", storeName ?? "");
    if (!m) return true;
    const expected = new URL(m.url).hostname.toLowerCase().replace(/^www\./, "");
    if (got === expected) return true;
    if (got.endsWith("." + expected)) return true;
    if (expected.endsWith("." + got)) return true;
    return false;
  } catch {
    /* Malformed URL — be permissive so we don't drop otherwise-good
       redirects on a parser quirk. */
    return true;
  }
}

/* Lookup a previously-resolved URL from the cache table.
   Schema (create on demand):
     CREATE TABLE resolved_clicks (
       source_url   text PRIMARY KEY,
       resolved_url text NOT NULL,
       resolved_at  timestamptz DEFAULT now()
     ); */
async function readCache(sourceUrl: string): Promise<string | null> {
  const supa = getSupabaseAdmin();
  if (!supa) return null;
  const { data } = await supa
    .from("resolved_clicks")
    .select("resolved_url, resolved_at")
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (!data) return null;
  // 30-day TTL
  const age = Date.now() - new Date((data as ResolvedRow).resolved_at).getTime();
  if (age > 30 * 86400 * 1000) return null;
  return (data as ResolvedRow).resolved_url;
}

async function writeCache(sourceUrl: string, resolvedUrl: string) {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  await supa.from("resolved_clicks").upsert(
    { source_url: sourceUrl, resolved_url: resolvedUrl, resolved_at: new Date().toISOString() },
    { onConflict: "source_url" },
  );
}

/* Resolve a Google Shopping relay URL via SerpAPI's product endpoint.
   Returns the first online seller's direct merchant link, or null
   when SerpAPI can't resolve it.

   ─── KILLED May 2026 ──────────────────────────────────────────────
   Google deprecated the Shopping Product API. SerpAPI now returns
   400 with body `{"error": "The Google Product service is no longer
   offered by Google."}` for every google_product call regardless of
   product_id type (productid / catalogid / gpcid all 400). Verified
   via scripts/_probe-serpapi-direct.ts against three real audit
   IDs from UK / US / DE markets.

   The May 2026 38-row resolver audit caught the downstream effect:
   0/30 relay=Y rows produced a pdp-ok outcome. click_resolutions
   telemetry confirmed 28/28 logged audit clicks had
   serpapi_attempted=true, serpapi_resolved=false — every single
   click was burning a SerpAPI credit on a dead endpoint AND adding
   ~200ms latency before falling through to merchant_search.

   `google_shopping` is NOT a replacement — its results also link
   to www.google.com (another relay), so we'd need a second click-
   through anyway. There's no current SerpAPI engine that returns
   direct merchant PDP URLs for Google Shopping product IDs.

   Real fix (queued): resolve relay URLs at INGEST time, not click
   time. The Playwright fleet that already scrapes catalogs can
   visit each Google relay during ingest, capture the final
   merchant URL after redirects, and store THAT in `offers.url`.
   Click-time becomes pure passthrough. Eliminates SerpAPI cost
   entirely + makes click resolution instant.

   Until that ships: short-circuit here so we don't burn credits +
   latency on a known-dead endpoint. Behaviour upstream is
   identical to the old "resolveViaSerpApi returned null" path —
   the GET handler still fires its merchant_search fallback chain.
   Telemetry log step stays "merchant_search" (the actual outcome)
   but serpapi_attempted now correctly reads `false`. */
async function resolveViaSerpApi(_googleUrl: string): Promise<string | null> {
  return null;
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  /* Optional title hint passed through from the deal card click. When
     the merchant resolution fails downstream, we use this to send the
     user to /compare?q=<title> instead of bouncing home — they get
     to see alternative listings for the same product instead of
     a 'deal_unavailable' message with no recovery path. */
  const titleHint = req.nextUrl.searchParams.get("title")?.trim() ?? "";
  /* Store hints (round-4 fallback improvement). When the Google
     relay resolver fails, we use these to build a merchant search
     URL — argos.co.uk/search?q=<title> rather than bouncing to
     havlo. User feedback: "there's no reason this shouldn't point
     to the actual website even if it means taking them to the
     product search page". */
  const storeIdHint   = req.nextUrl.searchParams.get("store")?.trim()     ?? "";
  const storeNameHint = req.nextUrl.searchParams.get("storeName")?.trim() ?? "";
  const offerIdHint   = req.nextUrl.searchParams.get("id")?.trim()        ?? "";
  const country = getServerCountry();
  const ctx = { country: country.code };

  /* Shared telemetry context. Each redirect branch calls logResolution
     with the same baseline + its own step + resolved URL. */
  const userAgent = req.headers.get("user-agent");
  const referer   = req.headers.get("referer");
  const baseLog = {
    offerId:      offerIdHint || null,
    storeId:      storeIdHint || null,
    storeName:    storeNameHint || null,
    titleHint:    titleHint || null,
    originalUrl:  target ?? "",
    country:      country.code,
    userAgent,
    referer,
  };

  /* Missing url param: redirect home instead of returning a plain-text
     "Missing url" body. Chrome was interpreting the text/plain
     response as a download attachment with the filename "go.txt"
     (derived from the route name) instead of rendering inline.
     Bug surfaced for users when a deal card somehow had an empty
     url field. The empty-string param hit the early return and
     downloaded a junk file. */
  if (!target) {
    const homeUrl = new URL(`/${country.code}`, req.nextUrl.origin).toString();
    logResolution({ ...baseLog, originalUrl: "", resolvedUrl: homeUrl, step: "missing_url", serpapiAttempted: false, serpapiResolved: false });
    return NextResponse.redirect(homeUrl, 307);
  }

  /* AliExpress: prefer the official API converter (proper attribution,
     full commission rates) over the ?aff_short_key= fallback. Falls
     back gracefully if the API call fails or credentials aren't set. */
  function isAliexpress(u: string): boolean {
    try {
      return /(^|\.)aliexpress\.(com|us)$/i.test(new URL(u).host);
    } catch { return false; }
  }

  /* Final redirect helper — wraps the resolved URL with the right
     affiliate tag (when any) right before sending the user out. The
     wrap is the LAST step so it applies regardless of whether we
     resolved a Google relay or had a direct URL to begin with.
     The telemetry log captures the PRE-wrap URL so we can see the
     resolver's decision separately from the affiliate tag layer. */
  const sendOut = (url: string, step: ResolutionStep, opts: { serpapiAttempted?: boolean; serpapiResolved?: boolean } = {}) => {
    /* Country-routed host rewrites BEFORE affiliate wrapping. Catches
       stored-URL hosts that don't serve the visitor's market —
       currently just bare ubuy.com → country subdomain (verified
       user-reported broken CTA May 2026 v3). The rewrite is keyed
       on hostname so it's safe to call on every URL: non-matching
       hosts pass through unchanged. Without this, fixing
       merchantSearchUrl alone wouldn't help — ingestion-stored
       URLs flow through the passthrough branch and never hit
       merchantSearchUrl. */
    const normalised = rewriteUbuyHostForCountry(url, country.code);
    const wrapped = wrapWithAffiliate(normalised, ctx).toString();
    logResolution({
      ...baseLog,
      resolvedUrl: normalised,
      step,
      serpapiAttempted: opts.serpapiAttempted ?? false,
      serpapiResolved:  opts.serpapiResolved  ?? false,
    });
    return NextResponse.redirect(wrapped, 307);
  };

  /* Direct merchant URLs pass through with a single redirect — but
     AliExpress URLs go through the API converter first when active,
     producing a proper s.click.aliexpress.com tracking link. */
  if (!isGoogleRelay(target)) {
    if (isAliexpress(target) && aliexpressApiActive()) {
      const tracked = await convertAliexpressUrl(target);
      if (tracked) {
        logResolution({ ...baseLog, resolvedUrl: tracked, step: "passthrough", serpapiAttempted: false, serpapiResolved: false });
        return NextResponse.redirect(tracked, 307);
      }
      // API call failed → fall through to wrapWithAffiliate fallback
    }
    return sendOut(target, "passthrough");
  }

  /* Google relay — try cache first, then SerpAPI. */
  const cached = await readCache(target);
  if (cached) {
    /* Same hostname guard as the live resolve path below — a cached
       wrong-merchant URL is just as bad as a fresh one. */
    if (!storeIdHint && !storeNameHint) return sendOut(cached, "cache_hit");
    if (hostnameMatchesStore(cached, storeIdHint, storeNameHint)) return sendOut(cached, "cache_hit");
    /* Cached URL points at a different merchant than the user
       clicked — skip it and fall through to merchant_search. The
       cache stamp stays in place; subsequent identical relays for
       OTHER stores might legitimately resolve to that URL. */
  }

  const resolved = await resolveViaSerpApi(target);
  if (resolved) {
    /* Hostname verification — only trust the SerpAPI result if its
       hostname matches the merchant the user clicked. Without this,
       a Fashion-Nova-tagged Google relay can resolve to a Walmart
       seller page and we'd happily redirect there (May 2026 user
       report). Falls through to merchant_search on mismatch. */
    const trustResolved = (!storeIdHint && !storeNameHint) || hostnameMatchesStore(resolved, storeIdHint, storeNameHint);
    if (trustResolved) {
      // Fire-and-forget — don't block redirect on cache write
      void writeCache(target, resolved);
      return sendOut(resolved, "serpapi_resolved", { serpapiAttempted: true, serpapiResolved: true });
    }
    /* serpapi_resolved fired but hostname mismatched — log a
       diagnostic row so we can see how often this safety net
       trips, then fall through. */
    logResolution({
      ...baseLog,
      resolvedUrl: resolved,
      step:        "serpapi_resolved",
      serpapiAttempted: true,
      serpapiResolved:  true,
    });
  }

  /* Last resort — Google relay we couldn't resolve.

     Evolution of this fallback across QA rounds:
       Round 3: redirected to /[country]?deal_unavailable=1 → bad
         UX, user saw an apology banner with no next step.
       Round 4 (first try): redirected to the Google relay URL
         itself → Google's consent gate 400'd on the encoded
         continue param.
       Round 4 (second try): redirected back to havlo /compare or
         /deals → user feedback: "bringing the user back to havlo
         is quite unusable; even taking them to the product search
         page on the merchant would be better".
       Round 4 (current): MERCHANT-FIRST fallback chain.
         1. Build a merchant-specific search URL using the storeId
            + title hint (e.g. argos.co.uk/search/iPhone+17+Pro/,
            currys.co.uk/search?q=Galaxy+S26+Ultra). User lands on
            the actual retailer's site even if not on the specific
            product page.
         2. If we know the merchant but have no title to search
            with, send them to the merchant's homepage.
         3. Only if BOTH the merchant lookup AND the title hint
            fail do we fall back to havlo: /compare?q=<title> when
            we have one, or /deals as last resort. */

  /* Step 1: curated merchant search URL when we know the store +
     title and the store is in our hand-built table.

     serpapiAttempted is now `false` everywhere in this fallback
     chain — resolveViaSerpApi was short-circuited May 2026 after
     the google_product API deprecation (see comment on that
     function). The telemetry truth: we no longer make SerpAPI
     calls for Google relays. The flag staying `true` here would
     be a lie that distorts every cost / efficacy analysis. */
  if (titleHint && (storeIdHint || storeNameHint)) {
    /* country.code threaded through so country-routed merchants
       (e.g. Ubuy, which lives on per-country subdomains) can land
       the visitor on inventory they can actually buy. Verified
       fix May 2026 v3 — Ubuy CTAs were routing to ubuy.com (a
       global country-selector landing page that returns no
       product results) instead of ubuy.com.ng for NG visitors. */
    const m = merchantSearchUrl(storeIdHint, storeNameHint, titleHint, country.code);
    if (m) return sendOut(m.url, "merchant_search", { serpapiAttempted: false, serpapiResolved: false });
  }

  /* Step 2: smart fallback for long-tail merchants not in the
     curated table. Strategies (per user feedback: never bounce to
     Google, because that defeats Havlo's value prop — a shopper
     could've gone to Google themselves):
       a) storeName / storeId looks like a domain → merchant
          homepage. ("x-kom.de" → "https://x-kom.de".)
       b) storeName looks like a plausible multi-word brand →
          try "<slug>.com". ("Cricket Wireless" →
          "https://cricketwireless.com". Best-effort: most real
          retailers own their obvious brand domain.)
     When neither fires, fall through to Havlo /compare. */
  if (storeIdHint || storeNameHint) {
    const m = smartFallbackUrl(storeIdHint, storeNameHint, titleHint);
    if (m) return sendOut(m.url, "smart_fallback", { serpapiAttempted: false, serpapiResolved: false });
  }

  /* Step 3: merchant homepage from the curated table when we have a
     store but no title and smart fallback didn't fire. */
  if (storeIdHint || storeNameHint) {
    const m = merchantHomepage(storeIdHint, storeNameHint);
    if (m) return sendOut(m.url, "merchant_homepage", { serpapiAttempted: false, serpapiResolved: false });
  }

  /* Step 4: havlo /compare when we have a title but absolutely no
     merchant signal. User sees alternative listings for the same
     product — still useful. */
  if (titleHint) {
    const compareUrl = new URL(`${req.nextUrl.origin}/${country.code}/compare`);
    compareUrl.searchParams.set("q", titleHint);
    logResolution({ ...baseLog, resolvedUrl: compareUrl.toString(), step: "havlo_compare", serpapiAttempted: false, serpapiResolved: false });
    return NextResponse.redirect(compareUrl, 307);
  }

  /* Step 5: absolute last resort — havlo /deals. Reached only when
     we have neither merchant nor title information AND can't resolve
     the relay URL. Rare. */
  const dealsUrl = new URL(`/${country.code}/deals`, req.nextUrl.origin).toString();
  logResolution({ ...baseLog, resolvedUrl: dealsUrl, step: "havlo_deals", serpapiAttempted: false, serpapiResolved: false });
  return NextResponse.redirect(dealsUrl, 307);
}
