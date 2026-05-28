import type { MetadataRoute } from "next";
import { ACTIVE_COUNTRIES } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";
import { posts } from "@/lib/blog/posts";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  /* Stable date for the brand homepages — bump only when the
     homepage's actual structure / framing changes meaningfully.
     Setting `lastModified: now` previously made Google treat
     /[country] as freshly-modified content (the build runs daily)
     and it started prefixing the SERP snippet with a date stamp
     ("9 May 2026 — ..."), which reads like a blog post / news
     result, not a brand site. Static brand pages don't get the
     date treatment. /[country]/deals stays on `now` because deal
     listings really do refresh daily — the freshness signal is
     honest there. */
  const HOMEPAGE_LAST_MODIFIED = new Date("2026-05-01");

  /* Country-scoped routes — emit one entry per country, each with
     hreflang alternates pointing at sibling country versions. Lets
     Google route the right variant to the right audience instead of
     surfacing /us/deals to a Nigerian searcher. */
  const homepages: MetadataRoute.Sitemap = ACTIVE_COUNTRIES.map((c) => ({
    url:            `${SITE_URL}/${c.code}`,
    priority:       1.0,
    changeFrequency: "weekly",
    lastModified:   HOMEPAGE_LAST_MODIFIED,
    alternates:     { languages: buildHreflangAlternates("") },
  }));

  const dealsPages: MetadataRoute.Sitemap = ACTIVE_COUNTRIES.map((c) => ({
    url:            `${SITE_URL}/${c.code}/deals`,
    priority:       0.9,
    changeFrequency: "hourly",
    lastModified:   now,
    alternates:     { languages: buildHreflangAlternates("deals") },
  }));

  const comparePages: MetadataRoute.Sitemap = ACTIVE_COUNTRIES.map((c) => ({
    url:            `${SITE_URL}/${c.code}/compare`,
    priority:       0.9,
    changeFrequency: "weekly",
    lastModified:   now,
    alternates:     { languages: buildHreflangAlternates("compare") },
  }));

  /* Global routes — country-independent, no hreflang variants.
     /blog dropped from here: it now redirects to /[country]/blog,
     which is the canonical surface emitted below. */
  const globalRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/about`,           priority: 0.6, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/contact`,         priority: 0.4, changeFrequency: "yearly",  lastModified: now },
    { url: `${SITE_URL}/privacy-policy`,  priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/terms-of-use`,    priority: 0.3, changeFrequency: "monthly", lastModified: now },
    /* /how-we-make-money replaces the old /disclaimer URL (308
       permanent redirect lives in next.config.mjs). Slightly higher
       priority than other legal pages because affiliate transparency
       is a real surface shoppers click into, not just a
       compliance checkbox. */
    { url: `${SITE_URL}/how-we-make-money`, priority: 0.4, changeFrequency: "monthly", lastModified: now },
  ];

  /* Per-country blog index. Each country's /[country]/blog gets its
     own sitemap entry with hreflang alternates pointing at sibling
     country variants. */
  const blogIndexRoutes: MetadataRoute.Sitemap = ACTIVE_COUNTRIES.map((c) => ({
    url:             `${SITE_URL}/${c.code}/blog`,
    priority:        0.7,
    changeFrequency: "weekly",
    lastModified:    now,
    alternates:      { languages: buildHreflangAlternates("blog") },
  }));

  /* Per-country blog posts. Emit (country × post) pairs only for
     valid combinations: a post tagged ['ng'] only appears under
     /ng/blog/[slug], a post tagged ['all'] under every country.
     Canonical URL is set on the post page itself (always primary
     country) so Google ranks the right variant. lastModified uses
     post's publishedAt so unchanged posts don't churn. */
  const blogPostRoutes: MetadataRoute.Sitemap = posts.flatMap((post) => {
    const targets = !post.countries || post.countries.length === 0
      ? ACTIVE_COUNTRIES.map((c) => c.code)
      : post.countries.includes("all")
        ? ACTIVE_COUNTRIES.map((c) => c.code)
        : post.countries;
    return targets.map((c) => ({
      url:             `${SITE_URL}/${c}/blog/${post.slug}`,
      priority:        0.7,
      changeFrequency: "monthly" as const,
      lastModified:    new Date(post.publishedAt),
    }));
  });

  /* Category filter URLs are intentionally NOT in the sitemap.
     /[country]/deals canonicalizes ?category=X variants back to the
     base via generateMetadata's `alternates.canonical`, so emitting
     them as separate sitemap entries told Google "70 unique pages"
     while every one of them pointed at the same canonical. Result
     was 70 entries stuck in 'Discovered – currently not indexed'.

     The category filter UI is reachable from /deals on every country,
     so users + bots can still navigate to it; we just don't ask Google
     to spend index budget on near-duplicate query-string variants.
     Same pattern as NerdWallet / Wirecutter / Skyscanner sitemaps. */

  return [
    ...homepages,
    ...dealsPages,
    ...comparePages,
    ...globalRoutes,
    ...blogIndexRoutes,
    ...blogPostRoutes,
  ];
}
