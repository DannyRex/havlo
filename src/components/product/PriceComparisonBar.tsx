"use client";

/* Price-vs-market visual indicator for the PDP.

   The marquee feature of Havlo. Three layered signals communicate
   "is this a good price?":
     1. Position — where THIS offer sits on the price spectrum
        across stores carrying the same product.
     2. Per-store dots — every other store carrying this product
        appears as a small dot at its effective price. Visiting
        store's dot rendered prominently with a triangle marker
        + store name label.
     3. Historical context — when price-history data is present,
        the bar surfaces "all-time low: £X (Mar 2026)" and "this
        store's lowest: £Y" so the visitor sees the price story
        not just the price snapshot.

   Trust strip below the bar:
     • Cheapest store called out by name + delta vs visiting store.
     • "Tracked across N stores · last verified X ago" so the
       freshness of the data is visible.
     • Confidence indicator: high / limited based on store count +
       recency of last_verified.
     • Cross-border landed-cost disclosure when any plotted dot is
       cross-border for this visitor.

   Action affordance: when the visiting store ISN'T the cheapest,
   a one-tap "Save £X at [Store] →" row routes to /compare with
   the cheaper offer's pid so the user lands directly on the
   alternative.

   Currency contract: every *Ngn prop is NGN. The bar's
   formatPriceForUser converts to the visitor's display currency at
   render time. Passing user-currency values would double-convert
   and round small-amount products to £0 (May 2026 bug). The
   PerStoreOffer.effectiveNgn from pdp-stats is also NGN, validated
   country-aware via effectiveLandedPrice. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Globe, AlertCircle, TrendingDown, Award, Sparkles, ArrowRight, Plane } from "lucide-react";
import { formatPriceForUser, timeAgo } from "@/lib/utils";
import { type Country } from "@/lib/country";
import type { PerStoreOffer } from "@/lib/pdp-stats";
import type { PriceHistorySummary } from "@/lib/search/price-history";

interface Props {
  /** The visiting offer's price in NGN — the marker position
      anchor. */
  thisPriceNgn:        number;
  /** Store the visitor is currently looking at. Highlighted on the
      bar with the triangle marker + store-name label. */
  thisStoreId:         string;
  thisStoreName:       string;
  thisIsCrossBorder:   boolean;
  /** Country object — drives currency formatting + the
      cross-border-for-visitor judgement on each dot. */
  country:             Country;
  /** Per-store breakdown (all stores carrying this product, with
      country-aware effective prices). Sorted cheapest first. */
  perStoreOffers:      PerStoreOffer[];
  /** Historical price summary — when present, drives "all-time
      low" + "this store's lowest" callouts. Falls back to
      current-prices-only spectrum when absent. */
  priceHistory?:       PriceHistorySummary;
  /** When Havlo last verified the price (ISO string). */
  lastCheckedAt?:      string;
  /** Country the store is anchored to ("UK", "US", null = global). */
  storeCountry?:       string | null;
  /** Out-of-stock flag — when true, render the warning panel
      instead of the bar (no point ranking the price of an
      unavailable item). */
  outOfStock?:         boolean;
  /** Country code for routing the "cheaper at [Store]" action. */
  countryCode:         string;
  /** Product id for the cheaper-at action's `?pid=` backstop. */
  productId?:          string;
  /** Product title for the cheaper-at action's `?q=` parameter. */
  productSearchTitle?: string;
}

/* Visual constants. */
const TRIANGLE_INSET_PCT = 4;       // keep the marker tip visible at extremes
const DOT_INSET_PCT      = 3;       // dots respect the same constraint
const DOT_PIXEL_SIZE     = 8;       // hit-target size for hover/tap

export default function PriceComparisonBar({
  thisPriceNgn,
  thisStoreId,
  thisStoreName,
  thisIsCrossBorder,
  country,
  perStoreOffers,
  priceHistory,
  lastCheckedAt,
  storeCountry,
  outOfStock,
  countryCode,
  productId,
  productSearchTitle,
}: Props) {
  /* Tap-to-reveal popover for per-store dots. Desktop hovers don't
     surface store info clearly (the native title= tooltip is
     unreliable on touch). Now: every dot is a real button; tapping
     opens a small popover above the spectrum with store name +
     price + cross-border flag. Tapping another dot moves the
     popover; tapping outside closes it. Works on both mobile and
     desktop with a single interaction model. */
  const [activeDotStoreId, setActiveDotStoreId] = useState<string | null>(null);
  const barWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeDotStoreId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!barWrapperRef.current?.contains(e.target as Node)) {
        setActiveDotStoreId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [activeDotStoreId]);

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

  /* ── Spectrum range ─────────────────────────────────────────────
     min/max derived from the per-store rows. */
  const allEffectives = perStoreOffers.map((r) => r.effectiveNgn).filter((p) => p > 0);
  const lowestPriceNgn = allEffectives.length > 0 ? Math.min(...allEffectives) : thisPriceNgn;
  const highestPriceNgn = allEffectives.length > 0 ? Math.max(...allEffectives) : thisPriceNgn;

  /* Two distinct collapse cases, NOT folded together:
       isSingleStore — only one store carries the product. The bar
                       degrades to "watching for more" + a pinned
                       marker.
       allTiedPrices — multiple stores but every price is identical.
                       Was previously bucketed into isSingleStore,
                       which caused the dots-disappear bug: the CTA
                       said "Compare across 4 stores" but the bar
                       hid all dots and read "1 store · watching
                       for more". Now we keep multi-store mode,
                       stack dots at the centre, and surface
                       "Tied at £X" copy. */
  const isSingleStore = perStoreOffers.length <= 1;
  const allTiedPrices = !isSingleStore && lowestPriceNgn === highestPriceNgn;

  /* Position calculation. Map any NGN price to a 0..1 position along
     the spectrum, clamped. range >= 1 protects against /0 in
     single-store mode.

     When every store is tied, the gradient stops being meaningful
     (there's no "low end" or "high end" to position relative to),
     so we force every marker — triangle + dots — to the centre
     of a solid-green bar instead. Keeps the dots visible without
     stacking them at the left edge. */
  const range = Math.max(highestPriceNgn - lowestPriceNgn, 1);
  const positionOf = (priceNgn: number): number =>
    allTiedPrices
      ? 0.5
      : Math.max(0, Math.min(1, (priceNgn - lowestPriceNgn) / range));
  const offset = positionOf(thisPriceNgn);

  /* Triangle marker — visiting store. Inset so the tip stays
     fully on-bar at extreme positions. */
  const markerLeftPct = Math.max(TRIANGLE_INSET_PCT, Math.min(100 - TRIANGLE_INSET_PCT, offset * 100));

  /* Dynamic label-translate based on marker position so long
     store names ("John Lewis & Partners", "Currys Business") at
     the bar's extremes don't get visually clipped off-screen.
     Aligns the label's start, centre, or end to the marker
     depending on which edge it's near. Computed as a string
     instead of a Tailwind class so we can ramp smoothly. */
  const labelTranslateX = markerLeftPct < 15
    ? "0%"
    : markerLeftPct > 85
      ? "-100%"
      : "-50%";

  /* MSRP tick removed (May 2026). The ProductHero already shows
     the strikethrough "£60 £80 You save £20" treatment in the
     hero price block, which conveys the discount cleanly.
     Plotting the same number as a tick on the spectrum carried
     ambiguous labelling ("MSRP" → jargon; "List price" → users
     read it as "average price across stores"). Dropped the tick
     entirely; the bar now focuses on per-store CURRENT prices
     only. */

  /* ── Verdict ───────────────────────────────────────────────────
     Headline + color + marker tone. Three-bucket green/amber/red
     mapped to the spectrum thirds. Single-store overrides to
     "Best price tracked" — by definition it's the cheapest known.

     History-aware override: surface "Lowest in 90 days" when the
     visiting store's current price matches the historical floor.
     Was previously labelled "All-time low" but the lookback
     window is 90d (see product_price_history RPC), and we don't
     have data from before our tracking started — calling it
     "all-time" overpromises. "Lowest in 90 days" is honest and
     still a strong buy signal.

     Confidence guard: requires `storeCount >= 2` so we don't
     trumpet "lowest" for a product that only one store has ever
     listed (the floor IS trivially that store's price in that
     case, no real signal). Below that threshold we fall back to
     the regular spectrum verdict. */
  const isHistoricalLow = priceHistory
    && priceHistory.storeCount >= 2
    && Math.abs(thisPriceNgn - priceHistory.allTimeLowNgn) <= 100
    && priceHistory.allTimeLowStoreId === thisStoreId;

  let verdict: {
    label:      string;
    colour:     string;
    markerFill: string;
  };
  if (isHistoricalLow) {
    verdict = { label: "Lowest in 90 days",  colour: "text-emerald-600 dark:text-emerald-400", markerFill: "text-emerald-500" };
  } else if (isSingleStore) {
    verdict = { label: "Best price tracked", colour: "text-emerald-600 dark:text-emerald-400", markerFill: "text-emerald-500" };
  } else if (allTiedPrices) {
    /* Every store charges the same — useful trust signal: no
       deal to chase, this is the going rate. Green tone keeps the
       feel positive (no overcharging anywhere). */
    verdict = { label: "Same price everywhere", colour: "text-emerald-600 dark:text-emerald-400", markerFill: "text-emerald-500" };
  } else if (offset === 0) {
    verdict = { label: "Lowest price",       colour: "text-emerald-600 dark:text-emerald-400", markerFill: "text-emerald-500" };
  } else if (offset <= 0.33) {
    verdict = { label: "Great price",        colour: "text-emerald-600 dark:text-emerald-400", markerFill: "text-emerald-500" };
  } else if (offset <= 0.66) {
    verdict = { label: "Average price",      colour: "text-amber-600 dark:text-amber-400",     markerFill: "text-amber-500"   };
  } else {
    verdict = { label: "Above average",      colour: "text-red-600 dark:text-red-400",         markerFill: "text-red-500"     };
  }

  const otherStoresCount = Math.max(0, perStoreOffers.length - 1);
  const subtitleText = isSingleStore
    ? "1 store · watching for more"
    : allTiedPrices
      ? `across ${perStoreOffers.length} stores · same price`
      : `across ${perStoreOffers.length} stores`;

  /* ── Cheapest-at action ─────────────────────────────────────────
     When the visitor isn't on the cheapest store, surface a
     one-tap "Save £X at [Store]" row. The savings number is real
     (current price minus cheapest known) and the link routes to
     /compare so the user sees the full breakdown in context. */
  const cheapest = perStoreOffers[0];
  const notOnCheapest = !isSingleStore
    && cheapest
    && cheapest.storeId !== thisStoreId
    && cheapest.effectiveNgn < thisPriceNgn;
  const cheaperSavings = notOnCheapest ? thisPriceNgn - cheapest.effectiveNgn : 0;
  const cheaperHref = (() => {
    if (!notOnCheapest) return null;
    const params = new URLSearchParams({ mode: "similar" });
    if (productSearchTitle) params.set("q", productSearchTitle);
    if (productId)          params.set("pid", productId);
    return `/${countryCode}/compare?${params.toString()}`;
  })();

  /* ── Savings math line ──────────────────────────────────────────
     Plain-English single line so the user has a number to anchor
     on. Hierarchy: "this IS the cheapest" → "Save £X vs highest" →
     skip when the spread is trivially small (< 5%). */
  const savingsVsHighest = !isSingleStore && highestPriceNgn > thisPriceNgn
    ? highestPriceNgn - thisPriceNgn
    : 0;
  const savingsPctVsHighest = !isSingleStore && highestPriceNgn > 0
    ? Math.round((savingsVsHighest / highestPriceNgn) * 100)
    : 0;
  const savingsCopy: string | null = (() => {
    if (isSingleStore) return null;
    if (offset === 0) return "This is the cheapest price across the stores we track.";
    if (savingsPctVsHighest >= 5) {
      return `You'd save ${formatPriceForUser(savingsVsHighest, country)} vs the highest known price.`;
    }
    return null;
  })();

  /* ── Cross-border presence ──────────────────────────────────────
     The disclaimer renders when ANY plotted dot is cross-border
     for THIS visitor. Visitor-aware (not the raw is_international
     DB flag) so UK retailers on a UK PDP don't trigger it. */
  const anyXBorder = perStoreOffers.some((r) => r.isCrossBorder);

  /* ── Confidence indicator ───────────────────────────────────────
     Transparent freshness signal — not a fake score. Bands:
       high   — ≥3 stores AND last verified < 24h ago
       medium — ≥2 stores OR last verified < 7d ago
       limited — anything else
     The PDP visit-time test for `< 24h` uses lastCheckedAt as a
     proxy for "is our data current?"; richer sources (per-store
     scraped_at timestamps) would refine this in a future pass. */
  const confidence = (() => {
    const stores = perStoreOffers.length;
    const ageMs = lastCheckedAt ? Date.now() - new Date(lastCheckedAt).getTime() : Infinity;
    const fresh24h = ageMs < 24 * 60 * 60 * 1000;
    const fresh7d  = ageMs < 7 * 24 * 60 * 60 * 1000;
    if (stores >= 3 && fresh24h) return { label: "High confidence",    tone: "text-emerald-600 dark:text-emerald-400" };
    if (stores >= 2 || fresh7d)   return { label: "Medium confidence",  tone: "text-ink-2" };
    return                              { label: "Limited data",        tone: "text-amber-600 dark:text-amber-400" };
  })();

  return (
    <div className="rounded-2xl bg-surface border border-border p-4 sm:p-5 mb-7">
      {/* ── Headline ─────────────────────────────────────────────
          Verdict label + subtitle ("across N stores" or "1 store ·
          watching for more"). All-time-low headline carries the
          extra "Award" icon as a visual exclamation point. */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className={`text-[15px] font-semibold flex items-center gap-1.5 ${verdict.colour}`}>
          {isHistoricalLow && <Award size={15} className="shrink-0" aria-hidden="true" />}
          {verdict.label}
        </h3>
        <span className="text-[11px] text-ink-3 tabular-nums">
          {subtitleText}
        </span>
      </div>

      {/* ── The bar ─────────────────────────────────────────────── */}
      <div className="relative mb-2" ref={barWrapperRef}>
        {/* Triangle marker — visiting store, positioned above the bar */}
        <div
          className={`absolute top-0 -translate-x-1/2 -translate-y-[10px] z-20 pointer-events-none ${verdict.markerFill}`}
          style={{ left: `${markerLeftPct}%` }}
          aria-hidden="true"
        >
          <svg width="14" height="11" viewBox="0 0 14 11" className="block drop-shadow-sm">
            <path
              d="M7 11 L0.5 0.5 L13.5 0.5 Z"
              fill="currentColor"
              stroke="rgb(var(--bg-rgb))"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Bar itself + dots underneath */}
        <div
          className="relative h-2 rounded-full overflow-visible"
          aria-label={
            isSingleStore
              ? `Best price tracked. ${formatPriceForUser(thisPriceNgn, country)} is the only listing we've found so far.`
              : `${verdict.label}. ${formatPriceForUser(thisPriceNgn, country)} of a ${formatPriceForUser(lowestPriceNgn, country)} to ${formatPriceForUser(highestPriceNgn, country)} range across ${perStoreOffers.length} stores.`
          }
        >
          {/* Bar background. Gradient (green→amber→red across the
              price spread) for the normal case. Solid green when
              every store is tied — the gradient's "low end / high
              end" framing stops being meaningful when there's no
              spread, and a solid colour reads as "no overcharging
              anywhere" without implying a winning store. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: allTiedPrices
                ? "rgb(16,185,129)"
                : "linear-gradient(90deg, rgb(16,185,129) 0%, rgb(16,185,129) 33%, rgb(245,158,11) 50%, rgb(239,68,68) 67%, rgb(239,68,68) 100%)",
            }}
          />

          {/* Per-store dots — every other store rendered at its
              effective-price position. Visiting store's dot is
              skipped because the triangle marker above represents
              it. Each dot is a <button> with a 28×28 hit target so
              taps register reliably on mobile (Apple HIG: min
              44px; we get to 28 with the surrounding bar margin
              extending the practical hit zone). Tapping opens the
              popover above the bar with store name + price +
              cross-border flag. */}
          {!isSingleStore && perStoreOffers.map((row) => {
            if (row.storeId === thisStoreId) return null;
            const pos = positionOf(row.effectiveNgn);
            const left = Math.max(DOT_INSET_PCT, Math.min(100 - DOT_INSET_PCT, pos * 100));
            const isCheapestDot = row.storeId === cheapest?.storeId;
            const isActive      = activeDotStoreId === row.storeId;
            return (
              <button
                key={row.storeId}
                type="button"
                /* Desktop: hover reveals the popover (mouse-driven
                   discovery, no click needed). Mobile / touch: tap
                   toggles since hover doesn't exist on touch devices.
                   Both paths converge on setActiveDotStoreId — the
                   popover state machine is identical, only the
                   trigger event differs.

                   onMouseEnter/Leave is desktop-only (no-op on touch);
                   onClick stays as the mobile fallback. onTouchStart
                   on touch devices fires BEFORE onMouseEnter so the
                   activation order is deterministic. */
                onMouseEnter={() => setActiveDotStoreId(row.storeId)}
                onMouseLeave={() => setActiveDotStoreId((current) => (current === row.storeId ? null : current))}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDotStoreId(isActive ? null : row.storeId);
                }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center pointer-events-auto z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                style={{ left: `${left}%` }}
                aria-label={`${row.storeName} at ${formatPriceForUser(row.effectiveNgn, country)}`}
                aria-pressed={isActive}
              >
                <span
                  className={`block rounded-full transition-all ${
                    isCheapestDot
                      ? "bg-emerald-700 ring-2 ring-white/90"
                      : "bg-ink/70 ring-2 ring-white/70"
                  } ${isActive ? "scale-150" : "hover:scale-125"}`}
                  style={{
                    width:  `${DOT_PIXEL_SIZE}px`,
                    height: `${DOT_PIXEL_SIZE}px`,
                  }}
                  aria-hidden="true"
                />
              </button>
            );
          })}

          {/* Per-store popover — renders above the active dot with
              store name + effective price + cross-border flag. The
              popover position mirrors the active dot's left% so
              it sits directly above. -top-14 leaves room for the
              triangle marker that lives at -top-3. The translate-x
              auto-centers; clamping the position at extremes
              (3-97%) keeps the popover on-screen even at the
              ends of the bar. */}
          {!isSingleStore && activeDotStoreId && (() => {
            const row = perStoreOffers.find((r) => r.storeId === activeDotStoreId);
            if (!row || row.storeId === thisStoreId) return null;
            const pos = positionOf(row.effectiveNgn);
            const left = Math.max(DOT_INSET_PCT, Math.min(100 - DOT_INSET_PCT, pos * 100));
            /* Edge-aware horizontal anchor — was always -translate-x-1/2
               (center on dot), which clipped on small viewports when
               the dot sat at the bar's extreme left/right. User
               report May 2026: popover gets cut off on mobile at the
               edges.

               New behaviour:
                 left < 20%    → anchor popover to LEFT (no translate)
                 left > 80%    → anchor popover to RIGHT (-100% translate)
                 otherwise     → center (-50% translate, current)

               The arrow tail position adjusts to match (see below). */
            const anchor: "left" | "right" | "center" =
              left < 20 ? "left" : left > 80 ? "right" : "center";
            const translateClass =
              anchor === "left"  ? "translate-x-0" :
              anchor === "right" ? "-translate-x-full" :
                                   "-translate-x-1/2";
            return (
              <div
                role="dialog"
                aria-label={`${row.storeName} details`}
                className={`absolute -top-16 ${translateClass} z-30 rounded-lg bg-ink text-bg px-2.5 py-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.25)] whitespace-nowrap pointer-events-none max-w-[calc(100vw-2rem)]`}
                style={{ left: `${left}%` }}
                data-anchor={anchor}
              >
                <p className="text-[11px] font-semibold leading-tight">
                  {row.storeName}
                </p>
                <p className="text-[12px] tabular-nums font-bold leading-tight">
                  {formatPriceForUser(row.effectiveNgn, country)}
                </p>
                {row.isCrossBorder && (
                  <p className="text-[10px] text-amber-300 inline-flex items-center gap-1 mt-0.5 leading-tight">
                    <Plane size={9} aria-hidden="true" /> Cross-border
                  </p>
                )}
                {/* Tail pointing at the dot below — position adjusts
                    to match the popover's edge-aware anchor so the
                    triangle still points AT the dot, not into empty
                    space.
                      center: triangle in the middle of popover
                      left-anchored: triangle near popover's left edge
                      right-anchored: triangle near popover's right edge */}
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-1 w-2 h-2 rotate-45 bg-ink ${
                    anchor === "left"  ? "left-3" :
                    anchor === "right" ? "right-3" :
                                          "left-1/2 -translate-x-1/2"
                  }`}
                />
              </div>
            );
          })()}
        </div>

        {/* Visiting-store name label, positioned under the triangle
            so the user sees "You're on [Store]" at a glance. */}
        {!isSingleStore && (
          <div
            className="absolute -bottom-5 pointer-events-none"
            style={{
              left: `${markerLeftPct}%`,
              /* Dynamic translateX so long store names don't clip
                 off-screen at the bar's extremes. Anchors:
                   <15%  → label's LEFT edge sits on the marker
                   >85%  → label's RIGHT edge sits on the marker
                   else  → centred on the marker (-50%)            */
              transform: `translateX(${labelTranslateX})`,
            }}
            aria-hidden="true"
          >
            <p className="text-[10px] font-medium text-ink-2 whitespace-nowrap">
              {thisStoreName}
            </p>
          </div>
        )}
      </div>

      {/* Spacer for the visiting-store label sitting below the bar. */}
      {!isSingleStore && <div className="h-5" />}

      {/* ── Range labels ───────────────────────────────────────── */}
      {isSingleStore ? (
        <div className="flex items-center justify-between text-[11px] text-ink-3 tabular-nums mb-3">
          <span>
            {formatPriceForUser(thisPriceNgn, country)}
            <span className="ml-1 opacity-70">only listing</span>
          </span>
          <span className="opacity-60">no upper bound yet</span>
        </div>
      ) : allTiedPrices ? (
        /* Tied across all stores — single centred label. The
           cheapest/highest framing is meaningless when low === high
           ("£60 cheapest · £60 highest" reads as a typo).  */
        <div className="flex items-center justify-center text-[11px] text-ink-3 tabular-nums mb-3">
          <span>
            {formatPriceForUser(lowestPriceNgn, country)}
            <span className="ml-1 opacity-70">across {perStoreOffers.length} stores</span>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-ink-3 tabular-nums mb-3">
          <span>
            {formatPriceForUser(lowestPriceNgn, country)}
            <span className="ml-1 opacity-70">cheapest</span>
          </span>
          <span>
            {formatPriceForUser(highestPriceNgn, country)}
            <span className="ml-1 opacity-70">highest</span>
          </span>
        </div>
      )}

      {/* ── Savings math line ──────────────────────────────────── */}
      {savingsCopy && (
        <p className="text-[12px] text-ink-2 mb-3">
          {savingsCopy}
        </p>
      )}

      {/* ── Cheaper-at action ────────────────────────────────────
          Gated at 2% of price OR 500 NGN min, whichever is higher,
          so a "Save ₦80" line doesn't compete with the savings
          headline above. The gate fires often for high-ticket
          items and rarely for budget products — exactly the
          shape we want (visibility scales with stakes). */}
      {cheaperHref && cheaperSavings >= Math.max(500, thisPriceNgn * 0.02) && (
        <Link
          href={cheaperHref}
          className="mb-3 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300/40 hover:border-emerald-400/60 transition-colors group"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <TrendingDown size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="text-[13px] text-emerald-800 dark:text-emerald-200 truncate">
              Save <span className="font-semibold">{formatPriceForUser(cheaperSavings, country)}</span> at <span className="font-semibold">{cheapest!.storeName}</span>
            </span>
          </span>
          <ArrowRight size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Link>
      )}

      {/* ── Historical signal ──────────────────────────────────── */}
      {priceHistory && !isHistoricalLow && (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-surface-2 border border-border">
          <p className="text-[11px] text-ink-2 leading-relaxed">
            <Sparkles size={11} className="inline-block mr-1 -mt-0.5 text-ink-3" aria-hidden="true" />
            Lowest tracked: <span className="font-semibold text-ink tabular-nums">
              {formatPriceForUser(priceHistory.allTimeLowNgn, country)}
            </span>
            <span className="text-ink-3"> · {timeAgo(priceHistory.allTimeLowAt)}</span>
            {priceHistory.thisStoreLowNgn !== undefined
              && priceHistory.thisStoreLowNgn < thisPriceNgn
              && priceHistory.allTimeLowStoreId !== thisStoreId && (
              <>
                <span className="text-ink-3"> · at this store: </span>
                <span className="font-semibold text-ink tabular-nums">
                  {formatPriceForUser(priceHistory.thisStoreLowNgn, country)}
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Single-store hint ──────────────────────────────────── */}
      {isSingleStore && (
        <p className="text-[12px] text-ink-2 mb-3">
          Havlo couldn&apos;t find this exact product at another store yet. The verdict will update if a cheaper or pricier listing surfaces.
        </p>
      )}

      {/* ── Trust strip ────────────────────────────────────────────
          Confidence + cheapest-store + verification timestamp +
          ships-from country. Compact line above the cross-border
          disclaimer so the trust signals live next to the price
          claim they support. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] pt-3 border-t border-border">
        <span className={`inline-flex items-center gap-1 font-medium ${confidence.tone}`}>
          <Check size={11} aria-hidden="true" />
          {confidence.label}
        </span>
        {lastCheckedAt && (
          <span className="inline-flex items-center gap-1 text-ink-3">
            <span aria-hidden="true">·</span>
            Verified {timeAgo(lastCheckedAt)}
          </span>
        )}
        {!isSingleStore && cheapest && cheapest.storeId !== thisStoreId && (
          <span className="inline-flex items-center gap-1 text-ink-3">
            <span aria-hidden="true">·</span>
            Cheapest at <span className="font-medium text-ink-2">{cheapest.storeName}</span>
          </span>
        )}
        {storeCountry && (
          <span className="inline-flex items-center gap-1 text-ink-3">
            <Globe size={10} aria-hidden="true" />
            Ships from {storeCountry}
          </span>
        )}
      </div>

      {/* ── Cross-border landed-cost disclosure ──────────────────
          Visitor-aware via the per-store isCrossBorder flag —
          surfaces only when at least one plotted dot is genuinely
          cross-border for this visitor. */}
      {anyXBorder && (
        <p className="mt-2.5 text-[11px] text-ink-3 leading-relaxed">
          <span className="text-amber-500">⚑</span>{" "}
          Cross-border prices include a ~30% landed estimate (shipping + customs).
          Final total varies by carrier and customs assessment.
        </p>
      )}
      {/* When the visiting offer itself is cross-border but no
          other dot is, the visitor still benefits from this
          disclaimer. The check above misses that case, so render
          here as a fallback. */}
      {!anyXBorder && thisIsCrossBorder && (
        <p className="mt-2.5 text-[11px] text-ink-3 leading-relaxed">
          <span className="text-amber-500">⚑</span>{" "}
          This offer ships across borders. The price includes a ~30% landed
          estimate for shipping and customs.
        </p>
      )}
    </div>
  );
}

