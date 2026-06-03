import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import HubProductGrid from "@/components/hub/HubProductGrid";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import { getCountry, ACTIVE_COUNTRIES } from "@/lib/country";
import { categories, getCategory } from "@/lib/data/categories";
import { fetchCategoryHubOffers } from "@/lib/hubs";
import {
  SITE_URL,
  buildHreflangAlternates,
  buildBreadcrumbList,
  buildItemListJsonLd,
} from "@/lib/seo";
import type { SeoDeal } from "@/lib/seo";

/* Category hub — /[country]/deals/[category].

   Purpose (GSC audit M2): a crawlable, indexable page per category per
   market that links DOWN to real PDPs, giving the orphaned product
   corpus inbound internal links. Distinct from the ?category= filter on
   /[country]/deals (which canonicalises to /deals and is NOT in the
   sitemap) — this path self-canonicalises and IS sitemapped.

   ISR: 6h, same cadence as /deals. Heavy work is one product_best_offers
   read, deduped with generateMetadata via React cache(). */
export const revalidate = 21600;

/* Category slugs are a FINITE, build-time-known set (categories.ts ×
   ACTIVE_COUNTRIES — see generateStaticParams below). dynamicParams=false
   makes any slug outside that set 404 at the ROUTING layer with a real
   HTTP 404 — the same mechanism that correctly 404s an unknown /[country].
   Without it, an unknown slug fell through to the page body's
   notFound(), which under this route's dynamic render returned a
   soft-404 (HTTP 200 with the not-found UI) — bad for crawl signals.
   Valid slugs still render normally (dynamically, for the country
   header); only unlisted slugs are rejected up front. */
export const dynamicParams = false;

/* Pre-build every active market × real category (11 cats × 6 markets =
   66 pages). Bounded + cheap; keeps the hubs crawl-ready on first
   deploy rather than waiting for on-demand ISR. Counts every non-"all"
   category, including ones hidden from the homepage grid (health) and
   the June 2026 Appliances re-split — hub routes are independent of the
   homepage `hidden` flag. */
export function generateStaticParams() {
  const cats = categories.filter((c) => c.slug !== "all");
  return ACTIVE_COUNTRIES.flatMap((country) =>
    cats.map((cat) => ({ country: country.code, category: cat.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: { country: string; category: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const cat = getCategory(params.category);
  if (!cat || cat.slug === "all") {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  const url = `${SITE_URL}/${country.code}/deals/${cat.slug}`;
  const title = `${cat.name} deals in ${country.name}`;
  const description = `Compare ${cat.name.toLowerCase()} prices across local and cross-border stores in ${country.name}. Price drops and the cheapest verified option, updated through the day.`;

  /* Deduped fetch (cache()) — also used by the page below. Index only
     when the hub actually has products, so an empty category in a thin
     market doesn't ship a soft-404 into the index. */
  const offers = await fetchCategoryHubOffers(country.code, cat.slug);
  const hasInventory = offers.length > 0;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates(`deals/${cat.slug}`),
    },
    robots: hasInventory ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${title} · Havlo`,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Havlo`,
      description,
    },
  };
}

export default async function CategoryHubPage({
  params,
}: {
  params: { country: string; category: string };
}) {
  const country = getCountry(params.country);
  const cat = getCategory(params.category);
  if (!cat || cat.slug === "all") notFound();

  const offers = await fetchCategoryHubOffers(country.code, cat.slug);

  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
    { name: "Deals",      url: `${SITE_URL}/${country.code}/deals` },
    { name: cat.name,     url: `${SITE_URL}/${country.code}/deals/${cat.slug}` },
  ]);

  /* ItemList over the real PDPs on the page — every offer here is a
     genuine /[country]/p/[id] URL (synthetic ids filtered upstream). */
  const seoDeals: SeoDeal[] = offers.slice(0, 24).map((d) => ({
    title:           d.title,
    url:             `${SITE_URL}/${country.code}/p/${d.id}`,
    imageUrl:        d.imageUrl,
    storeName:       d.storeName,
    salePrice:       d.salePrice,
    originalPrice:   d.originalPrice,
    currency:        d.currency,
    discountPercent: d.discountPercent,
    brand:           null,
  }));
  const itemList =
    seoDeals.length > 0
      ? buildItemListJsonLd(seoDeals, `${cat.name} deals in ${country.name} on Havlo`)
      : null;

  /* Sibling categories for cross-linking — strengthens the hub graph
     and gives each sibling hub another inbound link. */
  const otherCats = categories.filter((c) => c.slug !== "all" && c.slug !== cat.slug);

  return (
    <main className="bg-bg">
      <JsonLd data={itemList ? [breadcrumb, itemList] : breadcrumb} />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Crawlable breadcrumb — real anchors up to /deals + home. */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
            <li>
              <Link href={`/${country.code}/deals`} className="hover:text-ink transition-colors">
                Deals
              </Link>
            </li>
            <li aria-hidden className="text-ink-3/60">/</li>
            <li className="text-ink-2 font-medium">{cat.name}</li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-[1.08] mb-3">
            {cat.name} deals in {country.name}
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-base leading-relaxed max-w-2xl">
            The cheapest {cat.name.toLowerCase()} we can find across local
            and cross-border stores that ship to {country.name}. Tap any
            product to compare every store carrying it.
          </p>
        </header>

        {/* Product grid → real PDPs */}
        <HubProductGrid deals={offers} countryCode={country.code} />

        {/* See-all CTA into the filtered feed (extra path for users +
            crawlers between the hub and the main deals surface). */}
        {offers.length > 0 && (
          <div className="mt-8">
            <Link
              href={`/${country.code}/deals?category=${cat.slug}`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-border-strong text-ink font-semibold text-sm hover:bg-surface-2 transition-colors"
            >
              See all {cat.name.toLowerCase()} in {country.name}
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Browse other categories — sibling hub cross-links */}
        <section className="mt-12 pt-8 border-t border-border">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-3 mb-4">
            Browse other categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherCats.map((c) => (
              <Link
                key={c.slug}
                href={`/${country.code}/deals/${c.slug}`}
                className="px-3.5 py-2 rounded-full bg-surface-2 border border-border text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      </section>

      <NewsletterStrip />
    </main>
  );
}
