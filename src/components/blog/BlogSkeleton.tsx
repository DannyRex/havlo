/* Shared instant skeleton for the two blog surfaces:
     • blog index — /[country]/blog          (variant="index")
     • blog post   — /[country]/blog/[slug]   (variant="post")

   Both are narrow, centered single-column reading layouts that look
   nothing like the country HOMEPAGE shell (hero + trending rail +
   cashback band + category grid + store-logo marquee + newsletter +
   CTA). Neither blog route had its own loading.tsx, so during
   client-side navigation each inherited that homepage skeleton from
   the nearest ancestor (/[country]/loading.tsx) — a jarring mismatch
   on the rare cold (non-prefetched) navigation. These variants mirror
   the real column width, vertical rhythm, and section order of
   blog/page.tsx and blog/[slug]/page.tsx so the swap is seamless.

   The index paints an eyebrow + hero + a stack of post cards; the post
   paints a back link + article header + prose lines + footer row. */

export default function BlogSkeleton({
  variant,
}: {
  variant: "index" | "post";
}) {
  if (variant === "post") {
    return (
      <main className="bg-bg">
        {/* Mirrors blog/[slug]/page.tsx: max-w-2xl article column. */}
        <article className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {/* Back link */}
          <div className="skeleton h-4 w-40 rounded mb-8" />

          {/* Header — h1 (2 lines) + lede + read-time meta over a rule */}
          <header className="mb-8 sm:mb-10">
            <div className="skeleton h-8 sm:h-10 w-full rounded-lg mb-2.5" />
            <div className="skeleton h-8 sm:h-10 w-2/3 rounded-lg mb-4" />
            <div className="skeleton h-4 w-full max-w-lg rounded mb-1.5" />
            <div className="skeleton h-4 w-4/5 max-w-md rounded mb-5" />
            <div className="flex items-center gap-4 pb-6 border-b border-border">
              <div className="skeleton h-3.5 w-24 rounded" />
            </div>
          </header>

          {/* Prose body — paragraph groups with a subhead between them,
              varied line widths so it reads as real copy, not bars. */}
          <div className="space-y-3">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-11/12 rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
          </div>
          <div className="skeleton h-6 sm:h-7 w-1/2 rounded-lg mt-10 mb-4" />
          <div className="space-y-3">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
          <div className="skeleton h-6 sm:h-7 w-2/5 rounded-lg mt-10 mb-4" />
          <div className="space-y-3">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-11/12 rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
          </div>

          {/* Footer — "more posts" link + CTA pill over a rule */}
          <div className="mt-14 pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-10 w-40 rounded-full" />
          </div>
        </article>
      </main>
    );
  }

  /* index variant */
  return (
    <main className="bg-bg">
      {/* Mirrors blog/page.tsx: max-w-3xl list column. */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        {/* Hero — eyebrow (flag + country · Blog) + h1 (2 lines) + lede */}
        <header className="mb-10 sm:mb-14">
          <div className="skeleton h-3.5 w-32 rounded mb-3" />
          <div className="skeleton h-9 sm:h-12 w-3/4 max-w-md rounded-lg mb-2.5" />
          <div className="skeleton h-9 sm:h-12 w-1/2 max-w-xs rounded-lg mb-4" />
          <div className="skeleton h-4 w-full max-w-xl rounded mb-1.5" />
          <div className="skeleton h-4 w-2/3 max-w-md rounded" />
        </header>

        {/* Post cards — rounded-2xl bordered tiles with chip row, title,
            two-line excerpt, and a read-time meta line. */}
        <div className="space-y-6 sm:space-y-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-5 sm:p-6 rounded-2xl border border-border bg-surface"
            >
              <div className="skeleton h-5 w-16 rounded-full mb-3" />
              <div className="skeleton h-6 sm:h-7 w-3/4 rounded-lg mb-2.5" />
              <div className="skeleton h-4 w-full rounded mb-1.5" />
              <div className="skeleton h-4 w-5/6 rounded mb-4" />
              <div className="skeleton h-3.5 w-24 rounded" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
