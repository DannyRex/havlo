import type { MetadataRoute } from "next";
import { categories } from "@/lib/data/categories";
import { COUNTRIES } from "@/lib/country";

const SITE = "https://havlo.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  /* Country-scoped routes — emit once per supported country. */
  const countryRoutes: MetadataRoute.Sitemap = COUNTRIES.flatMap((c) => [
    { url: `${SITE}/${c.code}`,         priority: 1.0, changeFrequency: "daily",  lastModified: now },
    { url: `${SITE}/${c.code}/deals`,   priority: 0.9, changeFrequency: "hourly", lastModified: now },
    { url: `${SITE}/${c.code}/compare`, priority: 0.9, changeFrequency: "weekly", lastModified: now },
  ]);

  /* Global routes — country-independent. */
  const globalRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/contact`,         priority: 0.4, changeFrequency: "yearly",  lastModified: now },
    { url: `${SITE}/privacy-policy`,  priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE}/terms-of-use`,    priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE}/disclaimer`,      priority: 0.3, changeFrequency: "monthly", lastModified: now },
  ];

  /* Category routes — country-scoped, since /deals data is country-filtered. */
  const categoryRoutes: MetadataRoute.Sitemap = COUNTRIES.flatMap((c) =>
    categories
      .filter((cat) => cat.slug !== "all")
      .map((cat) => ({
        url: `${SITE}/${c.code}/deals?category=${cat.slug}`,
        priority: 0.6,
        changeFrequency: "daily" as const,
        lastModified: now,
      })),
  );

  return [...countryRoutes, ...globalRoutes, ...categoryRoutes];
}
