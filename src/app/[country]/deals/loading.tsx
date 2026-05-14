/* Instant skeleton for /[country]/deals.
   Renders during the SSR data fetch in /[country]/deals/page.tsx
   (fetchInitialDeals → /api/deals + browse_deals RPC, typically
   0.2-1s when cache is warm, up to ~8s when the per-country pool
   has to cold-warm after deploy).

   Without this, navigation from any other route to /deals sits on
   the previous page for the full SSR duration. Worse: navigating
   from the homepage to /deals would fall back to the country-level
   skeleton which paints hero + trending + category grid + store
   logos — none of which exist on /deals — causing a hard layout
   jump when content lands.

   The skeleton mirrors DealFeed's structure (src/components/deals/
   DealFeed.tsx):
     • Header (h1 + subtitle)
     • Search input row + micro-copy
     • Sticky filter bar:
         - CategoryNav (horizontal scrolling chip row)
         - Tier pills + Stores filter button
         - Desktop deal-count + sort dropdown
     • Mobile-only view-mode + sort row
     • Masonry grid of card placeholders

   MASONRY_ASPECTS rotation mirrors the real deals grid so the
   placeholder grid has the same staggered rhythm as the loaded
   cards. */

const MASONRY_ASPECTS = ["aspect-[4/5]", "aspect-[3/4]", "aspect-square", "aspect-[5/4]"];

export default function DealsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header — h1 + subtitle copy lines */}
      <div className="mb-6 sm:mb-8 px-1 sm:px-0">
        <div className="skeleton h-8 sm:h-10 w-2/3 max-w-md rounded-lg mb-3" />
        <div className="skeleton h-4 w-full max-w-xl rounded mb-1.5" />
        <div className="skeleton h-4 w-3/4 max-w-md rounded" />
      </div>

      {/* Search input — full-width pill */}
      <div className="mb-1.5">
        <div className="skeleton h-12 w-full rounded-full" />
      </div>
      <div className="skeleton h-3 w-1/2 max-w-md rounded mb-4 ml-4" />

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 -mx-3 px-3 sm:-mx-6 sm:px-6 py-3 mb-6 bg-bg/85 backdrop-blur-xl border-b border-border">
        {/* Row 1 — Category nav (horizontal scroll chips) */}
        <div className="flex items-center gap-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-8 rounded-full shrink-0"
              /* Varied widths so the chip row reads as distinct
                 categories rather than a stripe of identical pills. */
              style={{ width: `${56 + (i * 13) % 48}px` }}
            />
          ))}
        </div>

        {/* Row 2 — tier pills + stores button, plus desktop deal-count + sort */}
        <div className="mt-3 flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="skeleton h-3.5 w-3.5 rounded mr-1" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-7 w-14 rounded-full" />
            ))}
          </div>

          {/* Stores filter — flex-1 on mobile, intrinsic on desktop */}
          <div className="flex-1 sm:flex-none ml-1.5">
            <div className="skeleton h-9 w-full sm:w-32 rounded-full" />
          </div>

          {/* Desktop-only right cluster — deal count + sort */}
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0 ml-auto">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-7 w-28 rounded-full" />
          </div>
        </div>
      </div>

      {/* Mobile-only view-mode + sort row */}
      <div className="flex items-center justify-between gap-3 mb-3 sm:hidden">
        <div className="skeleton h-8 w-20 rounded-full" />
        <div className="skeleton h-7 w-28 rounded-full" />
      </div>

      {/* Masonry grid — 12 tiles fills the fold across all viewports.
          Each tile pairs an image placeholder with three text rows
          matching MasonryCard's caption rhythm (brand · title ·
          price + savings line). */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
            <div className={`skeleton rounded-xl sm:rounded-2xl ${MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]}`} />
            <div className="pt-2.5 px-0.5 space-y-1.5">
              <div className="skeleton h-2.5 w-1/3 rounded" />
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
