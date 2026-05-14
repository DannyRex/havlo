/* Instant skeleton for /[country]/compare.
   The compare page is `"use client"` so SSR doesn't actually fetch
   the data — but Next.js still streams the route shell during
   chunk-load, and without a loading.tsx the user sees a blank
   white frame for ~200-800ms while the page JS hydrates.

   The empty state (no query yet) is also what most users see when
   they land on /compare directly, so the skeleton's shape mirrors
   it: a big search bar at the top, a chip rail underneath for
   "popular comparisons", and a quiet placeholder where results
   will eventually render.

   When a query IS present in the URL (?q=…), the page renders
   anchor + dupes after the API call. This skeleton stops short of
   modelling that loaded shape because:
     (a) the chip rail + search bar shape is what 80% of arrivals
         see (direct landing, no query)
     (b) once the query fetches, the page's own internal loading
         spinner takes over (a one-off ring near the search bar)
     (c) modelling the loaded anchor-card + dupe-grid shape would
         require a long-shaped skeleton that flashes wrong when
         results arrive at a different shape (single store, many
         dupes, no dupes, etc.) */

export default function CompareLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* SearchBar placeholder — large rounded-pill input centred.
          Matches src/components/compare/SearchBar.tsx max-w-3xl
          mx-auto centring and h-14 sm:h-16 height treatment. */}
      <div className="max-w-3xl mx-auto">
        <div className="skeleton h-14 sm:h-16 w-full rounded-full" />
        {/* Sublabel under the search input — "Search products or
            paste a link" micro-copy in the real component. */}
        <div className="skeleton h-3 w-2/3 max-w-sm rounded mt-3 mx-auto" />
      </div>

      {/* Trending chip rail placeholder — popular comparisons.
          Real TrendingChipRail renders 8-10 chips in a wrapping row
          with varied widths so popular searches feel discoverable. */}
      <div className="max-w-2xl mx-auto mt-10">
        <div className="skeleton h-3.5 w-44 rounded mb-3" />
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-8 rounded-full"
              /* Varied chip widths so the rail reads as distinct
                 product names, not a stripe of identical pills. */
              style={{ width: `${74 + (i * 19) % 86}px` }}
            />
          ))}
        </div>
      </div>

      {/* Quiet hint that results / live cards will fill the space
          below once the query lands. Three muted lines — barely
          visible — keep the page feeling alive without committing
          to a layout shape that might mismatch what arrives. */}
      <div className="max-w-3xl mx-auto mt-16 space-y-3 opacity-50">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-3 w-1/4 rounded" />
        <div className="skeleton h-3 w-1/5 rounded" />
      </div>
    </div>
  );
}
