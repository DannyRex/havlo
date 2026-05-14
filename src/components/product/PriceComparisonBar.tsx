"use client";

/* Price-vs-market visual indicator for the PDP.

   Replaces the previous "Last checked / Store country" info tiles
   that were visually quiet and uninformative. The new component
   shows where THIS offer's price sits between the cheapest and
   dearest known prices for the same product across other stores
   — like Spoken's price-position bar. Three colour zones (green
   → amber → red) communicate "good deal vs market" at a glance.

   Inputs (all NGN-internal, formatted via formatPriceForUser):
     · this    — the current offer's price the user is looking at
     · lowest  — cheapest dupe price (or `this` if no cheaper dupe)
     · highest — dearest dupe price  (or `this` if no dearer dupe)
     · count   — how many other stores were considered

   Single-store products (no dupes) get a simpler "Only at this store"
   banner instead — no comparison signal possible.

   Renamed the still-useful "Verified by Havlo" tile (was "Last
   checked", which QA flagged as ambiguous: who checked, when?
   "Verified by Havlo" makes the actor explicit). */

import { Check, Globe, AlertCircle, Info } from "lucide-react";
import { formatPriceForUser } from "@/lib/utils";
import { type Country, getCountry } from "@/lib/country";
import { timeAgo } from "@/lib/utils";

interface Props {
  /** Current offer's price in the user's display currency. */
  thisPrice:    number;
  /** Cheapest known price across this product's dupes (same currency). */
  lowestPrice:  number;
  /** Dearest known price across this product's dupes (same currency). */
  highestPrice: number;
  /** Number of OTHER stores compared (excludes this offer). 0 = single-store. */
  comparedStoreCount: number;
  /** Country object — drives currency formatting. */
  country:      Country;
  /** When Havlo last verified the price (ISO string). */
  lastCheckedAt?: string;
  /** Country the store is anchored to ("UK", "US", null = global). */
  storeCountry?: string | null;
  /** Out-of-stock flag — when true, render a warning instead. */
  outOfStock?:  boolean;
}

export default function PriceComparisonBar({
  thisPrice,
  lowestPrice,
  highestPrice,
  comparedStoreCount,
  country,
  lastCheckedAt,
  storeCountry,
  outOfStock,
}: Props) {
  /* Out-of-stock takes priority over price comparison — there's no
     point ranking the price of an unavailable item. */
  if (outOfStock) {
    return (
      <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-300/40 p-4 sm:p-5 mb-7">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-[14px] font-semibold text-red-700 dark:text-red-300 mb-1">
              Currently out of stock
            </h3>
            <p className="text-[13px] text-red-800/80 dark:text-red-200/80 leading-relaxed">
              Last seen unavailable. Cheaper alternatives below may still be in stock.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* Single-store product → no comparison possible. Show a simpler
     "exclusive at this store" badge + the verification + store-country
     facts. Still more informative than the old empty tiles. */
  if (comparedStoreCount === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-border p-4 sm:p-5 mb-7">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-ink-3 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-ink mb-1">
              Only seen at this store
            </h3>
            <p className="text-[12px] text-ink-3 leading-relaxed">
              Havlo couldn&apos;t find this exact product elsewhere yet. Comparison rail below shows similar picks.
            </p>
            {(lastCheckedAt || storeCountry) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[12px] text-ink-3">
                {lastCheckedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={12} aria-hidden="true" />
                    Verified by Havlo {timeAgo(lastCheckedAt)}
                  </span>
                )}
                {storeCountry && (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe size={12} aria-hidden="true" />
                    Ships from {storeCountry}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* Compute the position of `thisPrice` along the [lowest, highest]
     range. 0 = matches lowest (best deal), 1 = matches highest (worst).
     Clamped to [0,1] so a slightly-above-highest price still renders
     at the right end (defensive — should be rare). */
  const range  = Math.max(highestPrice - lowestPrice, 1); // avoid /0
  const offset = Math.max(0, Math.min(1, (thisPrice - lowestPrice) / range));

  /* Position the marker at offset% from left. Cap visually inset by
     a few pixels so the marker isn't clipped at the bar's edges. */
  const markerLeftPct = Math.max(2, Math.min(98, offset * 100));

  /* Verdict label + color — drives both the headline copy and the
     marker bg. Three buckets matched to the green / amber / red
     gradient zones below. */
  const verdict = offset <= 0.33
    ? { label: "Great price", colour: "text-emerald-600 dark:text-emerald-400", marker: "bg-emerald-500" }
    : offset <= 0.66
      ? { label: "Average price", colour: "text-amber-600 dark:text-amber-400", marker: "bg-amber-500" }
      : { label: "Above average", colour: "text-red-600 dark:text-red-400", marker: "bg-red-500" };

  /* Savings vs the dearest known price — useful framing when this
     offer ISN'T the cheapest but is still notably cheaper than the
     worst comparable price. Only render when meaningful (>5%
     savings) so we don't surface "Save 1%" noise. */
  const savePctVsHighest = highestPrice > 0
    ? Math.round(((highestPrice - thisPrice) / highestPrice) * 100)
    : 0;
  const showSavings = savePctVsHighest >= 5 && offset > 0.05;

  return (
    <div className="rounded-2xl bg-surface border border-border p-4 sm:p-5 mb-7">
      {/* Headline */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className={`text-[15px] font-semibold ${verdict.colour}`}>
          {offset === 0 ? "Cheapest of the bunch" : verdict.label}
        </h3>
        <span className="text-[11px] text-ink-3 tabular-nums">
          across {comparedStoreCount + 1} stores
        </span>
      </div>

      {/* The bar — 3-zone gradient + position marker */}
      <div
        className="relative h-2 rounded-full mb-2 overflow-hidden"
        style={{
          background:
            "linear-gradient(90deg, rgb(16,185,129) 0%, rgb(16,185,129) 33%, rgb(245,158,11) 50%, rgb(239,68,68) 67%, rgb(239,68,68) 100%)",
        }}
        aria-label={`${verdict.label}. ${formatPriceForUser(thisPrice, country)} of a ${formatPriceForUser(lowestPrice, country)}–${formatPriceForUser(highestPrice, country)} range across ${comparedStoreCount + 1} stores.`}
      >
        {/* Position marker — sized to clearly stand above the bar */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full ${verdict.marker} ring-2 ring-bg shadow-md`}
          style={{ left: `${markerLeftPct}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Range labels — anchor + dearest. Both formatted in user
          currency so the comparison is apples-to-apples. */}
      <div className="flex items-center justify-between text-[11px] text-ink-3 tabular-nums mb-3">
        <span>{formatPriceForUser(lowestPrice, country)}<span className="ml-1 opacity-70">cheapest</span></span>
        <span>{formatPriceForUser(highestPrice, country)}<span className="ml-1 opacity-70">highest</span></span>
      </div>

      {/* Optional savings line — only when meaningful */}
      {showSavings && (
        <p className="text-[12px] text-ink-2 mb-3">
          You&apos;d save <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPriceForUser(highestPrice - thisPrice, country)}</span> vs the highest known price.
        </p>
      )}

      {/* Verification + store-country facts — moved here from the old
          info tiles. Compact inline strip below the bar so the rich
          comparison signal stays the dominant element. "Verified by
          Havlo" replaces "Last checked" — QA flagged the old label
          as ambiguous (who checked, when?). New label makes the
          actor explicit so users understand it's our scrape data. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-3 pt-3 border-t border-border">
        {lastCheckedAt && (
          <span className="inline-flex items-center gap-1.5">
            <Check size={12} aria-hidden="true" />
            Verified by Havlo {timeAgo(lastCheckedAt)}
          </span>
        )}
        {storeCountry && (
          <span className="inline-flex items-center gap-1.5">
            <Globe size={12} aria-hidden="true" />
            Ships from {storeCountry}
          </span>
        )}
      </div>
    </div>
  );
}

/* Convenience helper: build PriceComparisonBar input from a list of
   dupe prices + the anchor offer's price. Centralises the math so
   the page.tsx call site stays tidy. */
export function priceStatsFromDupes(
  thisPriceUser: number,
  dupePricesUser: number[],
): { lowest: number; highest: number; count: number } {
  if (dupePricesUser.length === 0) {
    return { lowest: thisPriceUser, highest: thisPriceUser, count: 0 };
  }
  /* Include `thisPriceUser` in the range — covers the case where
     this offer is BELOW every dupe (anchor wins) or ABOVE every dupe
     (anchor loses). The marker still positions correctly. */
  const allPrices = [thisPriceUser, ...dupePricesUser];
  const lowest  = Math.min(...allPrices);
  const highest = Math.max(...allPrices);
  return { lowest, highest, count: dupePricesUser.length };
}

/* Re-exported so the import is a one-liner in PDP page.tsx — keeps
   the component co-located with its country helper. */
export { getCountry as resolveCountry };
