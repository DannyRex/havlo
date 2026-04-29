import type { MetadataRoute } from "next";
import { categories } from "@/lib/data/categories";
import { COUNTRIES } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";

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

  /* Global routes — country-independent, no hreflang variants. */
  const globalRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/contact`,         priority: 0.4, changeFrequency: "yearly",  lastModified: now },
    { url: `${SITE_URL}/privacy-policy`,  priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/terms-of-use`,    priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/disclaimer`,      priority: 0.3, changeFrequency: "monthly", lastModified: now },
  ];

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

  return [...homepages, ...dealsPages, ...comparePages, ...globalRoutes, ...categoryRoutes];
}
