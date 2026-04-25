import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * zeros so `$7.0000000036` → `$7`, `$7.5` → `$7.50`, `$7.99` → `$7.99`.
 * Defends against float-precision artifacts from `original - sale` math.
 */
export function formatUSDPrice(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `$${rounded}`;
  return `$${rounded.toFixed(2)}`;
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
