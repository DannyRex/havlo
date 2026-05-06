import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Hero from "@/components/landing/Hero";
import TrendingDeals from "@/components/landing/TrendingDeals";
import TrendingSearches from "@/components/landing/TrendingSearches";
import CategoryGrid from "@/components/landing/CategoryGrid";
import StoreLogos, { getStoreCountForCountry } from "@/components/landing/StoreLogos";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import CTA from "@/components/landing/CTA";
import RefreshOnInterval from "@/components/ui/RefreshOnInterval";
import JsonLd from "@/components/seo/JsonLd";
import { COUNTRIES, getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";

/* Revalidate this page server-side every 5 min so the trending shuffle
   surfaces fresh picks for every cached request. Combined with the
   client-side <RefreshOnInterval /> below, users on the page also see
   updates without manual reload. */
export const revalidate = 300;

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const title = `Find similar products for less in ${country.name}`;
  const description = `Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in ${country.name}.`;
  const url = `${SITE_URL}/${country.code}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates(""),
    },
    openGraph: {
      type: "website",
      title: `${title} · Havlo`,
      description,
      url,
      siteName: "Havlo",
      locale: country.code === "de" ? "de_DE" : `en_${country.code.toUpperCase()}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Havlo`,
      description,
    },
  };
}

export default function HomePage({ params }: { params: { country: string } }) {
  const country = getCountry(params.country);
  if (!COUNTRIES.some((c) => c.code === country.code)) notFound();

  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
  ]);

  /* Pass the user's country store count to the Hero so the trust
     pill ("scanning prices across N stores") matches the marquee
     rendered below. Same source of truth, no drift. */
  const storeCount = getStoreCountForCountry(country.code);

  return (
    <>
      <JsonLd data={breadcrumb} />
      <Hero storeCount={storeCount} />
      <TrendingDeals />
      <TrendingSearches />
      <CategoryGrid />
      <StoreLogos />
      <NewsletterStrip />
      <CTA />
      <RefreshOnInterval ms={300_000} />
    </>
  );
}
