import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import AmazonDealsBrowser from "@/components/hub/AmazonDealsBrowser";
import AmazonCashbackBanner from "@/components/hub/AmazonCashbackBanner";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";
import { getCountry, ACTIVE_COUNTRIES } from "@/lib/country";
import { fetchAllAmazonOffers } from "@/lib/hubs";
import {
  SITE_URL,
  buildHreflangAlternates,
  buildBreadcrumbList,
  buildItemListJsonLd,
} from "@/lib/seo";
import type { SeoDeal } from "@/lib/seo";

/* Amazon deals hub — /[country]/amazon.

   A CamelCamelCamel-style landing that promotes our Amazon affiliate
   relationship HONESTLY: it surfaces every real Amazon markdown we track
   across all marketplaces (UK / US / AE / IN / DE / ZA), filterable by
   country + category and sortable, and every card links to a Havlo PDP
   that carries the product's price history (so a "deal" can be checked,
   not trusted on faith) plus an affiliate "Buy on Amazon" button. The
   filtering/sorting is client-side over the full set — see
   AmazonDealsBrowser + fetchAllAmazonOffers. */
export const revalidate = 10800; // 3h — Amazon markdowns move faster than brand hubs

export function generateStaticParams() {
  return ACTIVE_COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/amazon`;
  const title = `Amazon deals in ${country.name}: checked against price history`;
  const description = `Real Amazon markdowns across the UK, US, India and more, each checked against its own price history. We tag the ones at their lowest in 30 days. Filter by country and category, sorted by the biggest markdown.`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("amazon"),
    },
    openGraph: { title: `${title} · Havlo`, description, url, type: "website" },
    twitter: { card: "summary_large_image", title: `${title} · Havlo`, description },
  };
}

export default async function AmazonDealsPage({
  params,
}: {
  params: { country: string };
}) {
  const country = getCountry(params.country);
  const offers = await fetchAllAmazonOffers();

  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
    { name: "Deals",      url: `${SITE_URL}/${country.code}/deals` },
    { name: "Amazon",     url: `${SITE_URL}/${country.code}/amazon` },
  ]);

  const seoDeals: SeoDeal[] = offers.slice(0, 24).map((d) => ({
    title:           d.title,
    url:             `${SITE_URL}/${country.code}/p/${d.id}`,
    imageUrl:        d.imageUrl,
    storeName:       d.storeName,
    salePrice:       d.salePrice,
    originalPrice:   d.originalPrice,
    currency:        d.currency,
    discountPercent: d.discountPercent,
  }));
  const itemList = buildItemListJsonLd(seoDeals, "Amazon deals on Havlo");

  return (
    <main className="bg-bg">
      <JsonLd data={[breadcrumb, itemList]} />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
            <li>
              <Link href={`/${country.code}/deals`} className="hover:text-ink transition-colors">Deals</Link>
            </li>
            <li aria-hidden className="text-ink-3/60">/</li>
            <li className="text-ink-2 font-medium">Amazon</li>
          </ol>
        </nav>

        {/* Hero — one benefit headline + one informative line. */}
        <header className="mb-6 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Amazon deals
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-[1.08] mb-3">
            Don&apos;t overpay on Amazon
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-base leading-relaxed">
            Real Amazon markdowns, each checked against its own price history.
            We tag the ones sitting at their lowest in 30 days, so you can spot
            a genuine deal at a glance and tap any item for the full history.
          </p>
        </header>

        {/* 2% cashback applies to every Amazon order, so it's advertised
            once here (not per card). */}
        <AmazonCashbackBanner country={country} />

        {/* Browser — client-side filter (country + category) + sort. */}
        {offers.length > 0 ? (
          <AmazonDealsBrowser deals={offers} countryCode={country.code} />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-ink-2 text-sm">
              No Amazon markdowns right now. Check back soon, or{" "}
              <Link href={`/${country.code}/deals`} className="text-ink underline underline-offset-4">
                browse all deals
              </Link>.
            </p>
          </div>
        )}

        {/* Affiliate disclosure — FTC + payout-neutral promise (#73). */}
        <p className="mt-8 text-[12px] text-ink-3 leading-relaxed max-w-2xl">
          As an Amazon Associate, Havlo may earn from qualifying purchases,
          at no extra cost to you. It never changes which deals we show or
          how we rank prices.
        </p>
      </section>

      <NewsletterStrip />

      {/* Back-to-top FAB — the browser can reveal a long, paginated
          grid, so give the visitor a one-tap way back up (parity with
          /deals). */}
      <ScrollToTopButton />
    </main>
  );
}
