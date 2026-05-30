/* Instant skeleton for /[country]/compare.
   Shown while the route segment is busy: for a bare /compare landing
   that's the brief JS-hydration window; for a deep-linked query
   (?q=…, ?key=…, ?oid=…) it's the short server-side /api/compare fetch
   the page now awaits before streaming real anchor + dupes (see
   page.tsx → fetchInitialCompare). Either way it replaces the blank
   white frame the user used to see.

   The skeleton models the EMPTY state — a big search bar, a chip rail
   for "popular comparisons", and a quiet results placeholder — for two
   reasons:
     (a) the bare landing (no query) is what most arrivals see, and
     (b) loading.tsx receives no searchParams, so it can't know whether
         a query is present or what shape its result will take (single
         store, many dupes, none); a loaded anchor+dupe skeleton would
         flash wrong when the real result arrives at a different shape.
         The search bar shape stays constant across both states, so the
         swap into real content never moves the primary control. */

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
