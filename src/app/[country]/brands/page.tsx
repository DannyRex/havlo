import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import StoreLogo from "@/components/compare/StoreLogo";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import { getCountry, ACTIVE_COUNTRIES } from "@/lib/country";
import { categories } from "@/lib/data/categories";
import { listIndexableBrands } from "@/lib/hubs";
import { resolveBrandDomain } from "@/lib/brand-domains";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";

/* Brand index — /[country]/brands.

   The crawl entry point into the brand-hub system: linked from the
   global footer, it lists every indexable brand for the market so a
   crawler (and a shopper) can reach each /[country]/brand/[slug] hub,
   which in turn links down to PDPs. Closes the de-orphaning loop. */
export const revalidate = 21600;

export function generateStaticParams() {
  return ACTIVE_COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/brands`;
  const title = `Shop by brand in ${country.name}`;
  const description = `Browse products by brand in ${country.name}. Compare prices across local and cross-border stores and find the cheapest verified option.`;

  const brands = await listIndexableBrands(country.code);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("brands"),
    },
    /* Nothing to list in a sparse market → keep the empty index out of
       the search index, but still let crawlers follow its links. */
    robots: brands.length > 0 ? undefined : { index: false, follow: true },
    openGraph: { title: `${title} · Havlo`, description, url, type: "website" },
    twitter: { card: "summary_large_image", title: `${title} · Havlo`, description },
  };
}

export default async function BrandsIndexPage({
  params,
}: {
  params: { country: string };
}) {
  const country = getCountry(params.country);
  const brands = await listIndexableBrands(country.code);

  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
    { name: "Deals",      url: `${SITE_URL}/${country.code}/deals` },
    { name: "Brands",     url: `${SITE_URL}/${country.code}/brands` },
  ]);

  return (
    <main className="bg-bg">
      <JsonLd data={breadcrumb} />

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
            <li className="text-ink-2 font-medium">Brands</li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-[1.08] mb-3">
            Shop by brand in {country.name}
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-base leading-relaxed max-w-2xl">
            Jump straight to a brand to compare its prices across local and
            cross-border stores that ship to {country.name}.
          </p>
        </header>

        {brands.length > 0 ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {brands.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/${country.code}/brand/${b.slug}`}
                  className="flex items-center justify-between gap-3 px-4 py-4 rounded-xl bg-surface-2 border border-border hover:border-border-strong transition-colors group"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    {/* Brand mark. No bundled /logos asset for most brands,
                        so StoreLogo resolves the brand's favicon from its
                        canonical domain (resolveBrandDomain: corrects the
                        ~12 brands whose slug.com points at the wrong company,
                        e.g. mac -> maccosmetics.com) and falls back to a
                        letter badge. Same primitive the product cards use. */}
                    <StoreLogo
                      storeId={b.slug}
                      storeName={b.brand}
                      storeLogoUrl={`/logos/${b.slug}.png`}
                      merchantUrl={`https://${resolveBrandDomain(b.slug)}`}
                      size={36}
                      pad={6}
                    />
                    <span className="text-ink font-medium text-[15px] truncate">{b.brand}</span>
                  </span>
                  <span className="text-ink-3 text-[13px] tabular-nums shrink-0">{b.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-border bg-surface-2 px-6 py-12 text-center">
            <p className="text-ink-2 text-[15px] leading-relaxed">
              We are still building out brand pages for {country.name}. In
              the meantime, browse the full deal feed.
            </p>
            <Link
              href={`/${country.code}/deals`}
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Browse deals
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Browse by category — cross-link into the category hubs */}
        <section className="mt-12 pt-8 border-t border-border">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-3 mb-4">
            Or browse by category
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.slug !== "all")
              .map((c) => (
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
