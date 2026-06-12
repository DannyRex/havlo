import Link from "next/link";
import { ArrowRight, Search, Home } from "lucide-react";
import { categories } from "@/lib/data/categories";

/* PDP not-found boundary — renders when /[country]/p/[id]/page.tsx calls
   notFound() for an offer that no longer exists (sold out, delisted,
   retired by the ingest, or a stale shared/indexed link). Replaces the
   generic site-wide 404 copy ("We couldn't find that page") with an
   on-message, product-context dead-end that points the visitor back into
   live inventory.

   ── Why this is an HTTP 200 and not a 404 (intentional, documented) ──
   On this stack (Next 14.2.5 on Vercel) a notFound() raised inside a
   MATCHED dynamic-param route is served as a SOFT-404: HTTP 200 with the
   not-found UI, NOT a 404. Verified on prod across every such route
   (/[country]/p/[id], /[country]/brand/[brand], /[country]/blog/[slug])
   and documented by the team in /[country]/deals/[category]/page.tsx,
   which only gets a real 404 because category slugs are a finite,
   build-time-known set: `dynamicParams = false` + generateStaticParams
   makes an unknown slug fail to MATCH and fall through to the static
   /_not-found (a genuine 404 at the routing layer).

   Offer ids are NOT enumerable at build (they churn every ingest), so the
   dynamicParams=false trick can't apply here, and the only path to a true
   404 is a per-request existence check in middleware (a DB round-trip on
   the hottest route) — deliberately not taken. Instead we lean on the two
   things that DO work: the page's generateMetadata returns
   `robots: { index:false, follow:false }` for a missing offer, so crawlers
   never index these URLs (the indexing half of the concern), and this
   boundary makes the unavoidable 200 a clear, branded "no longer
   available" page rather than something that reads as half-rendered.

   ── Links + hydration ──
   Links are country-AGNOSTIC (bare /, /deals, /deals/<cat>); middleware
   rewrites them to the visitor's /{country}/ prefix on click — same
   pattern as the root not-found, and it avoids a headers() read here.

   No `export const dynamic = "force-dynamic"` is needed (unlike the root
   /_not-found, which is statically prerendered and added it to stop a
   Navbar usePathname() hydration tear, #418/#425/#423): this boundary only
   renders inside the PDP route's request, which already renders
   dynamically, so usePathname() is the real path on both server and
   client. If the PDP route is ever made static, revisit this. */

/* Same high-intent slice the root not-found uses, so a stuck visitor (and
   a crawler) gets an obvious way back into the catalogue. */
const POPULAR = ["phones", "electronics", "gaming", "fashion", "audio", "computing"] as const;

export default function ProductNotFound() {
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
        No longer available
      </span>

      <h1 className="mt-5 text-3xl sm:text-5xl font-bold text-ink tracking-[-0.03em] leading-[1.05]">
        This product is no longer available
      </h1>

      <p className="mt-4 text-ink-2 text-[15px] sm:text-lg leading-relaxed max-w-md mx-auto">
        It may have sold out, expired, or been removed by the store. Prices
        move fast, so here are live deals to explore instead.
      </p>

      {/* Primary actions — full-width stacked on mobile, inline from sm up. */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/deals" className="btn-primary w-full sm:w-auto">
          <Search size={16} />
          Browse deals
        </Link>
        <Link href="/" className="btn-secondary w-full sm:w-auto">
          <Home size={16} />
          Go home
        </Link>
      </div>

      {/* Popular categories — real internal links so a crawler that lands
          on a dead PDP still finds its way deeper into the catalogue. */}
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
