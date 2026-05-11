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
    return h === "google.com" || h.endsWith(".google.com");
  } catch {
    return false;
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
   when SerpAPI can't resolve it. */
async function resolveViaSerpApi(googleUrl: string): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return null;

  /* The relay URL contains a `prds=...productId...` segment we can
     extract. Without product_id we can't resolve.

     Round-4 QA caught a 400 from Google's consent gate when the
     resolver fell through. The relay URL's `prds` carries multiple
     IDs (catalogid, productid, headlineOfferDocid, gpcid, mid).
     SerpAPI's google_product endpoint specifically wants the
     PRODUCT_ID, not catalogid. The previous regex matched whichever
     came first (usually catalogid) → SerpAPI returned no sellers
     → resolver returned null → fallback redirected to the Google
     relay → Google's consent gate broke. Now: try productid first
     and fall back through the alternatives. */
  const candidateIds: string[] = [];
  try {
    const u = new URL(googleUrl);
    const prds = u.searchParams.get("prds") ?? "";
    /* Pull each id type in priority order. SerpAPI's google_product
       most often accepts the `productid:` value. catalogid + gpcid
       are SerpAPI-resolvable fallbacks. */
    const priorityKeys = ["productid", "catalogid", "gpcid"] as const;
    for (const key of priorityKeys) {
      const re = new RegExp(`${key}:(\\d+)`, "i");
      const m = prds.match(re);
      if (m && !candidateIds.includes(m[1])) candidateIds.push(m[1]);
    }
  } catch {/* fall through */}
  if (candidateIds.length === 0) return null;

  /* Try each candidate ID until one returns a usable merchant URL.
     Stops at the first hit so we burn at most one extra SerpAPI
     credit per failed lookup. */
  for (const productId of candidateIds) {
    const endpoint = new URL("https://serpapi.com/search.json");
    endpoint.searchParams.set("engine",     "google_product");
    endpoint.searchParams.set("product_id", productId);
    endpoint.searchParams.set("api_key",    apiKey);

    try {
      const res = await fetch(endpoint.toString(), { next: { revalidate: 0 } });
      if (!res.ok) continue;
      const data = (await res.json()) as SerpProductResponse;
      const sellers = data.sellers_results?.online_sellers
        ?? data.product_results?.sellers
        ?? [];
      for (const s of sellers) {
        const link = s.direct_link ?? s.link;
        if (link && !isGoogleRelay(link)) return link;
      }
    } catch {/* try next candidate */}
  }
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
  const country = getServerCountry();
  const ctx = { country: country.code };

  /* Missing url param: redirect home instead of returning a plain-text
     "Missing url" body. Chrome was interpreting the text/plain
     response as a download attachment with the filename "go.txt"
     (derived from the route name) instead of rendering inline.
     Bug surfaced for users when a deal card somehow had an empty
     url field. The empty-string param hit the early return and
     downloaded a junk file. */
  if (!target) {
    return NextResponse.redirect(
      new URL(`/${country.code}`, req.nextUrl.origin),
      307,
    );
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
     resolved a Google relay or had a direct URL to begin with. */
  const sendOut = (url: string) =>
    NextResponse.redirect(wrapWithAffiliate(url, ctx), 307);

  /* Direct merchant URLs pass through with a single redirect — but
     AliExpress URLs go through the API converter first when active,
     producing a proper s.click.aliexpress.com tracking link. */
  if (!isGoogleRelay(target)) {
    if (isAliexpress(target) && aliexpressApiActive()) {
      const tracked = await convertAliexpressUrl(target);
      if (tracked) return NextResponse.redirect(tracked, 307);
      // API call failed → fall through to wrapWithAffiliate fallback
    }
    return sendOut(target);
  }

  /* Google relay — try cache first, then SerpAPI. */
  const cached = await readCache(target);
  if (cached) return sendOut(cached);

  const resolved = await resolveViaSerpApi(target);
  if (resolved) {
    // Fire-and-forget — don't block redirect on cache write
    void writeCache(target, resolved);
    return sendOut(resolved);
  }

  /* Last resort — Google relay we couldn't resolve.

     Evolution of this fallback across QA rounds:
       Round 3: redirected to /[country]?deal_unavailable=1 → bad
         UX, user saw an apology banner with no next step.
       Round 4 (first try): redirected to the Google relay URL
         itself → Google's consent gate (consent.google.com)
         double-encoded the continue URL and returned 400. The
         user's report on this exact failure mode triggered the
         current fix.
       Round 4 (final): always redirect to a Havlo destination.
         With a title hint, send to /compare?q=<title> (alternative
         listings). Without a title hint, send to /[country]/deals
         (browse fresh deals). Never redirect to a Google URL —
         consent.google.com is unreliable across regions and
         routinely 400s on encoded continue params. */
  if (titleHint) {
    const compareUrl = new URL(`${req.nextUrl.origin}/${country.code}/compare`);
    compareUrl.searchParams.set("q", titleHint);
    /* Positive recovery (show alternatives), not an error — no
       deal_unavailable flag. */
    return NextResponse.redirect(compareUrl, 307);
  }
  /* No title, can't resolve. Send to the country /deals page so
     the user lands on a real Havlo destination (browse fresh deals)
     and can continue shopping. Strictly better than the Google
     consent 400 the previous fallback caused. */
  return NextResponse.redirect(
    new URL(`/${country.code}/deals`, req.nextUrl.origin),
    307,
  );
}
