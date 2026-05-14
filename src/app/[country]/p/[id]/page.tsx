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
import { unstable_cache } from "next/cache";
import { COUNTRIES } from "@/lib/country";
import { SITE_URL, buildBreadcrumbList, buildHreflangAlternates } from "@/lib/seo";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { pgFtsFindDupes } from "@/lib/search/pg-fts";
import { isOfferAllowedForCountry } from "@/lib/country";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";
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
  /** Undefined when sourced from product_best_offers (the view
      filters for in_stock=true by construction and the column
      doesn't propagate). Treated as "in stock" downstream. */
  in_stock: boolean | undefined;
  title: string;
  category_slug: string | null;
  brand: string | null;
  image_url: string | null;
  store_name: string;
  store_logo_url: string | null;
}

/* Fetch a single offer by its ID. Three sources, tried in order:
     1. product_best_offers view (fast, ~50% of /deals clicks).
     2. offers + products + stores manual join (every DB-backed offer).
     3. curated-amazon static catalogue (the in-memory baseline for
        Amazon's 5 marketplaces, IDs like `amazon-us-iphone-15-pro-max`
        that aren't in the DB at all).
   Returns null on miss → page falls through to notFound(). */
async function fetchOffer(offerId: string): Promise<OfferRow | null> {
  const supa = getSupabaseAdmin();

  /* Try the joined view first. */
  if (supa) {
    const { data: viewRow } = await supa
      .from("product_best_offers")
      .select("*")
      .eq("offer_id", offerId)
      .maybeSingle();

    if (viewRow) {
      /* The product_best_offers view filters for in_stock=true via a
         lateral join and drops the column from its projection. Default
         to true so the out-of-stock badge doesn't misfire across every
         PDP (the bug user reported May 2026: "all products say Last
         seen unavailable"). */
      return {
        ...(viewRow as Omit<OfferRow, "in_stock">),
        in_stock: true,
      };
    }

    /* Fall back to the offers + products + stores join. Slower (two
       more network hops) but covers every offer in the catalog. */
    const { data: offer } = await supa
      .from("offers")
      .select("id, product_id, store_id, url, current_price, original_price, discount_percent, currency, in_stock, scraped_at")
      .eq("id", offerId)
      .maybeSingle();

    if (offer) {
      const [{ data: product }, { data: store }] = await Promise.all([
        supa.from("products").select("title, category_slug, brand, image_url").eq("id", offer.product_id).maybeSingle(),
        supa.from("stores").select("name, logo_url").eq("id", offer.store_id).maybeSingle(),
      ]);
      if (product && store) {
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
          /* offers.in_stock has a `default true` in the schema so a
             missing/null value is treated as in-stock. Only explicit
             false renders the out-of-stock tile in ProductHero. */
          in_stock: offer.in_stock ?? true,
          title: product.title,
          category_slug: product.category_slug,
          brand: product.brand,
          image_url: product.image_url,
          store_name: store.name,
          store_logo_url: store.logo_url,
        };
      }
    }
  }

  /* Curated Amazon fallback — handles IDs like
     `amazon-us-iphone-15-pro-max` (5 marketplaces x ~15 products =
     ~75 stable URLs that aren't in the offers table). Without this,
     clicking a curated card on /deals 404s the PDP. */
  const curated = curatedAmazonDeals.find((d) => d.id === offerId);
  if (curated) {
    return {
      offer_id: curated.id,
      /* Curated rows have no product_id (they're not in the products
         table). Use the id as a synthetic key — the PDP only reads
         this for the dupes anchor, and pgFtsFindDupes ranks by title
         similarity regardless of key value. */
      product_id: curated.id,
      store_id: curated.storeId,
      url: curated.url,
      current_price: curated.salePrice,
      original_price: curated.originalPrice ?? curated.salePrice,
      discount_percent: curated.discountPercent ?? 0,
      currency: curated.currency,
      scraped_at: curated.postedAt + "T00:00:00Z",
      in_stock: true,
      title: curated.title,
      category_slug: curated.categorySlug,
      brand: null,
      image_url: curated.imageUrl ?? null,
      store_name: curated.storeName,
      store_logo_url: `/logos/${curated.storeId}.png`,
    };
  }

  return null;
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

/* No anchor-price ceiling is passed to pgFtsFindDupes anymore.
   The previous behaviour (cap candidates at the anchor's NGN price)
   hid every alternative listed at or above the anchor's price,
   which made many PDPs show "0 alternatives" even when /deals
   had multiple matches for the same title.
   pgFtsFindDupes treats anchorPriceNgn === 0 as "no ceiling, rank
   by FTS similarity alone" — exactly what we want here. */

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

  /* Similar products via the dupes engine. anchorPriceNgn=0 means
     "no price ceiling" — rank by FTS similarity alone. Previously
     we passed the anchor's NGN price which silently hid every
     candidate priced at or above the anchor, producing empty
     alternative rails even when /deals showed multiple matches for
     the same title (user report May 2026: "filter by iPhone 15 Pro
     shows multiple products on /deals but PDP shows no cheaper
     alternatives"). */
  /* Cached dupes fetch — wraps pgFtsFindDupes in unstable_cache so
     repeat PDP loads within the 5-minute window don't re-run the
     FTS + per-product offer hydration. Cache key includes the
     anchor title (the only thing the FTS query depends on). 5-min
     TTL is tighter than the page's 1-hour ISR window, so the cache
     can't drift further than the page itself.

     Limit halved from 16 → 8 May 2026 to relieve Supabase egress
     (pgFtsFindDupes hydrates per-product offer rows). 8 hydrated
     candidates is enough headroom for the country filter below to
     drop a couple and still feel populated. */
  const fetchDupesCached = unstable_cache(
    async (title: string) => pgFtsFindDupes(title, 0, { limit: 8 }),
    ["pdp-dupes"],
    { revalidate: 300, tags: ["pdp-dupes"] },
  );
  const dupes = await fetchDupesCached(offer.title);

  /* Drop dupe-offers from stores that aren't appropriate for the
     visitor's market (e.g. NG-anchored Konga rows on a UK PDP).
     Same shape /api/compare/dupes already applies. */
  const countryFilteredDupes = country.code === "ng"
    ? dupes
    : dupes
        .map((d) => ({
          ...d,
          offers: d.offers.filter((o) => isOfferAllowedForCountry(o, country)),
        }))
        .filter((d) => d.offers.length > 0);

  /* Drop the anchor product itself from the "You may also like" rail.
     pgFtsFindDupes returns every product matching the title — including
     the anchor (same title, by definition, scores high). User report
     May 2026: "remove the current product in view if it's in YML."
     Three signals identify the anchor:
       1. d.key === anchor product_id (DupeResult.key IS product_id —
          see pgFtsFindDupes return shape).
       2. d.offers contains the anchor offer_id (covers curated Amazon
          rows whose product_id is a synthetic slug, not the same UUID
          shape — the offer-id check catches them).
       3. d.title exactly matches the anchor title (last-resort
          defensive — should only fire for products that have
          incomparable IDs across surfaces).

     Also dedupe by best-offer id so the rail can't surface two groups
     that resolve to the same /p/[id] link (defensive — dupes engine
     already groups by signature, but FTS scoring can occasionally
     split near-identical titles into separate groups). */
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const seenStoreTitle = new Set<string>();
  /* Normalise titles by stripping ALL non-alphanumeric characters and
     lowercasing. Catches the cases the original whitespace-collapse
     missed: invisible Unicode, smart-quotes, en-dash vs hyphen,
     trailing punctuation variants. "Fashion Nova Alena Pleated Crepe
     Mini Dress" and "Fashion-Nova: Alena Pleated Crepe Mini Dress"
     collapse to the same key. */
  const normaliseTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const filteredDupes = countryFilteredDupes.filter((d) => {
    if (offer.product_id && d.key === offer.product_id) return false;
    if (offer.offer_id && d.offers.some((o) => o.offerId === offer.offer_id)) return false;
    if (offer.title && normaliseTitle(d.title) === normaliseTitle(offer.title)) return false;
    /* Dedupe by best-offer id (defensive — dupes engine already
       groups by signature, but FTS scoring sometimes splits near-
       identical titles into separate groups). */
    const best = [...d.offers].sort((a, b) => a.landedPrice - b.landedPrice)[0];
    const id = best?.offerId || (best?.storeId + ":" + d.key);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    /* Title-key + store-title-key dedupes.

       title-key: catches dupes where two DupeResults share a title
       (FTS engine occasionally splits identical titles across keys
       when ingest left slight signature variance).

       store-title-key: catches the user-reported May 2026 case where
       /us/p/{fashion-nova-mini-dress} surfaced "Fashion Nova Alena
       Pleated Crepe Mini Dress" twice — once at $13 and once at $16.
       Same merchant, same title, different SKU variants (different
       size or color). Each variant has its own product_id so
       title-only dedupe wouldn't catch it — but the SAME merchant
       offering the SAME named item at two prices is, from the
       shopper's perspective, the same product. Keep the cheapest;
       drop the rest. */
    const titleKey = normaliseTitle(d.title);
    if (seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    const storeTitleKey = `${best?.storeId ?? ""}|${titleKey}`;
    if (seenStoreTitle.has(storeTitleKey)) return false;
    seenStoreTitle.add(storeTitleKey);
    return true;
  });

  /* JSON-LD: Product schema (with offers) + BreadcrumbList. Google
     Rich Results use these for the price + availability badge in
     SERPs. Image, brand, category, price, currency, availability —
     each maps to a Schema.org Product field. */
  const heroData = offerRowToHero(offer);

  /* Count of unique in-stock stores that carry THIS exact product.
     Drives the "Compare prices across N stores" CTA so the number
     matches what the user lands on after clicking — /compare's
     anchor-card header reads "Across N stores" where N is the
     anchor product's offer count. Same product_id → same count.

     Previous version counted anchor + similar-products' stores,
     which double-counted retailers and didn't match /compare's
     display. User report May 2026: "compare price across x stores
     doesn't align with the number of stores on the compare page."

     Curated Amazon PDPs (product_id is the synthetic slug, not a
     real DB row) have a single anchor store — Amazon — so the
     fallback to 1 is correct for that path. */
  let totalStores = 1;
  const supaForCount = getSupabaseAdmin();
  if (supaForCount && offer.product_id && !offer.offer_id.startsWith("amazon-")) {
    const { data: siblingOffers } = await supaForCount
      .from("offers")
      .select("store_id")
      .eq("product_id", offer.product_id)
      .eq("in_stock", true);
    if (siblingOffers && siblingOffers.length > 0) {
      totalStores = new Set(siblingOffers.map((o) => o.store_id)).size;
    }
  }
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",          url: `${SITE_URL}/${country.code}` },
    { name: country.name,     url: `${SITE_URL}/${country.code}` },
    { name: "Products",       url: `${SITE_URL}/${country.code}/deals` },
    { name: offer.title,      url: `${SITE_URL}/${country.code}/p/${offer.offer_id}` },
  ]);

  /* Price-vs-market stats. Reads the cheapest landedPrice (which is
     country-aware after the May 2026 effectiveLandedPrice fix —
     local stores use base price, cross-border keeps the ~30%
     landed estimate). Limits to dupes that have at least one offer
     after country filtering, so the comparison reflects what the
     user can actually click through to.

     Math: anchor price = offer.current_price; dupe prices = each
     dupe's cheapest offer (already country-filtered above). Both
     stay in NGN until the UI converts via formatPriceForUser. */
  const dupePricesNgn: number[] = filteredDupes.flatMap((d) => {
    const cheapestOffer = [...d.offers].sort((a, b) => a.landedPrice - b.landedPrice)[0];
    return cheapestOffer ? [cheapestOffer.landedPrice] : [];
  });
  const priceStats = dupePricesNgn.length > 0
    ? {
        lowest:  Math.min(offer.current_price, ...dupePricesNgn),
        highest: Math.max(offer.current_price, ...dupePricesNgn),
        count:   dupePricesNgn.length,
      }
    : undefined;

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

        <ProductHero
          offer={heroData}
          countryCode={country.code}
          totalStores={totalStores}
          priceStats={priceStats}
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

        {/* Live deals rail removed (May 2026).
            Earlier this surface fetched /api/live-search on mount,
            burning a SerpAPI credit per PDP visit regardless of
            whether the user actually looked at the rail. The DB-
            backed SimilarProducts rail above already covers the
            "show me alternatives" intent for ~95% of products, and
            the "Compare prices across N stores" CTA on the hero
            already routes to /compare for users who want the
            broader live-search view. Net: cleaner page + no per-
            visit SerpAPI cost.

            The LiveAlternatives component file stays in the
            codebase — keep it around in case we want to revive the
            pattern as an opt-in toggle later. */}
      </div>
    </main>
  );
}
