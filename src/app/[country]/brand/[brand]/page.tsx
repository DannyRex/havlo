import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import HubProductGrid from "@/components/hub/HubProductGrid";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import { getCountry, ACTIVE_COUNTRIES } from "@/lib/country";
import { categories } from "@/lib/data/categories";
import {
  fetchBrandHubOffers,
  resolveBrandSlug,
  listIndexableBrands,
  BRAND_HUB_MIN_PRODUCTS,
} from "@/lib/hubs";
import {
  SITE_URL,
  buildHreflangAlternates,
  buildBreadcrumbList,
  buildItemListJsonLd,
} from "@/lib/seo";
import type { SeoDeal } from "@/lib/seo";

/* Brand hub — /[country]/brand/[brand].

   Same de-orphaning role as the category hub, scoped to a brand. Brand
   coverage is sparse (~17% of the catalog), so:
     • generateStaticParams + sitemap only include brands with
       >= BRAND_HUB_MIN_PRODUCTS country-shoppable products (top
       BRAND_HUB_MAX per market).
     • A direct hit on a sub-threshold brand still renders (so an
       inbound link never 404s) but is set noindex.
     • An unknown brand slug 404s. */
export const revalidate = 21600;

export async function generateStaticParams() {
  const out: Array<{ country: string; brand: string }> = [];
  for (const country of ACTIVE_COUNTRIES) {
    const brands = await listIndexableBrands(country.code);
    for (const b of brands) out.push({ country: country.code, brand: b.slug });
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: { country: string; brand: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const summary = await resolveBrandSlug(country.code, params.brand);
  if (!summary) {
    return { title: "Brand not found", robots: { index: false, follow: false } };
  }

  const url = `${SITE_URL}/${country.code}/brand/${summary.slug}`;
  const title = `${summary.brand} prices in ${country.name}`;
  const description = `Compare ${summary.brand} prices across local and cross-border stores in ${country.name}. Find the cheapest verified option, updated through the day.`;

  /* Index only brands that clear the product threshold. Below it the
     page renders but stays out of the index (thin-content guard). */
  const indexable = summary.count >= BRAND_HUB_MIN_PRODUCTS;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates(`brand/${summary.slug}`),
    },
    robots: indexable ? undefined : { index: false, follow: true },
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

export default async function BrandHubPage({
  params,
}: {
  params: { country: string; brand: string };
}) {
  const country = getCountry(params.country);
  const summary = await resolveBrandSlug(country.code, params.brand);
  if (!summary) notFound();

  const offers = await fetchBrandHubOffers(country.code, summary.brand);
  /* No country-shoppable inventory at all → nothing to show or index.
     Treat as not found rather than shipping an empty page. */
  if (offers.length === 0) notFound();

  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",        url: `${SITE_URL}/${country.code}` },
    { name: country.name,   url: `${SITE_URL}/${country.code}` },
    { name: "Deals",        url: `${SITE_URL}/${country.code}/deals` },
    { name: summary.brand,  url: `${SITE_URL}/${country.code}/brand/${summary.slug}` },
  ]);

  /* ItemList carries the real brand here — this is exactly the surface
     where products.brand is known, so Google gets an accurate Brand on
     every Product entry. */
  const seoDeals: SeoDeal[] = offers.slice(0, 24).map((d) => ({
    title:           d.title,
    url:             `${SITE_URL}/${country.code}/p/${d.id}`,
    imageUrl:        d.imageUrl,
    storeName:       d.storeName,
    salePrice:       d.salePrice,
    originalPrice:   d.originalPrice,
    currency:        d.currency,
    discountPercent: d.discountPercent,
    brand:           summary.brand,
  }));
  const itemList = buildItemListJsonLd(
    seoDeals,
    `${summary.brand} products in ${country.name} on Havlo`,
  );

  return (
    <main className="bg-bg">
      <JsonLd data={[breadcrumb, itemList]} />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Crawlable breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
            <li>
              <Link href={`/${country.code}/deals`} className="hover:text-ink transition-colors">
                Deals
              </Link>
            </li>
            <li aria-hidden className="text-ink-3/60">/</li>
            <li>
              <Link href={`/${country.code}/brands`} className="hover:text-ink transition-colors">
                Brands
              </Link>
            </li>
            <li aria-hidden className="text-ink-3/60">/</li>
            <li className="text-ink-2 font-medium">{summary.brand}</li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-[1.08] mb-3">
            {summary.brand} prices in {country.name}
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-base leading-relaxed max-w-2xl">
            Every {summary.brand} product we track that is shoppable in{" "}
            {country.name}, from local retailers and the cross-border
            stores that ship to you. Tap any item to compare prices across
            stores.
          </p>
        </header>

        {/* Product grid → real PDPs */}
        <HubProductGrid deals={offers} countryCode={country.code} />

        {/* Browse by category — links into the category hub system */}
        <section className="mt-12 pt-8 border-t border-border">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-3 mb-4">
            Browse by category
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.slug !== "all")
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/${country.code}/deals/${c.slug}`}
                  className="px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
                >
                  {c.name}
                </Link>
              ))}
          </div>
          <div className="mt-5">
            <Link
              href={`/${country.code}/brands`}
              className="text-sm text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink"
            >
              See all brands in {country.name}
            </Link>
          </div>
        </section>
      </section>

      <NewsletterStrip />
    </main>
  );
}
