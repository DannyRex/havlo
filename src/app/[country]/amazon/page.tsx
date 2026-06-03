import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import HubProductGrid from "@/components/hub/HubProductGrid";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import { getCountry, ACTIVE_COUNTRIES } from "@/lib/country";
import { fetchAmazonHubOffers } from "@/lib/hubs";
import {
  SITE_URL,
  buildHreflangAlternates,
  buildBreadcrumbList,
  buildItemListJsonLd,
} from "@/lib/seo";
import type { SeoDeal } from "@/lib/seo";

/* Amazon deals hub — /[country]/amazon.

   A CamelCamelCamel-style landing that promotes our Amazon affiliate
   relationship HONESTLY: it surfaces real Amazon markdowns shoppable in
   the visitor's market, but every card links to a Havlo PDP that carries
   the product's price history (so a "deal" can be checked, not trusted on
   faith) and an affiliate "Buy on Amazon" button. Amazon is cross-border
   for NG/IN/ZA, so fetchAmazonHubOffers applies the full reachability
   filter — see lib/hubs.ts. */
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
  const title = `Amazon deals in ${country.name} — checked against price history`;
  const description = `The biggest Amazon price drops shoppable in ${country.name}, each checked against its price history so a deal is really a deal. See if Amazon is the cheapest before you buy.`;
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
  const offers = await fetchAmazonHubOffers(country.code);

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
  const itemList = buildItemListJsonLd(seoDeals, `Amazon deals in ${country.name} on Havlo`);

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

        {/* Hero */}
        <header className="mb-8 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Amazon deals
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-[1.08] mb-3">
            Save on your next Amazon purchase
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-base leading-relaxed">
            The biggest Amazon price drops you can shop from {country.name},
            updated through the day. Tap any item to see its full price
            history, so you can tell a real markdown from a &ldquo;was&rdquo;
            price that quietly crept up first &mdash; and to check whether
            another store beats Amazon before you buy.
          </p>
        </header>

        {/* Honesty strip — the CamelCamelCamel value, in our voice. */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { t: "Verified by price history", d: "Every deal links to a chart of what it actually cost over time, so an inflated “discount” has nowhere to hide." },
            { t: "Amazon vs everyone else",   d: "We show the same product at other stores too — so you only buy from Amazon when Amazon is genuinely the best price." },
            { t: "Shoppable from " + country.name, d: "Only Amazon offers that actually ship to your market, priced in your currency at the spot rate." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-ink mb-1">{c.t}</p>
              <p className="text-[13px] text-ink-3 leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>

        {/* Grid → real PDPs (price history + affiliate "Buy on Amazon"). */}
        {offers.length > 0 ? (
          <HubProductGrid deals={offers} countryCode={country.code} />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-ink-2 text-sm">
              No Amazon price drops shoppable in {country.name} right now. Check
              back soon, or{" "}
              <Link href={`/${country.code}/deals`} className="text-ink underline underline-offset-4">
                browse all deals
              </Link>.
            </p>
          </div>
        )}

        {/* Affiliate disclosure — FTC + payout-neutral promise (#73). */}
        <p className="mt-8 text-[12px] text-ink-3 leading-relaxed max-w-2xl">
          As an Amazon Associate, Havlo may earn a commission from qualifying
          purchases made through links on this page, at no extra cost to you.
          It never changes which deals we show or how we rank prices &mdash;
          if another store is cheaper, we say so.
        </p>

        <div className="mt-6">
          <Link
            href={`/${country.code}/deals`}
            className="text-sm text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink"
          >
            See all deals in {country.name} →
          </Link>
        </div>
      </section>

      <NewsletterStrip />
    </main>
  );
}
