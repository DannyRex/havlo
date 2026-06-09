/* Instant skeleton for /[country]/cashback.
   The cashback page is server-rendered with country-aware metadata
   + JSON-LD + rate table. SSR cost is moderate (~150-400ms) but
   noticeable from a cold homepage navigation. Without this loading
   file, the user sits on the previous page until the SSR completes.

   The skeleton mirrors src/app/[country]/cashback/page.tsx exactly:
     1. Hero (eyebrow pill, H1, subhead)
     2. "How it works" — H2 + 4-step ordered list
     3. "Cashback rates" — H2 + intro copy + rate table rows
     4. Two trust cards (No hidden fees / The cheapest still wins)
        in a 2-col grid on sm+
     5. Email capture card (H2 + supporting copy + input + button)
     6. Common questions — H2 + 4 Q&A blocks
     7. Final CTA — H2 + supporting copy + two action buttons

   The page is content-dense and visually quiet (no images), so the
   skeleton's job is to preserve vertical rhythm so headings, copy,
   and the rate table don't visibly snap into place when SSR lands.
   Aspect ratios + max-w containers match the real layout. */

export default function CashbackLoading() {
  return (
    <main className="bg-bg">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        {/* ── Hero ────────────────────────────────────────────── */}
        <header className="mb-12">
          {/* Eyebrow pill — "Cashback · Coming Soon" */}
          <div className="skeleton h-4 w-44 rounded-full mb-3" />
          {/* H1 — large display heading, often wraps to 2 lines */}
          <div className="space-y-2 mb-5">
            <div className="skeleton h-10 sm:h-14 w-full rounded-lg" />
            <div className="skeleton h-10 sm:h-14 w-3/4 rounded-lg" />
          </div>
          {/* Subhead — 2-3 lines of body copy */}
          <div className="space-y-2">
            <div className="skeleton h-5 w-full rounded" />
            <div className="skeleton h-5 w-11/12 rounded" />
            <div className="skeleton h-5 w-1/2 rounded" />
          </div>
        </header>

        {/* ── How it works ────────────────────────────────────── */}
        <section className="mb-12">
          <div className="skeleton h-7 sm:h-8 w-40 rounded-lg mb-4" />
          <ol className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex gap-3">
                {/* Step number — single digit, ink-3 mono */}
                <div className="skeleton h-5 w-3 rounded shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4 w-2/5 rounded" />
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-4 w-3/4 rounded" />
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Cashback rates ──────────────────────────────────── */}
        <section className="mb-12">
          <div className="skeleton h-7 sm:h-8 w-36 rounded-lg mb-4" />
          {/* Intro paragraph — 3 lines */}
          <div className="space-y-2 mb-5">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-11/12 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
          {/* Rate rows — store name on the left, percentage pill on the right.
              Six rows matches the typical partner count at launch. */}
          <ul className="divide-y divide-border border border-border rounded-2xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 px-4 py-3.5 bg-surface"
              >
                <div className="skeleton h-4 w-28 rounded" />
                <div className="skeleton h-6 w-20 rounded-full" />
              </li>
            ))}
          </ul>
        </section>

        {/* ── Trust cards — 2-col grid on sm+ ────────────────── */}
        <section className="mb-12 grid sm:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl border border-border bg-surface">
              {/* Icon */}
              <div className="skeleton h-5 w-5 rounded mb-3" />
              {/* Card title */}
              <div className="skeleton h-4 w-1/2 rounded mb-2" />
              {/* Card body — 3-4 lines */}
              <div className="space-y-1.5">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </section>

        {/* ── Email capture card ──────────────────────────────── */}
        <section className="mb-12 p-6 sm:p-8 rounded-2xl border border-border bg-surface-2">
          {/* H2 */}
          <div className="skeleton h-7 sm:h-8 w-2/3 max-w-md rounded-lg mb-2" />
          {/* Supporting copy — 2 lines */}
          <div className="space-y-2 mb-5">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
          </div>
          {/* Form — email input + submit button */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="skeleton h-12 flex-1 rounded-full" />
            <div className="skeleton h-12 w-full sm:w-32 rounded-full" />
          </div>
        </section>

        {/* ── Common questions (FAQ) ──────────────────────────── */}
        <section className="mb-12">
          <div className="skeleton h-7 sm:h-8 w-44 rounded-lg mb-4" />
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                {/* Q */}
                <div className="skeleton h-4 w-1/2 rounded mb-2" />
                {/* A — 3-4 lines */}
                <div className="space-y-1.5">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-4 w-11/12 rounded" />
                  <div className="skeleton h-4 w-3/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────── */}
        <section className="pt-8 border-t border-border">
          <div className="skeleton h-7 sm:h-8 w-2/3 max-w-md rounded-lg mb-2" />
          <div className="space-y-2 mb-5">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="skeleton h-11 w-full sm:w-48 rounded-full" />
            <div className="skeleton h-11 w-full sm:w-44 rounded-full" />
          </div>
        </section>
      </section>
    </main>
  );
}
