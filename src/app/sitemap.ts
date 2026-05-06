import type { MetadataRoute } from "next";
import { categories } from "@/lib/data/categories";
import { COUNTRIES } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";
import { posts } from "@/lib/blog/posts";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  /* Country-scoped routes — emit one entry per country, each with
     hreflang alternates pointing at sibling country versions. Lets
     Google route the right variant to the right audience instead of
     surfacing /us/deals to a Nigerian searcher. */
  const homepages: MetadataRoute.Sitemap = COUNTRIES.map((c) => ({
    url:            `${SITE_URL}/${c.code}`,
    priority:       1.0,
    changeFrequency: "daily",
    lastModified:   now,
    alternates:     { languages: buildHreflangAlternates("") },
  }));

  const dealsPages: MetadataRoute.Sitemap = COUNTRIES.map((c) => ({
    url:            `${SITE_URL}/${c.code}/deals`,
    priority:       0.9,
    changeFrequency: "hourly",
    lastModified:   now,
    alternates:     { languages: buildHreflangAlternates("deals") },
  }));

  const comparePages: MetadataRoute.Sitemap = COUNTRIES.map((c) => ({
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
    { url: `${SITE_URL}/disclaimer`,      priority: 0.3, changeFrequency: "monthly", lastModified: now },
  ];

  /* Per-country blog index. Each country's /[country]/blog gets its
     own sitemap entry with hreflang alternates pointing at sibling
     country variants. */
  const blogIndexRoutes: MetadataRoute.Sitemap = COUNTRIES.map((c) => ({
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
      ? COUNTRIES.map((c) => c.code)
      : post.countries.includes("all")
        ? COUNTRIES.map((c) => c.code)
        : post.countries;
    return targets.map((c) => ({
      url:             `${SITE_URL}/${c}/blog/${post.slug}`,
      priority:        0.7,
      changeFrequency: "monthly" as const,
      lastModified:    new Date(post.publishedAt),
    }));
  });

  /* Category routes — country-scoped + hreflang. Each category surfaces
     the same product taxonomy across all 6 countries. */
  const categoryRoutes: MetadataRoute.Sitemap = COUNTRIES.flatMap((c) =>
    categories
      .filter((cat) => cat.slug !== "all")
      .map((cat) => ({
        url:            `${SITE_URL}/${c.code}/deals?category=${cat.slug}`,
        priority:       0.6,
        changeFrequency: "daily" as const,
        lastModified:   now,
        alternates: {
          languages: Object.fromEntries(
            Object.entries(buildHreflangAlternates("deals")).map(
              ([lang, url]) => [lang, `${url}?category=${cat.slug}`],
            ),
          ),
        },
      })),
  );

  return [
    ...homepages,
    ...dealsPages,
    ...comparePages,
    ...globalRoutes,
    ...blogIndexRoutes,
    ...blogPostRoutes,
    ...categoryRoutes,
  ];
}
