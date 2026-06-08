/* Shared instant skeleton for the hub surfaces:
     • brand hub     — /[country]/brand/[brand]   (variant="product")
     • category hub   — /[country]/deals/[category] (variant="product")
     • brand index    — /[country]/brands           (variant="chip")

   All three render the same shell — a crawlable breadcrumb, an h1 +
   lede hero, a responsive grid, then the NewsletterStrip. Only the
   grid differs: the two hubs paint 4/5 product cards (mirroring
   HubProductGrid), the index paints short brand-link tiles.

   Why this exists: none of the three had their own loading.tsx, so
   each inherited the NEAREST ancestor skeleton during client-side
   navigation. The brand routes fell back to the HOMEPAGE shell
   (hero + trending rail + category grid + store-logo marquee +
   newsletter + CTA — nothing like a hub), and the category hub fell
   back to the DEALS-FEED shell (search bar + sticky filter toolbar
   the hub doesn't have). Either way the loading state painted a
   layout that bore no resemblance to the page that landed, so the
   real content swap caused a hard jump. This matches the hub's own
   vertical rhythm so the swap is seamless.

   Heights are approximate (real cards vary with store badge + image)
   but the spacing, columns, and section order match the live pages
   in brand/[brand]/page.tsx, deals/[category]/page.tsx, and
   brands/page.tsx. */

export default function HubSkeleton({
  variant,
}: {
  variant: "product" | "chip";
}) {
  return (
    <main className="bg-bg">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb — short segments + separators */}
        <div className="mb-6 flex items-center gap-2">
          <div className="skeleton h-3.5 w-12 rounded" />
          <div className="skeleton h-3.5 w-1.5 rounded opacity-50" />
          <div className="skeleton h-3.5 w-16 rounded" />
          <div className="skeleton h-3.5 w-1.5 rounded opacity-50" />
          <div className="skeleton h-3.5 w-20 rounded" />
        </div>

        {/* Hero — h1 + two-line lede */}
        <div className="mb-8">
          <div className="skeleton h-8 sm:h-10 w-2/3 max-w-md rounded-lg mb-3" />
          <div className="skeleton h-4 w-full max-w-2xl rounded mb-1.5" />
          <div className="skeleton h-4 w-3/4 max-w-xl rounded" />
        </div>

        {/* Grid */}
        {variant === "product" ? (
          /* Mirrors HubProductGrid: cols 2/3/4, uniform aspect-[4/5]
             cards with a brand · title · price caption rhythm. */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton aspect-[4/5] rounded-xl sm:rounded-2xl" />
                <div className="pt-2.5 px-0.5 space-y-1.5">
                  <div className="skeleton h-2.5 w-1/3 rounded" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Mirrors the brand index: cols 2/3/4 of brand-link tiles. */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="skeleton h-[68px] rounded-xl" />
            ))}
          </div>
        )}

        {/* Browse-by-category chip row (both hubs + index render this) */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="skeleton h-3.5 w-40 rounded mb-4" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-9 rounded-full"
                /* Varied widths so the row reads as distinct category
                   chips, not a stripe of identical pills. */
                style={{ width: `${72 + ((i * 17) % 52)}px` }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* NewsletterStrip skeleton — matches NewsletterStrip.tsx
          (bg-surface band, max-w-4xl, heading + body + form row). */}
      <section className="py-12 sm:py-20 bg-surface border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="skeleton h-7 sm:h-8 w-2/3 max-w-md rounded-lg mx-auto mb-4" />
          <div className="skeleton h-4 w-full max-w-md rounded mx-auto mb-2" />
          <div className="skeleton h-4 w-3/4 max-w-sm rounded mx-auto mb-7 sm:mb-8" />
          <div className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
            <div className="skeleton h-12 flex-1 rounded-full" />
            <div className="skeleton h-12 w-full sm:w-32 rounded-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
