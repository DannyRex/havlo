/* Instant skeleton for the country homepage.
   Renders the moment the user clicks the home link from any other
   route, before the server-rendered page is ready. Without this,
   the browser sits on the previous page for the full SSR duration
   (1-3s on a cold cache because TrendingDeals + CategoryGrid each
   fan out to multiple DB queries).

   The skeleton mirrors the real layout's vertical rhythm so the
   page doesn't visually jump when the real content swaps in.
   Heights are approximate (real cards are taller/shorter depending
   on store badge + image) but the gradient + spacing match. */

export default function HomepageLoading() {
  return (
    <main className="bg-bg">
      {/* Hero skeleton — pill, headline, subhead, search */}
      <section className="pt-10 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="skeleton h-6 w-56 rounded-full mx-auto mb-6" />
          <div className="skeleton h-14 sm:h-20 w-full max-w-2xl rounded-2xl mx-auto mb-4" />
          <div className="skeleton h-14 sm:h-20 w-4/5 rounded-2xl mx-auto mb-6" />
          <div className="skeleton h-5 w-3/4 max-w-md rounded mx-auto mb-2" />
          <div className="skeleton h-5 w-1/2 max-w-sm rounded mx-auto mb-8" />
          <div className="skeleton h-14 w-full max-w-xl rounded-full mx-auto" />
        </div>
      </section>

      {/* TrendingDeals skeleton — heading + horizontal scroll cards */}
      <section className="py-12 sm:py-20 bg-bg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-6 sm:mb-8 px-1 sm:px-0">
            <div className="skeleton h-8 sm:h-10 w-64 rounded-lg" />
            <div className="skeleton h-5 w-20 rounded hidden sm:block" />
          </div>
          <div className="flex gap-3 sm:gap-5 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-44 sm:w-60">
                <div className="skeleton aspect-[4/5] rounded-xl sm:rounded-2xl mb-2.5" />
                <div className="skeleton h-3 w-1/3 rounded mb-1.5" />
                <div className="skeleton h-3.5 w-3/4 rounded mb-1.5" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CashbackTeaser skeleton — narrower content, centred */}
      <section className="py-12 sm:py-20 bg-surface border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="skeleton h-6 w-44 rounded-full mb-4" />
            <div className="skeleton h-8 sm:h-10 w-3/4 max-w-md rounded-lg mb-4" />
            <div className="skeleton h-4 w-2/3 max-w-md rounded mb-2" />
            <div className="skeleton h-4 w-1/2 max-w-sm rounded mb-8" />
            <div className="skeleton h-12 w-full max-w-md rounded-full" />
          </div>
        </div>
      </section>

      {/* CategoryGrid skeleton — 4×3 tile grid */}
      <section className="py-12 sm:py-20 bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="skeleton h-8 sm:h-10 w-56 rounded-lg mb-6 sm:mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[5/3] rounded-xl" />
            ))}
          </div>
        </div>
      </section>

      {/* StoreLogos skeleton — single row of chips */}
      <section className="py-12 sm:py-20 bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="skeleton h-3.5 w-40 rounded mx-auto mb-3" />
          <div className="skeleton h-8 sm:h-10 w-2/3 max-w-md rounded-lg mx-auto mb-8" />
          <div className="flex items-center justify-center gap-6 sm:gap-10 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton w-14 h-14 sm:w-20 sm:h-20 rounded-2xl shrink-0" />
            ))}
          </div>
        </div>
      </section>

      {/* NewsletterStrip skeleton — bg-surface section between
          StoreLogos and CTA. Heading + body + email form row.
          Matches NewsletterStrip.tsx max-w-4xl + text-center. */}
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

      {/* CTA skeleton — final hero-style section. Dark feel in the
          real component (white text on ink-3 background) but the
          skeleton renders the same shape via shimmer-on-surface so
          the silhouette matches without committing to the dark
          treatment that flashes wrong on theme change. */}
      <section className="py-14 sm:py-24 bg-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl sm:rounded-3xl bg-surface border border-border p-6 sm:p-12 lg:p-16">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              {/* Copy column */}
              <div>
                <div className="space-y-2 mb-5">
                  <div className="skeleton h-10 sm:h-14 w-full rounded-lg" />
                  <div className="skeleton h-10 sm:h-14 w-3/4 rounded-lg" />
                </div>
                <div className="space-y-2 mb-8">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-4 w-2/3 rounded" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="skeleton h-12 w-full sm:w-44 rounded-full" />
                  <div className="skeleton h-12 w-full sm:w-40 rounded-full" />
                </div>
              </div>
              {/* Visual column — placeholder card stack */}
              <div className="hidden lg:flex flex-col gap-3">
                <div className="skeleton h-20 rounded-2xl" />
                <div className="skeleton h-20 rounded-2xl" />
                <div className="skeleton h-20 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
