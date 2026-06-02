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
import { getClickThroughUrl } from "@/lib/utils";
import { appendSignature } from "@/lib/go-signing";
import { toAbsoluteMerchantUrl } from "@/lib/pdp-url";
import { displayStoreName } from "@/lib/store-display";

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

/* Generous price ceiling for synthetic offers. The offer payload
   rides in the URL query string, so a malformed or hostile link can
   carry negative, Infinity, or 1e308 values. Anything at or above
   this is garbage rather than a product, so the offer is rejected
   instead of rendering a broken or layout-breaking price. */
const PRICE_MAX = 1_000_000_000;

function searchParamsToOffer(sp: PageProps["searchParams"]): OfferData | null {
  /* Cap the title. A 2000-char `t=` would otherwise flow straight
     into a 2000-char <title> tag and browser-tab label. */
  const title  = single(sp.t).trim().slice(0, 200);
  /* Unwrap `/api/go?url=<abs>` relay wrappers (SerpAPI Google-relay
     rows carry Deal.url in that form) to the absolute merchant URL.
     Without this, the `new URL()` parse below throws on the relative
     value and 404s a legitimate live deal. The link builder
     (pdp-url.ts) now unwraps too, but pre-fix /p/live links — plus any
     shared or search-indexed URL — still carry the wrapped form, so
     the consume side must handle it as well. */
  const rawUrl = toAbsoluteMerchantUrl(single(sp.u).trim());
  if (!title || !rawUrl) return null;

  /* The merchant URL must be a real http(s) link. This value gets
     signed into an /api/go redirect, so a javascript: / data: / other
     scheme is rejected here rather than relying on /api/go to scrub a
     URL we have already vouched for with a signature. */
  let url: string;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    url = u.toString();
  } catch {
    return null;
  }

  /* Price must be finite, positive, and under the ceiling. An
     implausible price means a bogus synthetic offer, so return null
     and let the page 404 instead of rendering a negative or a
     14-digit price. */
  const currentPrice = parseNumber(sp.p);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || currentPrice >= PRICE_MAX) {
    return null;
  }
  /* Original ("was") price: clamped to at least the current price so
     an op<p inversion cannot render a nonsense strikethrough, and to
     the same ceiling. */
  const originalPrice = Math.min(
    PRICE_MAX,
    Math.max(currentPrice, parseNumber(sp.op, currentPrice)),
  );
  /* Discount is DERIVED from the two prices, never trusted from the
     `dp=` param. The param is what let a "150% OFF" badge render
     against unrelated prices. Capped at 99. */
  const discountPercent = originalPrice > currentPrice
    ? Math.min(99, Math.round((1 - currentPrice / originalPrice) * 100))
    : 0;

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
    storeName:       (single(sp.sn) || "Merchant").slice(0, 80),
    storeLogoUrl:    single(sp.sl) || null,
    title,
    category:        "general",
    brand:           null,
    imageUrl:        single(sp.i) || undefined,
    url,
    currentPrice,
    originalPrice,
    discountPercent,
    currency,
    /* External / live offers default to in-stock; we have no way to
       check without re-scraping. Stale ones the user clicks
       gracefully degrade to "View at merchant" rather than blocking
       the click. */
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
  const storeLabel = displayStoreName(offer.storeName);
  const title = `${offer.title} at ${storeLabel}`;
  return {
    title,
    description: `Find ${offer.title} at ${storeLabel} on Havlo. See cheaper alternatives across other stores in ${country.name}.`,
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
  const dupes = await pgFtsFindDupes(offer.title, 0, { limit: 30, strict: false });

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
     pass behind it. Title-key collapse catches duplicate dupes the
     FTS engine occasionally splits across signatures. */
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const seenStoreTitle = new Set<string>();
  const normaliseTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const filteredDupes = countryFilteredDupes.filter((d) => {
    if (offer.title && normaliseTitle(d.title) === normaliseTitle(offer.title)) return false;
    const best = [...d.offers].sort((a, b) => a.landedPrice - b.landedPrice)[0];
    const id = best?.offerId || (best?.storeId + ":" + d.key);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    const titleKey = normaliseTitle(d.title);
    if (seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    /* Same-store same-title collapse — catches Fashion-Nova-style
       variant duplication where one merchant offers the same named
       item at two prices (different SKU sizes / colors). Same shape
       as /p/[id]. */
    const storeTitleKey = `${best?.storeId ?? ""}|${titleKey}`;
    if (seenStoreTitle.has(storeTitleKey)) return false;
    seenStoreTitle.add(storeTitleKey);
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

        <ProductHero
          offer={offer}
          countryCode={country.code}
          signedOutboundUrl={appendSignature(getClickThroughUrl({
            url:       offer.url,
            id:        offer.offerId,
            title:     offer.title,
            storeId:   offer.storeId,
            storeName: offer.storeName,
            country:   country.code,
          }))}
          totalStores={totalStores}
        />

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
