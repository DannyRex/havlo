/* /[country]/p/live — Synthetic PDP for offers that aren't in the
   offers table.

   Why this route exists: the standard /[country]/p/[id] page looks
   up an offer by its UUID from product_best_offers / offers /
   curated-amazon. Live SerpAPI results (LiveAlternatives + compare
   LiveResults) carry synthetic IDs (`serp-{ts}-{i}`) that don't
   resolve in any of those sources, so they'd 404 on the regular
   PDP route.

   This route accepts the offer's data inline via query params and
   renders the same ProductHero + similar products grid. No DB
   lookup needed for the anchor; similar products still come from
   pgFtsFindDupes against the title.

   URL shape (URL-encoded values):
     /[country]/p/live
       ?t=Product+title
       &s=storeId
       &sn=Store+Name
       &p=12345              (price in the offer's currency)
       &op=15000             (original price, optional)
       &dp=20                (discount %, optional)
       &c=NGN|USD            (currency)
       &u=https%3A%2F%2F...  (merchant URL)
       &i=https%3A%2F%2F...  (image URL, optional)
       &sl=/logos/x.png      (store logo, optional)

   Keeps each user click to a card flowing through a PDP-style
   page first instead of jumping straight outbound — matches the
   site-wide pattern user requested May 2026: "no product across
   the site should go directly to merchant." */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCountry, COUNTRIES } from "@/lib/country";
import { SITE_URL } from "@/lib/seo";
import { pgFtsFindDupes } from "@/lib/search/pg-fts";
import { isOfferAllowedForCountry } from "@/lib/country";
import ProductHero, { type OfferData } from "@/components/product/ProductHero";
import SimilarProducts from "@/components/product/SimilarProducts";

/* Synthetic PDPs are never indexed — they're transient anchors for
   external offers that may or may not exist tomorrow. Keeps Google
   from filling its index with disposable query-param URLs. */
export const dynamic = "force-dynamic";

interface PageProps {
  params: { country: string };
  searchParams: Record<string, string | string[] | undefined>;
}

function single(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function parseNumber(v: string | string[] | undefined, fallback = 0): number {
  const s = single(v).trim();
  if (!s) return fallback;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

function searchParamsToOffer(sp: PageProps["searchParams"]): OfferData | null {
  const title = single(sp.t).trim();
  const url   = single(sp.u).trim();
  if (!title || !url) return null;

  const ccyRaw = single(sp.c).toUpperCase();
  const currency: "NGN" | "USD" = ccyRaw === "NGN" ? "NGN" : "USD";

  return {
    /* Empty offerId signals "synthetic" to ProductHero so it can
       skip any DB-tied features (e.g. cashback lookup, click
       telemetry that requires a known offer_id). Routing back to
       this same /p/live URL via the URL param chain still works. */
    offerId:         "",
    productId:       "",
    storeId:         single(sp.s) || "external",
    storeName:       single(sp.sn) || "Merchant",
    storeLogoUrl:    single(sp.sl) || null,
    title,
    category:        "general",
    brand:           null,
    imageUrl:        single(sp.i) || undefined,
    url,
    currentPrice:    parseNumber(sp.p),
    originalPrice:   parseNumber(sp.op, parseNumber(sp.p)),
    discountPercent: Math.round(parseNumber(sp.dp)),
    currency,
    /* External / live offers default to in-stock; we have no way to
       check without re-scraping. Stale ones the user clicks
       gracefully degrade to "View at merchant → maybe oos" rather
       than blocking the click. */
    inStock:         true,
    scrapedAt:       new Date().toISOString(),
  };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const country = getCountry(params.country);
  const offer = searchParamsToOffer(searchParams);
  if (!offer) {
    return { title: "Product not found", robots: { index: false, follow: false } };
  }
  const title = `${offer.title} at ${offer.storeName}`;
  return {
    title,
    description: `Find ${offer.title} at ${offer.storeName} on Havlo. See cheaper alternatives across other stores in ${country.name}.`,
    /* Synthetic PDPs never get indexed — they're transient query-
       param URLs for offers that may or may not exist tomorrow,
       and indexing them would pollute SERPs with disposable URLs. */
    robots: { index: false, follow: true },
    alternates: { canonical: undefined },
  };
}

export default async function LivePdpPage({ params, searchParams }: PageProps) {
  const country = getCountry(params.country);
  if (!COUNTRIES.some((c) => c.code === country.code)) notFound();

  const offer = searchParamsToOffer(searchParams);
  if (!offer) notFound();

  /* Similar products from the DB — same engine as the regular PDP.
     anchorPriceNgn=0 means "no ceiling, FTS similarity ranking."
     The visitor lands on a synthetic anchor + still gets the broader
     "look at these alternatives" view. */
  const dupes = await pgFtsFindDupes(offer.title, 0, { limit: 16 });

  /* Country-filter the dupes' offers so a UK PDP doesn't surface
     Konga rows. Same shape as the regular PDP. */
  const countryFilteredDupes = country.code === "ng"
    ? dupes
    : dupes
        .map((d) => ({
          ...d,
          offers: d.offers.filter((o) => isOfferAllowedForCountry(o, country)),
        }))
        .filter((d) => d.offers.length > 0);

  /* Dedupe + drop the synthetic anchor itself from the YML rail.
     Same shape as /p/[id]. Synthetic anchors don't have a product_id,
     so the anchor filter relies on title-exact match + the dedupe
     pass behind it. */
  const seenIds = new Set<string>();
  const filteredDupes = countryFilteredDupes.filter((d) => {
    if (offer.title && d.title === offer.title) return false;
    const best = [...d.offers].sort((a, b) => a.landedPrice - b.landedPrice)[0];
    const id = best?.offerId || (best?.storeId + ":" + d.key);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  /* Synthetic anchors don't have a DB product to count stores
     against. Fall back to 1 (just the anchor's own store). Future:
     pgFtsFindSimilar could return a ProductGroup we'd anchor on. */
  const totalStores = 1;

  return (
    <main className="bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <Link
          href={`/${country.code}/compare?q=${encodeURIComponent(offer.title)}&mode=similar`}
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-ink-3 hover:text-ink transition-colors mb-5 sm:mb-7"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Back to results
        </Link>

        <ProductHero offer={offer} countryCode={country.code} totalStores={totalStores} />

        {filteredDupes.length > 0 && (
          <section className="mt-12 sm:mt-16">
            <header className="mb-6 sm:mb-8">
              <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
                You may also like
              </h2>
              <p className="text-sm sm:text-base text-ink-2 mt-1.5">
                {filteredDupes.length} {filteredDupes.length === 1 ? "pick" : "picks"} from other stores. Sorted cheapest first.
              </p>
            </header>
            <SimilarProducts dupes={filteredDupes} countryCode={country.code} />
          </section>
        )}
      </div>
    </main>
  );
}
