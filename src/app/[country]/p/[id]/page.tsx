/* /[country]/p/[id] — Product detail page.

   The PDP is RELATIVE TO A STORE: a single offer = a single deal at
   a single merchant. URL is the offer's stable UUID. The page renders
   the offer's image, title, price, and a "View at {Merchant}" CTA
   that routes through /api/go for affiliate wrapping. Below the
   hero, "Cheaper alternatives" reuses the same pgFtsFindDupes
   pipeline /compare relies on.

   Click-model change shipped alongside this page: MasonryCard and
   ListCard now link to /p/[id] instead of jumping outbound to the
   merchant on first click. The first click brings the user HERE; the
   "View at {Merchant}" CTA does the actual outbound. Affiliate tags
   still fire at that final click via /api/go.

   SEO:
     - Per-page meta title + description from the offer's title + store
     - OpenGraph image = the product image
     - JSON-LD Product schema with offer details so Google can show
       price + availability + rating in rich results
     - Canonical URL is the country-aware /[country]/p/[id]
     - generateStaticParams skipped (offers churn too fast to pre-render)

   Architecture mirrors /[country]/compare and /[country]/cashback:
     server-rendered shell, ProductHero client component for the
     interactive parts (cashback badge, image fallback, etc.),
     SimilarProducts a thin masonry around MasonryCard. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { ChevronLeft } from "lucide-react";

import { getCountry } from "@/lib/country";
import { COUNTRIES } from "@/lib/country";
import { SITE_URL, buildBreadcrumbList, buildHreflangAlternates } from "@/lib/seo";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { pgFtsFindDupes } from "@/lib/search/pg-fts";
import { isOfferAllowedForCountry, USD_FX } from "@/lib/country";
import JsonLd from "@/components/seo/JsonLd";
import ProductHero, { type OfferData } from "@/components/product/ProductHero";
import SimilarProducts from "@/components/product/SimilarProducts";

/* Offers churn frequently (every ingest cycle adds + retires rows).
   ISR revalidate keeps the cached HTML fresh without re-rendering
   on every request. 1 hour is a sensible default — the underlying
   price/availability changes slowly enough that an hour of staleness
   is invisible to users, and the warm cache keeps SSR latency low. */
export const revalidate = 3600;

interface PageProps {
  params: { country: string; id: string };
}

/* ── Data fetch ──────────────────────────────────────────────────── */

interface OfferRow {
  offer_id: string;
  product_id: string;
  store_id: string;
  url: string;
  current_price: number;
  original_price: number | null;
  discount_percent: number | null;
  currency: "NGN" | "USD";
  scraped_at: string;
  in_stock: boolean;
  title: string;
  category_slug: string | null;
  brand: string | null;
  image_url: string | null;
  store_name: string;
  store_logo_url: string | null;
}

/* Fetch a single offer by its ID, joined with its product + store.
   Returns null on miss → page falls through to notFound().
   Uses product_best_offers when possible (already joined view) but
   falls back to a manual join when the offer isn't the "best" for
   its product (e.g. user landed on a non-cheapest offer via deep
   link). The manual fallback covers every offer regardless of rank. */
async function fetchOffer(offerId: string): Promise<OfferRow | null> {
  const supa = getSupabaseAdmin();
  if (!supa) return null;

  /* Try the joined view first — fast path for offers that ARE the
     best for their product (~50% of /deals clicks). */
  const { data: viewRow } = await supa
    .from("product_best_offers")
    .select("*")
    .eq("offer_id", offerId)
    .maybeSingle();

  if (viewRow) return viewRow as OfferRow;

  /* Fall back to the offers + products + stores join. Slower (two
     more network hops) but covers every offer in the catalog. */
  const { data: offer } = await supa
    .from("offers")
    .select("id, product_id, store_id, url, current_price, original_price, discount_percent, currency, in_stock, scraped_at")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return null;

  const [{ data: product }, { data: store }] = await Promise.all([
    supa.from("products").select("title, category_slug, brand, image_url").eq("id", offer.product_id).maybeSingle(),
    supa.from("stores").select("name, logo_url").eq("id", offer.store_id).maybeSingle(),
  ]);
  if (!product || !store) return null;

  return {
    offer_id: offer.id,
    product_id: offer.product_id,
    store_id: offer.store_id,
    url: offer.url,
    current_price: offer.current_price,
    original_price: offer.original_price,
    discount_percent: offer.discount_percent,
    currency: offer.currency as "NGN" | "USD",
    scraped_at: offer.scraped_at,
    in_stock: offer.in_stock,
    title: product.title,
    category_slug: product.category_slug,
    brand: product.brand,
    image_url: product.image_url,
    store_name: store.name,
    store_logo_url: store.logo_url,
  };
}

function offerRowToHero(row: OfferRow): OfferData {
  return {
    offerId:         row.offer_id,
    productId:       row.product_id,
    storeId:         row.store_id,
    storeName:       row.store_name,
    storeLogoUrl:    row.store_logo_url,
    title:           row.title,
    category:        row.category_slug ?? "general",
    brand:           row.brand,
    imageUrl:        row.image_url ?? undefined,
    url:             row.url,
    currentPrice:    row.current_price,
    originalPrice:   row.original_price ?? row.current_price,
    discountPercent: row.discount_percent ?? 0,
    currency:        row.currency,
    inStock:         row.in_stock,
    scrapedAt:       row.scraped_at,
  };
}

/* Convert the offer's native-currency price into NGN for the
   anchor-price arg pgFtsFindDupes expects. Falls back to 0
   ("no price ceiling") when the conversion can't be derived,
   matching the existing /compare/dupes contract. */
function offerToNgnAnchor(row: OfferRow): number {
  if (row.currency === "NGN") return row.current_price;
  if (row.currency === "USD") {
    return Math.round(row.current_price * USD_FX.NGN);
  }
  return 0;
}

/* ── Static params ───────────────────────────────────────────────── */

/* Skipped: offers churn every ingest cycle, so pre-rendering would
   waste build minutes on URLs that go stale within hours. ISR's
   on-demand caching is the right shape — each unique URL warms its
   own cache entry the first time a visitor lands on it. */

/* ── Metadata ────────────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const country = getCountry(params.country);
  const offer = await fetchOffer(params.id);
  if (!offer) {
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };
  }

  const url   = `${SITE_URL}/${country.code}/p/${offer.offer_id}`;
  const title = `${offer.title} at ${offer.store_name}`;
  const desc  = `Find ${offer.title} at ${offer.store_name} on Havlo. See cheaper alternatives across other stores in ${country.name}.`;

  return {
    title,
    description: desc.slice(0, 158),
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates(`p/${offer.offer_id}`),
    },
    openGraph: {
      type: "website",
      title: `${offer.title} · Havlo`,
      description: desc,
      url,
      siteName: "Havlo",
      images: offer.image_url ? [{ url: offer.image_url, width: 800, height: 800, alt: offer.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: offer.image_url ? [offer.image_url] : undefined,
    },
    robots: {
      index: offer.in_stock,
      follow: true,
      googleBot: {
        index: offer.in_stock,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default async function ProductPage({ params }: PageProps) {
  const country = getCountry(params.country);
  if (!COUNTRIES.some((c) => c.code === country.code)) notFound();

  const offer = await fetchOffer(params.id);
  if (!offer) notFound();

  /* Cheaper alternatives via the existing dupes pipeline. Pass the
     offer's price as the anchor so the dupes engine ranks rows
     cheaper-than-this-offer first; falls back to "no ceiling" for
     USD-priced rows that don't translate cleanly to NGN. */
  const anchorNgn = offerToNgnAnchor(offer);
  const dupes = await pgFtsFindDupes(offer.title, anchorNgn, { limit: 12 });

  /* Drop dupe-offers from stores that aren't appropriate for the
     visitor's market (e.g. NG-anchored Konga rows on a UK PDP).
     Same shape /api/compare/dupes already applies. */
  const filteredDupes = country.code === "ng"
    ? dupes
    : dupes
        .map((d) => ({
          ...d,
          offers: d.offers.filter((o) => isOfferAllowedForCountry(o, country)),
        }))
        .filter((d) => d.offers.length > 0);

  /* JSON-LD: Product schema (with offers) + BreadcrumbList. Google
     Rich Results use these for the price + availability badge in
     SERPs. Image, brand, category, price, currency, availability —
     each maps to a Schema.org Product field. */
  const heroData = offerRowToHero(offer);
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",          url: `${SITE_URL}/${country.code}` },
    { name: country.name,     url: `${SITE_URL}/${country.code}` },
    { name: "Products",       url: `${SITE_URL}/${country.code}/deals` },
    { name: offer.title,      url: `${SITE_URL}/${country.code}/p/${offer.offer_id}` },
  ]);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: offer.title,
    image: offer.image_url ? [offer.image_url] : undefined,
    brand: offer.brand ? { "@type": "Brand", name: offer.brand } : undefined,
    category: offer.category_slug ?? undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/${country.code}/p/${offer.offer_id}`,
      priceCurrency: offer.currency,
      price: offer.current_price,
      availability: offer.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: offer.store_name },
    },
  };

  return (
    <main className="bg-bg">
      <JsonLd data={breadcrumb} />
      <Script
        id="product-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Back link — to deals by default since most PDP visits arrive
            from /deals. Cheap navigation context that beats a bare
            browser-back button (which may not exist on direct PDP
            landings from a share link or SERP). */}
        <Link
          href={`/${country.code}/deals`}
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-ink-3 hover:text-ink transition-colors mb-5 sm:mb-7"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Back to deals
        </Link>

        <ProductHero offer={heroData} countryCode={country.code} />

        {filteredDupes.length > 0 && (
          <section className="mt-12 sm:mt-16">
            <header className="mb-6 sm:mb-8">
              <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
                Cheaper alternatives
              </h2>
              <p className="text-sm sm:text-base text-ink-2 mt-1.5">
                {filteredDupes.length} similar {filteredDupes.length === 1 ? "product" : "products"} we found across other stores. Sorted cheapest first.
              </p>
            </header>
            <SimilarProducts dupes={filteredDupes} />
          </section>
        )}
      </div>
    </main>
  );
}
