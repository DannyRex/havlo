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
export function getClickThroughUrl(item: { url: string; id?: string }): string {
  /* Already wrapped (legacy SerpAPI rows, AliExpress converter
     output, anything else that pre-encoded). Don't double-wrap. */
  if (item.url.startsWith("/api/go")) return item.url;

  const params = new URLSearchParams({ url: item.url });
  if (item.id) params.set("id", item.id);
  return `/api/go?${params.toString()}`;
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
