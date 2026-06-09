import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, Home } from "lucide-react";
import { categories } from "@/lib/data/categories";

/* Global 404 boundary.

   Catches every notFound() raised across the app — there are no
   nested not-found.tsx files, so category / brand / product
   not-found calls all bubble up here — plus any URL that matches no
   route at all. Renders INSIDE the root layout, so Navbar + Footer
   chrome is already present; this component owns only the in-page
   content.

   Before this existed, notFound() fell through to Next's built-in
   default ("404 | This page could not be found"), an unstyled
   framework page that read as broken / unfinished. This replaces it
   with a branded, on-message dead-end that routes the visitor back
   into the catalogue.

   Links are deliberately country-AGNOSTIC (bare /, /deals,
   /deals/<cat>). Reading the visitor's country here would require
   headers(), which forces every 404 to render dynamically for no
   benefit. Middleware rewrites these bare paths to the visitor's
   /{country}/ prefix on click, so they resolve correctly while the
   page itself stays static and cheap. */

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/* A short, high-intent slice of the category set — enough to give a
   stuck visitor (and a crawler) an obvious way back in without
   dumping the whole nav. */
const POPULAR = ["phones", "electronics", "gaming", "fashion", "audio", "computing"] as const;

export default function NotFound() {
  const popular = POPULAR
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
      {/* Eyebrow — small, calm status pill rather than a giant "404"
          that would shout louder than the actual message. */}
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-ink-3 text-xs font-semibold uppercase tracking-[0.12em]">
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "#16A34A" }}
        />
        404 error
      </span>

      <h1 className="mt-5 text-3xl sm:text-5xl font-bold text-ink tracking-[-0.03em] leading-[1.05]">
        We couldn&apos;t find that page
      </h1>

      <p className="mt-4 text-ink-2 text-[15px] sm:text-lg leading-relaxed max-w-md mx-auto">
        The page may have moved, the deal may have sold out, or the link
        might be off. Let&apos;s get you back to finding things for less.
      </p>

      {/* Primary actions — full-width stacked on mobile for tap targets,
          inline from sm up. */}
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

      {/* Popular categories — real internal links so a crawler that
          hits a 404 still finds its way deeper into the catalogue. */}
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
