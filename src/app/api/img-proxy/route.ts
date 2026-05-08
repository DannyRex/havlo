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
};

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

  if (!(target.hostname in HOST_REFERER)) {
    return new NextResponse(`Host not allowed: ${target.hostname}`, { status: 403 });
  }

  const referer = HOST_REFERER[target.hostname];
  const headers: HeadersInit = {
    /* Use a real-browser UA. Some CDNs short-circuit on Bot/Lib UAs. */
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
  };
  if (referer) headers.Referer = referer;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { headers, redirect: "follow" });
  } catch {
    return new NextResponse("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
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
