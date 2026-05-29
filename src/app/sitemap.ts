import type { MetadataRoute } from "next";
import { ACTIVE_COUNTRIES } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";
import { posts } from "@/lib/blog/posts";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

/* Pull the canonical (cheapest in-stock) offer_id per product so
   each product PDP gets ONE sitemap entry. We don't multiply by
   country — emitting all 14k products × 6 countries (~84k URLs)
   would overflow Google's 50K-per-file limit and serialise the
   wrong message (six "variants" of the same product page) when
   the actual difference is just price display. Per-country routing
   is handled by hreflang alternates on the single NG-primary URL.

   Filter is intentional: only PRODUCTS WITH INVENTORY get crawl
   priority. Out-of-stock pages are already noindex via robots
   metadata; emitting them as sitemap entries would tell Google to
   spend budget on URLs we don't want indexed. */
async function fetchProductSitemapRows(): Promise<Array<{ offerId: string; updatedAt: string }>> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];
  /* Top-N cap because Google's per-file limit is 50,000 entries
     and we have ~14,800 products today — well under. The cap
     guards against future growth: bumping past 45k would require
     splitting into multiple files via a sitemap index. When that
     becomes urgent, switch to Next.js's generateSitemaps() pattern
     so each sub-sitemap stays under the limit. */
  const { data, error } = await supa
    .from("product_best_offers")
    .select("offer_id, scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(45_000);
  if (error || !data) return [];
  return (data as Array<{ offer_id: string; scraped_at: string }>).map((r) => ({
    offerId:   r.offer_id,
    updatedAt: r.scraped_at,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    /* /for-merchants — public partnership landing page (F4 build).
       Country-independent; one canonical URL for all retailer
       prospects. Higher priority than legal pages because
       partner acquisition is a real funnel surface, not a
       compliance checkbox. */
    { url: `${SITE_URL}/for-merchants`, priority: 0.5, changeFrequency: "monthly", lastModified: now },
    /* /scan — barcode scanner entry point (F5 build). Country-
       independent (the client island reads country from
       middleware at request time for the redirect URL). Low
       priority because it's a utility surface, not a primary
       SEO target — most arrivals will be direct or PWA shortcut. */
    { url: `${SITE_URL}/scan`,          priority: 0.4, changeFrequency: "monthly", lastModified: now },
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

  /* Product PDPs — May 29 2026 SEO pass. Pulls top in-stock products
     by recency and emits one canonical NG-prefixed URL per product,
     with hreflang alternates pointing at the same product under
     /uk, /us, /in, /ae, /za. Single URL × 6 hreflang variants is
     the recommended pattern for multi-region single-language sites
     (vs emitting 14k × 6 entries which Google reads as duplicate). */
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const rows = await fetchProductSitemapRows();
    productRoutes = rows.map((r) => ({
      url:             `${SITE_URL}/ng/p/${r.offerId}`,
      priority:        0.6,
      changeFrequency: "weekly" as const,
      lastModified:    new Date(r.updatedAt),
      alternates:      { languages: buildHreflangAlternates(`p/${r.offerId}`) },
    }));
  } catch (err) {
    /* Sitemap is build-time critical — if Supabase is unreachable
       we'd rather emit a partial sitemap than fail the build. The
       missing product entries will reappear on the next successful
       build. */
    console.error("[sitemap] failed to fetch product rows:", (err as Error).message);
  }

  return [
    ...homepages,
    ...dealsPages,
    ...comparePages,
    ...globalRoutes,
    ...blogIndexRoutes,
    ...blogPostRoutes,
    ...productRoutes,
  ];
}
