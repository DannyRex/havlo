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

  /* Global routes — country-independent, no hreflang variants. About
     gets a higher priority (0.6) than legal pages because partnership
     prospects + branded queries ("havlo about", "havlo founder") land
     here, and we want it indexed quickly. */
  const globalRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/about`,           priority: 0.6, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/blog`,            priority: 0.7, changeFrequency: "weekly",  lastModified: now },
    { url: `${SITE_URL}/contact`,         priority: 0.4, changeFrequency: "yearly",  lastModified: now },
    { url: `${SITE_URL}/privacy-policy`,  priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/terms-of-use`,    priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/disclaimer`,      priority: 0.3, changeFrequency: "monthly", lastModified: now },
  ];

  /* Blog post URLs — high priority since they target commercial-intent
     queries and we want Google to crawl/rank them quickly. lastModified
     uses the post's own publishedAt rather than `now` so unchanged
     posts don't get treated as updated each time the sitemap rebuilds. */
  const blogPostRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url:             `${SITE_URL}/blog/${post.slug}`,
    priority:        0.7,
    changeFrequency: "monthly",
    lastModified:    new Date(post.publishedAt),
  }));

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
    ...blogPostRoutes,
    ...categoryRoutes,
  ];
}
