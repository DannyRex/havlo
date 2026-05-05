/* /blog — index page listing all posts in date-desc order.

   Built for SEO content engine: each post targets a specific
   commercial-intent search query (e.g. "best iPhone 15 deals
   Nigeria"). Long-tail traffic from Google compounds over time
   without ongoing ad spend, complementing the affiliate revenue
   from /compare and /deals. */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Calendar, Clock } from "lucide-react";
import { getPostsByDate } from "@/lib/blog/posts";

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
  const posts = getPostsByDate();

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
