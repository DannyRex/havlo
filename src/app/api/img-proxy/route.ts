/* /api/img-proxy — referer-rewriting image proxy.

   Purpose: Amazon, ASOS, AliExpress (and most other retailer CDNs)
   reject requests with a Referer header pointing at any domain
   other than their own. The 'no Referer' or 'wrong Referer' result
   is a 4xx, so /ng homepage product cards rendered black panels
   instead of product photos (65 of 85 imgs failed in the QA audit).

   This route fetches the upstream image SERVER-SIDE with the right
   Referer for each known CDN, then streams the bytes back to the
   browser. Browser sees a same-origin image and caches normally.
   Edge runtime so the latency is region-local; the bytes don't
   round-trip through a Vercel function instance.

   Allowed hosts are an explicit whitelist — never an open proxy.
   Adding a new retailer means adding their image host here. */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/* CDN host → Referer to send when fetching.
   Empty string means 'omit Referer entirely'. Some CDNs prefer
   no Referer over a foreign one. */
const HOST_REFERER: Record<string, string> = {
  "m.media-amazon.com":               "https://www.amazon.com/",
  "images-na.ssl-images-amazon.com":  "https://www.amazon.com/",
  "images-eu.ssl-images-amazon.com":  "https://www.amazon.co.uk/",
  "media-amazon.com":                 "https://www.amazon.com/",
  "images.asos-media.com":            "https://www.asos.com/",
  "ae-pic-a1.aliexpress-media.com":   "https://www.aliexpress.com/",
  "ae-pic-a1.aliexpress.com":         "https://www.aliexpress.com/",
  "ae01.alicdn.com":                  "https://www.aliexpress.com/",
  "i5.walmartimages.com":             "https://www.walmart.com/",
  "i5.walmartimages.ca":              "https://www.walmart.ca/",
  "pisces.bbystatic.com":             "https://www.bestbuy.com/",
  "media.currys.biz":                 "https://www.currys.co.uk/",
  "johnlewis.scene7.com":             "https://www.johnlewis.com/",
  "media.johnlewiscontent.com":       "https://www.johnlewis.com/",
  "media.4rgos.it":                   "https://www.argos.co.uk/",
  "i.dell.com":                       "https://www.dell.com/",
  "image.boohooamplience.com":        "https://www.boohoo.com/",
  "img.shopstyle.com":                "https://www.shopstyle.com/",
  /* Konga, 3C Hub, Jumia don't enforce Referer; allow but no rewrite. */
  "www-konga-com-res.cloudinary.com": "",
  "www.3chub.com":                    "",
  "ng.jumia.is":                      "",
  "i.imgur.com":                      "",
  "upload.wikimedia.org":             "",
  "www.google.com":                   "",
  /* Slot Nigeria — uses api-prod.slot.ng for product images. Doesn't
     enforce Referer based on observed responses. Without this entry
     the proxy returned 403 for every Slot product image and cards
     showed the gradient + emoji fallback instead of the real photo. */
  "api-prod.slot.ng":                 "",
  /* Shopify CDN — every Shopify store (Supermart, HealthPlus,
     Essenza, future ones) serves product images from here. Open
     CDN, no Referer enforcement. Same fallback rationale as the
     direct-load whitelist in lib/utils.ts; this entry is the safety
     net for any code path that bypasses proxiedImageUrl(). */
  "cdn.shopify.com":                  "",
  /* DigitalOcean Spaces CDN — MedPlus product thumbnails live at
     {spacename}.{region}.cdn.digitaloceanspaces.com. The host
     allowlist matcher above falls through to subdomain-suffix
     matching, so the bare entry covers every regional variant
     (lon1, fra1, nyc3, sfo3, etc.) without per-region duplication. */
  "cdn.digitaloceanspaces.com":       "",
  /* DHgate image CDN — img1-img9.dhresource.com all serve product
     thumbs. Open, no Referer enforcement. */
  "dhresource.com":                   "",
  /* Google Shopping thumbnail CDN (encrypted-tbn0.gstatic.com etc.)
     — shows up when SerpAPI returns Google's own search-result
     image as the product photo. */
  "gstatic.com":                      "",
  /* AWS S3 — Bitmarte hosts product images at
     bitmarte-bucket.s3.eu-north-1.amazonaws.com. The proxy is the
     belt-and-braces backstop in case any code path bypasses the
     direct-load whitelist in lib/utils.ts. Open S3 buckets don't
     enforce Referer; sending the original would also be fine but
     omitting it avoids leaking the user's browsing context. */
  "amazonaws.com":                    "",
  /* SerpAPI cache CDN — google_images responses occasionally return
     a serpapi.com/searches/{id}/images/{token}.jpeg cached URL
     instead of the original merchant CDN. Open access, no Referer
     enforcement. Without this entry the proxy 403'd those rows
     even though the source returned 200 → users saw the Havlo H
     fallback on every affected PDP. May 2026 v3. */
  "serpapi.com":                      "",
  /* Kara (kara.com.ng) — special case. Kara serves EVERY product
     image from Cloudflare R2 with a 7-day pre-signed URL. There is
     NO permanent image URL anywhere on the site. Storing the
     signed URL at ingest worked for a week then 403'd for users.
     Solution: store the product PAGE URL as image_url, allow the
     proxy to fetch the page (kara.com.ng) and the resolved R2
     CDN (cloudflarestorage.com) here, and let the og:image
     resolution path below extract a fresh signed URL on every
     cache miss. With the proxy's 30-day cache TTL the practical
     cost is ~1 page fetch per product per day at peak. */
  "kara.com.ng":                      "",
  /* Cloudflare R2 — Kara's image CDN (resolved via og:image from
     a kara.com.ng product page). Whitelist needed because the
     redirect / og:image follow-fetch re-validates the resolved
     hostname against the allowlist. Open access, no Referer
     enforcement once you have a valid signed URL. */
  "r2.cloudflarestorage.com":         "",
};

/* Hosts whose URLs are HTML product pages (not direct image URLs).
   For these, the proxy fetches the page, extracts the og:image
   meta tag, then fetches THAT URL for the actual bytes. Used for
   merchants like Kara whose images live behind expiring signed URLs
   and have no permanent CDN URL we could store at ingest time.

   Detection runs BEFORE the host allowlist check (above) is used
   as the actual upstream — the proxy fetches the page (with the
   page host's referer policy), parses og:image, then re-validates
   the resolved image host against the same allowlist before
   fetching the bytes. */
const HTML_PAGE_HOSTS = new Set<string>([
  "kara.com.ng",
]);

/* Reasonable upper bound for cache lifetime. Product images don't
   change often; if a retailer rotates a CDN URL, our DB ingest will
   pick up the new one on the next refresh. */
const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  /* Only http(s). Reject file://, data:, etc. */
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return new NextResponse("Unsupported scheme", { status: 400 });
  }

  /* Host allowlist check — accept exact hostname match OR any
     subdomain of a roster entry. Lets a single roster entry like
     "cdn.digitaloceanspaces.com" cover every regional / spacename
     variant (commercefiles.lon1.cdn.digitaloceanspaces.com etc.)
     without per-region duplication. Mirrors the lib/utils.ts
     direct-load matcher. */
  function findRefererForHost(host: string): string | null {
    if (host in HOST_REFERER) return HOST_REFERER[host];
    for (const entry of Object.keys(HOST_REFERER)) {
      if (host.endsWith("." + entry)) return HOST_REFERER[entry];
    }
    return null;
  }
  const referer = findRefererForHost(target.hostname);
  if (referer === null) {
    return new NextResponse(`Host not allowed: ${target.hostname}`, { status: 403 });
  }

  /* HTML-page resolution. For hosts in HTML_PAGE_HOSTS (Kara today),
     the stored "image URL" is actually a product PAGE URL. We fetch
     the page, extract og:image (with twitter:image fallback), then
     re-target the fetch at that resolved image URL. The resolved
     host is re-validated against the same allowlist below so SSRF
     posture stays the same.

     Decoding: og:image values come straight out of HTML so they may
     be entity-encoded (`&amp;` instead of `&`). Decode the basic
     five before constructing the URL — Kara's R2 URLs have query-
     string ampersands that arrive as `&amp;`, and a raw new URL()
     would interpret those as literal characters.

     Cost: 1 extra fetch per cache miss (~100-200KB HTML). Edge cache
     amortizes this away after the first hit — typical Kara product
     page → 1 HTML fetch + 1 R2 fetch on cold cache, 0 fetches on
     warm cache for the next 30 days. */
  if (HTML_PAGE_HOSTS.has(target.hostname)) {
    let pageHtml = "";
    try {
      const pageRes = await fetch(target.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!pageRes.ok) {
        return new NextResponse(`Page fetch ${pageRes.status}`, { status: 502 });
      }
      pageHtml = await pageRes.text();
    } catch {
      return new NextResponse("Page fetch failed", { status: 502 });
    }

    /* Try og:image first (the spec-correct path), twitter:image as a
       fallback (some pages set one but not the other). Both regex
       variants handle the meta-attribute order swap that some
       templates emit. */
    const ogM = pageHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
             ?? pageHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
             ?? pageHtml.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (!ogM || !ogM[1]) {
      return new NextResponse("No og:image on page", { status: 404 });
    }
    const decoded = ogM[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    try {
      target = new URL(decoded);
    } catch {
      return new NextResponse("Invalid og:image URL", { status: 502 });
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return new NextResponse("Unsupported og:image scheme", { status: 400 });
    }
    /* Re-validate the resolved host against the same allowlist so
       og:image can't be an SSRF escape hatch. */
    const resolvedReferer = findRefererForHost(target.hostname);
    if (resolvedReferer === null) {
      return new NextResponse(`Resolved og:image host not allowed: ${target.hostname}`, { status: 403 });
    }
  }

  const headers: HeadersInit = {
    /* Use a real-browser UA. Some CDNs short-circuit on Bot/Lib UAs. */
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
  };
  /* Use the resolved host's referer rule (which may differ from the
     original target's — e.g. og:image resolved to r2.cloudflarestorage.com
     uses that host's referer policy, not kara.com.ng's). */
  const resolvedReferer = findRefererForHost(target.hostname);
  if (resolvedReferer) headers.Referer = resolvedReferer;

  /* Fetch with redirect:"manual" and re-validate every hop. An
     allowlisted host (e.g. any *.amazonaws.com S3 bucket) could
     otherwise 302 the proxy to an internal address; re-checking
     each redirect target against the same host allowlist + scheme
     check closes that SSRF-via-redirect gap. */
  let upstream: Response | undefined;
  try {
    let fetchTarget = target.toString();
    for (let hop = 0; hop < 4; hop++) {
      upstream = await fetch(fetchTarget, { headers, redirect: "manual" });
      if (upstream.status < 300 || upstream.status >= 400) break;
      const loc = upstream.headers.get("location");
      if (!loc) break;
      let next: URL;
      try {
        next = new URL(loc, fetchTarget);
      } catch {
        return new NextResponse("Invalid redirect target", { status: 502 });
      }
      if (next.protocol !== "https:" && next.protocol !== "http:") {
        return new NextResponse("Unsupported redirect scheme", { status: 400 });
      }
      if (findRefererForHost(next.hostname) === null) {
        return new NextResponse(`Redirect host not allowed: ${next.hostname}`, { status: 403 });
      }
      fetchTarget = next.toString();
    }
  } catch {
    return new NextResponse("Upstream fetch failed", { status: 502 });
  }

  if (!upstream || !upstream.ok || !upstream.body) {
    return new NextResponse(`Upstream ${upstream?.status ?? "error"}`, { status: 502 });
  }

  /* Stream the body straight through. Long cache so the browser /
     edge layer takes over after the first hit. */
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(upstream.body, {
    status:  200,
    headers: {
      "Content-Type":  contentType,
      "Cache-Control": `public, max-age=${ONE_MONTH_SECONDS}, s-maxage=${ONE_MONTH_SECONDS}, immutable`,
      "Vary":          "Accept",
    },
  });
}
