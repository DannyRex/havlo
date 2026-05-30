import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/compare`;
  /* Lead with the value proposition + local market. The root layout's
     title template ("%s · Havlo") appends the brand to the document
     title, so it isn't repeated here (OG/Twitter titles below set the
     brand explicitly since the template doesn't apply to them). */
  const title = `Compare Prices Across Stores in ${country.name}`;
  const description = `Search any product or paste a link. Havlo compares live prices across the stores you already shop in ${country.name} and shows you the cheapest. Free, no signup.`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("compare"),
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

export default function CompareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { country: string };
}) {
  const country = getCountry(params.country);
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",          url: `${SITE_URL}/${country.code}` },
    { name: country.name,     url: `${SITE_URL}/${country.code}` },
    { name: "Find for less",  url: `${SITE_URL}/${country.code}/compare` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumb} />
      {children}
    </>
  );
}
