/* /blog/[slug] — individual blog post page.

   Static-rendered via generateStaticParams so each post is a
   pre-built HTML page at deploy time (zero per-request cost,
   maximally cacheable). Open Graph metadata pulled from the post
   registry so each post has unique social previews.

   Body styling: uses the .prose container class with explicit
   typography overrides keyed to the site's ink/ink-2 tokens so
   the blog reads natively to the rest of the site instead of
   looking like a third-party blog wedged in. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { getPostBySlug, getAllSlugs } from "@/lib/blog/posts";

const SITE_URL = "https://havlo.io";

interface Params {
  slug: string;
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Not found" };

  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title:       post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type:           "article",
      title:          `${post.title} · Havlo`,
      description:    post.description,
      url,
      siteName:       "Havlo",
      publishedTime:  post.publishedAt,
      tags:           post.tags,
    },
    twitter: {
      card:        "summary_large_image",
      title:       post.title,
      description: post.description,
    },
  };
}

export default function BlogPostPage({ params }: { params: Params }) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  return (
    <main className="bg-bg">
      <article className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-8 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to blog
        </Link>

        <header className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-[40px] font-bold text-ink tracking-[-0.025em] leading-[1.1] mb-4">
            {post.title}
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed mb-5">
            {post.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-ink-3 pb-6 border-b border-border">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} />
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                  year:  "numeric",
                  month: "long",
                  day:   "numeric",
                })}
              </time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} />
              {post.readMinutes} min read
            </span>
          </div>
        </header>

        {/* Body — prose styled. Selectors target the elements blog
            posts produce (h2, p, ul, li, strong) so the site's design
            tokens bleed through cleanly. */}
        <div
          className="
            text-ink-2 text-[15px] sm:text-base leading-[1.7]
            [&>p]:mb-5
            [&>h2]:mt-10 [&>h2]:mb-3 [&>h2]:text-xl sm:[&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-ink [&>h2]:tracking-[-0.02em] [&>h2]:leading-tight
            [&>ul]:mb-5 [&>ul]:pl-5 [&>ul]:space-y-2.5
            [&>ul>li]:list-disc [&>ul>li]:marker:text-ink-3
            [&_strong]:text-ink [&_strong]:font-semibold
            [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-ink/40 hover:[&_a]:decoration-ink
          "
        >
          {post.body}
        </div>

        {/* Footer — back to blog + nudge to use Havlo */}
        <footer className="mt-14 pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            More posts
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Find for less now
          </Link>
        </footer>
      </article>
    </main>
  );
}
