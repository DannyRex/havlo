/* /[country]/blog/[slug] — per-country blog post page.

   Same content as the legacy /blog/[slug] route, but URL-prefixed
   by country. Canonical URL points at the post's PRIMARY country
   (first entry in countries[]) so when the same post is reachable
   via multiple country URLs (cross-cutting "all" posts), Google
   knows which version to rank.

   Static-rendered: generateStaticParams emits (country × slug)
   pairs only for relevant combinations (skip /uk/blog/iphone-nigeria-
   2026 since the post is NG-specific). Avoids 404s from invalid
   combinations and keeps the build clean. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildHreflangAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { getPostBySlug, posts as allPosts } from "@/lib/blog/posts";
import { COUNTRIES, getCountry } from "@/lib/country";

const SITE_URL = "https://havlo.io";

interface Params {
  country: string;
  slug:    string;
}

/* The set of valid blog posts is FINITE and build-time-known: `posts`
   is a static array (src/lib/blog/posts.tsx) and generateStaticParams
   below emits every valid (country × slug) pair. dynamicParams=false
   makes any pair outside that set 404 at the ROUTING layer (a genuine
   HTTP 404 → /_not-found) — the same mechanism the category hub uses
   (/[country]/deals/[category]). Without it, an unknown slug fell
   through to the page body's notFound(), which under a MATCHED
   dynamic-param route on this stack (Next 14.2.5 on Vercel) returned a
   soft-404 (HTTP 200 with the not-found UI) — bad for crawl signals.
   This also subsumes the country-relevance guard below: an off-country
   URL (/uk/blog/<ng-only-post>) isn't in the param set, so it 404s up
   front. The body's `!post` / `isRelevant` notFound() calls remain as
   defensive fallbacks. */
export const dynamicParams = false;

/* Generate (country × slug) pairs for every valid combination. A
   post with countries: ["ng"] only emits /ng/blog/[slug]. A post
   with countries: ["all"] emits a page for every country. A post
   with no countries field gets every country (legacy default). */
export function generateStaticParams() {
  const params: Params[] = [];
  for (const post of allPosts) {
    const targets = !post.countries || post.countries.length === 0
      ? COUNTRIES.map((c) => c.code)
      : post.countries.includes("all")
        ? COUNTRIES.map((c) => c.code)
        : post.countries;
    for (const c of targets) {
      params.push({ country: c, slug: post.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Not found" };

  const country = getCountry(params.country);

  /* Canonical URL = post's primary country (first non-"all" entry).
     For cross-cutting "all" posts, use this country's URL as
     canonical so each country variant gets its own ranking signal
     without competing with siblings. Pragmatic — most users land
     here via the country URL anyway. */
  const primaryCountry =
    post.countries?.find((c) => c !== "all") ?? country.code;
  const canonicalUrl = `${SITE_URL}/${primaryCountry}/blog/${post.slug}`;
  const url = `${SITE_URL}/${country.code}/blog/${post.slug}`;

  return {
    title:       post.title,
    description: post.description,
    alternates: {
      canonical: canonicalUrl,
      /* Hreflang for the post's country variants. Builds language
         alternates pointing at /[country]/blog/[slug] for each country.
         If the post is country-specific (countries: ['ng']), only NG
         gets the alternate and Google knows the post is NG-only.
         Closes the High 12 hreflang gap from the QA audit. */
      languages: buildHreflangAlternates(`blog/${post.slug}`),
    },
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

export default function CountryBlogPostPage({
  params,
}: {
  params: Params;
}) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const country = getCountry(params.country);

  /* Validate that this country/post combination is allowed. If a
     user types /uk/blog/iphone-nigeria-2026 manually, we 404 rather
     than rendering content that doesn't apply to them. Posts tagged
     'all' are valid for every country. */
  const isRelevant =
    !post.countries
    || post.countries.length === 0
    || post.countries.includes(country.code)
    || post.countries.includes("all");
  if (!isRelevant) notFound();

  /* BlogPosting JSON-LD. Canonical points at the post's primary
     country (mirrors generateMetadata) so all country variants credit
     one URL. publishedAt doubles as dateModified — the registry has no
     separate revised date, and claiming a fresher one we can't prove
     would be dishonest. author/publisher resolve to the Organization
     emitted globally in the root layout. Image is the post's own
     1200x630 OG card route. */
  const primaryCountry = post.countries?.find((c) => c !== "all") ?? country.code;
  const canonicalUrl = `${SITE_URL}/${primaryCountry}/blog/${post.slug}`;
  const ogImageUrl = `${canonicalUrl}/opengraph-image`;
  const blogPosting = {
    "@context":         "https://schema.org",
    "@type":            "BlogPosting",
    "@id":              canonicalUrl,
    headline:           post.title,
    description:        post.description,
    datePublished:      post.publishedAt,
    dateModified:       post.publishedAt,
    author:             { "@type": "Organization", name: "Havlo", url: SITE_URL },
    publisher:          { "@id": `${SITE_URL}#organization` },
    mainEntityOfPage:   canonicalUrl,
    url:                canonicalUrl,
    inLanguage:         "en",
    image:              { "@type": "ImageObject", url: ogImageUrl, width: 1200, height: 630 },
    ...(post.tags && post.tags.length > 0 ? { keywords: post.tags.join(", ") } : {}),
  };

  return (
    <main className="bg-bg">
      <JsonLd data={blogPosting} />
      <article className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        <Link
          href={`/${country.code}/blog`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-8 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to {country.name} blog
        </Link>

        <header className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-[40px] font-bold text-ink tracking-[-0.025em] leading-[1.1] mb-4">
            {post.title}
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed mb-5">
            {post.description}
          </p>
          {/* Publish date intentionally not shown — keeps evergreen
              buyer's guides from reading as dated. post.publishedAt is
              still used for /blog sort order, the sitemap lastmod and
              the OpenGraph article timestamp. */}
          <div className="flex items-center gap-4 text-xs text-ink-3 pb-6 border-b border-border">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} />
              {post.readMinutes} min read
            </span>
          </div>
        </header>

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

        <footer className="mt-14 pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href={`/${country.code}/blog`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            More posts
          </Link>
          <Link
            href={`/${country.code}/compare`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Find for less now
          </Link>
        </footer>
      </article>
    </main>
  );
}
