"use client";

/* Price-history line chart for the PDP.

   Renders the product_price_timeseries data (one point per day,
   lowest price across stores) as an SVG line + area chart. No
   chart library — the data shape is simple enough that a hand-rolled
   SVG is smaller, faster, and gives full control over the visual
   language that has to match PriceComparisonBar.

   What it shows:
     • The PRICE FLOOR across all stores carrying this product over
       the last 90 days. Not the visiting store's price specifically —
       the bar above the chart shows that. The chart is "what's the
       cheapest this product has ever been across any store?"
     • A dashed reference line for the visiting store's current price,
       so the visitor can see if their offer is above / below / at
       the historical floor.
     • Tooltip on hover (desktop) / touch (mobile) showing exact
       price + date for that point.

   What it deliberately doesn't show:
     • Per-store lines. KuantoKusta's chart is single-line (lowest
       across stores). Multi-line would be cluttered for products
       with 5+ stores and confusing when stores enter/exit the data
       over time.
     • Original (non-sale) prices. The data is current/sale prices
       only — that's what shoppers actually care about.

   Empty / sparse data:
     • <2 points: show empty state ("No price history yet").
     • 2-6 points: show the chart but suppress the "X day low" badge
       in the header (not enough data to claim a low confidently).
     • 7+ points: full chart + badges.

   Currency contract: prices come in as NGN. The component runs them
   through formatPriceForUser at render time using the same Country
   object the PriceComparisonBar uses. */

import { useState, useId, useMemo } from "react";
import { formatPriceForUser } from "@/lib/utils";
import type { Country } from "@/lib/country";
import type { PriceHistoryPoint } from "@/lib/search/price-history";
import { TrendingDown, Calendar } from "lucide-react";

interface Props {
  /** Time-series points, oldest first. */
  points:        PriceHistoryPoint[];
  /** Visiting offer's current NGN price — drives the dashed
      reference line + "this price vs floor" framing. */
  currentNgn:    number;
  /** Country object for currency formatting (matches the bar above). */
  country:       Country;
  /** Lookback window the data covers — used in the empty-state copy
      and the chart header. Default 90 to match the page's fetch. */
  windowDays?:   number;
}

/* Visual tuning ─────────────────────────────────────────────────────
   Chart dimensions chosen to match the PriceComparisonBar's visual
   weight without overshadowing it. 380px height on desktop is enough
   to read individual points; 240px on mobile keeps the chart from
   dominating the above-the-fold area when the PDP scrolls. */
const CHART_HEIGHT_DESKTOP = 200;
const CHART_HEIGHT_MOBILE  = 160;
const PADDING_X            = 12;
const PADDING_TOP          = 16;
const PADDING_BOTTOM       = 28;

export default function PriceHistoryChart({ points, currentNgn, country, windowDays = 90 }: Props) {
  const uid = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  /* Empty state — no history rows yet. Most likely cause: product
     was just ingested, hasn't had a price change recorded yet. The
     trigger from migration 0027 always writes at least one row on
     INSERT so this should only fire for legitimately new products. */
  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-surface-2/40 px-5 py-8 text-center">
        <Calendar size={20} className="mx-auto text-ink-3 mb-2" />
        <p className="text-sm text-ink-2">No price history yet.</p>
        <p className="text-xs text-ink-3 mt-1">
          Check back in a few days — we&apos;ll track this product&apos;s price across stores.
        </p>
      </div>
    );
  }

  /* Scale points to chart coordinates. Recomputed on every render
     but the math is trivial (≤90 elements) — useMemo only to keep
     downstream JSX dependency-tracking simple. */
  const { pathD, areaD, lowest, lowestIdx, highest, prices, days } = useMemo(() => {
    const prices = points.map((p) => p.minPriceNgn);
    const days   = points.map((p) => p.day);
    let lowest   = prices[0];
    let lowestIdx = 0;
    let highest  = prices[0];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] < lowest)  { lowest = prices[i]; lowestIdx = i; }
      if (prices[i] > highest) { highest = prices[i]; }
    }
    /* Range padding so the line doesn't sit flush against the
       chart edges. If lowest === highest (flat price), pad both
       directions equally so the line ends up centre-vertically. */
    const rangeRaw  = highest - lowest;
    const range     = rangeRaw === 0 ? Math.max(highest * 0.1, 100) : rangeRaw;
    const minPadded = lowest  - range * 0.15;
    const maxPadded = highest + range * 0.15;
    const heightUsable = 100 - ((PADDING_TOP + PADDING_BOTTOM) / 200) * 100; // % space
    const xStep = 100 / Math.max(prices.length - 1, 1);

    const coords = prices.map((p, i) => {
      const x = i * xStep;
      const y = PADDING_TOP + ((maxPadded - p) / (maxPadded - minPadded)) * heightUsable;
      return { x, y };
    });
    /* Step-after line (price holds until next change) — the
       offer_price_history data is event-based not sampled, so
       drawing a smooth line between two points implies prices
       continuously slid between them. Step-after makes the chart
       honest: prices hold the last known value until a new event
       overwrites them. */
    const segments: string[] = [];
    coords.forEach((c, i) => {
      if (i === 0) {
        segments.push(`M ${c.x.toFixed(2)} ${c.y.toFixed(2)}`);
      } else {
        const prev = coords[i - 1];
        segments.push(`L ${c.x.toFixed(2)} ${prev.y.toFixed(2)}`);
        segments.push(`L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`);
      }
    });
    const pathD = segments.join(" ");
    /* Area shape closes the line back down to the bottom edge for
       the gradient fill — pure cosmetic depth cue. */
    const last = coords[coords.length - 1];
    const first = coords[0];
    const areaD = `${pathD} L ${last.x.toFixed(2)} ${100 - PADDING_BOTTOM / 200 * 100} L ${first.x.toFixed(2)} ${100 - PADDING_BOTTOM / 200 * 100} Z`;
    return { pathD, areaD, lowest, lowestIdx, highest, prices, days };
  }, [points]);

  const currentVsLowest = currentNgn - lowest;
  const isCurrentAtFloor = currentNgn <= lowest * 1.01;

  /* Format the lowest date as "Mar 12" — short, locale-agnostic. */
  const lowestDate = new Date(days[lowestIdx]).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <section className="rounded-2xl border border-border bg-surface-2/40 p-4 sm:p-5">
      {/* Header — context + the "lowest in N days" callout. Mirrors
          the PriceComparisonBar's header rhythm so the two surfaces
          read as siblings. */}
      <header className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-ink leading-tight">
            Price history
          </h3>
          <p className="text-xs text-ink-3 mt-0.5">
            Lowest across stores · last {windowDays} days
          </p>
        </div>
        {points.length >= 7 && (
          <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
            <TrendingDown size={11} className="text-success" />
            <span className="text-[11px] font-semibold text-success whitespace-nowrap">
              Low: {formatPriceForUser(lowest, country)}
            </span>
          </div>
        )}
      </header>

      {/* SVG chart. preserveAspectRatio=none lets the chart stretch
          to the container width while we keep the math in 0-100
          coordinate space. */}
      <div className="relative" style={{ height: CHART_HEIGHT_DESKTOP }}>
        <div className="absolute inset-0 hidden sm:block">
          <ChartSvg
            uid={uid}
            pathD={pathD}
            areaD={areaD}
            prices={prices}
            currentNgn={currentNgn}
            lowest={lowest}
            highest={highest}
            lowestIdx={lowestIdx}
            hoverIdx={hoverIdx}
            setHoverIdx={setHoverIdx}
          />
        </div>
        <div className="absolute inset-0 sm:hidden" style={{ height: CHART_HEIGHT_MOBILE }}>
          <ChartSvg
            uid={uid + "-m"}
            pathD={pathD}
            areaD={areaD}
            prices={prices}
            currentNgn={currentNgn}
            lowest={lowest}
            highest={highest}
            lowestIdx={lowestIdx}
            hoverIdx={hoverIdx}
            setHoverIdx={setHoverIdx}
          />
        </div>
      </div>

      {/* Footer strip — three info tiles below the chart. Mirrors
          the PriceComparisonBar's facts strip for visual
          consistency. */}
      <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-surface border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-ink-3 font-medium">Lowest</div>
          <div className="text-sm font-semibold text-success mt-0.5">
            {formatPriceForUser(lowest, country)}
          </div>
          <div className="text-[10px] text-ink-3 mt-0.5">{lowestDate}</div>
        </div>
        <div className="rounded-lg bg-surface border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-ink-3 font-medium">Highest</div>
          <div className="text-sm font-semibold text-ink mt-0.5">
            {formatPriceForUser(highest, country)}
          </div>
          <div className="text-[10px] text-ink-3 mt-0.5">in {windowDays}d</div>
        </div>
        <div className="rounded-lg bg-surface border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-ink-3 font-medium">Right now</div>
          <div className={`text-sm font-semibold mt-0.5 ${isCurrentAtFloor ? "text-success" : "text-ink"}`}>
            {formatPriceForUser(currentNgn, country)}
          </div>
          <div className={`text-[10px] mt-0.5 ${isCurrentAtFloor ? "text-success" : "text-ink-3"}`}>
            {isCurrentAtFloor
              ? "At lowest"
              : currentVsLowest > 0
                ? `+${formatPriceForUser(currentVsLowest, country)} vs low`
                : `${formatPriceForUser(currentVsLowest, country)} vs low`}
          </div>
        </div>
      </div>

      {/* Hover tooltip — desktop only, only renders when an index
          is hovered. Positioned absolutely above the hovered point
          via the inline left offset. */}
      {hoverIdx !== null && (
        <div className="mt-2 text-xs text-ink-2 text-center">
          <span className="font-semibold text-ink">{formatPriceForUser(prices[hoverIdx], country)}</span>
          <span className="text-ink-3"> · {new Date(days[hoverIdx]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      )}
    </section>
  );
}

/* Inner SVG component — shared by desktop + mobile variants.
   Coordinate system is 0-100 in both dimensions (preserveAspectRatio
   none lets it stretch); strokes use vector-effect=non-scaling-stroke
   so line thickness doesn't distort when the container resizes. */
interface SvgProps {
  uid:        string;
  pathD:      string;
  areaD:      string;
  prices:     number[];
  currentNgn: number;
  lowest:     number;
  highest:    number;
  lowestIdx:  number;
  hoverIdx:   number | null;
  setHoverIdx: (i: number | null) => void;
}

function ChartSvg({ uid, pathD, areaD, prices, currentNgn, lowest, highest, lowestIdx, hoverIdx, setHoverIdx }: SvgProps) {
  /* Map currentNgn to chart Y so the dashed "your price" reference
     line lands at the right vertical position. Outside the data
     range we clamp to the chart edges. */
  const range = (highest - lowest) || Math.max(highest * 0.1, 100);
  const minPadded = lowest  - range * 0.15;
  const maxPadded = highest + range * 0.15;
  const heightUsable = 100 - ((PADDING_TOP + PADDING_BOTTOM) / 200) * 100;
  const currentY = Math.max(
    PADDING_TOP,
    Math.min(
      PADDING_TOP + heightUsable,
      PADDING_TOP + ((maxPadded - currentNgn) / (maxPadded - minPadded)) * heightUsable,
    ),
  );

  const xStep = 100 / Math.max(prices.length - 1, 1);
  const lowestX = lowestIdx * xStep;
  const lowestY = PADDING_TOP + ((maxPadded - prices[lowestIdx]) / (maxPadded - minPadded)) * heightUsable;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-full"
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgb(16 185 129)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Area fill below the line — subtle gradient. */}
      <path d={areaD} fill={`url(#grad-${uid})`} />

      {/* Dashed reference line for the visitor's current price */}
      <line
        x1="0" y1={currentY}
        x2="100" y2={currentY}
        stroke="rgb(120 113 108)"
        strokeWidth="0.4"
        strokeDasharray="1.5 1"
        vectorEffect="non-scaling-stroke"
        opacity="0.5"
      />

      {/* The line itself — emerald to match the success tokens */}
      <path
        d={pathD}
        fill="none"
        stroke="rgb(16 185 129)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Hover hit-targets — invisible vertical strips, one per
          point, that catch mouse/touch and surface the tooltip
          state. Width slightly wider than xStep so adjacent strips
          overlap a hair and hover never lands in a dead zone. */}
      {prices.map((_, i) => {
        const x = i * xStep;
        const half = xStep / 2 + 0.5;
        return (
          <rect
            key={i}
            x={Math.max(0, x - half)}
            y={0}
            width={Math.min(100, half * 2)}
            height={100}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onTouchStart={() => setHoverIdx(i)}
            style={{ cursor: "pointer" }}
          />
        );
      })}

      {/* Lowest-point marker — a green dot + ring */}
      <circle cx={lowestX} cy={lowestY} r="2.2" fill="rgb(16 185 129)" vectorEffect="non-scaling-stroke" />
      <circle cx={lowestX} cy={lowestY} r="3.5" fill="none" stroke="rgb(16 185 129)" strokeWidth="0.5" opacity="0.5" vectorEffect="non-scaling-stroke" />

      {/* Hover marker — only renders when an index is hovered */}
      {hoverIdx !== null && (
        <>
          <line
            x1={hoverIdx * xStep} y1={PADDING_TOP}
            x2={hoverIdx * xStep} y2={100 - PADDING_BOTTOM / 200 * 100}
            stroke="rgb(120 113 108)"
            strokeWidth="0.3"
            strokeDasharray="0.8 0.8"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
          <circle
            cx={hoverIdx * xStep}
            cy={PADDING_TOP + ((maxPadded - prices[hoverIdx]) / (maxPadded - minPadded)) * heightUsable}
            r="2"
            fill="white"
            stroke="rgb(16 185 129)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
