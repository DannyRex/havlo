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

   Single-store products (May 2026 user request): the bar STILL
   renders — marker pinned at left edge (de facto cheapest, since
   nothing else has been seen), headline copy adjusted to "Best
   price tracked", range labels collapse to the single price, and
   a hint line surfaces "watching for cheaper alternatives." Old
   behaviour was a separate "Only seen at this store" info panel,
   which the user reported as visually weaker than the bar layout
   even though the comparison data was absent.

   Renamed the still-useful "Verified by Havlo" tile (was "Last
   checked", which QA flagged as ambiguous: who checked, when?
   "Verified by Havlo" makes the actor explicit). */

import { Check, Globe, AlertCircle } from "lucide-react";
import { formatPriceForUser } from "@/lib/utils";
import { type Country } from "@/lib/country";
import { timeAgo } from "@/lib/utils";

interface Props {
  /** Current offer's price IN NGN. formatPriceForUser converts to
      the user's currency at render time. Passing user-currency
      values here would cause double-conversion: the formatter
      assumes its input is NGN and divides by 1600 before applying
      the target FX rate, so a "£20 already-converted" value would
      become £0 (May 2026 bug). */
  thisPriceNgn:    number;
  /** Cheapest known price across this product's dupes, IN NGN. */
  lowestPriceNgn:  number;
  /** Dearest known price across this product's dupes, IN NGN. */
  highestPriceNgn: number;
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
  thisPriceNgn,
  lowestPriceNgn,
  highestPriceNgn,
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

  /* Single-store path detection. Caller passes
     lowestPriceNgn === highestPriceNgn === thisPriceNgn when the
     dupes engine returned no other listings for this product. We
     keep the bar layout (per May 2026 user request — "show the
     price bar relative to this only item price") but swap in
     single-store copy + marker treatment below. */
  const isSingleStore = comparedStoreCount === 0;

  /* Compute the position of `thisPriceNgn` along the [lowest, highest]
     range. 0 = matches lowest (best deal), 1 = matches highest (worst).
     Clamped to [0,1] so a slightly-above-highest price still renders
     at the right end (defensive — should be rare). The math is unit-
     agnostic (it's a ratio), so it works with either NGN or any
     other consistent currency input.

     For single-store the range collapses to 0 and offset = 0 — marker
     pins at the left edge, which reads as "this IS the lowest price
     we've tracked" (de facto cheapest because nothing else is known). */
  const range  = Math.max(highestPriceNgn - lowestPriceNgn, 1); // avoid /0
  const offset = Math.max(0, Math.min(1, (thisPriceNgn - lowestPriceNgn) / range));

  /* Position the marker at offset% from left. Cap visually inset
     by enough pixels that the wider triangle marker can keep its
     full shape visible at the edges. With the SVG triangle being
     14px wide and the bar typically ~280-360px, an inset of 3%
     keeps the triangle base fully on-bar even at the extremes. */
  const markerLeftPct = Math.max(3, Math.min(97, offset * 100));

  /* Verdict label + color — drives both the headline copy and the
     marker bg. Three buckets matched to the green / amber / red
     gradient zones below.

     Single-store override: green tone is the most honest read since
     this IS the lowest known price by definition (there's no other
     listing to be more expensive than), but the headline phrasing
     ("Best price tracked") makes the "we've only seen one" caveat
     explicit. Without an override the multi-store wording would
     read "Lowest price" which is the right framing only when
     there's something to compare against. */
  /* Verdict carries a TEXT color class (used for the SVG marker via
     currentColor) alongside the BG class (was the only field before;
     now unused since the dot marker is gone but kept around in case
     a future surface wants a colored chip in the same hue). */
  const verdict = isSingleStore
    ? { label: "Best price tracked", colour: "text-emerald-600 dark:text-emerald-400", marker: "bg-emerald-500", markerFill: "text-emerald-500" }
    : offset <= 0.33
      ? { label: "Great price",      colour: "text-emerald-600 dark:text-emerald-400", marker: "bg-emerald-500", markerFill: "text-emerald-500" }
      : offset <= 0.66
        ? { label: "Average price",  colour: "text-amber-600 dark:text-amber-400",    marker: "bg-amber-500",   markerFill: "text-amber-500" }
        : { label: "Above average",  colour: "text-red-600 dark:text-red-400",        marker: "bg-red-500",     markerFill: "text-red-500" };

  /* Savings vs the dearest known price — useful framing when this
     offer ISN'T the cheapest but is still notably cheaper than the
     worst comparable price. Only render when meaningful (>5%
     savings) so we don't surface "Save 1%" noise. Suppressed
     entirely for single-store (no "highest" to compare against). */
  const savePctVsHighest = !isSingleStore && highestPriceNgn > 0
    ? Math.round(((highestPriceNgn - thisPriceNgn) / highestPriceNgn) * 100)
    : 0;
  const showSavings = !isSingleStore && savePctVsHighest >= 5 && offset > 0.05;

  /* Headline text branches on single vs multi. Pulled out so both
     the visible <h3> and the aria-label below stay in sync. */
  const headlineText = isSingleStore
    ? "Best price tracked"
    : offset === 0
      /* Renamed from "Cheapest of the bunch" (May 2026, founder
         direction): plain English, parallel to the other verdict
         labels ("Great price" / "Average price" / "Above average")
         which all read as 2-word noun phrases. "Of the bunch" was
         the only marketing-flavour idiom in the verdict set. */
      ? "Lowest price"
      : verdict.label;

  /* Right-side subtitle. "across N stores" reads weird at N=1.
     "1 store · watching for more" sets the expectation that the
     verdict will change as we discover more listings. */
  const subtitleText = isSingleStore
    ? "1 store · watching for more"
    : `across ${comparedStoreCount + 1} stores`;

  return (
    <div className="rounded-2xl bg-surface border border-border p-4 sm:p-5 mb-7">
      {/* Headline */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className={`text-[15px] font-semibold ${verdict.colour}`}>
          {headlineText}
        </h3>
        <span className="text-[11px] text-ink-3 tabular-nums">
          {subtitleText}
        </span>
      </div>

      {/* The bar — 3-zone gradient + downward-pointing triangle
          marker. Triangle sits ABOVE the bar in a non-clipped
          wrapper so the marker stays fully visible even when the
          anchor price sits at the very low or very high end of
          the range (was clipped by the bar's overflow:hidden +
          rounded corners on the previous round-dot variant). The
          triangle's tip points down at the exact position on the
          bar; the larger silhouette + page-bg halo reads as a
          definitive "you are here" marker at any glance distance.

          User report May 2026: "make the mark on the comparison
          bar spectrum more obvious, maybe like a triangle or
          something. When it's at the edge, it's not very visible
          currently." */}
      <div className="relative mb-2">
        {/* Triangle marker — positioned above the bar so it never
            clips. Translate the horizontal anchor to centre on the
            tip; -translate-y aligns the tip just touching the bar
            top. */}
        <div
          className={`absolute top-0 -translate-x-1/2 -translate-y-[10px] z-10 pointer-events-none ${verdict.markerFill}`}
          style={{ left: `${markerLeftPct}%` }}
          aria-hidden="true"
        >
          <svg width="14" height="11" viewBox="0 0 14 11" className="block drop-shadow-sm">
            {/* Downward-pointing triangle. Stroke is the page
                background (theme-aware via --bg-rgb) so the
                triangle gets a visible halo against any of the
                three gradient zones underneath. Fill is the
                verdict colour via currentColor. */}
            <path
              d="M7 11 L0.5 0.5 L13.5 0.5 Z"
              fill="currentColor"
              stroke="rgb(var(--bg-rgb))"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {/* Bar itself. overflow-hidden stays — the gradient
            corners are kept clean; the marker lives in the wrapper
            ABOVE this div now, not as a child. */}
        <div
          className="relative h-2 rounded-full overflow-hidden"
          style={{
            background:
              "linear-gradient(90deg, rgb(16,185,129) 0%, rgb(16,185,129) 33%, rgb(245,158,11) 50%, rgb(239,68,68) 67%, rgb(239,68,68) 100%)",
          }}
          aria-label={
            isSingleStore
              ? `Best price tracked. ${formatPriceForUser(thisPriceNgn, country)} is the only listing we've found so far.`
              : `${verdict.label}. ${formatPriceForUser(thisPriceNgn, country)} of a ${formatPriceForUser(lowestPriceNgn, country)} to ${formatPriceForUser(highestPriceNgn, country)} range across ${comparedStoreCount + 1} stores.`
          }
        />
      </div>

      {/* Range labels — multi-store shows cheapest + highest; single
          store shows just the one price on the left ("only listing")
          since there's no upper bound yet. */}
      {isSingleStore ? (
        <div className="flex items-center justify-between text-[11px] text-ink-3 tabular-nums mb-3">
          <span>
            {formatPriceForUser(thisPriceNgn, country)}
            <span className="ml-1 opacity-70">only listing</span>
          </span>
          <span className="opacity-60">no upper bound yet</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-ink-3 tabular-nums mb-3">
          <span>{formatPriceForUser(lowestPriceNgn, country)}<span className="ml-1 opacity-70">cheapest</span></span>
          <span>{formatPriceForUser(highestPriceNgn, country)}<span className="ml-1 opacity-70">highest</span></span>
        </div>
      )}

      {/* Optional savings line — only when meaningful */}
      {showSavings && (
        <p className="text-[12px] text-ink-2 mb-3">
          You&apos;d save <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPriceForUser(highestPriceNgn - thisPriceNgn, country)}</span> vs the highest known price.
        </p>
      )}

      {/* Single-store hint — replaces the old "Only seen at this
          store" panel's explanation, but in-line so the bar stays
          the dominant visual element. */}
      {isSingleStore && (
        <p className="text-[12px] text-ink-2 mb-3">
          Havlo couldn&apos;t find this exact product at another store yet. The verdict will update if a cheaper or pricier listing surfaces.
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

/* Removed: priceStatsFromDupes + resolveCountry re-export.
   Both were unused (PDP page.tsx builds priceStats inline now)
   and the helper hard-coded the old "user-currency" convention
   that produced the May 2026 £0/£0 bug. The bar's contract is
   now strict NGN — see Props above. */
