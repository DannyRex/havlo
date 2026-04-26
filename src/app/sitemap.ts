import type { MetadataRoute } from "next";
import { categories } from "@/lib/data/categories";

const SITE = "https://havlo.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`,                priority: 1.0, changeFrequency: "daily",   lastModified: now },
    { url: `${SITE}/deals`,           priority: 0.9, changeFrequency: "hourly",  lastModified: now },
    { url: `${SITE}/compare`,         priority: 0.9, changeFrequency: "weekly",  lastModified: now },
    { url: `${SITE}/privacy-policy`,  priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE}/terms-of-use`,    priority: 0.3, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE}/disclaimer`,      priority: 0.3, changeFrequency: "monthly", lastModified: now },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug !== "all")
    .map((c) => ({
      url: `${SITE}/deals?category=${c.slug}`,
      priority: 0.7,
      changeFrequency: "daily" as const,
      lastModified: now,
    }));

  return [...staticRoutes, ...categoryRoutes];
}
