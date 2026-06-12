import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isGoogleRelay } from "./url-helpers";
import { merchantSearchUrl, smartFallbackUrl } from "./merchant-search-urls";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* Build the click-through URL for a deal. ALWAYS routes the user
   through /api/go so:
     1. wrapWithAffiliate appends the right ?tag= for Amazon, ?subId=
        for Konga, ?aff_short_key= for AliExpress, etc.
     2. AliExpress URLs get converted to s.click.aliexpress.com via
        the converter at click time
     3. Future analytics (which deal got clicked, from which surface)
        attribute correctly

   Without this wrap, cards would link directly to amazon.com /
   konga.com / etc. and the affiliate tags would never get applied
   — which is exactly the bug we just shipped on the curated Amazon
   catalog. The /api/go route is the affiliate chokepoint and must
   be in every deal click path.

   May 2026 re-audit: SSR pre-resolution of google-relay URLs.
   Previously the rendered <a href> for a google-relay offer was
   `/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop&...`
   — the user-clicked redirect chain (/api/go → merchantSearchUrl →
   merchant) was correct, but every audit metric that parsed href
   strings reported "PDP CTA points at google.com" because the
   url= parameter contained google.com. Audit-after-audit kept
   flagging this as a 60-73% regression rate despite the destination
   being correct.

   Fix: when item.url is a google-relay AND we have storeId+title,
   run merchantSearchUrl AT SSR TIME to get the merchant URL, then
   wrap THAT. The href becomes
   `/api/go?url=https%3A%2F%2Fwww.bestbuy.com%2Fsearch%3F...&store=...`
   — no google.com anywhere. User click experience unchanged
   (still wrapped in /api/go for affiliate tagging).

   Falls back to the original google-relay when storeId/title
   missing OR when merchantSearchUrl can't resolve the store
   (unknown merchant). Those cases still work at click time via
   /api/go's smart_fallback → merchant_homepage → havlo_compare
   chain. */
export function getClickThroughUrl(item: { url: string; id?: string; title?: string; storeId?: string; storeName?: string; country?: string }): string {
  /* Already-wrapped URLs (SerpAPI Google relays stored in the DB
     as `/api/go?url=...`, AliExpress converter output, etc.) used
     to short-circuit here — `return item.url` as-is. But that
     meant the title / storeId / storeName fields we now need for
     the merchant-fallback chain in /api/go never got attached.
     User feedback was "all clicks still redirect to havlo" even
     after I shipped the merchant-search-URL fallback — root cause
     was this short-circuit.

     New behavior: when the URL is already wrapped, AUGMENT it with
     the missing hint params instead of bypassing. The inner ?url=
     stays untouched. */
  if (item.url.startsWith("/api/go?")) {
    try {
      const u = new URL(item.url, "https://havlo.io");
      if (item.id        && !u.searchParams.get("id"))        u.searchParams.set("id",        item.id);
      if (item.title     && !u.searchParams.get("title"))     u.searchParams.set("title",     item.title.slice(0, 120));
      if (item.storeId   && !u.searchParams.get("store"))     u.searchParams.set("store",     item.storeId);
      if (item.storeName && !u.searchParams.get("storeName")) u.searchParams.set("storeName", item.storeName);
      /* SSR pre-resolve also runs on the already-wrapped path
         (May 2026 re-audit — most stored offer URLs ARE
         pre-wrapped as `/api/go?url=https://google.com/...` from
         older ingest runs, so the fresh-wrap pre-resolve branch
         below never fired for them). Read the inner url param; if
         it's a google-relay AND we have hints, swap the inner
         url to the merchant URL.

         Same fallback shape as the fresh path: when
         merchantSearchUrl can't resolve, keep the original inner
         url and let /api/go's runtime smart-fallback handle the
         click. */
      const innerUrl = u.searchParams.get("url");
      if (innerUrl && isGoogleRelay(innerUrl) && (item.storeId || item.storeName)) {
        const m = item.title
          ? merchantSearchUrl(item.storeId ?? "", item.storeName ?? "", item.title, item.country)
          : null;
        const fb = !m ? smartFallbackUrl(item.storeId ?? "", item.storeName ?? "", item.title ?? "") : null;
        if (m)       u.searchParams.set("url", m.url);
        else if (fb) u.searchParams.set("url", fb.url);
      }
      /* Return as a path-only URL so it stays same-origin. */
      return u.pathname + (u.search ? u.search : "");
    } catch {
      /* Malformed wrap — bail to the original, downstream /api/go
         will handle the missing param path gracefully. */
      return item.url;
    }
  }

  /* SSR pre-resolve of google-relay URLs. See the function
     docstring for the full rationale. Resolved at SSR time so the
     rendered href doesn't contain google.com — audit-metric fix.
     Falls through to smartFallbackUrl when the merchant isn't in
     our curated MERCHANTS table — handles long-tail UK / DE / etc.
     marketplaces (OnBuy, B-stock, etc.) that exist in our offers
     but aren't enumerated as merchant-search targets. */
  let effectiveUrl = item.url;
  if (item.url && isGoogleRelay(item.url) && (item.storeId || item.storeName)) {
    const m = item.title
      ? merchantSearchUrl(item.storeId ?? "", item.storeName ?? "", item.title, item.country)
      : null;
    const fb = !m ? smartFallbackUrl(item.storeId ?? "", item.storeName ?? "", item.title ?? "") : null;
    if (m)       effectiveUrl = m.url;
    else if (fb) effectiveUrl = fb.url;
  }

  const params = new URLSearchParams({ url: effectiveUrl });
  if (item.id) params.set("id", item.id);
  /* Title hint — when /api/go can't resolve a Google-relay URL at
     click time, it uses this to build a MERCHANT search URL
     (Argos / Currys / etc.) so the user still lands on the actual
     retailer's site. Beats bouncing back to havlo. */
  if (item.title) params.set("title", item.title.slice(0, 120));
  /* Store hint — let /api/go know which merchant the click came
     from. With the storeId we can construct a merchant-specific
     search URL. Round-4 user feedback. */
  if (item.storeId)   params.set("store",     item.storeId);
  if (item.storeName) params.set("storeName", item.storeName);
  return `/api/go?${params.toString()}`;
}

/* True if the URL points at an Amazon search-results page (e.g.
   amazon.com/s?k=Samsung+Galaxy+S24+Ultra) rather than a specific
   product page (/dp/ASIN, /gp/product/ASIN).

   Why this exists: the curated Amazon catalog (curated-amazon.ts)
   intentionally generates `/s?k=` URLs because ASINs rotate across
   regional variants and refurb editions — a bad ASIN gives a 404,
   while a search URL always 200s and Amazon's relevance scoring
   lands the user on the canonical product. The affiliate tag still
   attributes correctly because tag attribution works on any
   amazon.{tld} URL.

   The downside: we display a precise NGN price ("₦1,758,400") on
   the deal card, but the destination is a *list* of products. The
   user can't anchor that price to a specific item on the search
   page. The QA agent flagged this as a trust issue.

   Solution downstream: card components prefix the price with "from "
   when this returns true, signalling that the displayed price is a
   reference value for the product family, not a guarantee. The
   precise number stays in the card as the cheapest seen, but the
   "from" prefix removes the implied "this exact price at click". */
export function isAmazonSearchUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!/(^|\.)amazon\./i.test(u.hostname)) return false;
    /* Search routes: /s, /s/, /s?k=, /gp/search. Product routes (do
       NOT match): /dp/{ASIN}, /gp/product/{ASIN}, /-/en/dp/{ASIN}. */
    return /^\/(s|gp\/search)(\/|\?|$)/.test(u.pathname + (u.search ? "?" : ""));
  } catch {
    return false;
  }
}

/* Generalised search-URL detector across ALL retailers, not just
   Amazon. When a deal's outbound link routes to a store's search
   results page rather than a specific product page, we can't
   guarantee the displayed price is what the user will see at
   checkout — the search page may surface a sponsored listing,
   a different variant, or a different seller at a higher price.

   Card components prefix the price with "from " when this returns
   true (same UX pattern isAmazonSearchUrl already used for Amazon)
   so the displayed number reads as a reference, not a guarantee.

   Detects:
     - /search, /search/...      (Currys, Argos, John Lewis, Konga, ...)
     - /sitesearch               (Boots)
     - /s, /s/...                (Amazon)
     - /gp/search                (Amazon legacy)
     - /searchresults.html       (Sports Direct)
     - /searchpage.jsp           (Best Buy)
     - /catalog/                 (Jumia)
     - root path "/" + ?q=/?s=/?search=  (homepage search redirects)

   Does NOT match obvious product pages:
     - /dp/{ASIN}, /gp/product/  (Amazon products)
     - /p/, /product/, /products/, /pd/  (most retailers)
     - /item/                     (eBay, AliExpress)
     - any path containing a slash-separated SKU or slug */
export function isStoreSearchUrl(url: string | undefined | null): boolean {
  if (!url) return false;

  /* Unwrap /api/go redirects first.

     SerpAPI / curated Amazon / AliExpress-converter rows often
     persist their outbound URL as `/api/go?url=...&...` (the
     affiliate chokepoint). new URL() can't parse a relative URL
     without a base, so the previous implementation silently
     returned false for every wrapped row — i.e. the Amazon
     "from" prefix was only firing for raw amazon.com URLs and
     never for the wrapped ones the user was actually seeing on
     /deals.

     Strategy: detect the /api/go prefix, pull the `url` query
     param, recurse on the inner URL. The decoded URL is the
     real merchant URL we want to test against the search-page
     patterns below. */
  if (url.startsWith("/api/go") || url.startsWith("/api/go?")) {
    const qIndex = url.indexOf("?");
    if (qIndex < 0) return false;
    try {
      const params = new URLSearchParams(url.slice(qIndex + 1));
      const inner = params.get("url");
      if (!inner) return false;
      return isStoreSearchUrl(inner);
    } catch {
      return false;
    }
  }

  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const qs   = u.search.toLowerCase();

    /* Explicit search path patterns covering the merchants we ship.
       Ordered cheapest-to-most-specific so the common case bails
       fast. */
    if (/^\/search(\/|\?|$)/.test(path)) return true;       // /search?q= or /search/foo
    if (/^\/sitesearch(\/|\?|$)/.test(path)) return true;   // Boots
    if (/^\/s(\/|\?|$)/.test(path)) return true;            // Amazon
    if (path.startsWith("/gp/search")) return true;         // Amazon legacy
    if (path.includes("/searchresults")) return true;       // Sports Direct + variants
    if (path.includes("/searchpage.jsp")) return true;      // Best Buy
    if (path.startsWith("/catalog")) return true;           // Jumia
    if (path.startsWith("/sr")) return true;                // Nordstrom /sr?keyword=
    if (path.includes("/keyword")) return true;             // Wayfair /keyword.php

    /* Root path with a search query string — common pattern for
       single-page Shopify storefronts (Kara, HealthPlus, Supermart,
       Slot use this). */
    if ((path === "/" || path === "") &&
        /[?&](q|s|search|keyword|searchterm|qz|ntt|descriptionfilter)=/i.test(qs)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/* Hosts whose images load fine when hotlinked direct from havlo.io.
   Anything NOT in this set is wrapped through /api/img-proxy which
   rewrites the Referer to the merchant's own domain so Amazon /
   ASOS / AliExpress / Walmart etc. don't 4xx the request.
   Sourced from observed-working hosts on the live catalog. */
const DIRECT_LOAD_IMAGE_HOSTS = new Set([
  "havlo.io",
  "localhost",
  "www-konga-com-res.cloudinary.com",
  "www.3chub.com",
  /* ng.jumia.is — REMOVED from direct-load May 2026 (Best Practices).
     Jumia's image CDN is Cloudflare-fronted, so a direct cross-origin
     hotlink sets the `__cf_bm` bot-management cookie in the browser.
     Lighthouse flags that as a third-party cookie (third-party-cookies
     audit, weight 5) and also surfaces an inspector-issue, dropping
     Best Practices to ~79 whenever a Jumia card lands in the random
     mix. Routing Jumia through /api/img-proxy fixes it cleanly: the
     proxy fetches server-side and strips Set-Cookie, so no __cf_bm
     ever reaches the browser. Edge-cached 30 days so the extra hop is
     amortised. (Entry intentionally NOT re-added — tombstone for any
     future maintainer tempted to whitelist it for the saved hop.) */
  "i.imgur.com",
  "upload.wikimedia.org",
  "www.google.com",
  /* Slot Nigeria — direct-loads cleanly, no Referer enforcement
     observed. Skipping the proxy saves a hop per image. */
  "api-prod.slot.ng",
  /* Shopify CDN — used by every Shopify-based scraper (Supermart,
     HealthPlus, Essenza, plus any future ones). Open, no Referer
     enforcement, served from a fast global edge. Direct-load is
     the right call. Without this every Shopify product card was
     falling back to the gradient/emoji because /api/img-proxy
     blocks unwhitelisted hosts. */
  "cdn.shopify.com",
  /* DigitalOcean Spaces — MedPlus stores its product thumbnails
     here (commercefiles.lon1.cdn.digitaloceanspaces.com). Open
     S3-compatible CDN, no Referer enforcement. Same direct-load
     rationale as Shopify. */
  "cdn.digitaloceanspaces.com",
  /* DHgate image CDN — multiple regional variants (img1, img2, …,
     img4.dhresource.com etc.). The endsWith subdomain matcher
     covers all of them via the bare parent. Open CDN, no Referer
     enforcement. */
  "dhresource.com",
  /* Google Shopping thumbnail CDN (encrypted-tbn*.gstatic.com) —
     REMOVED from direct-load May 2026 v3. Adblockers (uBlock,
     Brave strict, Firefox tracking protection) routinely block
     gstatic.com because it's Google's tracking-adjacent CDN. With
     direct-load, ~74% of NG /deals images served from gstatic →
     blocked by extensions → onError → Havlo H fallback. With
     next/image previously, the user-visible URL was
     havlo.io/_next/image?url=... and adblockers didn't touch it.
     Routing through /api/img-proxy restores that property: the
     image URL is now havlo.io/api/img-proxy?url=... which
     adblockers don't block. Edge-cached 30 days so function-
     execution cost stays bounded.
     (Entry intentionally NOT re-added — leaving the comment as
     a tombstone for future maintainers tempted to whitelist it.) */
  /* AWS S3 — Bitmarte hosts product images at
     bitmarte-bucket.s3.eu-north-1.amazonaws.com. Open S3 bucket, no
     Referer enforcement. The subdomain-suffix matcher catches every
     regional + bucket variant (eu-north-1, us-east-1, etc.) via the
     bare entry, the same shape as the digitaloceanspaces / dhresource
     entries above. NOTE this does NOT match `*.amazon.com` hosts —
     those are different TLDs and remain in the proxy allowlist with
     their proper Referer rewrites. */
  "amazonaws.com",
  /* Supabase Storage — our OWN self-hosted product images
     (<project-ref>.supabase.co/storage/v1/object/public/product-images/...).
     Public bucket, behind Supabase's CDN, no Referer, already a normalized
     webp -> serve direct (no proxy hop, no adblock concern). The
     subdomain-suffix matcher (".supabase.co") covers the project host.
     Pipeline: migration 0076 + scripts/backfill-self-host-images.ts. */
  "supabase.co",
]);

/* Wrap an external image URL through /api/img-proxy unless its host
   is on the direct-load whitelist. Same-origin URLs (already starting
   with '/' or matching havlo.io) pass through unchanged. Malformed
   URLs pass through unchanged so the <img> tag's onError fallback
   can take over rather than this helper choking the render. */
/* True if the URL's hostname is on the direct-load list. Exact
   match OR subdomain (endsWith ".entry") so a single roster entry
   covers every regional / spacename variant of the same CDN —
   e.g. "cdn.digitaloceanspaces.com" matches both
   commercefiles.lon1.cdn.digitaloceanspaces.com (MedPlus) and any
   future store on the same provider without a per-region entry. */
function isDirectLoadHost(hostname: string): boolean {
  if (DIRECT_LOAD_IMAGE_HOSTS.has(hostname)) return true;
  /* Array.from() instead of `for..of` directly because the project
     tsconfig targets ES5 for the public bundle and Set iteration
     needs --downlevelIteration or ES2015+. Cheap conversion, runs
     at module load on a tiny set. */
  for (const entry of Array.from(DIRECT_LOAD_IMAGE_HOSTS)) {
    if (hostname.endsWith("." + entry)) return true;
  }
  return false;
}

/* Literal "no image available" placeholder graphics that some merchant feeds
   hand us as the product image: a pharmacy Shopify template
   ("online-pharmacy-product-image-placeholder"), medplus's
   "image-place-holder.png", and similar. These are NOT real product photos --
   a single grey "no image" PNG reused across many SKUs. Storing/self-hosting
   one leaks a foreign placeholder into our product cards AND collapses dozens
   of unrelated products to one perceptual-hash. Treat a matching URL as "no
   image" so the Havlo logo fallback (ResilientImage) renders instead.

   DELIBERATELY does NOT match gstatic / encrypted-tbn thumbnails -- those are
   real (if low-res) product images, not placeholders. Substring match is
   indexOf-based to stay ES5-safe for the public bundle. */
const PLACEHOLDER_IMAGE_PATTERNS = [
  "placeholder", "place-holder", "place_holder",
  "no-image", "noimage", "no_image", "no-img", "noimg",
  "default-product", "default-image", "default_image", "defaultimage",
  "coming-soon", "comingsoon", "image-not", "not-available",
  "image_not_found", "imagenotfound", "no-photo", "nopic",
];
export function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  for (let i = 0; i < PLACEHOLDER_IMAGE_PATTERNS.length; i++) {
    if (u.indexOf(PLACEHOLDER_IMAGE_PATTERNS[i]) !== -1) return true;
  }
  return false;
}

export function proxiedImageUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("/")) return rawUrl;
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (isDirectLoadHost(u.hostname)) return rawUrl;
  return `/api/img-proxy?url=${encodeURIComponent(rawUrl)}`;
}

/* Shrink an oversized product-image URL to a card-appropriate width by
   rewriting the CDN's own size token — NO server transform involved.

   Why this exists: deal cards render plain <img> (next/image's optimizer
   is off to stay under Vercel's 5K/mo transform cap), and img-proxy is
   edge runtime so it streams raw bytes without resizing. That left a
   ~180px masonry cell downloading whatever full-res asset the merchant
   stored — often a 1500px Amazon hero (~150-300 KiB) when ~640px would
   be pixel-identical on screen. Rewriting the size token in the URL is
   the only resize lever we have left, and it costs nothing at runtime.

   Two CDN dialects cover the bulk of the catalogue:
     · Amazon media — `_SL1500_`, `_SX679_`, `_UY741_` etc. The letter
       pair is S/U + L/X/Y (Scale/fix-X/fix-Y) and the digits are the
       px bound. Clamp any > maxW down to maxW.
     · Cloudinary — `…/upload/w_2000/…` transform segments. Clamp w_ down.

   Downsize-ONLY (never upscales a smaller asset), and the Cloudinary
   branch is host-gated so a stray `w_1234` in some other URL's path
   isn't touched. Unknown URL shapes pass through unchanged. Safe even
   if a rewrite ever misses: ResilientImage falls back to the Havlo mark
   on load error. */
export function downscaleCardImageUrl(url: string | null | undefined, maxW = 640): string {
  if (!url) return url ?? "";
  let out = url;
  /* Amazon size codes: _SL1000_, _SX679_, _SY741_, _UL1500_, _UX_, _UY_.
     Capture the 2-letter code + the number; clamp when over maxW. */
  out = out.replace(/_((?:S|U)[LXY])(\d{3,5})_/g, (m, code, n) =>
    Number(n) > maxW ? `_${code}${maxW}_` : m);
  if (/\bcloudinary\.com\//.test(out)) {
    out = out.replace(/(^|[,/])w_(\d{3,5})\b/g, (m, pre, n) =>
      Number(n) > maxW ? `${pre}w_${maxW}` : m);
  }
  return out;
}

export function formatNaira(amount: number): string {
  /* Always prefix with the literal ₦ symbol. Was using
     `Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" })`
     which on some Node/browser engines (Vercel runtime among them)
     returns "NGN 5,000" instead of "₦5,000" because en-NG CLDR data
     doesn't always carry the narrow symbol. Hand-rolling makes the
     symbol deterministic across environments. */
  return `₦${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

import { FX_GENERATED } from "@/lib/fx-rates.generated";
/** USD->NGN baseline, SINGLE-SOURCED from the build-time FX mirror
 *  (fx-rates.generated.ts), which the daily FX cron rewrites from the
 *  fx_rates table -- the same table the SQL price RPCs read via fx_rate().
 *  So the engine rate (this), the display rate (country.USD_FX, which also
 *  reads the mirror) and the DB/SQL rate are ONE number by construction and
 *  cannot drift apart (this closes the launch-QA "1650 vs 1600" split). The
 *  literal is only a fallback if the generated file is ever missing NGN.
 *  The mirror is a static client-safe constant, so utils stays DB-import-free
 *  and still ships in client bundles. */
export const USD_TO_NGN = FX_GENERATED.NGN ?? 1_650;

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Compact USD formatter for product cards: rounds to 2dp, drops trailing
 * zeros, and adds thousands-separator commas for prices ≥ 1000.
 *   7        → "$7"
 *   7.5      → "$7.50"
 *   1500     → "$1,500"
 *   1500.99  → "$1,500.99"
 *   1234567  → "$1,234,567"
 * Defends against float-precision artifacts from `original - sale` math.
 */
export function formatUSDPrice(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const isInt = Number.isInteger(rounded);
  const body = rounded.toLocaleString("en-US", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  });
  return `$${body}`;
}

export function usdToNgn(usd: number): number {
  return Math.round(usd * USD_TO_NGN);
}

/* Convert any FX_GENERATED-supported currency to NGN (Havlo's base unit).
   FX_GENERATED is "1 USD = X <currency>", so NGN per 1 unit of `currency`
   is FX_GENERATED.NGN / FX_GENERATED[currency]. Generalises usdToNgn so
   the paste->sniff flow stops rendering a GBP/EUR price as raw NGN<amount>
   (which a non-NGN market then shows as £0 — the LookFantastic report,
   June 2026). NGN and unknown/missing currencies pass through unchanged
   (we don't fabricate a rate we don't have). */
export function currencyToNgn(amount: number, currency: string | null | undefined): number {
  const cur = (currency ?? "NGN").toUpperCase();
  if (cur === "NGN") return Math.round(amount);
  const rate = FX_GENERATED[cur];
  if (!rate || rate <= 0) return Math.round(amount);
  const ngnPerUsd = FX_GENERATED.NGN ?? USD_TO_NGN;
  return Math.round(amount * (ngnPerUsd / rate));
}

/* Compact NGN: one decimal of real precision in BOTH tiers, with a
   trailing ".0" stripped (₦53.5K, ₦53K — never ₦54K for ₦53,500;
   user rule June 2026: don't round away the half-thousand). 999,950+
   rolls into the M tier so we never print "₦1000.0K". */
export function formatCompact(amount: number): string {
  const strip = (s: string) => s.replace(/\.0$/, "");
  if (amount >= 999_950) return `₦${strip((amount / 1_000_000).toFixed(1))}M`;
  if (amount >= 1_000)   return `₦${strip((amount / 1_000).toFixed(1))}K`;
  return `₦${Math.round(amount)}`;
}

/* Deterministic integer grouping ("3257" → "3,257").

   Hydration safety: a bare `n.toLocaleString()` (no locale arg) formats
   with the RUNTIME's default locale, which differs between the Vercel
   Node server (en-US full ICU) and a visitor's browser (e.g. fr-FR
   renders "3 257", de-DE "3.257"). When the same count is server-
   rendered and then hydrated, those differ and React logs a text
   mismatch (#418) — the console-noise half of the QA "hydration errors"
   finding. Pinning the locale to en-US makes server and client emit the
   identical string for every visitor, matching the comma grouping the
   price formatters (formatLocalExact, formatUSDPrice) already use.

   Use this for any plain integer that appears in rendered markup
   (store counts, product counts, "N deals"). Prices go through
   formatLocal / formatPriceForUser, which are already locale-pinned. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/* Country-aware compact formatter. Used wherever the codebase already
   has an amount in NGN (typically because /compare's matcher
   normalises everything to NGN internally) but the UI is being
   rendered for a user whose currency isn't NGN.

   Bug this fixes (user-reported): a US user on /us/deals or
   /us/compare saw '₦' prices because most components called
   formatNaira / formatCompact directly without going through the
   country picker. Now: pass NGN amount + country and the helper
   converts via the FX table and formats with Intl.

   Imported lazily to avoid pulling country.ts into utils.ts which
   doesn't otherwise depend on it. */
import type { Country, FxSnapshot } from "@/lib/country";
import { USD_FX, formatLocal, formatLocalExact } from "@/lib/country";

/* HYDRATION CONTRACT for the user-currency formatters below: every
   formatter takes an optional trailing `fx` snapshot, defaulting to
   the bundled USD_FX. Server components and API routes can rely on
   the default (the server's snapshot IS the authoritative one). A
   CLIENT component whose formatted output ships in SSR HTML must
   pass useCountry().fx instead — the bundled USD_FX in the browser
   can be a different revision of the daily-rewritten FX mirror than
   the server's (dev HMR across a rewrite, deploy skew), and the
   default would re-derive a slightly different price on hydration
   (the June 2026 "₦54,755 vs ₦54,738" MasonryCard warning class).
   Client components whose prices only ever render from client-side
   fetches (PriceComparisonBar, PriceHistoryChart, …) may keep the
   default: their text never appears in SSR HTML, so there is
   nothing to mismatch. */

/* Format a price for the visitor's currency.

   Default mode: `amount` is in NGN (matches every existing call
   site). Pipeline does NGN → USD → target via USD_FX.

   Opt-in mode: pass `sourceCurrency` when you have the original
   currency at the call site. The function skips the NGN
   intermediate and converts SOURCE → USD → target directly,
   avoiding the 1-unit rounding drift introduced by `usdToNgn`'s
   integer cast.

   Why the drift mattered: a $99.99 USD source flowing through
   usdToNgn(99.99) = 159984 NGN, then formatPriceForUser(159984, UK)
   = (159984/1600 = 99.99) × 0.79 = £78.99 → £79. The same $99.99
   passed direct as sourceCurrency="USD" computes 99.99 × 0.79 =
   £78.99 → £79. Identical for round prices, but two products
   originating at sub-cent USD values could drift by 1 minor unit
   between paths. Opt-in keeps the default behaviour unchanged
   while letting precision-sensitive surfaces (cards that have
   both raw price + currency in hand) take the cleaner path.

   Same currency as visitor's: full Intl format via formatLocal
   regardless of currency. The old NGN-only compact (₦5K) was an
   inconsistency — a UK shopper saw "£1,250" but an NG shopper saw
   "₦5K". Unified: every currency renders with grouping separators
   and (for USD) cents. Compact display is still available via the
   formatCompact helper for surfaces that explicitly want it. */
export function formatPriceForUser(
  amount:         number,
  country:        Country,
  sourceCurrency: "NGN" | "USD" = "NGN",
  fx:             FxSnapshot = USD_FX,
): string {
  const target = convertForUser(amount, country, sourceCurrency, fx);
  /* No Math.round here — formatLocal hands off to Intl.NumberFormat
     with the right fraction-digit settings per currency, so the
     final rounding happens at display time on the floating value.
     Avoids the double-round bug where Math.round(0.499 * 1.0) = 0
     but Intl.format(0.499) with 2 fraction digits → "0.50". */
  return formatLocal(target, country);
}

/* Exact-precision counterpart to formatPriceForUser. Use when the
   surface needs the full number regardless of magnitude — chart
   hover tooltips, delta callouts on close values, anywhere the
   user is actively investigating a specific datum. formatLocal's
   ≥ 1M adaptive abbreviation would drop precision exactly when
   the user needs it most. */
export function formatPriceForUserExact(
  amount:         number,
  country:        Country,
  sourceCurrency: "NGN" | "USD" = "NGN",
  fx:             FxSnapshot = USD_FX,
): string {
  const target = convertForUser(amount, country, sourceCurrency, fx);
  return formatLocalExact(target, country);
}

/* Format a price DELTA so it always equals the difference of its two
   operand prices AS THE USER SEES THEM RENDERED. Both operands are
   rounded to the visitor's display precision (USD 2dp, every other
   currency whole units) BEFORE subtracting, never after.

   Why this exists (QA #11): "£109 highest - £100 cheapest" gets shown
   beside a savings line that read "£8". The prices are each rounded
   independently for display, but the savings was rounding the raw
   delta once: round(108.6) - round(100.4) = 9, yet round(108.6 -
   100.4) = round(8.2) = 8. Independently-rounded deltas drift by one
   minor unit at any rounding boundary. Deriving the delta from the same
   rounded integers the user can read off the two price labels makes the
   on-screen arithmetic self-consistent, every time.

   Operands are NGN by default (matches every comparison call site).
   Pass them in either order; the magnitude of the gap is formatted. */
export function formatPriceDeltaForUser(
  aNgn:           number,
  bNgn:           number,
  country:        Country,
  sourceCurrency: "NGN" | "USD" = "NGN",
  fx:             FxSnapshot = USD_FX,
): string {
  /* Round each operand to the EXACT value its own price label shows by
     running it through the identical formatter the labels use
     (formatLocalExact → Intl.NumberFormat), then reading the number
     back. Numeric rounding (Math.round(x*100)/100 OR x.toFixed(2))
     drifts a penny off Intl on a few percent of USD values because
     each rounds the double differently than Intl does; deriving the
     operand from the formatter itself makes the delta equal to the
     visible difference by construction, in every currency.

     Slice the symbol off by its known length (don't regex-strip
     non-digits) so a symbol that contains a dot — AED's "د.إ" — can't
     corrupt the parse; then drop the en-locale thousands commas. */
  const toDisplay = (amt: number): number => {
    const converted = convertForUser(amt, country, sourceCurrency, fx);
    const body = formatLocalExact(converted, country)
      .slice(country.symbol.length)
      .replace(/,/g, "");
    return parseFloat(body);
  };
  return formatLocal(Math.abs(toDisplay(aNgn) - toDisplay(bNgn)), country);
}

/* Shared conversion path. Avoids duplicating the
   source-currency-aware math between the adaptive + exact
   formatters. */
export function convertForUser(
  amount:         number,
  country:        Country,
  sourceCurrency: "NGN" | "USD",
  fx:             FxSnapshot = USD_FX,
): number {
  if (country.currency === sourceCurrency) return amount;
  /* Convert source → USD intermediate → target. When source IS
     USD, the first step is a pass-through. */
  const amountUsd = sourceCurrency === "USD"
    ? amount
    : amount / fx[sourceCurrency];
  return amountUsd * fx[country.currency];
}

export function savings(original: number, sale: number): number {
  // Round to 2dp to defend against float-precision artifacts (e.g. 7.0000…0036)
  return Math.round((original - sale) * 100) / 100;
}

/* Honest, displayable discount percent, derived from the two prices the
   user actually sees: the struck-through original and the sale price.

   Why not just trust deal.discountPercent / offer.discountPercent?
   Ingestion stores original_price and discount_percent as INDEPENDENT
   nullable columns straight from the provider (see ingestion.ts) — we
   never derive one from the other. So the provider's percent can be
   computed against a list price that was already stale at import time,
   or against a price we don't display, leaving the badge ("30% off")
   contradicting the struck pair the user can do the math on (£100 →
   £80 = 20%). Recomputing from the shown pair keeps the badge, the
   struck-through price, and the savings line all telling one story.

   Returns 0 (no badge) when there's no genuine markdown (sale ≥
   original, or non-positive inputs) OR when the implied discount is
   implausibly large (> 95%) — in practice a bad feed original_price,
   where showing "97% off" would erode trust more than showing nothing.
   Percent is currency-invariant (a single FX factor scales both prices
   equally), so callers may pass base or user-converted prices. */
export function displayDiscountPct(original: number, sale: number): number {
  if (!(original > 0) || !(sale > 0) || sale >= original) return 0;
  const pct = Math.round(((original - sale) / original) * 100);
  return pct > 95 ? 0 : pct;
}

/* Repair a SINGLE whitespace token that carries the classic zero-for-o
   leetspeak corruption from scraped seller feeds — "Veat00l" → "Veatool",
   "g00gle" → "google", "Amaz0n" → "Amazon". Finding #8 (pre-launch QA):
   a brand whose name renders with digits embedded mid-word reads as
   fake / counterfeit and torches trust on a price-comparison surface.

   The gate is deliberately narrow so it NEVER mangles a legitimate
   model code. It fires only when a lowercase letter sits IMMEDIATELY on
   BOTH sides of a run of one-or-two zeros, and the whole token is
   otherwise pure letters. A catalog audit (15.2k products) confirmed
   every real model identifier is excluded by that shape:
     • uppercase-adjacent zeros — "A0BK", "BA33BC0", "ZJM01"  (no lowercase
       letter touching the zero)
     • zeros mixed with other digits — "KM1GY-70", "HPG2 6592", "PB31PD",
       "NN-CT55JWBPQ"  (a non-zero digit breaks the all-letters shape)
   …so none of them match, while "Veat00l" / "g00gle" / "Amaz0n" do. */
const ZERO_FOR_O_TOKEN = /^[A-Za-z]*[a-z]0{1,2}[a-z][A-Za-z]*$/;
function deLeetToken(token: string): string {
  return ZERO_FOR_O_TOKEN.test(token) ? token.replace(/0/g, "o") : token;
}

/* Invisible directional / zero-width characters that must never reach a
   rendered title or a document <title>. They survive React + Next
   HTML-escaping intact (escaping only neutralises < > & " '), yet they
   let a crafted string reorder or hide how a title paints: a right-to-
   left override (U+202E) visually reverses the product name, a zero-
   width space (U+200B) splits a word with no visible gap, a stray BOM
   (U+FEFF) wedges itself mid-string. None carry legible content, so
   they're removed outright.

   Deliberately EXCLUDES U+200C / U+200D (ZWNJ / ZWJ): those are
   load-bearing in Devanagari (India), Arabic (UAE) and emoji ZWJ
   sequences, so stripping them would corrupt legitimate multi-script
   titles in the very markets Havlo serves. Finding #12. */
const TITLE_UNSAFE_CHARS = /[\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/* Clean up dirty product titles from upstream scrapers (especially ASOS
   which spits out "Brand – Product – – Material" with repeated en-dashes).
   Collapses any run of separator characters (en-dash, em-dash, hyphen, |)
   with optional whitespace into a single " - " ASCII hyphen, and strips
   leading/trailing separators. Brand-voice rule bans en/em dashes in
   user-visible copy; cleanTitle runs on every product title before it
   reaches cards, PDPs and emails. Safe to call multiple times. */
export function cleanTitle(raw: string): string {
  return raw
    /* Strip embedded HTML tags. DHgate (and some SerpAPI seller feeds)
       ingest titles with <strong>keyword</strong> markup intact — React's
       default text escaping then shows the literal "<strong>" / "</strong>"
       characters to the user. User-reported case (May 2026): a DHgate
       sneaker listing showed up in autocomplete with two <strong>shoes</strong>
       tags rendered as plain text in the dropdown.

       Catches <strong>, <b>, <em>, <i>, <span>, <br>, etc. — anything
       tag-shaped. Five-char entity unescape isn't needed since we're
       stripping tags entirely, not interpreting them. */
    .replace(/<[^>]*>/g, "")
    /* Drop the Unicode replacement char (U+FFFD "�") and ASCII control
       chars — both are unambiguous encoding breakage from upstream feeds,
       never meaningful in a product name. Control chars become a space so
       two words don't fuse; the replacement char vanishes outright. The
       trailing space-collapse + trim tidy up either way. Finding #8. */
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    /* Strip invisible directional / zero-width / BOM characters. Unlike
       the tag strip above, these survive HTML escaping untouched, so a
       crafted title (e.g. a right-to-left override) can still reorder or
       hide how the name paints in a browser tab, a SERP, or our own
       document <title>. Removed outright (zero-width), keeping ZWNJ/ZWJ
       for Indic + Arabic + emoji. See TITLE_UNSAFE_CHARS. Finding #12. */
    .replace(TITLE_UNSAFE_CHARS, "")
    /* Repair zero-for-o brand corruption per token ("Veat00l" → "Veatool").
       deLeetToken self-gates on a shape that excludes every real model
       code, so this is inert on the 99.98% of titles with no corruption. */
    .replace(/[A-Za-z0-9]+/g, deLeetToken)
    .replace(/[–—|\-]+(\s*[–—|\-]+)+/g, " - ") // collapse runs
    .replace(/^\s*[–—|\-]+\s*/, "")                       // trim leading
    .replace(/\s*[–—|\-]+\s*$/, "")                       // trim trailing
    .replace(/\s{2,}/g, " ")                                         // collapse spaces
    .trim();
}

/* Sanitize a short label (a store / brand name) for safe use in a
   document <title> or a visible chip, WITHOUT the product-title
   normalisation cleanTitle applies — its separator-run collapse would
   turn a legitimate "Best-Buy" into "Best – Buy". Strips tag-shaped
   markup, the U+FFFD replacement char, ASCII control chars and the
   invisible directional / zero-width set, then collapses whitespace.

   Exists for /p/live, whose store name arrives from a user-controllable
   `sn=` query param and is concatenated straight into the page <title>
   ("<product> at <store>"). Finding #12. */
export function sanitizeLabel(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(TITLE_UNSAFE_CHARS, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  /* Within the last 12h, show the hour so a freshly-found deal reads
     "found 8h ago" instead of a flat "today" (minutes / "Just now" under 1h).
     12-24h stays "Today". */
  const hours = Math.floor(diff / 3600000);
  if (hours < 12) {
    if (hours >= 1) return `${hours}h ago`;
    const mins = Math.floor(diff / 60000);
    return mins >= 1 ? `${mins}m ago` : "Just now";
  }
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* Freshness tier for price-staleness signals on the PDP.
   The May 29 2026 trust-break report: a user saw "Last refreshed
   2w ago" on a PDP, clicked through, found the price had changed
   at the store. The bare "X ago" string was treated identically
   whether verified 1 hour or 2 weeks. The visual tone never
   shifted, so users defaulted to trusting it.

   Tiers chosen against the Mon/Wed/Fri scrape cadence:
     - fresh (<3 days)   — within one scrape cycle; price is reliable
     - aging (3-7 days)  — past one cycle; could have drifted but unlikely
     - stale (7-30 days) — multiple cycles missed; explicit warning
     - veryStale (30+)   — likely incident or feed-source broken;
                            loudest warning

   `warn` flag is what callers use to decide whether to surface a
   "Price may have changed" caveat. `tone` is the Tailwind class
   bucket so callers can drive colour without re-encoding the tier. */
export type FreshnessTier = "fresh" | "aging" | "stale" | "veryStale";

export interface Freshness {
  tier:   FreshnessTier;
  ageMs:  number;
  days:   number;
  warn:   boolean;        // true when caller should surface staleness caveat
  tone:   "success" | "neutral" | "warn" | "danger";
}

export function freshnessOf(dateStr: string | null | undefined): Freshness {
  if (!dateStr) {
    return { tier: "veryStale", ageMs: Infinity, days: Infinity, warn: true, tone: "danger" };
  }
  const ageMs = Date.now() - new Date(dateStr).getTime();
  const days  = Math.floor(ageMs / 86400000);
  if (days < 3)   return { tier: "fresh",     ageMs, days, warn: false, tone: "success" };
  if (days < 7)   return { tier: "aging",     ageMs, days, warn: false, tone: "neutral" };
  if (days < 30)  return { tier: "stale",     ageMs, days, warn: true,  tone: "warn"    };
  return            { tier: "veryStale", ageMs, days, warn: true,  tone: "danger"  };
}

export function daysUntil(dateStr: string): number {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / 86400000
  );
}
