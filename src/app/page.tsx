/* Bare-domain homepage — havlo.io/

   PREVIOUSLY: this route was noindex + a geo 307 redirect to /{country},
   so the bare brand domain could never be indexed (only /ng, /uk, … were).
   For a brand search like "havlo" there was no indexable homepage at the
   root, which hurt brand ranking.

   NOW: `/` is a REAL, indexable homepage — the NG market, which is Havlo's
   primary market AND the hreflang x-default — with a self-canonical to
   https://havlo.io/. Country-specific bare paths (/deals, /compare, …) still
   geo-redirect via middleware; only the bare `/` renders.

   Country awareness without cloaking: the server HTML is identical for
   everyone (crawlers included), so `/` is always rankable. CountryProvider
   (the existing client provider in the layout) then routes a RETURNING
   visitor whose saved-market cookie isn't NG to their country homepage.
   Cookie-gated, so a crawler carries no cookie and is never redirected. A
   first-time non-NG visitor sees the NG (x-default) homepage and switches
   market with the country picker.

   This file mirrors the body of [country]/page.tsx with country pinned to
   NG. We deliberately do NOT import that route module's default export —
   importing a page module across route segments breaks Next's webpack
   module graph (verified: "Cannot read properties of undefined (reading
   'call')" at RootHome). Keep the two in sync by hand. */

import type { Metadata } from "next";
import { Suspense } from "react";
import ReactDOM from "react-dom";
import Hero from "@/components/landing/Hero";
import TrendingDeals, { getTrendingBuckets } from "@/components/landing/TrendingDeals";
import { composePicks } from "@/components/landing/trending-compose";
import CashbackTeaser from "@/components/landing/CashbackTeaser";
import CategoryGrid from "@/components/landing/CategoryGrid";
import AmazonPromo from "@/components/landing/AmazonPromo";
import StoreLogos, { getStoreCountForCountry } from "@/components/landing/StoreLogos";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import CTA from "@/components/landing/CTA";
import HomeVideoShowcase from "@/components/landing/HomeVideoShowcase";
import RefreshOnInterval from "@/components/ui/RefreshOnInterval";
import JsonLd from "@/components/seo/JsonLd";
import DealUnavailableBanner from "@/components/feedback/DealUnavailableBanner";
import { getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";
import { getPopularPlaceholderExamples } from "@/lib/popular-placeholder-examples";
import { getShoppableStoreCount } from "@/lib/providers/browse-db";
import { proxiedImageUrl, downscaleCardImageUrl } from "@/lib/utils";

/* ISR — mirror the country homepage's window so the bare domain stays a
   cheap static render. */
export const revalidate = 300;

/* The bare homepage renders the NG (x-default / primary) market. */
const HOME_CC = "ng";

export const metadata: Metadata = {
  /* Absolute (bypasses the layout's "%s · Havlo" template) so the brand
     leads the SERP title for "havlo" queries. */
  title: { absolute: "Havlo · Find similar products for less" },
  description:
    "Before you buy it, find it for less. Havlo compares prices across the stores you already shop, so you never overpay online.",
  alternates: {
    /* Self-canonical to the bare domain so Google indexes havlo.io/ as the
       homepage. buildHreflangAlternates emits x-default → / for the homepage
       cluster (see lib/seo.ts). */
    canonical: `${SITE_URL}/`,
    languages: buildHreflangAlternates(""),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    title: "Havlo · Find similar products for less",
    description:
      "Before you buy it, find it for less. Havlo compares prices across the stores you already shop.",
    url: `${SITE_URL}/`,
    siteName: "Havlo",
  },
};

function CategoryGridSkeleton() {
  return (
    <section className="py-12 sm:py-20 bg-bg" aria-hidden="true">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="skeleton h-8 sm:h-10 w-56 rounded-lg mb-6 sm:mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[5/3] rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function RootHome() {
  const country = getCountry(HOME_CC);

  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
  ]);

  const shoppableCount = await getShoppableStoreCount(country.code);
  const storeCount = shoppableCount > 0 ? shoppableCount : getStoreCountForCountry(country.code);
  const placeholderExamples = await getPopularPlaceholderExamples(country.code);
  const trendingBuckets = await getTrendingBuckets(country);

  const leadDeal = trendingBuckets ? composePicks(trendingBuckets, false)[0] : null;
  if (leadDeal?.imageUrl) {
    ReactDOM.preload(proxiedImageUrl(downscaleCardImageUrl(leadDeal.imageUrl)), {
      as: "image",
      fetchPriority: "high",
    });
  }

  return (
    <>
      <JsonLd data={breadcrumb} />
      <Suspense fallback={null}>
        <DealUnavailableBanner />
      </Suspense>
      <Hero storeCount={storeCount} countryCode={country.code} countryName={country.name} placeholderExamples={placeholderExamples} />
      {trendingBuckets && (
        <TrendingDeals buckets={trendingBuckets} countryCode={country.code} />
      )}
      <HomeVideoShowcase countryCode={country.code} />
      <AmazonPromo country={country} />
      <CashbackTeaser country={country} />
      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoryGrid country={country} />
      </Suspense>
      <StoreLogos country={country} />
      <NewsletterStrip />
      <CTA country={country} />
      <RefreshOnInterval ms={300_000} />
    </>
  );
}
