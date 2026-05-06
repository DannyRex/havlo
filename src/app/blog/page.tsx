/* /blog — index page listing posts relevant to the user's country.

   Why country-filtered: the catalog covers seven markets but each
   post targets a specific market's retailers. Showing UK retailer
   guides to a Nigerian visitor is noise. Filter at render time
   based on the cookie country (set by CountryProvider / middleware).
   Fallback to ALL posts when the filter produces zero hits so the
   page never renders empty for countries we haven't written for yet.

   SEO: each /blog/{slug} URL is globally accessible. The filter is
   a UX layer on the index only — Google still finds every post via
   sitemap entries and individual URL crawling. No duplicate-content
   risk because /blog has a single canonical regardless of which
   posts get rendered.

   Built for SEO content engine: each post targets a specific
   commercial-intent search query (e.g. "best iPhone 15 deals
   Nigeria"). Long-tail traffic from Google compounds over time
   without ongoing ad spend, complementing the affiliate revenue
   from /compare and /deals. */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Calendar, Clock } from "lucide-react";
import { getPostsForCountry } from "@/lib/blog/posts";
import { getServerCountry } from "@/lib/country-server";
import { COUNTRIES } from "@/lib/country";

/* Country code → flag emoji map for the post-card chip. Pulled from
   the existing COUNTRIES roster so the same flags shown in the
   country switcher render here too. "all" gets a globe. */
const FLAG_FOR: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.flag]),
);
function flagFor(code: string): string {
  if (code === "all") return "🌍";
  return FLAG_FOR[code] ?? "🌐";
}

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Buyer's guides, price-comparison breakdowns, and shopping insights from Havlo. Where to actually find the best deals across leading retailers.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Havlo Blog",
    description: "Buyer's guides and price-comparison breakdowns from Havlo.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogIndexPage() {
  const country = getServerCountry();
  const posts   = getPostsForCountry(country.code);

  return (
    <main className="bg-bg">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        <header className="mb-10 sm:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3">
            Blog
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-ink tracking-[-0.025em] leading-[1.05] mb-4">
            Buyer&apos;s guides &amp; deal breakdowns.
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed max-w-xl">
            Where the actual best prices live across leading retailers, plus
            the tradeoffs that matter when you&apos;re deciding what to buy.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="text-center text-ink-3 py-12">
            <p>No posts yet. Check back soon.</p>
          </div>
        ) : (
          <ul className="space-y-6 sm:space-y-8">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block p-5 sm:p-6 rounded-2xl border border-border hover:border-border-strong bg-surface hover:bg-surface-2 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Country flag chips — shows which market(s) this
                          post targets. Helps the user understand why
                          they're seeing a UK guide on their NG view
                          (cross-cutting topic, or fallback when no
                          local content exists yet). */}
                      {post.countries && post.countries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {post.countries.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 border border-border text-[10px] uppercase tracking-[0.06em] text-ink-3"
                            >
                              <span aria-hidden="true">{flagFor(c)}</span>
                              <span>{c === "all" ? "Global" : c.toUpperCase()}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight mb-2 group-hover:text-ink">
                        {post.title}
                      </h2>
                      <p className="text-sm sm:text-[15px] text-ink-2 leading-relaxed mb-4 line-clamp-2">
                        {post.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-ink-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={12} />
                          <time dateTime={post.publishedAt}>
                            {new Date(post.publishedAt).toLocaleDateString(undefined, {
                              year:  "numeric",
                              month: "short",
                              day:   "numeric",
                            })}
                          </time>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={12} />
                          {post.readMinutes} min read
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight
                      size={18}
                      className="text-ink-3 shrink-0 mt-1 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
