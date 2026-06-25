"use client";

/* Price-history line chart for the PDP — v2.

   What changed vs v1 (May 2026 chart rewrite):
     • viewBox now scales to the container's measured width so
       strokes + circles stay geometrically true at every viewport
       (v1 used preserveAspectRatio="none" which non-uniformly
       stretched everything).
     • Range toggle: 30D / 90D / All. Client-side slice so switching
       is instant (server fetch is now 365d, see page.tsx).
     • Verdict header: dynamic copy + colour that answers "is this
       a good price right now?" — "Lowest in 30 days" (success),
       "X% above the lowest" (warn), "Higher than usual" (danger).
     • Tooltip rendered at the hovered point as an HTML overlay
       (not below the chart). Smart-flips to avoid overflow.
     • X-axis date ticks — 3-4 evenly spaced labels.
     • Labeled reference line for the visitor's current price so
       they can read "you are here" at a glance.
     • Recent-change pill: "↓ ₦X last 7 days" when meaningful.
     • Keyboard navigation — arrow keys move the hovered index,
       Home/End jump to bounds, Esc unpins.
     • Respects prefers-reduced-motion.
     • Single SVG (no mobile/desktop duplicate trees from v1).
     • role="img" + aria-label + sr-only summary for screen readers.

   What's deliberately NOT in scope:
     • Per-store lines. The cross-store min line + a labeled
       reference for the visitor's offer is enough decision
       support; per-store would clutter and needs a new RPC.
     • Y-axis price gridlines. Added Jun 2026, then REMOVED Jun 2026 —
       owner wanted fewer lines ("many lines feel noisy"). The exact
       numbers live in the tiles below + the single high/low reference-line
       label; the chart shows ONE reference line (the extreme the current
       price is farthest from) plus the bold "now" dot for the live price.
     • Single-store-day dimming. Polish item; ignored for v2.

   Currency contract: every *Ngn input is NGN. formatPriceForUser
   converts at render time via the country prop. Passing user-
   currency values would double-convert. */

import {
  useCallback, useEffect, useId, useLayoutEffect,
  useMemo, useRef, useState,
} from "react";
import { convertForUser, formatPriceForUser, formatPriceForUserExact, timeAgo } from "@/lib/utils";
import type { Country } from "@/lib/country";
import type { PriceHistoryPoint } from "@/lib/search/price-history";
import {
  TrendingDown, TrendingUp, Minus, Calendar,
} from "lucide-react";

interface Props {
  /** Time-series points, oldest first. NGN. */
  points:             PriceHistoryPoint[];
  /** Visiting offer's current NGN price — drives the reference line
      + the verdict copy in the header. */
  currentNgn:         number;
  /** Country for price + date formatting (matches the bar above). */
  country:            Country;
  /** Optional — used in the reference-line label so users see e.g.
      "Jumia · ₦12,500" instead of a generic "Your price". */
  visitingStoreName?: string;
  /** Where this PDP's product data lives:
        "tracked"  — real product in the offers table; history rows
                     accumulate as prices change. Empty state means
                     "we just haven't seen a change yet."
        "curated"  — static curated catalog (curated-amazon.ts and
                     similar). We never write offer_price_history
                     for these; empty state means "tracking doesn't
                     apply to this product type."

      Default "tracked" preserves the existing behaviour for the
      vast majority of PDPs. The PDP page passes "curated" when
      the offer's product_id is a synthetic (non-UUID) string. */
  dataSource?:        "tracked" | "curated";
}

/* ── Layout tokens (all px, absolute — no ratio math) ─────────── */
const CHART_HEIGHT      = 220;
const PAD_TOP           = 16;   // breathing space above the line
const PAD_BOTTOM        = 28;   // room for the x-axis date row
const PAD_LEFT          = 12;
const PAD_RIGHT         = 12;
const TOOLTIP_OFFSET_Y  = 14;
const HOVER_DOT_RADIUS  = 4.5;

/* ── Visual tokens ────────────────────────────────────────────── */
const LINE_HEX          = "#16a34a";  // success
const REF_LINE_HEX      = "#6b7280";  // neutral grey, distinct from line

/* ── Range toggle options ─────────────────────────────────────── */
const RANGE_OPTIONS = [
  { key: "30D", days:  30, label: "30D" },
  { key: "90D", days:  90, label: "90D" },
  { key: "ALL", days: 365, label: "All" },
] as const;
type RangeKey = typeof RANGE_OPTIONS[number]["key"];

/* Whether a range chip is offered for a given data span. A non-ALL window
   is only meaningful once the data covers at least half of it; below that
   it renders identically to a smaller window or to All, so the chip is
   hidden. Single source of truth shared by RangeToggle (which chips to
   render) and the default-range picker (which range to pre-select) so the
   two can never disagree — the active range is therefore always a visible
   chip. span <= 0 (a single point, no span yet) offers every chip, matching
   the toggle's long-standing behaviour. */
function isRangeOffered(key: RangeKey, spanDays: number): boolean {
  if (key === "ALL") return true;
  const days = RANGE_OPTIONS.find((r) => r.key === key)?.days ?? 0;
  return spanDays <= 0 || spanDays >= days * 0.5;
}

export default function PriceHistoryChart({
  points, currentNgn, country, visitingStoreName, dataSource = "tracked",
}: Props) {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  /* Default range: the widest sub-window the data actually fills AND the
     toggle actually offers — 90D for long spans, else 30D, else All.
     Gating on isRangeOffered (the SAME visibility test RangeToggle uses)
     guarantees the active range is never a hidden chip. The bug it fixes:
     a short history (e.g. 9 points over 8 days) used to default to 30D —
     stamping the verdict "Lowest in 30 days" and the "30D low/high" tiles —
     while the 30D chip stays hidden for spans under 15 days, leaving only
     an inactive "All" on screen. Such a span now defaults to All ("…since
     tracking started" + "All-time" tiles + the All chip highlighted).
     Stable across SSR + client. */
  const initialRange: RangeKey = useMemo(() => {
    if (points.length < 7) return "ALL";
    const span = computeSpanDays(points);
    if (span >= 60 && isRangeOffered("90D", span)) return "90D";
    if (isRangeOffered("30D", span)) return "30D";
    return "ALL";
  }, [points]);
  const [rangeKey, setRangeKey] = useState<RangeKey>(initialRange);

  const range = useMemo(
    () => RANGE_OPTIONS.find((r) => r.key === rangeKey) ?? RANGE_OPTIONS[1],
    [rangeKey],
  );

  /* Slice the points to the active window. Anchored at the LATEST
     point — sliding window from now backwards. */
  const sliced = useMemo(
    () => sliceToLastNDays(points, range.days),
    [points, range.days],
  );

  /* Container width drives the SVG viewBox. ResizeObserver keeps
     it in sync as the layout shifts (responsive grid, side-nav
     open/close, etc.). 640 is a sensible SSR default that maps to
     a centred max-width-3xl card. */
  const width = useContainerWidth(containerRef, 640);
  const reducedMotion = usePrefersReducedMotion();

  /* Derive everything geometry-related once per (sliced, width,
     currentNgn) change. The math doesn't depend on hover state.
     currentNgn flows through because the reference-line Y position
     depends on it. */
  /* Y-axis price ticks — compact labels in a LEFT GUTTER (owner direction
     June 2026: "add the vertical price y axis, no grid lines"). Same "nice"
     price steps as before, but we render ONLY the labels — no horizontal
     gridlines. The gutter width depends on the longest label and shifts the
     plot's x math right, so it's computed before geometry; padYDomain matches
     the geometry's domain so labels land on the right pixels. */
  const { yTicks, axisGutter } = useMemo(() => {
    if (sliced.length === 0) {
      return { yTicks: [] as Array<{ y: number; label: string }>, axisGutter: PAD_LEFT };
    }
    let lo = sliced[0].minPriceNgn;
    let hi = lo;
    for (const p of sliced) {
      if (p.minPriceNgn < lo) lo = p.minPriceNgn;
      if (p.minPriceNgn > hi) hi = p.minPriceNgn;
    }
    const { yMin, yMax } = padYDomain(lo, hi);
    const minDisp = convertForUser(yMin, country, "NGN");
    const maxDisp = convertForUser(yMax, country, "NGN");
    const chartH  = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const ticks = buildYTicks(minDisp, maxDisp, chartH).map((t) => ({
      y:     t.y,
      label: axisPriceLabel(t.value, country),
    }));
    const longest = ticks.reduce((m, t) => Math.max(m, t.label.length), 0);
    const gutter = ticks.length > 0 ? Math.min(64, Math.max(36, longest * 6 + 12)) : PAD_LEFT;
    return { yTicks: ticks, axisGutter: gutter };
  }, [sliced, country]);

  /* Geometry — plotted line, fill, current-price Y, high/low markers. Left pad
     is the Y-axis gutter so the plot starts right of the price labels. */
  const geom = useMemo(
    () => computeGeometryFull(sliced, width, currentNgn, range.days, axisGutter),
    [sliced, width, currentNgn, range.days, axisGutter],
  );

  /* Store-count provenance for the footer strip. Swept over the
     FULL points array — deliberately NOT the range-sliced window
     that feeds `geom`. The footer previously read
     geom.peakStoreCount, which only saw the active window, so the
     number flickered (1 on a 30D default load, 2 on a 90D/All load)
     and read as a third, contradictory store count against the
     live "Compare prices across 20 stores" headline. Sweeping the
     full history makes it stable across range toggles and frames it
     honestly as "how many stores this timeline was built from",
     which is a provenance fact independent of today's live pool.
     May 2026 QA non-negotiable: "fluctuating store counts." */
  const historyStoreCount = useMemo(() => {
    let peak = 0;
    for (const p of points) if (p.storeCount > peak) peak = p.storeCount;
    return peak;
  }, [points]);

  /* Hover + pin state. `pinned` keeps the tooltip visible after a
     tap (mobile) or Enter/Space (keyboard) until the user moves
     pointer away or hits Esc / taps outside. */
  const [hoverIdx, setHoverIdxRaw] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const setHoverIdx = useCallback((i: number | null) => {
    setHoverIdxRaw(i);
    if (i === null) setPinned(false);
  }, []);

  /* Click-outside unpins the tooltip (touch UX). */
  useEffect(() => {
    if (!pinned) return;
    const handler = (e: PointerEvent) => {
      if (!chartRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setHoverIdxRaw(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [pinned]);

  /* Keyboard nav — only when the chart has focus. Arrows move the
     hovered index; Home/End jump to bounds; Esc unpins. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (sliced.length === 0) return;
      const last = sliced.length - 1;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          setHoverIdxRaw((i) => Math.max(0, (i ?? last) - 1));
          setPinned(true);
          break;
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          setHoverIdxRaw((i) => Math.min(last, (i ?? -1) + 1));
          setPinned(true);
          break;
        case "Home":
          e.preventDefault();
          setHoverIdxRaw(0);
          setPinned(true);
          break;
        case "End":
          e.preventDefault();
          setHoverIdxRaw(last);
          setPinned(true);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          setPinned((p) => !p);
          break;
        case "Escape":
          e.preventDefault();
          setHoverIdxRaw(null);
          setPinned(false);
          break;
      }
    },
    [sliced.length],
  );

  /* ── Empty state ──────────────────────────────────────────────
     Only fires when we have ZERO points. With ≥ 1 point we render
     the chart frame — a single dot plus a flat hold-line communicates
     "we've seen one price point, here it is" honestly and is more
     useful than hiding the chart entirely. The 2+ point path draws
     the full curve.

     Copy branches by dataSource:
       "tracked" — real product, history will accumulate. Forward-
                   looking copy invites the user to come back later.
       "curated" — static curated catalog (curated-amazon.ts etc.).
                   We don't write offer_price_history rows for
                   these — the empty state should explain that
                   tracking just doesn't apply to this product
                   type instead of implying it's about to start. */
  /* Date formatters for the tooltip + lowest-tile dates. Declared HERE,
     above the empty-state early return below, because React hooks must
     run in the same order on every render (react-hooks/rules-of-hooks):
     leaving them after the early return made them conditional. They
     depend on nothing ([] deps), so computing them unconditionally is
     free. */
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
    [],
  );
  const dateFmtYear = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }),
    [],
  );

  if (sliced.length < 1) {
    const isCurated = dataSource === "curated";
    return (
      <section
        ref={containerRef}
        className="rounded-2xl border border-border bg-surface-2/40 px-5 py-8 text-center"
        aria-label={isCurated
          ? "Price history. Not tracked for this listing"
          : "Price history. No data yet"
        }
      >
        <Calendar size={20} className="mx-auto text-ink-3 mb-2" aria-hidden="true" />
        <p className="text-sm text-ink-2">
          {isCurated ? "Price history not tracked here" : "No price activity yet"}
        </p>
        <p className="text-xs text-ink-3 mt-1 max-w-sm mx-auto leading-relaxed">
          {isCurated
            ? <>This listing comes from our curated set. Live price tracking kicks in for products in our actively-monitored catalog.</>
            : <>Once the price changes at any store, you&apos;ll see the full timeline here.</>}
        </p>
      </section>
    );
  }

  /* ── Verdict + change indicators ──────────────────────────── */
  const verdict       = computeVerdict(currentNgn, geom.lowestNgn, geom.meanNgn, range.days, sliced.length);
  const weekChange    = computeRecentChange(sliced, 7);

  /* Lowest-date callout — shown both in the header pill (verdict
     when applicable) and in the lowest tile. When the live price has
     undercut the entire tracked history, computeGeometryFull folds
     geom.lowestNgn down to the current price; in that case caption it
     "right now" so we never stamp today's price with a stale history
     date (geom.lowestIdx still points at the lowest tracked day). */
  const currentIsLowest = currentNgn <= geom.lowestNgn;
  /* "today" (not "right now") so the Lowest tile's caption doesn't read
     as a near-duplicate of the separate "Right now" tile beside it. */
  const lowestDate = currentIsLowest
    ? "today"
    : dateFmt.format(new Date(sliced[geom.lowestIdx].day));

  /* Window word folded into the Lowest/Highest tile LABELS ("30D low",
     "All-time high") so those stats read unmistakably as the price's range
     OVER TIME — not the spectrum bar's "highest now" current cross-store
     spread. A launch UX pass found users conflating the two ("highest £197"
     on the spectrum vs "£230" on the chart, same page): both correct (today's
     priciest store vs the 30-day peak of the cheapest line) but reading as a
     contradiction. Putting the window in the label makes the lenses distinct;
     the captions now carry WHEN each extreme occurred. */
  const windowWord = range.label === "All" ? "All-time" : range.label;
  /* Date the highest tracked price occurred, mirroring lowestDate, so both
     extreme tiles caption with "when". If the live price is the peak, "today". */
  const currentIsHighest = currentNgn >= geom.highestNgn;
  const highestDate = currentIsHighest
    ? "today"
    : (() => {
        let idx = 0, max = sliced[0].minPriceNgn;
        for (let i = 1; i < sliced.length; i++) {
          if (sliced[i].minPriceNgn > max) { max = sliced[i].minPriceNgn; idx = i; }
        }
        return dateFmt.format(new Date(sliced[idx].day));
      })();

  /* Single reference line: show whichever extreme the current price sits
     FARTHER from, so the hero dot + the line bracket the meaningful range —
     a low current price shows the HIGH it's reached ("look how far it's
     dropped"); a high current price shows the LOW it could return to ("it's
     been cheaper"). One line instead of several keeps the chart calm. The
     extremes come from the tracked history (not the live-folded stat), so the
     line is always a real past point distinct from the current dot. */
  const histLowNgn   = sliced[geom.lowestIdx].minPriceNgn;
  const histHighNgn  = sliced[geom.highestIdx].minPriceNgn;
  const refIsHigh    = currentNgn <= (histLowNgn + histHighNgn) / 2;
  const refY         = refIsHigh ? geom.highestY : geom.lowestY;
  const refNgn       = refIsHigh ? histHighNgn : histLowNgn;
  const refLineLabel = `${windowWord} ${refIsHigh ? "high" : "low"} · ${formatPriceForUser(refNgn, country)}`;
  /* The hero dot sits at "now" — the right edge of the plot. */
  const currentDotX  = width - PAD_RIGHT;

  /* Current-price label that floats by the hero dot on the right edge. */
  const referenceLabel = visitingStoreName
    ? `${visitingStoreName} · ${formatPriceForUser(currentNgn, country)}`
    : `Your price · ${formatPriceForUser(currentNgn, country)}`;

  /* Tooltip + hover marker computations — done once at render time. */
  const hover = hoverIdx !== null
    ? buildHoverState(sliced, hoverIdx, geom, width, country, dateFmtYear)
    : null;

  /* ── Screen-reader summary ────────────────────────────────── */
  const a11ySummary = buildAriaSummary({
    range, sliced, geom, currentNgn, country, lowestDate, currentIsLowest,
  });

  return (
    <section
      ref={containerRef}
      className="rounded-2xl border border-border bg-surface-2/40 p-4 sm:p-5"
      aria-label="Price history"
    >
      {/* ── Header: verdict + range toggle ─────────────────── */}
      <header className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-ink leading-tight">
            Price history
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <VerdictPill verdict={verdict} />
            {weekChange && <WeekChangePill change={weekChange} country={country} />}
          </div>
        </div>
        <RangeToggle
          value={rangeKey}
          onChange={setRangeKey}
          /* Disable ranges with insufficient data so the toggle
             never produces an empty chart. */
          dataSpanDays={computeSpanDays(points)}
        />
      </header>

      {/* ── Chart container ──────────────────────────────────── */}
      <div
        ref={chartRef}
        role="img"
        aria-label={a11ySummary}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-ink/30 rounded-lg"
        style={{ height: CHART_HEIGHT }}
      >
        <svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          /* Why preserveAspectRatio="none" here BUT it's safe (unlike
             v1): viewBox width === measured container width, so the
             scale factor is always 1×1. The strokes / circles render
             at their literal px values. */
          onMouseMove={(e) => {
            const rect = chartRef.current?.getBoundingClientRect();
            if (!rect) return;
            const px = e.clientX - rect.left;
            const idx = nearestIndex(px, geom);
            setHoverIdxRaw(idx);
          }}
          onMouseLeave={() => {
            if (!pinned) setHoverIdxRaw(null);
          }}
          onTouchStart={(e) => {
            const rect = chartRef.current?.getBoundingClientRect();
            const touch = e.touches[0];
            if (!rect || !touch) return;
            const px = touch.clientX - rect.left;
            const idx = nearestIndex(px, geom);
            setHoverIdxRaw(idx);
            setPinned(true);
          }}
          onTouchMove={(e) => {
            const rect = chartRef.current?.getBoundingClientRect();
            const touch = e.touches[0];
            if (!rect || !touch) return;
            const px = touch.clientX - rect.left;
            const idx = nearestIndex(px, geom);
            setHoverIdxRaw(idx);
          }}
        >
          <defs>
            <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={LINE_HEX} stopOpacity="0.20" />
              <stop offset="100%" stopColor={LINE_HEX} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Y axis — price LABELS only, in the left gutter (owner direction:
              "vertical price y axis, no grid lines"). No horizontal gridlines
              and no vertical gridlines; the labels alone carry the scale,
              right-aligned against the gutter edge and vertically centred on
              their price level. */}
          {yTicks.map((t, i) => (
            <text
              key={`ylabel-${i}`}
              x={axisGutter - 6}
              y={t.y + 3}
              fontSize={10}
              textAnchor="end"
              className="fill-ink-3 tabular-nums select-none"
            >
              {t.label}
            </text>
          ))}

          {/* Area fill under the smooth line, capped at the chart bottom */}
          <path d={geom.areaD} fill={`url(#grad-${uid})`} />

          {/* Single reference line — the extreme (high OR low) the current
              price sits farthest from, so the hero dot + this line bracket the
              range. Replaces the old your-price line + lowest dot: one line,
              not several. */}
          <line
            x1={axisGutter}
            x2={width - PAD_RIGHT}
            y1={refY}
            y2={refY}
            stroke={REF_LINE_HEX}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity="0.5"
          />

          {/* The price line itself — smooth monotone curve, emerald */}
          <path
            d={geom.pathD}
            fill="none"
            stroke={LINE_HEX}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Current price — the hero. Bold dot at "now" (right edge) so the
              eye lands on the price you'd actually pay. */}
          <circle
            cx={currentDotX}
            cy={geom.currentRefY}
            r={6.5}
            fill="white"
          />
          <circle
            cx={currentDotX}
            cy={geom.currentRefY}
            r={4.5}
            fill={LINE_HEX}
            stroke="white"
            strokeWidth={1.5}
          />

          {/* Hover guide + marker. Only render when an index is
              active AND it's not the lowest (avoids visual clash). */}
          {hover && (
            <>
              <line
                x1={hover.x} x2={hover.x}
                y1={PAD_TOP} y2={CHART_HEIGHT - PAD_BOTTOM}
                stroke={REF_LINE_HEX}
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={HOVER_DOT_RADIUS + 2}
                fill="white"
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={HOVER_DOT_RADIUS}
                fill={LINE_HEX}
                stroke="white"
                strokeWidth={1.5}
              />
            </>
          )}

          {/* X-axis date labels */}
          {geom.axisTicks.map((t, i) => {
            /* textAnchor:
                 - single tick (1-point chart): centre on the tick x
                   so the label sits in the middle of the chart.
                 - multi-tick: pin first to the left edge, last to
                   the right edge, intermediates centred. Keeps end
                   labels from overflowing past the chart box. */
            const isOnly  = geom.axisTicks.length === 1;
            const isFirst = !isOnly && i === 0;
            const isLast  = !isOnly && i === geom.axisTicks.length - 1;
            const anchor: "start" | "end" | "middle" =
              isFirst ? "start" :
              isLast  ? "end"   :
                        "middle";
            return (
              <text
                key={`tick-${i}`}
                x={t.x}
                y={CHART_HEIGHT - 8}
                textAnchor={anchor}
                className="fill-ink-3"
                style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
              >
                {t.label}
              </text>
            );
          })}
        </svg>

        {/* Reference-line label — HTML overlay positioned at the
            right edge of the chart. Floats above/below the line
            depending on where the line sits. */}
        <div
          className="absolute pointer-events-none text-[10px] font-medium text-ink-2 px-1.5 py-0.5 rounded-md bg-surface/90 border border-border backdrop-blur"
          style={{
            right: PAD_RIGHT + 4,
            top:   geom.currentRefY > CHART_HEIGHT / 2
              ? geom.currentRefY - 22
              : geom.currentRefY + 6,
            transition: reducedMotion ? "none" : "top 200ms ease-out",
            maxWidth: "60%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {referenceLabel}
        </div>

        {/* Single reference-line label — left end of the high/low line. */}
        <div
          className="absolute pointer-events-none text-[10px] font-medium text-ink-3 px-1.5 py-0.5 rounded-md bg-surface/80 border border-border"
          style={{
            left: axisGutter + 2,
            top:  refY > CHART_HEIGHT / 2 ? refY - 20 : refY + 4,
            transition: reducedMotion ? "none" : "top 200ms ease-out",
            maxWidth: "55%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {refLineLabel}
        </div>

        {/* Hover tooltip — HTML overlay positioned above the hovered
            point. Smart-flips when near the top or right edges. */}
        {hover && (
          <div
            className="absolute pointer-events-none rounded-lg border border-border bg-surface shadow-card px-2.5 py-2 z-10"
            style={{
              ...hover.tooltipStyle,
              transition: reducedMotion ? "none" : "left 120ms ease-out, top 120ms ease-out",
              minWidth: 110,
            }}
            role="status"
            aria-live="polite"
          >
            <div className="text-[11px] text-ink-3 leading-none mb-1 tabular-nums">
              {hover.dateLabel}
            </div>
            <div className="text-sm font-semibold text-ink leading-none tabular-nums">
              {hover.priceLabel}
            </div>
            {hover.deltaFromLow !== null && (
              <div className={`text-[10px] mt-1 leading-none tabular-nums ${hover.deltaFromLow > 0 ? "text-ink-3" : "text-success"}`}>
                {hover.deltaFromLow > 0
                  /* Exact format for the delta — see the buildHoverState
                     comment. The user is comparing close values and a
                     ≥ 1M adaptive form would collapse small deltas to
                     "+₦0.0M". */
                  ? `+${formatPriceForUserExact(hover.deltaFromLow, country)} above the lowest`
                  : "Lowest day shown"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tiles strip ─────────────────────────────────────── */}
      <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2">
        {/* Lowest / Highest describe the price RANGE over the selected
            window — the window lives in the LABEL ("30D low", "All-time
            high") so these can't be misread as the spectrum bar's current
            cross-store spread above. "Right now" is the visiting price.
            Captions carry WHEN each extreme occurred (#23: consistent
            framing across all three tiles). */}
        <Tile
          label={`${windowWord} low`}
          value={formatPriceForUser(geom.lowestNgn, country)}
          caption={lowestDate}
          tone="success"
        />
        <Tile
          label={`${windowWord} high`}
          value={formatPriceForUser(geom.highestNgn, country)}
          caption={highestDate}
        />
        <Tile
          label="Right now"
          value={formatPriceForUser(currentNgn, country)}
          caption={verdict.tileCaption}
          tone={verdict.tone === "success" ? "success" : undefined}
        />
      </div>

      {/* ── Freshness strip ──────────────────────────────────────
          When the last recorded day is more than a week back, this
          line is the user's warning that the chart's "right now"
          tile may have drifted. Default styling stays muted for
          fresh data; tier-driven recolouring surfaces the staleness
          before the user clicks through and finds the merchant
          price doesn't match. May 29 2026 trust-break report. */}
      {(() => {
        const lastDay = sliced[sliced.length - 1].day;
        /* Plain provenance only — the ProductHero amber chip is the
           single authoritative staleness warning on this page.
           Restating it here was the third repeat in a row (chip ->
           comparison bar -> chart strip), which the user reported
           as visual noise. The "last refreshed Xd ago" string is
           still useful as chart-axis annotation — it tells the
           reader where the rightmost data point lives — but it
           stays neutral ink-3 instead of escalating to amber. May
           29 2026 trust-signal consolidation. */
        return (
          <p className="mt-3 text-[11px] text-ink-3 leading-tight">
            {historyStoreCount > 0 && (
              <>
                Price history from {historyStoreCount}{" "}
                {historyStoreCount === 1 ? "store" : "stores"} ·{" "}
              </>
            )}
            last refreshed{" "}
            <time suppressHydrationWarning>{timeAgo(lastDay)}</time>
          </p>
        );
      })()}

      {/* sr-only fallback list for screen readers — duplicates the
          chart as a tiny table so the data is reachable without
          interaction. */}
      <span className="sr-only">{a11ySummary}</span>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   Subcomponents
   ══════════════════════════════════════════════════════════════ */

interface Verdict {
  copy:        string;
  tone:        "success" | "warn" | "danger" | "neutral";
  icon:        "down" | "up" | "flat";
  tileCaption: string;
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
  const tones = {
    success: "bg-success/10 text-success border-success/20",
    warn:    "bg-warn/10    text-warn    border-warn/20",
    danger:  "bg-danger/10  text-danger  border-danger/20",
    neutral: "bg-surface    text-ink-2   border-border",
  } as const;
  const Icon = verdict.icon === "down" ? TrendingDown
            : verdict.icon === "up"   ? TrendingUp
            :                            Minus;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${tones[verdict.tone]}`}
    >
      <Icon size={11} aria-hidden="true" />
      {verdict.copy}
    </span>
  );
}

function WeekChangePill({
  change, country,
}: { change: { deltaNgn: number; direction: "up" | "down" }; country: Country }) {
  const isDown = change.direction === "down";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${
        isDown ? "text-success" : "text-ink-3"
      }`}
    >
      {isDown ? "▼" : "▲"}
      {formatPriceForUser(Math.abs(change.deltaNgn), country)} last 7 days
    </span>
  );
}

interface RangeToggleProps {
  value:        RangeKey;
  onChange:     (k: RangeKey) => void;
  dataSpanDays: number;
}

function RangeToggle({ value, onChange, dataSpanDays }: RangeToggleProps) {
  return (
    <div
      className="inline-flex rounded-full border border-border bg-surface p-0.5 shrink-0"
      role="tablist"
      aria-label="Price history time range"
    >
      {RANGE_OPTIONS.map((r) => {
        const isActive = r.key === value;
        /* Hide a range when the dataset doesn't have enough span
           to make it meaningfully different from the smaller ranges.
           Previously this just disabled the button, but a greyed-out
           tab still draws the eye to a control that can't do anything
           — better to remove it entirely until the data can fill it.
           The All option is never hidden. isRangeOffered is shared with
           the default-range picker so a hidden chip is never the active
           range. */
        if (!isRangeOffered(r.key, dataSpanDays)) return null;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(r.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums transition-colors ${
              isActive
                ? "bg-ink text-bg"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

interface TileProps {
  label:   string;
  value:   string;
  caption: string;
  tone?:   "success" | "warn" | "danger";
}
function Tile({ label, value, caption, tone }: TileProps) {
  const valueTone =
    tone === "success" ? "text-success" :
    tone === "warn"    ? "text-warn"    :
    tone === "danger"  ? "text-danger"  :
                          "text-ink";
  return (
    <div className="rounded-lg bg-surface border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-3 font-medium">
        {label}
      </div>
      <div className={`text-sm font-semibold mt-0.5 tabular-nums ${valueTone}`}>
        {value}
      </div>
      <div className={`text-[10px] mt-0.5 ${tone === "success" ? "text-success" : "text-ink-3"}`}>
        {caption}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Hooks
   ══════════════════════════════════════════════════════════════ */

/* Container-width tracker via ResizeObserver. Falls back to
   `fallback` during SSR / first paint. */
function useContainerWidth(ref: React.RefObject<HTMLElement>, fallback: number): number {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const initial = el.clientWidth;
    if (initial > 0) setW(initial);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cw = e.contentRect.width;
        if (cw > 0) setW(Math.round(cw));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return prefers;
}

/* ══════════════════════════════════════════════════════════════
   Geometry + math helpers
   ══════════════════════════════════════════════════════════════ */

interface Geometry {
  pathD:      string;
  areaD:      string;
  xs:         number[];      // pixel x for each sliced point
  ys:         number[];      // pixel y for each sliced point
  lowestIdx:  number;
  lowestNgn:  number;
  lowestX:    number;
  lowestY:    number;
  highestIdx: number;
  highestNgn: number;
  highestX:   number;
  highestY:   number;
  meanNgn:    number;
  currentRefY: number;
  axisTicks:  { x: number; label: string }[];
}

/* Smooth price line: monotone-cubic (Fritsch-Carlson) interpolation
   through the observed points. "Curvy" by founder request (June 2026),
   replacing the earlier step-after path. The tangents are clamped so the
   curve never overshoots the data band: it cannot dip below the lowest or
   rise above the highest observed price, so the rounded line stays honest
   about the range even though it bends smoothly between points.

   Input: parallel xs / ys arrays. n < 3 falls back to straight segments (a
   curve needs at least 3 points). The caller appends a flat horizontal
   extension to "today". */
function buildSmoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  if (n === 1) return d;
  if (n === 2) return d + ` L ${xs[1].toFixed(2)} ${ys[1].toFixed(2)}`;

  /* Per-segment secant slopes. */
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    slope[i] = dx[i] !== 0 ? (ys[i + 1] - ys[i]) / dx[i] : 0;
  }
  /* Tangent at each point: endpoints take the adjacent secant; interior
     points average their two neighbours, forced to 0 at a local peak or
     trough (sign change) so the curve flattens there instead of bulging. */
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  /* Fritsch-Carlson monotonicity clamp: keep each tangent within 3x its
     secant so no Bezier segment overshoots its endpoints' value range. */
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      const t = 3 / h;
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  /* One cubic Bezier per segment, control points a third of the way along
     each gap and tangent to m[]. */
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3;
    const c1y = ys[i] + (m[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3;
    const c2y = ys[i + 1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${xs[i + 1].toFixed(2)} ${ys[i + 1].toFixed(2)}`;
  }
  return d;
}

/* Hydration-safe "now": snapped to UTC midnight of the current day.
   The chart's X axis is day-granular (every point is keyed by `day`,
   parsed as a UTC midnight), so sub-day precision was never visible.
   But a raw Date.now() made the SVG path coordinates depend on the
   exact render instant, which differs between the server render and
   the first client hydration (a few hundred ms to a few seconds
   apart). At 30D range the X projection is ~2.3e-7 px/ms, enough to
   shift a toFixed(2) path coord by ~1 ULP on a fraction of points and
   trip React's hydration attribute-mismatch warning (#418) on the
   <path d>. Snapping to UTC midnight makes `today` identical across
   SSR and the first client render within the same calendar day, so
   the geometry serialises byte-for-byte. The only divergence window
   is the single render that straddles UTC midnight, which self-heals
   on the next render — the same accepted edge as every other
   day-granular surface (e.g. the footer year). */
function todayMidnightUtcMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function computeGeometry(points: PriceHistoryPoint[], width: number, rangeDays: number, leftPad: number = PAD_LEFT, currentNgn?: number): Geometry {
  if (points.length === 0) {
    return {
      pathD: "", areaD: "", xs: [], ys: [],
      lowestIdx: 0, lowestNgn: 0, lowestX: 0, lowestY: 0,
      highestIdx: 0, highestNgn: 0, highestX: 0, highestY: 0,
      meanNgn: 0,
      currentRefY: PAD_TOP, axisTicks: [],
    };
  }

  /* Sweep for stats in one pass. Store-count provenance is computed
     separately in the component over the FULL history (see
     historyStoreCount) so it doesn't inherit this function's
     range-sliced view. */
  let lowestNgn  = points[0].minPriceNgn;
  let lowestIdx  = 0;
  let highestNgn = points[0].minPriceNgn;
  let highestIdx = 0;
  let sum        = points[0].minPriceNgn;
  for (let i = 1; i < points.length; i++) {
    const p = points[i].minPriceNgn;
    if (p < lowestNgn)  { lowestNgn  = p; lowestIdx = i; }
    if (p > highestNgn) { highestNgn = p; highestIdx = i; }
    sum += p;
  }
  const meanNgn = sum / points.length;

  /* Y-axis range with 12% padding so the line never touches the
     chart edges. Flat-price (lowest === highest) gets fake-padded
     so the line sits in the middle of the band. */
  const { yMin, yMax } = padYDomain(lowestNgn, highestNgn);
  const chartH      = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const usableW     = width - leftPad - PAD_RIGHT;

  /* X axis is DATE-based, not point-index-based (May 2026 fix).
     Previous index projection made the rightmost dot whatever the
     last data point was (e.g. "May 1" perpetually showed at the
     bottom-right tick even when "today" is May 28), because the
     chart had no concept of "now". Now:
       xDomainEnd   = today (epoch ms)
       xDomainStart = rangeDays-back from today, OR the earliest
                      point's day for the "All" toggle (so we don't
                      slice valuable history)
       xForDay(d)   = PAD_LEFT + ((d_ms - start) / span) * usableW
     The path is drawn through points at their true date positions,
     then extends horizontally from the last point to today so the
     chart visually reads "no change since the last reading". */
  const today        = todayMidnightUtcMs();
  const firstDayMs   = new Date(points[0].day).getTime();
  /* "All" range — tightly fit the X domain to the actual data span
     rather than forcing a full 365-day window. The earlier fixed-
     365-day approach left ~95% of the chart empty when a product
     only had a week or two of history, surfacing as the "tiny line
     in the bottom-right corner" UX bug. A 7-day visual floor
     guarantees the chart looks proportional even when data is
     truly sparse (1-2 days). */
  const ALL_MIN_DOMAIN_DAYS = 7;
  const xDomainStart = rangeDays >= 365
    ? Math.min(firstDayMs, today - ALL_MIN_DOMAIN_DAYS * 86_400_000)
    : today - rangeDays * 86_400_000;
  const xDomainEnd   = today;
  const dateSpanMs   = Math.max(1, xDomainEnd - xDomainStart);
  const xForDay = (dayStr: string) => {
    const dayMs = new Date(dayStr).getTime();
    return leftPad + ((dayMs - xDomainStart) / dateSpanMs) * usableW;
  };
  const yForP = (p: number) =>
    PAD_TOP + ((yMax - p) / (yMax - yMin)) * chartH;

  /* Build pixel coords once. */
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < points.length; i++) {
    xs.push(xForDay(points[i].day));
    ys.push(yForP(points[i].minPriceNgn));
  }
  const todayX = leftPad + usableW;

  /* Smooth price path (buildSmoothPath): a monotone cubic curve through the
     observations, clamped so it never overshoots the data band (the rounded
     line can't claim a price below the lowest or above the highest reading).
     "Curvy" by founder request (June 2026), replacing the step-after path.
     The weekly snapshot (migration 0082) feeds it enough points that the
     curve reads as a real trend rather than a single dot.

     Path extends from the last data point horizontally to TODAY at the
     right edge whenever the latest reading is older than now — communicates
     "no change since the last reading" while keeping the right edge
     anchored on a meaningful date. The extension is a horizontal L segment,
     consistent with the step semantics, so we never claim an unobserved
     price.

     Single-point path: flat horizontal line at the price level from the
     chart's left edge through the dot at its actual date X, then extending
     to today on the right — the same hold-flat semantics for a lone
     reading. */
  const lastPointX = xs[xs.length - 1];
  const lastPointY = ys[ys.length - 1];
  /* The line's right edge must land ON the "now" dot so the timeline reads
     continuously INTO the current price — not hold flat at the last recorded
     reading and leave the hero dot floating above/below it (founder report
     June 2026: "the line should correlate with the position of the dot". A
     sparse history where only the pricier store was re-scraped on the last
     day made the min-line end high while the live cheapest dot sat far below,
     reading as a contradiction). When a current price is supplied the
     extension targets its Y — same yForP formula + same clamp as the hero
     dot's currentRefY, so the line meets the dot exactly; with no current
     price it falls back to the old flat hold. */
  const clampToBand = (y: number) =>
    Math.max(PAD_TOP + 2, Math.min(CHART_HEIGHT - PAD_BOTTOM - 2, y));
  const endY = currentNgn != null && Number.isFinite(currentNgn)
    ? clampToBand(yForP(currentNgn))
    : lastPointY;
  const todayExtension = lastPointX < todayX || endY !== lastPointY
    ? ` L ${todayX.toFixed(2)} ${endY.toFixed(2)}`
    : "";

  const pathD = points.length === 1
    ? `M ${leftPad.toFixed(2)} ${ys[0].toFixed(2)} L ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}${todayExtension}`
    : buildSmoothPath(xs, ys) + todayExtension;

  const areaBottom = CHART_HEIGHT - PAD_BOTTOM;
  const areaRightX = Math.max(lastPointX, todayX);
  /* Single-point area: rectangle from the left edge across to the
     today extension's right edge, dropped to the baseline. */
  const areaD = points.length === 1
    ? `M ${leftPad.toFixed(2)} ${ys[0].toFixed(2)} L ${areaRightX.toFixed(2)} ${ys[0].toFixed(2)} L ${areaRightX.toFixed(2)} ${areaBottom} L ${leftPad.toFixed(2)} ${areaBottom} Z`
    : `${pathD} L ${areaRightX.toFixed(2)} ${areaBottom} L ${xs[0].toFixed(2)} ${areaBottom} Z`;

  /* Axis ticks — up to 4 dates evenly spaced across the X DOMAIN
     (start → today), independent of how many data points exist.
     Previously ticks were drawn at point indices, which made the
     rightmost label the LAST DATA POINT's date — a perpetual "May 1"
     on the right edge even when the user opened the chart on May 28.
     Now the rightmost tick always reads today's date because we
     spread by date fraction, not point index. */
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const axisTicks: { x: number; label: string }[] = [];
  const totalDays = Math.round(dateSpanMs / 86_400_000);
  const tickCount = totalDays >= 30 ? 4 : 3;
  for (let t = 0; t < tickCount; t++) {
    const denom = Math.max(tickCount - 1, 1);
    const fraction = t / denom;
    const dayMs = xDomainStart + fraction * dateSpanMs;
    axisTicks.push({
      x:     leftPad + fraction * usableW,
      label: fmt.format(new Date(dayMs)),
    });
  }

  return {
    pathD,
    areaD,
    xs, ys,
    lowestIdx,
    lowestNgn,
    lowestX: xs[lowestIdx],
    lowestY: ys[lowestIdx],
    highestIdx,
    highestNgn,
    highestX: xs[highestIdx],
    highestY: ys[highestIdx],
    meanNgn,
    /* Reference Y clamped to the chart band so out-of-range
       prices still appear at the top/bottom edge. */
    currentRefY: PAD_TOP, // placeholder; caller sets via buildHoverState's external use
    axisTicks,
  };
}

/* Y-domain padding — single source of truth shared by computeGeometry
   (drawing) and the component's axis-tick memo, so ticks always land on
   the same pixels as the plotted line. 12% breathing band; flat-price
   series get a fake band so the line sits mid-chart. */
function padYDomain(lowestNgn: number, highestNgn: number): { yMin: number; yMax: number } {
  const rangeRaw = highestNgn - lowestNgn;
  const range    = rangeRaw === 0 ? Math.max(highestNgn * 0.1, 100) : rangeRaw;
  return { yMin: lowestNgn - range * 0.12, yMax: highestNgn + range * 0.12 };
}

/* Axis price label — compact (₦450K / £250 / ₦1.5M) so the left gutter stays
   narrow. One decimal of real precision with ".0" stripped. Exact values live
   in the tooltip + stat tiles. */
function axisPriceLabel(displayValue: number, country: Country): string {
  const strip = (s: string) => s.replace(/\.0$/, "");
  const v = Math.abs(displayValue);
  if (v >= 999_950) return `${country.symbol}${strip((displayValue / 1_000_000).toFixed(1))}M`;
  if (v >= 1_000)   return `${country.symbol}${strip((displayValue / 1_000).toFixed(1))}K`;
  return `${country.symbol}${Math.round(displayValue)}`;
}

/* "Nice" price tick positions for the Y axis. Callers pass the domain in the
   USER's display currency so steps snap to round numbers in what the user
   reads (£25 steps, not NGN-nice values that convert to £247). Steps snap to
   1/2/2.5/5 × 10^n; Y mapping is linear so display-unit positions land on the
   same pixel as NGN. */
function buildYTicks(
  yMin: number,
  yMax: number,
  chartH: number,
): { y: number; value: number }[] {
  const span = yMax - yMin;
  if (!(span > 0)) return [];
  const rawStep = span / 3; // aim for ~3 ticks
  const mag  = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: { y: number; value: number }[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + step * 1e-6; v += step) {
    const y = PAD_TOP + ((yMax - v) / span) * chartH;
    /* Skip ticks hugging the very top/bottom edge — they'd collide with the
       line's padding band or the x-axis date row. */
    if (y < PAD_TOP + 6 || y > CHART_HEIGHT - PAD_BOTTOM - 6) continue;
    ticks.push({ y, value: v });
  }
  return ticks;
}

/* Add currentRefY post-hoc since it depends on `currentNgn` which
   isn't in `points`. */
function computeGeometryFull(
  points: PriceHistoryPoint[],
  width: number,
  currentNgn: number,
  rangeDays: number,
  leftPad: number = PAD_LEFT,
): Geometry {
  const g = computeGeometry(points, width, rangeDays, leftPad, currentNgn);
  if (points.length === 0) return g;
  const { yMin, yMax } = padYDomain(g.lowestNgn, g.highestNgn);
  const chartH   = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const refRaw   = PAD_TOP + ((yMax - currentNgn) / (yMax - yMin)) * chartH;
  return {
    ...g,
    /* Fold the live "right now" price into the headline min/max so the
       Cheapest / Highest tiles and the screen-reader summary can never
       contradict the current price (e.g. show "Cheapest £31" beside
       "Right now £30"). Only these two scalar stats widen — the drawn
       path, fill area, lowest-marker dot and the y-domain all stay
       history-only (computed inside computeGeometry), and lowestIdx /
       lowestX / lowestY keep pointing at the lowest *tracked* point. */
    lowestNgn:  Math.min(g.lowestNgn,  currentNgn),
    highestNgn: Math.max(g.highestNgn, currentNgn),
    currentRefY: Math.max(PAD_TOP + 2, Math.min(CHART_HEIGHT - PAD_BOTTOM - 2, refRaw)),
  };
}

/* The component above uses `computeGeometry` then patches in
   currentRefY in a useMemo. Keep both exports for readability. */
function nearestIndex(px: number, geom: Geometry): number {
  if (geom.xs.length === 0) return 0;
  let bestIdx  = 0;
  let bestDist = Math.abs(px - geom.xs[0]);
  for (let i = 1; i < geom.xs.length; i++) {
    const d = Math.abs(px - geom.xs[i]);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

interface HoverState {
  x:            number;
  y:            number;
  dateLabel:    string;
  priceLabel:   string;
  deltaFromLow: number | null;
  tooltipStyle: React.CSSProperties;
}

function buildHoverState(
  points:   PriceHistoryPoint[],
  idx:      number,
  geom:     Geometry,
  width:    number,
  country:  Country,
  dateFmt:  Intl.DateTimeFormat,
): HoverState {
  const p   = points[idx];
  const x   = geom.xs[idx];
  const y   = geom.ys[idx];
  const dl  = dateFmt.format(new Date(p.day));
  /* formatPriceForUserExact (not formatPriceForUser) because the
     tooltip is the surface where the user is actively inspecting
     a specific number. The adaptive ≥ 1M abbreviation in
     formatLocal would collapse "₦1,520,000" to "₦1.5M" — dropping
     the variance that the chart's whole job is to surface. */
  const pl  = formatPriceForUserExact(p.minPriceNgn, country);
  const dfl = p.minPriceNgn > geom.lowestNgn
    ? p.minPriceNgn - geom.lowestNgn
    : 0;

  /* Tooltip positioning. Default above the point, but flip below
     if the point is in the top 1/3 of the chart. Right-edge clamp
     prevents overflow. */
  const flipBelow = y < CHART_HEIGHT * 0.35;
  /* Tooltip is ~110px wide (CSS minWidth) — keep the left/right
     edges within the chart. */
  const halfBox = 60;
  const left = Math.max(halfBox, Math.min(width - halfBox, x)) - halfBox;
  const top  = flipBelow
    ? y + TOOLTIP_OFFSET_Y
    : y - TOOLTIP_OFFSET_Y - 56;

  return {
    x, y,
    dateLabel:    dl,
    priceLabel:   pl,
    deltaFromLow: dfl,
    tooltipStyle: { left, top },
  };
}

interface RecentChange {
  deltaNgn:  number;
  direction: "up" | "down";
}

function computeRecentChange(
  points: PriceHistoryPoint[],
  daysBack: number,
): RecentChange | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const lastDate = new Date(last.day).getTime();
  const threshold = lastDate - daysBack * 86_400_000;
  /* Find the point closest to (but not after) the threshold. */
  let comparison: PriceHistoryPoint | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (new Date(points[i].day).getTime() <= threshold) {
      comparison = points[i];
      break;
    }
  }
  /* If no data point exists from N days ago, fall back to the
     oldest point IF the window spans at least daysBack / 2. */
  if (!comparison) {
    const oldest = points[0];
    const oldestDate = new Date(oldest.day).getTime();
    if ((lastDate - oldestDate) >= (daysBack * 86_400_000) / 2) {
      comparison = oldest;
    } else {
      return null;
    }
  }

  const delta = last.minPriceNgn - comparison.minPriceNgn;
  /* Suppress small drift (under 1% relative) so the pill doesn't
     trumpet noise. */
  if (Math.abs(delta) / comparison.minPriceNgn < 0.01) return null;

  return {
    deltaNgn:  delta,
    direction: delta < 0 ? "down" : "up",
  };
}

function computeVerdict(
  currentNgn: number,
  lowestNgn:  number,
  meanNgn:    number,
  rangeDays:  number,
  pointCount: number = 2,
): Verdict {
  /* Range label is woven into the verdict copy. Two variants because
     the days form takes a preposition ("in 30 days") and the All form
     doesn't ("since tracking started" — no leading "in"). The bug
     this fixes: prior code did `Cheapest in ${rangeLabel}` for both,
     which produced "Cheapest in since tracking started" — sentence
     fragment, reads broken. */
  const verdictPhrase = rangeDays >= 365
    ? "since tracking started"
    : `in ${rangeDays} days`;

  /* Single-observation case — we can't claim "lowest" or
     "above usual" with just one data point. Honest framing: the
     price is what it is, no trend judgment yet. */
  if (pointCount < 2) {
    return {
      copy:        "Just started tracking",
      tone:        "neutral",
      icon:        "flat",
      tileCaption: "First reading",
    };
  }

  /* At-floor: 1% tolerance for FX + rounding drift. Uses "Lowest" to
     match the "Lowest" stat tile + the "X% above the lowest" copy below,
     so the chart uses ONE word for the historical floor everywhere (#23
     — a consistent term is clearer than alternating cheapest/lowest). */
  if (currentNgn <= lowestNgn * 1.01) {
    return {
      copy:        `Lowest ${verdictPhrase}`,
      tone:        "success",
      icon:        "down",
      tileCaption: "At its lowest",
    };
  }
  /* Below mean: still a good time to buy, just not the floor. */
  if (currentNgn <= meanNgn) {
    const pctAboveLow = Math.round(((currentNgn - lowestNgn) / lowestNgn) * 100);
    const pctFmt = pctAboveLow.toLocaleString("en-US");
    return {
      copy:        `${pctFmt}% above the lowest`,
      tone:        "neutral",
      icon:        "flat",
      tileCaption: `${pctFmt}% above the lowest`,
    };
  }
  /* Above mean: warn signal. */
  const pctAboveLow = Math.round(((currentNgn - lowestNgn) / lowestNgn) * 100);
  const pctFmt = pctAboveLow.toLocaleString("en-US");
  if (pctAboveLow >= 20) {
    return {
      copy:        `Higher than usual`,
      tone:        "warn",
      icon:        "up",
      tileCaption: `${pctFmt}% above the lowest`,
    };
  }
  return {
    copy:        `${pctFmt}% above the lowest`,
    tone:        "warn",
    icon:        "up",
    tileCaption: `${pctFmt}% above the lowest`,
  };
}

/* Slice helpers ─────────────────────────────────────────────── */

function sliceToLastNDays(points: PriceHistoryPoint[], days: number): PriceHistoryPoint[] {
  if (points.length === 0) return points;
  /* Anchor at TODAY, not at the last data point. A user browsing on
     May 28 with the latest history row recorded May 1 expects to see
     "May 28" on the right edge of the chart — anchoring on the last
     data point would have made the right-edge label "May 1" instead.
     The chart geometry extends the line horizontally from the last
     point to today's X position so the right edge stays meaningful. */
  const today = todayMidnightUtcMs();
  const threshold = today - days * 86_400_000;
  let firstIdx = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (new Date(points[i].day).getTime() < threshold) {
      firstIdx = i + 1;
      break;
    }
  }
  return points.slice(firstIdx);
}

function computeSpanDays(points: PriceHistoryPoint[]): number {
  if (points.length < 2) return 0;
  const first = new Date(points[0].day).getTime();
  const last  = new Date(points[points.length - 1].day).getTime();
  return Math.max(0, Math.round((last - first) / 86_400_000));
}

/* Build a screen-reader summary that describes the chart in prose.
   Keeps the chart accessible without an interactive layer. */
function buildAriaSummary({
  range, sliced, geom, currentNgn, country, lowestDate, currentIsLowest,
}: {
  range:      typeof RANGE_OPTIONS[number];
  sliced:     PriceHistoryPoint[];
  geom:       Geometry;
  currentNgn: number;
  country:    Country;
  lowestDate: string;
  currentIsLowest: boolean;
}): string {
  const cur  = formatPriceForUser(currentNgn,    country);
  const low  = formatPriceForUser(geom.lowestNgn, country);
  const high = formatPriceForUser(geom.highestNgn, country);
  /* When the current price is the lowest, "on <date>" would read as a
     stale day; phrase it as the live price instead. */
  const lowestClause = currentIsLowest
    ? `Lowest ${low}, which is the current price.`
    : `Lowest ${low} on ${lowestDate}.`;
  const pointWord = sliced.length === 1 ? "data point" : "data points";
  return `Price history over ${range.label}. ${sliced.length} ${pointWord}. ` +
         `Current price ${cur}. ${lowestClause} Highest ${high}.`;
}

