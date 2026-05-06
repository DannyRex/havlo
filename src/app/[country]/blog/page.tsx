/* /[country]/blog — per-country blog index.

   Each country gets its own canonical /[country]/blog URL. A NG
   user lands on /ng/blog seeing NG-targeted posts; a UK user lands
   on /uk/blog seeing UK-targeted posts; etc. SEO-clean: each
   country's index is a unique URL Google can rank independently
   for country-specific queries.

   Why per-country routes (vs the global /blog with cookie filter):
     - /uk/blog can rank for "UK shopping deals" without competing
       with /ng/blog which targets different keywords
     - International search results show the right country variant
     - Existing /[country]/ pattern (deals + compare already work
       this way) — blog now matches that architecture

   /blog still exists but redirects to /{cookie-country}/blog so
   legacy links and bare /blog visits land on the user's country
   index. The previous /blog/[slug] direct URLs continue to work
   via redirect to /[country]/blog/[slug] (no SEO breakage). */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Calendar, Clock } from "lucide-react";
import { getPostsForCountry } from "@/lib/blog/posts";
import { COUNTRIES, getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";

const FLAG_FOR: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.flag]),
);
function flagFor(code: string): string {
  if (code === "all") return "🌍";
  return FLAG_FOR[code] ?? "🌐";
}

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/blog`;
  const title = `Blog · Havlo ${country.name}`;
  const description = `Buyer's guides and price-comparison breakdowns for shoppers in ${country.name}. Where the actual best prices live across leading retailers.`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("blog"),
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Havlo",
      type: "website",
    },
  };
}

export default function CountryBlogIndex({
  params,
}: {
  params: { country: string };
}) {
  const country = getCountry(params.country);
  if (!COUNTRIES.some((c) => c.code === country.code)) notFound();

  const posts = getPostsForCountry(country.code);

  return (
    <main className="bg-bg">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        <header className="mb-10 sm:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3 inline-flex items-center gap-1.5">
            <span aria-hidden="true">{country.flag}</span>
            <span>{country.name} · Blog</span>
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-ink tracking-[-0.025em] leading-[1.05] mb-4">
            Buyer&apos;s guides for {country.name}.
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed max-w-xl">
            Where the actual best prices live across leading retailers in {country.name},
            plus the tradeoffs that matter when you&apos;re deciding what to buy.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="text-center text-ink-3 py-12">
            <p>No posts yet for {country.name}. Check back soon.</p>
          </div>
        ) : (
          <ul className="space-y-6 sm:space-y-8">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/${country.code}/blog/${post.slug}`}
                  className="group block p-5 sm:p-6 rounded-2xl border border-border hover:border-border-strong bg-surface hover:bg-surface-2 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
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
                      <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight mb-2">
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
