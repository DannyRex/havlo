import Link from "next/link";
import { ArrowRight, Search, Tag } from "lucide-react";
import { categories } from "@/lib/data/categories";

/* Brand-hub not-found boundary — renders when
   /[country]/brand/[brand]/page.tsx calls notFound() for a brand slug
   that doesn't resolve to a tracked brand in the visitor's market (or
   resolves but has no country-shoppable inventory). Gives the brand hub
   the same branded, product-context dead-end the PDP got instead of
   bubbling to the generic site-wide 404.

   ── Why this is an HTTP 200 and not a 404 (intentional, documented) ──
   On this stack (Next 14.2.5 on Vercel) a notFound() raised inside a
   MATCHED dynamic-param route is served as a SOFT-404: HTTP 200 with the
   not-found UI, NOT a 404. The category hub (/[country]/deals/[category])
   escapes this with `dynamicParams = false` + generateStaticParams over a
   FINITE, build-time-known set, so an unknown slug fails to MATCH and
   falls through to the static /_not-found (a genuine 404 at the routing
   layer). The blog post route does the same — its posts are a static
   array.

   That trick can't apply to brands: the valid-brand set is DATA-DERIVED
   from the live catalogue (getCountryBrands) and churns every ingest, and
   sub-threshold brands are DELIBERATELY served (just noindex) so an
   inbound link never 404s — see the route header in page.tsx.
   listIndexableBrands is only the top-N indexable SUBSET, so pinning
   generateStaticParams to it under dynamicParams=false would wrongly 404
   every valid-but-thin brand hub. So the only honest paths are a soft-404
   or this boundary; we take this and lean on the two things that DO work:
   the page's generateMetadata returns `robots: { index:false, follow:false }`
   for an unknown brand, so crawlers never index these URLs (the indexing
   half of the concern), and this boundary makes the unavoidable 200 a
   clear, branded dead-end rather than something that reads as half-rendered.

   ── Links + hydration ──
   Links are country-AGNOSTIC (bare /deals, /brands, /deals/<cat>);
   middleware redirects them to the visitor's /{country}/ prefix on click
   — same pattern as the PDP and root not-found, and it avoids a headers()
   read here. No force-dynamic is needed: an unknown brand isn't in
   generateStaticParams, so this boundary only ever renders inside the
   brand route's on-demand (dynamic) request, where usePathname() is the
   real path on both server and client — no hydration tear (mirrors
   p/[id]/not-found.tsx). */

/* Same high-intent slice the PDP / root not-found uses, so a stuck
   visitor (and a crawler) gets an obvious way back into the catalogue. */
const POPULAR = ["phones", "electronics", "gaming", "fashion", "audio", "computing"] as const;

export default function BrandNotFound() {
  const popular = POPULAR
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
      {/* Calm status pill — amber dot signals "gone" without shouting. */}
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-ink-3 text-xs font-semibold uppercase tracking-[0.12em]">
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "#D97706" }}
        />
        Brand not available
      </span>

      <h1 className="mt-5 text-3xl sm:text-5xl font-bold text-ink tracking-[-0.03em] leading-[1.05]">
        This brand page isn&apos;t available
      </h1>

      <p className="mt-4 text-ink-2 text-[15px] sm:text-lg leading-relaxed max-w-md mx-auto">
        We may not track this brand in your country yet, or it has nothing
        shoppable right now. Prices move fast — here are live deals and
        brands to explore instead.
      </p>

      {/* Primary actions — full-width stacked on mobile, inline from sm up. */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/deals" className="btn-primary w-full sm:w-auto">
          <Search size={16} />
          Browse deals
        </Link>
        <Link href="/brands" className="btn-secondary w-full sm:w-auto">
          <Tag size={16} />
          All brands
        </Link>
      </div>

      {/* Popular categories — real internal links so a crawler that lands
          on a dead brand hub still finds its way deeper into the catalogue. */}
      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3 mb-4">
          Popular categories
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {popular.map((c) => (
            <Link
              key={c.slug}
              href={`/deals/${c.slug}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
            >
              {c.name}
              <ArrowRight size={14} className="opacity-60" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
