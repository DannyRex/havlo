/* Instant skeleton for /[country]/p/[id] AND /[country]/p/live.
   Placed at the /p segment so a single file covers both PDP routes
   without duplication.

   Without this, a click from /deals to a PDP would fall back up the
   route tree and render the country-level homepage skeleton (hero,
   trending strip, category grid, store logos) — completely the wrong
   shape and a hard visual jump when the real PDP swaps in. User
   report May 2026: "PDP skeleton looks like the homepage when
   navigating from deals".

   The skeleton mirrors src/app/[country]/p/[id]/page.tsx + ProductHero
   + SimilarProducts:
     • Outer container max-w-6xl with the same padding rhythm
     • Back link
     • 2-column hero grid (stacks on mobile, 1fr:1.05fr md+)
         - Image column (square mobile, 4:5 md+)
         - Info column: pills, title, price, two CTAs, info tiles
     • "You may also like" heading + masonry of card placeholders

   Sizes/aspect ratios match the real layout so the page doesn't jump
   when content lands. The `skeleton` class is the same shimmer
   primitive used by the country-level loading file. */

export default function PdpLoading() {
  return (
    <main className="bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Back link */}
        <div className="skeleton h-4 w-28 rounded mb-5 sm:mb-7" />

        {/* ── Hero grid ─────────────────────────────────────────────── */}
        <section className="grid md:grid-cols-[1fr,minmax(0,1.05fr)] gap-6 sm:gap-10 lg:gap-14">
          {/* Image column — matches aspect-square mobile, aspect-[4/5] md+
              and the same rounded-2xl/3xl treatment as the real hero. */}
          <div className="skeleton aspect-square md:aspect-[4/5] rounded-2xl sm:rounded-3xl" />

          {/* Info column */}
          <div className="flex flex-col">
            {/* Eyebrow: store pill (+ optional cross-border tag). Two
                short pills covers the most common case; if a single
                pill renders, the layout still won't shift since
                heights are identical. */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="skeleton h-7 w-28 rounded-full" />
              <div className="skeleton h-7 w-24 rounded-full" />
            </div>

            {/* H1 — title, up to 3 lines clamp in the real layout */}
            <div className="space-y-2.5 mb-5">
              <div className="skeleton h-7 sm:h-9 lg:h-10 w-full rounded-lg" />
              <div className="skeleton h-7 sm:h-9 lg:h-10 w-4/5 rounded-lg" />
              <div className="skeleton h-7 sm:h-9 lg:h-10 w-3/5 rounded-lg" />
            </div>

            {/* Price block — large primary + small secondary line */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="skeleton h-9 sm:h-11 w-40 rounded-lg" />
                <div className="skeleton h-5 sm:h-6 w-24 rounded" />
              </div>
              <div className="skeleton h-4 w-32 rounded mt-2" />
            </div>

            {/* Primary CTA — solid pill */}
            <div className="skeleton h-12 w-full max-w-xs rounded-full mb-3" />

            {/* Secondary CTA — outline pill */}
            <div className="skeleton h-11 w-full max-w-xs rounded-full mb-7" />

            {/* Info tiles — 2-col grid on sm+, 1-col on mobile.
                Two tiles match the real "Last checked" + "Store country"
                pair (out-of-stock tile is conditional and rare, so
                skipping it here keeps the skeleton uncluttered). */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          </div>
        </section>

        {/* ── "You may also like" rail ──────────────────────────────── */}
        <section className="mt-12 sm:mt-16">
          <header className="mb-6 sm:mb-8">
            <div className="skeleton h-7 sm:h-9 w-52 rounded-lg mb-2" />
            <div className="skeleton h-4 w-72 rounded" />
          </header>

          {/* Masonry-style placeholder grid. Uses the same columns-2 /
              columns-3 / columns-4 ladder as the real SimilarProducts
              so the card density matches at every breakpoint. Eight
              cards covers what the (now 8-row) dupes fetch yields and
              fills the viewport without scrolling-into-empty on most
              screens. */}
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
                {/* Vary aspect ratios so the placeholder grid has the
                    same staggered rhythm as the real masonry (matches
                    MASONRY_ASPECTS rotation: 4/5, 3/4, 1/1, 5/4). */}
                <div
                  className={`skeleton rounded-xl sm:rounded-2xl ${
                    ["aspect-[4/5]", "aspect-[3/4]", "aspect-square", "aspect-[5/4]"][i % 4]
                  }`}
                />
                <div className="skeleton h-3 w-1/3 rounded mt-2.5 mb-1.5" />
                <div className="skeleton h-3.5 w-3/4 rounded mb-1.5" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
