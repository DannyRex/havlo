import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Hero from "@/components/landing/Hero";
import TrendingDeals from "@/components/landing/TrendingDeals";
import CashbackTeaser from "@/components/landing/CashbackTeaser";
import CategoryGrid from "@/components/landing/CategoryGrid";
import StoreLogos, { getStoreCountForCountry } from "@/components/landing/StoreLogos";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import CTA from "@/components/landing/CTA";
import RefreshOnInterval from "@/components/ui/RefreshOnInterval";
import JsonLd from "@/components/seo/JsonLd";
import DealUnavailableBanner from "@/components/feedback/DealUnavailableBanner";
import { COUNTRIES, getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";

/* Revalidate this page server-side every 30 min. Was 300s (5 min);
   pushed out to 1800s on May 2026 after PSI flagged "Document request
   latency: 4,830 ms" on a cold-cache hit — that 4.8s is the streaming
   SSR's full duration (TrendingDeals + CategoryGrid each fan out to
   several DB queries before the response stream closes), and the
   short revalidate window meant ~12 cold renders per region per hour.

   Bumping to 1800s drops that to 2 cold renders per region per hour
   — every other visitor still hits warm ISR cache, and the client-
   side <RefreshOnInterval /> below kicks in every 5 minutes for users
   already on the page so freshness on the live surface is preserved.

   The trending shuffle still rotates because the underlying ranker
   uses popularity_score that updates with click telemetry. */
export const revalidate = 1800;

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

/* Per-country meta description. Previous template lived inline and
   came out ~110-120 chars — under Google's 150-160 sweet spot, which
   caused the snippet to run short with empty space in SERPs. Each
   string here names 2-3 stores the visitor recognises in their
   country, lifting both length and click-through relevance.
   Length budget per entry: 145-160 chars. */
const META_DESCRIPTIONS: Record<string, string> = {
  ng: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in Nigeria, including Konga, Jumia, Amazon, and 20+ more.",
  uk: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in the UK, including Currys, John Lewis, and 20+ more.",
  us: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in the US, including Amazon, Walmart, and 20+ more.",
  de: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in Germany, including Amazon, MediaMarkt, and 20+ more.",
  ae: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in the UAE, including noon, Amazon, and 20+ more.",
  in: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in India, including Flipkart, Amazon, and 20+ more.",
  za: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in South Africa, including Takealot, and 20+ more.",
};

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const title = `Find similar products for less in ${country.name}`;
  const description = META_DESCRIPTIONS[country.code]
    ?? `Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in ${country.name}.`;
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

/* ── Skeleton fallbacks for streamed sections ──────────────────────
   Kept inline (vs imported from a separate file) so the relationship
   between the real section's layout and the placeholder stays
   obvious during future edits. Heights tuned to roughly match the
   real components so the page doesn't jump when content resolves. */

function TrendingDealsSkeleton() {
  return (
    <section className="py-12 sm:py-20 bg-bg" aria-hidden="true">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between mb-6 sm:mb-8 px-1 sm:px-0">
          <div className="skeleton h-8 sm:h-10 w-64 rounded-lg" />
          <div className="skeleton h-5 w-20 rounded hidden sm:block" />
        </div>
        <div className="flex gap-3 sm:gap-5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-44 sm:w-60">
              <div className="skeleton aspect-[4/5] rounded-xl sm:rounded-2xl mb-2.5" />
              <div className="skeleton h-3 w-1/3 rounded mb-1.5" />
              <div className="skeleton h-3.5 w-3/4 rounded mb-1.5" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
      {/* Recovery banner — only renders when /api/go bounced the user
          back here because a Google-relay merchant URL couldn't be
          resolved. Suspense boundary required because the banner
          reads useSearchParams() and Next 14 expects that to be
          inside a Suspense for static-rendered routes. */}
      <Suspense fallback={null}>
        <DealUnavailableBanner />
      </Suspense>
      <Hero storeCount={storeCount} countryCode={country.code} countryName={country.name} />
      {/* TrendingDeals + CategoryGrid both fan out to several DB
          queries to assemble their content (3-10 parallel reads
          each). Wrapping them in Suspense lets the page shell +
          Hero stream to the browser immediately — the visitor sees
          the search input and the trust pill within ~200ms instead
          of waiting 1-3s for every section to resolve. */}
      <Suspense fallback={<TrendingDealsSkeleton />}>
        <TrendingDeals />
      </Suspense>
      {/* Cashback teaser — restores the pre-launch signup hook that
          was previously a hero strip (removed in c9954c9 because it
          duplicated the nav link and pushed the search input down).
          Sits below the fold so visitors who scroll see it; carries
          its own inline email capture so signup is one step, not
          "click → land on /cashback → submit". */}
      <CashbackTeaser />
      {/* TrendingSearches moved to /compare in round-4 QA. The
          chips work better as a "try a comparison" rail next to the
          search input than as a standalone homepage section that
          competed with TrendingDeals + CategoryGrid for the same
          attention. */}
      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoryGrid />
      </Suspense>
      <StoreLogos />
      <NewsletterStrip />
      <CTA />
      <RefreshOnInterval ms={300_000} />
    </>
  );
}
