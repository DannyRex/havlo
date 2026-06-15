import type { MetadataRoute } from "next";
import { ACTIVE_COUNTRIES } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";
import { posts } from "@/lib/blog/posts";
import { categories } from "@/lib/data/categories";
import { listIndexableBrands, listCategoriesWithInventory } from "@/lib/hubs";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

/* Regenerate on a 6h ISR cycle instead of per request. Building ~12k
   product URLs (each with 6 hreflang alternates) on top of ~12
   paginated Supabase round-trips is too heavy to run on every
   Googlebot fetch — the on-request version intermittently surfaced a
   "Temporary processing error" in Search Console (audit C2, May 2026).
   ISR serves a cached file and refreshes it in the background; 6h
   matches the PDP revalidate cadence so newly-ingested products enter
   the sitemap inside a crawl-relevant window. */
export const revalidate = 21600;

/* Per-file ceiling. The sitemap protocol caps a single file at 50,000
   URLs; stay well below. Once the catalog approaches this, split into a
   sitemap index via Next's generateSitemaps(). */
const MAX_SITEMAP_URLS = 45_000;
/* PostgREST returns at most 1,000 rows per response regardless of a
   larger .limit(), so paginate in 1,000-row pages. */
const SITEMAP_PAGE = 1_000;

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
async function fetchProductSitemapRows(): Promise<Array<{ productId: string; updatedAt: string }>> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];
  /* Paginate with .range(). The previous .limit(45_000) was silently
     truncated to PostgREST's 1,000-row response cap, so the live
     sitemap carried only the 1,000 most-recently-scraped products —
     ~91% of the ~12k catalog was missing (GSC audit C1, May 2026).
     Walk 1,000-row pages until the catalog is exhausted or we reach
     MAX_SITEMAP_URLS. Dedupe by product_id: the canonical PDP URL is now
     keyed by the STABLE product_id (not the volatile offer_id), so we emit
     one <url> per product, matching the canonical tag the page renders. */
  const seen = new Set<string>();
  const out: Array<{ productId: string; updatedAt: string }> = [];
  for (let from = 0; from < MAX_SITEMAP_URLS; from += SITEMAP_PAGE) {
    const { data, error } = await supa
      .from("product_best_offers")
      .select("product_id, scraped_at")
      /* Image required (June 2026 GSC audit): imageless UUID PDPs are the
         thinnest pages we emit and feed "Crawled - currently not indexed"
         (503 URLs). Keep them OUT of the sitemap so Google's crawl budget
         goes to pages that can actually rank (image + price + offers);
         they stay reachable through internal links regardless. */
      .not("image_url", "is", null)
      .order("scraped_at", { ascending: false })
      .range(from, from + SITEMAP_PAGE - 1);
    if (error || !data) break;
    const batch = data as Array<{ product_id: string; scraped_at: string }>;
    for (const r of batch) {
      if (!r.product_id || seen.has(r.product_id)) continue;
      seen.add(r.product_id);
      out.push({ productId: r.product_id, updatedAt: r.scraped_at });
    }
    /* Short page = last page. */
    if (batch.length < SITEMAP_PAGE) break;
  }
  return out;
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

  /* Amazon affiliate hub — /[country]/amazon. One per market.
     Daily-ish change frequency: Amazon markdowns move faster than the
     brand hubs but slower than the live /deals feed. */
  const amazonPages: MetadataRoute.Sitemap = ACTIVE_COUNTRIES.map((c) => ({
    url:            `${SITE_URL}/${c.code}/amazon`,
    priority:       0.8,
    changeFrequency: "daily",
    lastModified:   now,
    alternates:     { languages: buildHreflangAlternates("amazon") },
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
      url:             `${SITE_URL}/ng/p/${r.productId}`,
      priority:        0.6,
      changeFrequency: "weekly" as const,
      lastModified:    new Date(r.updatedAt),
      alternates:      { languages: buildHreflangAlternates(`p/${r.productId}`) },
    }));
  } catch (err) {
    /* Sitemap is build-time critical — if Supabase is unreachable
       we'd rather emit a partial sitemap than fail the build. The
       missing product entries will reappear on the next successful
       build. */
    console.error("[sitemap] failed to fetch product rows:", (err as Error).message);
  }

  /* Hub pages — M2 internal-linking de-orphan surfaces (May 2026).
     Three families, each emitted per ACTIVE country:
       • /[cc]/brands        — the brand index (crawl entry point)
       • /[cc]/deals/[slug]   — category hubs
       • /[cc]/brand/[slug]   — brand hubs

     Each hub self-canonicalizes per country (unlike ?category= filter
     URLs, which canonical back to /deals and are deliberately kept OUT
     of the sitemap above). We submit ONLY hubs that will be indexable,
     to keep "Submitted URL marked noindex" out of Search Console:
       - brand index: only when the country has >= 1 indexable brand
         (the page noindexes an empty index).
       - category hubs: only categories with country-shoppable inventory
         (the page noindexes an empty category).
       - brand hubs: only the threshold-cleared, capped indexable set.

     Brand hubs carry NO hreflang alternates: brand presence varies by
     market (a brand indexable in NG may be absent in ZA), so a fixed
     6-country cluster would declare siblings that 404. Category hubs and
     the brand index DO carry hreflang — those structures are consistent
     across every market. */
  const hubRoutes: MetadataRoute.Sitemap = [];
  try {
    for (const c of ACTIVE_COUNTRIES) {
      const [indexableBrands, categoriesWithInventory] = await Promise.all([
        listIndexableBrands(c.code),
        listCategoriesWithInventory(c.code),
      ]);

      /* Brand index — only when there's something to list. */
      if (indexableBrands.length > 0) {
        hubRoutes.push({
          url:             `${SITE_URL}/${c.code}/brands`,
          priority:        0.6,
          changeFrequency: "weekly",
          lastModified:    now,
          alternates:      { languages: buildHreflangAlternates("brands") },
        });
      }

      /* Category hubs — only categories with inventory in this market. */
      for (const cat of categories) {
        if (cat.slug === "all") continue;
        if (!categoriesWithInventory.has(cat.slug)) continue;
        hubRoutes.push({
          url:             `${SITE_URL}/${c.code}/deals/${cat.slug}`,
          priority:        0.7,
          changeFrequency: "daily",
          lastModified:    now,
          alternates:      { languages: buildHreflangAlternates(`deals/${cat.slug}`) },
        });
      }

      /* Brand hubs — threshold-cleared, capped set. No hreflang (see
         the block comment above). */
      for (const b of indexableBrands) {
        hubRoutes.push({
          url:             `${SITE_URL}/${c.code}/brand/${b.slug}`,
          priority:        0.6,
          changeFrequency: "weekly",
          lastModified:    now,
        });
      }
    }
  } catch (err) {
    /* Same posture as productRoutes — a hub-data fetch failure should
       degrade to a partial sitemap, not fail the build. The hubs
       reappear on the next successful regeneration. */
    console.error("[sitemap] failed to build hub routes:", (err as Error).message);
  }

  return [
    ...homepages,
    ...dealsPages,
    ...comparePages,
    ...amazonPages,
    ...globalRoutes,
    ...blogIndexRoutes,
    ...blogPostRoutes,
    ...hubRoutes,
    ...productRoutes,
  ];
}
