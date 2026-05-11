import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
   be in every deal click path. */
export function getClickThroughUrl(item: { url: string; id?: string; title?: string; storeId?: string; storeName?: string }): string {
  /* Already wrapped (legacy SerpAPI rows, AliExpress converter
     output, anything else that pre-encoded). Don't double-wrap. */
  if (item.url.startsWith("/api/go")) return item.url;

  const params = new URLSearchParams({ url: item.url });
  if (item.id) params.set("id", item.id);
  /* Title hint — when /api/go can't resolve a Google-relay URL at
     click time, it now uses this to build a MERCHANT search URL
     (Argos / Currys / etc.) so the user still lands on the actual
     retailer's site, just on a search results page instead of the
     specific product. Beats the previous fallback of bouncing back
     to havlo. Truncated to keep URL length reasonable. */
  if (item.title) params.set("title", item.title.slice(0, 120));
  /* Store hint — let /api/go know WHICH merchant the click came
     from. With the storeId we can construct a merchant-specific
     search URL (argos.co.uk/search?q=..., currys.co.uk/...). Round-4
     user feedback: "there's no reason this shouldn't point to the
     actual website even if it means taking them to the product
     search page". */
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
  "ng.jumia.is",
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
  /* Google Shopping thumbnail CDN — shows up in SerpAPI ingest
     where Google's own search-results thumbnails come back as the
     product image. Open CDN, served fast from Google's edge. */
  "gstatic.com",
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

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Approximate NGN per 1 USD — update periodically */
export const USD_TO_NGN = 1_600;

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

export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}K`;
  return `₦${amount}`;
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
import type { Country } from "@/lib/country";
import { USD_FX, formatLocal } from "@/lib/country";

export function formatPriceForUser(amountNgn: number, country: Country): string {
  if (country.currency === "NGN") {
    /* Same currency — keep the compact ₦XXk form for parity with the
       rest of the NG-facing UI. */
    return formatCompact(amountNgn);
  }
  /* NGN → USD intermediate → target currency. Same FX table used by
     MasonryCard's price conversion so the two surfaces never disagree. */
  const ngnPerUsd = USD_FX.NGN;
  const amountUsd = amountNgn / ngnPerUsd;
  const target = Math.round(amountUsd * USD_FX[country.currency]);
  return formatLocal(target, country);
}

export function savings(original: number, sale: number): number {
  // Round to 2dp to defend against float-precision artifacts (e.g. 7.0000…0036)
  return Math.round((original - sale) * 100) / 100;
}

/* Clean up dirty product titles from upstream scrapers (especially ASOS
   which spits out "Brand – Product – – Material" with repeated en-dashes).
   Collapses any run of separator characters (en-dash, em-dash, hyphen, |)
   with optional whitespace into a single " – ", and strips leading/trailing
   separators. Safe to call multiple times. */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/[–—|\-]+(\s*[–—|\-]+)+/g, " – ") // collapse runs
    .replace(/^\s*[–—|\-]+\s*/, "")                       // trim leading
    .replace(/\s*[–—|\-]+\s*$/, "")                       // trim trailing
    .replace(/\s{2,}/g, " ")                                         // collapse spaces
    .trim();
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function daysUntil(dateStr: string): number {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / 86400000
  );
}
