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
   PerStoreOffer.effectiveNgn from pdp-stats is the RAW merchant price
   in NGN (#16) so the bar's headline / "cheapest" agrees with the hero
   big-price and the price-history chart; the cross-border landed total
   is surfaced separately as the "+ ~30% shipping/customs" est.
   disclosure below. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Globe, AlertCircle, TrendingDown, Award, History, ArrowRight, Plane, RotateCcw } from "lucide-react";
import { formatPriceForUser, formatPriceDeltaForUser, timeAgo } from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
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
  /** Out-of-stock offers for THIS product, as labelled context only
      (computeAnchorStats.outOfStock). Rendered as a greyed "last seen —
      out of stock" strip below the bar; NEVER part of the spectrum / verdict
      / cheapest math (those run on perStoreOffers, which is in-stock only). */
  outOfStockOffers?:   PerStoreOffer[];
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
  perStoreOffers: allPerStoreOffers,
  priceHistory,
  lastCheckedAt,
  storeCountry,
  outOfStock,
  countryCode,
  productId,
  productSearchTitle,
  outOfStockOffers,
}: Props) {
  /* Cluster-based popover (May 2026 rewrite). Dots within
     CLUSTER_THRESHOLD_PCT of each other on the spectrum belong to
     one cluster and share a single popover that LISTS every store
     in the band. A click on any dot in a cluster opens the same
     popover — the user's question on a price spectrum is "which
     stores sit around here?", not "which single store?", so one
     callout answers it in one tap.

     This replaces the previous per-store popover (state keyed by
     offerId) which forced N taps to inspect N close-priced stores
     and required vertical row-fanning to keep hit zones separated.
     The fan put dots visually off the bar — a price-spectrum dot
     drifting up or down loses its primary semantic ("position =
     price"). Clusters keep every dot on the centerline. */
  const [activeClusterId, setActiveClusterId] = useState<number | null>(null);
  const barWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeClusterId === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!barWrapperRef.current?.contains(e.target as Node)) {
        setActiveClusterId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [activeClusterId]);

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

  /* ── Used / refurbished split (May 2026 PDP-trust fix) ───────────
     Used/refurb listings are real datapoints but must NOT silently
     become the headline "cheapest". A £123 used unit under a £200 new
     one would otherwise drag the spectrum low end down, flip the
     visiting NEW offer's verdict to "Above average", and headline a
     price the buyer can't actually get new.

     So EVERY spectrum / verdict / cheapest / dot calculation below
     runs on the NEW-only subset (we just rebind `perStoreOffers` to
     it, leaving the ~700 lines downstream untouched), and used rows
     are surfaced as a separately-LABELLED line beneath the bar.

     Fallback: if EVERY listing is used, keep showing them all so the
     bar doesn't blank out — there's simply no new price to rank
     against, and the used line is suppressed (nothing to contrast). */
  const newPerStore = allPerStoreOffers.filter((r) => !r.isUsed);
  const perStoreOffers = newPerStore.length > 0 ? newPerStore : allPerStoreOffers;
  const usedOffers = (newPerStore.length > 0 ? allPerStoreOffers.filter((r) => r.isUsed) : [])
    .filter((r) => r.storeId !== thisStoreId && r.effectiveNgn > 0)
    .sort((a, b) => a.effectiveNgn - b.effectiveNgn);

  /* ── Spectrum range ─────────────────────────────────────────────
     min/max derived from the per-store rows. */
  const allEffectives = perStoreOffers.map((r) => r.effectiveNgn).filter((p) => p > 0);
  const lowestPriceNgn = allEffectives.length > 0 ? Math.min(...allEffectives) : thisPriceNgn;
  const highestPriceNgn = allEffectives.length > 0 ? Math.max(...allEffectives) : thisPriceNgn;

  /* Cluster computation. Walk dots sorted by X position; chain dots
     within CLUSTER_THRESHOLD_PCT of the previous into one cluster.
     For multi-dot clusters, redistribute each dot's display X to
     give visible separation (DOT_SPACING_PCT) while keeping the
     cluster centered at its true price centroid.

       CLUSTER_THRESHOLD_PCT  3 — dots within 3% are visually
         indistinguishable on the bar and belong in one band.
       DOT_SPACING_PCT        1.8 — ~10-12px visual spacing on a
         common bar width. Small enough that the dot's displayed
         X stays close to its true price-position; large enough
         that each dot reads as its own circle, not a blur.

     dotAssignByOfferId maps offerId → { clusterId, displayLeftPct }
     so the render loop can position each dot and route its click
     to the right cluster popover. */
  const CLUSTER_THRESHOLD_PCT = 3;
  /* Spacing between dots in a cluster. Sized so the gap is visible
     on a 330-px mobile bar (3% ≈ 10px between dot centres, 2px of
     whitespace between the 8-px circles) while not feeling sprawled
     on desktop. */
  const DOT_SPACING_PCT       = 3;

  interface ClusterDef {
    id:        number;
    offerIds:  string[];
    centerPct: number;
    minNgn:    number;
    maxNgn:    number;
  }
  interface DotAssignment {
    clusterId:      number;
    displayLeftPct: number;
  }
  const clusters: ClusterDef[]                       = [];
  const dotAssignByOfferId = new Map<string, DotAssignment>();
  {
    const cands = perStoreOffers
      .filter((row) => row.storeId !== thisStoreId)
      .map((row) => ({
        offerId:      row.offerId,
        effectiveNgn: row.effectiveNgn,
        leftPct: lowestPriceNgn === highestPriceNgn
          ? 50
          : ((row.effectiveNgn - lowestPriceNgn) / (highestPriceNgn - lowestPriceNgn) * 100),
      }))
      .sort((a, b) => a.leftPct - b.leftPct);

    /* Dot cap (readability). A popular product can carry 60+ stores; plotting
       every one turns the spectrum into a barcode. Keep the cheapest + dearest
       endpoints plus an evenly-spaced sample between them, so the bar still
       shows the true spread + the floor without the clutter. The verdict,
       "cheapest at X", store count, and lowest/highest are all computed on the
       FULL perStoreOffers above — only the rendered dots are thinned. The
       visiting store is its own triangle marker and is never in cands. */
    const MAX_DOTS = 14;
    const dotCands = cands.length <= MAX_DOTS ? cands : (() => {
      const keep = new Set<number>([0, cands.length - 1]);
      const step = (cands.length - 1) / (MAX_DOTS - 1);
      for (let i = 1; i < MAX_DOTS - 1; i++) keep.add(Math.round(i * step));
      return Array.from(keep).sort((a, b) => a - b).map((i) => cands[i]);
    })();

    let current: { offerIds: string[]; pcts: number[]; ngns: number[] } | null = null;
    const flush = () => {
      if (!current) return;
      const id  = clusters.length;
      const sum = current.pcts.reduce((a, b) => a + b, 0);
      clusters.push({
        id,
        offerIds:  current.offerIds,
        centerPct: sum / current.pcts.length,
        minNgn:    Math.min(...current.ngns),
        maxNgn:    Math.max(...current.ngns),
      });
      current = null;
    };
    for (const c of dotCands) {
      const lastInCurrent = current ? current.pcts[current.pcts.length - 1] : null;
      if (current && lastInCurrent !== null && c.leftPct - lastInCurrent <= CLUSTER_THRESHOLD_PCT) {
        current.offerIds.push(c.offerId);
        current.pcts.push(c.leftPct);
        current.ngns.push(c.effectiveNgn);
      } else {
        flush();
        current = { offerIds: [c.offerId], pcts: [c.leftPct], ngns: [c.effectiveNgn] };
      }
    }
    flush();

    /* For each cluster, lay dots out evenly around the cluster's
       centroid so they sit on the bar with a small visible gap.
       Single-dot clusters keep their true X (no shift). */
    for (const cluster of clusters) {
      const n = cluster.offerIds.length;
      if (n === 1) {
        const cand = dotCands.find((c) => c.offerId === cluster.offerIds[0])!;
        dotAssignByOfferId.set(cluster.offerIds[0], {
          clusterId:      cluster.id,
          displayLeftPct: cand.leftPct,
        });
      } else {
        const totalSpread = (n - 1) * DOT_SPACING_PCT;
        /* Edge clamp the cluster as a whole so a cluster at the bar's
           extreme (e.g. two stores tied at the lowest price → cluster
           centroid at 0%) still produces distinct dot positions. Per-
           dot clamping via DOT_INSET_PCT later would otherwise collapse
           both dots back to the same X. Shift the cluster bodily into
           the [DOT_INSET_PCT, 100 - DOT_INSET_PCT - totalSpread] band
           and lay dots out from there. */
        let startPct = cluster.centerPct - totalSpread / 2;
        const minStart = DOT_INSET_PCT;
        const maxStart = 100 - DOT_INSET_PCT - totalSpread;
        if (startPct < minStart) startPct = minStart;
        else if (startPct > maxStart) startPct = maxStart;
        for (let i = 0; i < n; i++) {
          dotAssignByOfferId.set(cluster.offerIds[i], {
            clusterId:      cluster.id,
            displayLeftPct: startPct + i * DOT_SPACING_PCT,
          });
        }
      }
    }
  }

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
     fully on-bar at extreme positions. A single store has no spread to
     sit within, so centre it on the neutral bar instead of letting the
     degenerate 0-width range pin it to the green "cheapest" end. */
  const markerLeftPct = isSingleStore
    ? 50
    : Math.max(TRIANGLE_INSET_PCT, Math.min(100 - TRIANGLE_INSET_PCT, offset * 100));

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
    /* One store means there's nothing to compare against, so a green
       "Best price tracked" verdict misreads as "we checked and this one
       won" — user report June 2026: a product that was the priciest of
       its on-page alternatives still showed green "Best price tracked"
       on its own PDP. Neutral tone + an honest label, no cheapest claim. */
    verdict = { label: "No comparison yet", colour: "text-ink-2", markerFill: "text-ink-3" };
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
    /* Single-store framing — was "1 store · watching for more".
       Phase 6 audit user-test: that copy read as "weak comparison
       data" instead of "we found this for you". Reframed to centre
       the user — "Only seller we track right now" is conversational,
       acknowledges the catalog reality, and primes the reader for
       the bar's downstream "we'll add comparisons" message without
       sounding apologetic. */
    ? "Only seller we track right now"
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
      /* Delta derived from the SAME rounded prices shown as "cheapest
         now / highest now" above, so the saving can't read £8 while
         the labels differ by £9 (QA #11). */
      return `You'd save ${formatPriceDeltaForUser(highestPriceNgn, thisPriceNgn, country)} vs the highest known price.`;
    }
    return null;
  })();

  /* ── Cross-border presence ──────────────────────────────────────
     The disclaimer renders when ANY plotted dot is cross-border
     for THIS visitor. Visitor-aware (not the raw is_international
     DB flag) so UK retailers on a UK PDP don't trigger it. */
  const anyXBorder = perStoreOffers.some((r) => r.isCrossBorder);

  /* Confidence score ("High/Medium confidence" / "Limited data") removed
     June 2026: a derived meta-label that added anxiety ("Limited data") and
     contradicted the chart's "Price history from N stores" right below it.
     The honest signals carry the trust without a fake score: "Verified Xago"
     freshness in the strip + the store count in the subtitle. */

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
              ? `No price comparison yet. ${formatPriceForUser(thisPriceNgn, country)} is the only listing we've found so far.`
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
              background: isSingleStore
                /* Neutral slate — the green→amber→red spectrum implies a
                   price range that a lone offer doesn't have, so it stays
                   plain rather than painting the one price "cheapest". */
                ? "rgb(148,163,184)"
                : allTiedPrices
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
            const assignment = dotAssignByOfferId.get(row.offerId);
            if (!assignment) return null;

            const left = Math.max(DOT_INSET_PCT, Math.min(100 - DOT_INSET_PCT, assignment.displayLeftPct));
            const isCheapestDot     = row.offerId === cheapest?.offerId;
            const isInActiveCluster = activeClusterId === assignment.clusterId;

            return (
              <button
                key={row.offerId}
                type="button"
                /* Every dot in a cluster routes to the SAME activeClusterId.
                   Hover/click on any dot opens the shared cluster popover.
                   No vertical fanning — dots stay on the bar centerline so
                   the "position = price" semantic of the spectrum holds. */
                onMouseEnter={() => setActiveClusterId(assignment.clusterId)}
                onMouseLeave={() => setActiveClusterId((current) => (current === assignment.clusterId ? null : current))}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveClusterId(isInActiveCluster ? null : assignment.clusterId);
                }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center pointer-events-auto z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                style={{ left: `${left}%` }}
                aria-label={`${displayStoreName(row.storeName)} at ${formatPriceForUser(row.effectiveNgn, country)}`}
                aria-pressed={isInActiveCluster}
              >
                <span
                  className={`block rounded-full transition-transform duration-150 ${
                    isCheapestDot
                      ? "bg-emerald-700 ring-2 ring-white/90"
                      : "bg-ink/70 ring-2 ring-white/70"
                  } ${isInActiveCluster ? "scale-150" : ""}`}
                  style={{
                    width:  `${DOT_PIXEL_SIZE}px`,
                    height: `${DOT_PIXEL_SIZE}px`,
                  }}
                  aria-hidden="true"
                />
              </button>
            );
          })}

          {/* Cluster popover — renders above the active cluster's
              centroid. For a 1-store cluster, it's a compact pill
              (store name + price). For 2+ stores, it's a small
              list: header ("3 stores at ₦1.7M" or "3 stores from
              ₦1.65M – ₦1.75M") plus a row per store with price and
              cross-border flag. One callout answers "which stores
              sit at this price band?" — the actual question a
              price-spectrum user asks. */}
          {!isSingleStore && activeClusterId !== null && (() => {
            const cluster = clusters[activeClusterId];
            if (!cluster) return null;
            const clusterOffers = cluster.offerIds
              .map((id) => perStoreOffers.find((o) => o.offerId === id))
              .filter((o): o is PerStoreOffer => Boolean(o));
            if (clusterOffers.length === 0) return null;

            const left = Math.max(DOT_INSET_PCT, Math.min(100 - DOT_INSET_PCT, cluster.centerPct));

            /* Edge-aware horizontal anchor — keeps the popover on-screen
               at the bar's extreme left/right on small viewports.
                 left  < 20%  → anchor LEFT  (no translate)
                 left  > 80%  → anchor RIGHT (-100% translate)
                 otherwise    → CENTER       (-50% translate) */
            const anchor: "left" | "right" | "center" =
              left < 20 ? "left" : left > 80 ? "right" : "center";
            const translateClass =
              anchor === "left"  ? "translate-x-0" :
              anchor === "right" ? "-translate-x-full" :
                                   "-translate-x-1/2";

            /* SINGLE-STORE CLUSTER — compact pill (the common case
               for isolated dots; this preserves the original tooltip
               feel where most spectra are sparse). */
            if (clusterOffers.length === 1) {
              const row = clusterOffers[0];
              return (
                <div
                  role="dialog"
                  aria-label={`${displayStoreName(row.storeName)} details`}
                  className={`absolute -top-16 ${translateClass} z-30 rounded-lg bg-ink text-bg px-2.5 py-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.25)] whitespace-nowrap pointer-events-none max-w-[calc(100vw-2rem)]`}
                  style={{ left: `${left}%` }}
                  data-anchor={anchor}
                >
                  <p className="text-[11px] font-semibold leading-tight">
                    {displayStoreName(row.storeName)}
                  </p>
                  <p className="text-[12px] tabular-nums font-bold leading-tight">
                    {formatPriceForUser(row.effectiveNgn, country)}
                  </p>
                  {row.isCrossBorder && (
                    <p className="text-[10px] text-amber-300 dark:text-amber-700 inline-flex items-center gap-1 mt-0.5 leading-tight">
                      <Plane size={9} aria-hidden="true" /> Cross-border
                    </p>
                  )}
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
            }

            /* MULTI-STORE CLUSTER — list panel. The header summarises
               the band; rows show each store + price. Using bottom-full
               + mb-3 so the panel anchors its BOTTOM to the bar top —
               this lets the panel grow upward as more stores join the
               cluster without clipping the topmost row off-screen. */
            const minFmt    = formatPriceForUser(cluster.minNgn, country);
            const maxFmt    = formatPriceForUser(cluster.maxNgn, country);
            const sameBand  = minFmt === maxFmt;
            const sortedOffers = [...clusterOffers].sort((a, b) => a.effectiveNgn - b.effectiveNgn);

            return (
              <div
                role="dialog"
                aria-label={`${clusterOffers.length} stores in this price band`}
                className={`absolute bottom-full mb-3 ${translateClass} z-30 rounded-lg bg-ink text-bg px-3 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.25)] pointer-events-none max-w-[calc(100vw-2rem)] min-w-[180px]`}
                style={{ left: `${left}%` }}
                data-anchor={anchor}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-80 mb-1.5 whitespace-nowrap">
                  {clusterOffers.length} stores {sameBand ? `at ${minFmt}` : `· ${minFmt} to ${maxFmt}`}
                </p>
                <ul className="space-y-1">
                  {sortedOffers.map((o) => (
                    <li key={o.offerId} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <span className="font-medium truncate inline-flex items-center gap-1">
                        {displayStoreName(o.storeName)}
                        {o.isCrossBorder && (
                          <Plane size={9} className="text-amber-300 dark:text-amber-700 shrink-0" aria-hidden="true" />
                        )}
                      </span>
                      <span className="tabular-nums font-bold whitespace-nowrap">
                        {formatPriceForUser(o.effectiveNgn, country)}
                      </span>
                    </li>
                  ))}
                </ul>
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-1 w-2 h-2 rotate-45 bg-ink ${
                    anchor === "left"  ? "left-4" :
                    anchor === "right" ? "right-4" :
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
        <div className="flex items-center text-[11px] text-ink-3 tabular-nums mb-3">
          <span>
            {formatPriceForUser(thisPriceNgn, country)}
            <span className="ml-1 opacity-70">listed here</span>
          </span>
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
          {/* "now" qualifier marks this as the LIVE spread across
              today's listings — distinct from the "Lowest tracked"
              historical low below. Without it, "£77 cheapest" beside
              "Lowest tracked £74" reads as two contradictory lows for
              the same product (QA #3) when they're really two
              different facts: cheapest available right now vs lowest
              we've ever recorded. */}
          <span>
            {formatPriceForUser(lowestPriceNgn, country)}
            <span className="ml-1 opacity-70">cheapest now</span>
          </span>
          <span>
            {formatPriceForUser(highestPriceNgn, country)}
            <span className="ml-1 opacity-70">highest now</span>
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
              Save <span className="font-semibold">{formatPriceDeltaForUser(thisPriceNgn, cheapest!.effectiveNgn, country)}</span> at <span className="font-semibold">{displayStoreName(cheapest!.storeName)}</span>
            </span>
          </span>
          <ArrowRight size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Link>
      )}

      {/* ── Used / refurbished disclosure (May 2026 PDP-trust fix) ──
          Used/refurb listings are surfaced here as a SEPARATE, clearly
          labelled line rather than being allowed to silently win the
          headline "cheapest" above. The spectrum, verdict, dots and
          cheapest-at action all run on the NEW-only subset (see the
          used/new split near the top of this component); this strip
          gives the genuinely-cheaper-but-used datapoints their due
          without letting a used unit misrepresent the new-price story.
          Suppressed when every listing is used (newPerStore empty →
          usedOffers empty) — there's no new price to contrast against. */}
      {usedOffers.length > 0 && (() => {
        const cheapestUsed = usedOffers[0];
        const moreCount    = usedOffers.length - 1;
        return (
          <div className="mb-3 px-3.5 py-2.5 rounded-xl border border-border bg-surface-2">
            <div className="flex items-start gap-2.5">
              <RotateCcw size={14} className="text-ink-3 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[12px] text-ink-2 leading-relaxed">
                  Used or refurbished from{" "}
                  <span className="font-semibold text-ink tabular-nums">
                    {formatPriceForUser(cheapestUsed.effectiveNgn, country)}
                  </span>{" "}
                  at <span className="font-medium text-ink">{displayStoreName(cheapestUsed.storeName)}</span>
                  {cheapestUsed.isCrossBorder && (
                    <span className="text-ink-3 whitespace-nowrap">
                      {" "}<Plane size={9} className="inline -mt-px" aria-hidden="true" /> cross-border
                    </span>
                  )}
                  {moreCount > 0 && (
                    <span className="text-ink-3"> · {moreCount} more {moreCount === 1 ? "listing" : "listings"}</span>
                  )}
                </p>
                <p className="text-[11px] text-ink-3 leading-relaxed mt-0.5">
                  Not included in the price ranking above.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Out-of-stock "last seen" context removed (June 2026): an
          unactionable, dated price from stores that don't carry the item
          read as noise on the PDP — the price-history chart + spectrum
          already give real price context. The outOfStockOffers prop is
          kept on the interface (compare still renders the lane) but is no
          longer shown here. */}

      {/* ── Historical signal ──────────────────────────────────── */}
      {priceHistory && !isHistoricalLow && (
        <div className="mb-3 px-3.5 py-2 rounded-xl border border-border bg-surface-2">
          <p className="text-[11px] text-ink-2 leading-relaxed">
            <History size={11} className="inline-block mr-1 -mt-0.5 text-ink-3" aria-hidden="true" />
            Lowest tracked: <span className="font-semibold text-ink tabular-nums">
              {formatPriceForUser(priceHistory.allTimeLowNgn, country)}
            </span>
            {/* suppressHydrationWarning — timeAgo reads Date.now()
                at render time. SSR happens at server T0, hydration at
                client T1, so the relative string can differ across a
                day boundary or even a minute boundary depending on
                cron timing. The mismatch is visually identical to
                the user but React strict mode raises a hydration
                warning. */}
            <span className="text-ink-3" suppressHydrationWarning> · {timeAgo(priceHistory.allTimeLowAt)}</span>
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

      {/* Single-store hint ("We'll compare as more stores list it")
          removed June 2026: redundant with the "Only seller we track right
          now" subtitle above. */}

      {/* ── Trust strip ────────────────────────────────────────────
          Confidence + cheapest-store + verification timestamp +
          ships-from country. Compact line above the cross-border
          disclaimer so the trust signals live next to the price
          claim they support. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] pt-3 border-t border-border">
        {lastCheckedAt && (
          /* Freshness is the lead trust signal now that the derived
             confidence score is gone. The ProductHero amber chip above
             remains the single authoritative "price may have changed"
             warning, so this stays plain provenance, not a restated alarm. */
          <span className="inline-flex items-center gap-1 text-ink-2 font-medium" suppressHydrationWarning>
            <Check size={11} aria-hidden="true" />
            Verified {timeAgo(lastCheckedAt)}
          </span>
        )}
        {!isSingleStore && cheapest && cheapest.storeId !== thisStoreId && (
          <span className="inline-flex items-center gap-1 text-ink-3">
            <span aria-hidden="true">·</span>
            Cheapest at <span className="font-medium text-ink-2">{displayStoreName(cheapest.storeName)}</span>
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
          Cross-border total is a rough estimate: roughly +30% for shipping and customs, which varies.
        </p>
      )}
      {/* When the visiting offer itself is cross-border but no
          other dot is, the visitor still benefits from this
          disclaimer. The check above misses that case, so render
          here as a fallback. */}
      {!anyXBorder && thisIsCrossBorder && (
        <p className="mt-2.5 text-[11px] text-ink-3 leading-relaxed">
          <span className="text-amber-500">⚑</span>{" "}
          Ships across borders, so the total is a rough estimate: roughly +30% for shipping and customs, which varies.
        </p>
      )}
    </div>
  );
}

