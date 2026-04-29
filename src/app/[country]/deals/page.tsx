import { Suspense } from "react";
import type { Metadata } from "next";
import DealFeed from "@/components/deals/DealFeed";
import JsonLd from "@/components/seo/JsonLd";
import { getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/deals`;
  const title = `Deals worth checking today in ${country.name}`;
  const description = `Fresh price drops + standout offers across the stores you already shop in ${country.name}. Filter by category, brand, and discount.`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("deals"),
    },
    openGraph: {
      title:       `${title} · Havlo`,
      description,
      url,
      type:        "website",
    },
    twitter: {
      card:        "summary_large_image",
      title:       `${title} · Havlo`,
      description,
    },
  };
}

export default function DealsPage({ params }: { params: { country: string } }) {
  const country = getCountry(params.country);
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
    { name: "Deals",      url: `${SITE_URL}/${country.code}/deals` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumb} />
      <Suspense>
        <DealFeed />
      </Suspense>
    </>
  );
}
