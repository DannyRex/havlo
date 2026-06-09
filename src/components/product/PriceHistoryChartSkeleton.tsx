/* Loading skeleton for <PriceHistoryChart>.

   Why a dedicated skeleton (and not just an empty box):
     The chart is code-split via next/dynamic on the PDP — its JS
     chunk loads after the rest of the page. During that gap (50ms
     on fast networks, 500ms+ on slow ones) we need to reserve the
     space so the page doesn't reflow when the chart hydrates AND
     telegraph that something is loading so users don't think the
     section is empty.

   Visual hierarchy mirrors the real chart so the swap-in is barely
   perceptible:
     • Header row: title bar + verdict pill + range toggle
     • Chart body (220px tall) — same height as the real SVG
     • 3-tile strip
     • Freshness line

   Uses the project's .skeleton utility class (globals.css) which
   resolves to a flat surface-2 background. No shimmer animation —
   matches the rest of the app's skeleton language and respects
   prefers-reduced-motion implicitly. */

export default function PriceHistoryChartSkeleton() {
  return (
    <section
      className="rounded-2xl bg-surface-2/40 p-4 sm:p-5"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading price history"
    >
      {/* Header row — title block on the left, range toggle on the right */}
      <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <div className="min-w-0 flex-1">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="flex items-center gap-2 mt-2">
            <div className="skeleton h-5 w-32 rounded-full" />
          </div>
        </div>
        <div className="skeleton h-7 w-32 rounded-full shrink-0" />
      </div>

      {/* Chart body — same 220px height as the real SVG so nothing
          shifts when the chunk hydrates. */}
      <div
        className="skeleton rounded-lg"
        style={{ height: 220 }}
      />

      {/* Tiles strip */}
      <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg bg-surface border border-border px-3 py-2"
          >
            <div className="skeleton h-2.5 w-12 rounded" />
            <div className="skeleton h-3.5 w-16 rounded mt-1.5" />
            <div className="skeleton h-2.5 w-14 rounded mt-1" />
          </div>
        ))}
      </div>

      {/* Freshness strip */}
      <div className="mt-3 skeleton h-2.5 w-48 rounded" />
    </section>
  );
}
