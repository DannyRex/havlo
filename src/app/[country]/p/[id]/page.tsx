/* /[country]/p/[id] — Product detail page.

   The PDP is RELATIVE TO A STORE: a single offer = a single deal at
   a single merchant. URL is the offer's stable UUID. The page renders
   the offer's image, title, price, and a "View at {Merchant}" CTA
   that routes through /api/go for affiliate wrapping. Below the
   hero, "Cheaper alternatives" reuses the same pgFtsFindDupes
   pipeline /compare relies on.

   ── Architecture (June 2026 streaming refactor) ──────────────────────
   This file renders only the CHEAP ISR SHELL server-side: the offer
   existence check, hero data, single-offer JSON-LD, breadcrumb, back
   link and keep-browsing rail. The expensive cross-store comparison
   (dupes + variant-match spectrum + price history + "you may also like"
   rail) lives in src/lib/offers/pdp-data.ts and is streamed CLIENT-side
   by <PdpInteractive> via the /api/pdp/[id] endpoint.

   Why: the route is ISR (see generateStaticParams below) so the edge can
   serve it cheaply, but Vercel BUFFERS a cold ISR render — it doesn't
   stream the loading.tsx boundary — so computing the heavy pipeline in
   the render froze a cold navigation on the previous page for ~1.5s with
   no skeleton. Moving the heavy work behind a client fetch keeps the ISR
   render fast (one offer read + one product-meta read), so a cold nav
   paints the hero + skeletons instantly and the comparison streams in.
   See <PdpInteractive> for the full rationale.

   SEO:
     - Per-page meta title + description from the offer's title + store
     - OpenGraph image = the product image
     - JSON-LD Product schema with a single Offer (price + availability +
       seller) so Google can show price + availability in rich results.
       The AggregateOffer (price RANGE across stores) was dropped in the
       streaming refactor because the cross-store pool is no longer
       computed server-side — the single Offer still carries the core
       commerce fields. Canonical URL is the country-aware /[country]/p/[id]
     - generateStaticParams returns [] (ISR on-demand, see below)

   Architecture mirrors /[country]/compare and /[country]/cashback:
     server-rendered shell, ProductHero client component for the
     interactive parts (cashback badge, image fallback, etc.),
     SimilarProducts a thin masonry around MasonryCard. */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getCountry, COUNTRIES, isOfferAllowedForCountry } from "@/lib/country";
import { SITE_URL, buildBreadcrumbList, buildHreflangAlternates, canonicalGtin, cleanMpn } from "@/lib/seo";
import { fetchOfferById, fetchOfferByProductId, type OfferRow } from "@/lib/offers/fetch-offer-by-id";
import { fetchProductMeta } from "@/lib/offers/fetch-product-description";
import { cleanTitle, formatPriceForUser, convertForUser, getClickThroughUrl } from "@/lib/utils";
import { getCategory } from "@/lib/data/categories";
import { slugifyBrand } from "@/lib/hubs";
import { merchantTrust } from "@/lib/merchant-trust";
import { displayStoreName } from "@/lib/store-display";
import { appendSignature } from "@/lib/go-signing";
import JsonLd from "@/components/seo/JsonLd";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import { type OfferData } from "@/components/product/ProductHero";
import PdpInteractive from "@/components/product/PdpInteractive";
import PdpViewTracker from "@/components/product/PdpViewTracker";
import PdpBackLink from "@/components/product/PdpBackLink";

/* Offers churn frequently (every ingest cycle adds + retires rows).
   ISR revalidate keeps the cached HTML fresh without re-rendering
   on every request. 1 hour is a sensible default — the underlying
   price/availability changes slowly enough that an hour of staleness
   is invisible to users, and the warm cache keeps SSR latency low. */
export const revalidate = 3600;

/* ── Static params ───────────────────────────────────────────────── */

/* Return an EMPTY set: we deliberately pre-render ZERO offer URLs at
   build time (offers churn every ingest cycle, so build-time snapshots
   would go stale within hours and waste build minutes). But the
   function MUST be present — a dynamic segment with NO
   generateStaticParams at all is classified `ƒ` (Dynamic), never enters
   the prerender/ISR manifest, and `export const revalidate` above then
   silently has NO effect: every request renders dynamically
   (x-vercel-cache: MISS, private/no-store) on the highest-traffic page
   on the site. Exporting generateStaticParams (even returning []) opts
   the route into static generation with fallback: blocking, so each
   unique offer URL is server-rendered on its FIRST hit and then served
   from the ISR cache (x-vercel-cache: HIT/PRERENDER) until the
   revalidate window — the on-demand caching this page always intended.
   dynamicParams keeps its default (true) so any offer id still renders
   on demand; we just don't seed the cache at build time.

   Verified via `next build`: without this the route is `ƒ` and absent
   from prerender-manifest.dynamicRoutes; with it the route is `●` with
   fallback: null (blocking ISR) and zero prewarmed paths. */
export function generateStaticParams(): { country: string; id: string }[] {
  return [];
}

interface PageProps {
  params: { country: string; id: string };
}

/* ── Data ────────────────────────────────────────────────────────── */
/* fetchOfferById + OfferRow live in lib/offers/fetch-offer-by-id.ts so
   /api/compare's oid-fallback path can reuse the same 3-source
   resolution (view / manual join / curated catalogue). The heavy
   comparison pipeline lives in lib/offers/pdp-data.ts (loadPdpData),
   shared by the /api/pdp/[id] endpoint this page streams from. */

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
    /* DB-authoritative anchor market (stores.country) so ProductHero's
       cross-border check resolves a UK/DE long-tail store to its real
       market instead of falling back to its USD-normalised currency
       and leaking an INTL badge / "≈ $X" line on its own PDP. */
    storeCountry:    row.store_country ?? null,
    inStock:         row.in_stock,
    scrapedAt:       row.scraped_at,
    /* Resolve trust server-side so the MERCHANTS table stays out of
       the client bundle. Drives the "Verified" eyebrow pill. */
    trust:           merchantTrust(row.store_id, row.store_name),
  };
}

/* ── Metadata ────────────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const country = getCountry(params.country);
  /* Resolve product_id FIRST (the stable canonical key), then offer_id
     (legacy/crawled URLs). React.cache dedups these across the body. */
  const offer = (await fetchOfferByProductId(params.id)) ?? (await fetchOfferById(params.id));
  if (!offer) {
    /* Missing/dead offer: noindex so crawlers drop the URL, and a title
       that matches the not-found.tsx boundary's "no longer available"
       copy. The response is still HTTP 200 (a matched dynamic-param route
       can't emit a real 404 on this stack — see not-found.tsx for the
       full why), but noindex keeps these out of the index regardless. */
    return {
      title: "Product no longer available",
      /* index:false drops the dead URL; follow:true (was nofollow — June
         2026 GSC audit) lets crawlers flow through the dead-end's links
         (categories, /deals) so equity into a churned PDP isn't stranded. */
      robots: { index: false, follow: true },
    };
  }

  /* Canonical = the STABLE product_id URL, never the volatile offer_id. */
  const canonicalId = offer.product_id ?? offer.offer_id;
  const url   = `${SITE_URL}/${country.code}/p/${canonicalId}`;
  /* Use the same cleaned title + display store name the hero renders,
     so the SERP entry matches the page (no raw "Amazon.co.uk -
     Amazon.co.uk-Seller" strings leaking into Google). */
  const name  = cleanTitle(offer.title);
  const store = displayStoreName(offer.store_name);
  /* offer.currency is normalised to NGN|USD by the time it reaches the
     PDP (OfferData.currency). Map anything else to NGN — the same
     default convertToUserCurrency uses — so this price matches the
     hero's displayed price exactly. */
  const srcCcy = offer.currency === "USD" ? "USD" : "NGN";
  const price  = formatPriceForUser(offer.current_price, country, srcCcy);

  /* Title leads with the product (primary keyword) + local price
     intent + brand. We deliberately do NOT bake a live store COUNT
     into the title: the visible "compare N stores" number comes from a
     multi-stage dupes/partition/country-filter pipeline in the page
     body, and a title asserting a count that disagrees with the
     rendered page would be worse than a count-free frame (and clashes
     with the honest single-store framing the PDP already does). The
     price leads the description instead, where it survives the SERP
     cap and carries the most CTR. The root layout's title template
     ("%s · Havlo") appends the brand, so we don't add it here. */
  const title = `${name} Price in ${country.name}`;

  /* Price-led description, value front-loaded so the price + store +
     comparison promise survive the 158-char SERP cap even when the
     product name is long. "From {price}" keeps the price-as-observed
     framing honest (there may be a cheaper store). Out-of-stock PDPs
     are noindex below, so the in-stock branch owns the indexable copy;
     the OOS branch leans on the price-alert hook instead of a price
     that may no longer be buyable.

     "Updated multiple times a week" replaces the old "updated daily"
     (June 2026 honesty pass): SerpAPI-sourced prices refresh Mon/Wed/Fri
     and the free-source scrape runs daily, so the whole catalog is
     refreshed at least three times a week — "daily" overclaimed for the
     SerpAPI majority. */
  const desc = offer.in_stock
    ? `From ${price} at ${store}. Compare live prices for ${name} across ${country.name} stores and find the cheapest place to buy. Prices updated multiple times a week on Havlo.`
    : `Compare live prices for ${name} across ${country.name} stores on Havlo. Track the price and get alerted the moment it drops.`;
  /* Trim on a word boundary with an ellipsis rather than a hard
     mid-word slice. U+2026, not an em dash. */
  const metaDesc = desc.length > 158
    ? `${desc.slice(0, 157).replace(/\s+\S*$/, "")}…`
    : desc;

  return {
    title,
    description: metaDesc,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates(`p/${canonicalId}`),
    },
    openGraph: {
      type: "website",
      title: `${name} · Havlo`,
      description: metaDesc,
      url,
      siteName: "Havlo",
      images: offer.image_url ? [{ url: offer.image_url, width: 800, height: 800, alt: name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · Havlo`,
      description: metaDesc,
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

/* Synthetic-id prefixes (mirrors src/lib/pdp-url.ts's isSyntheticId).
   When a user lands on /[country]/p/aliex-{id} (or paapi-/konga-/serp-)
   directly — typed URL, bookmark, share link from before the May-2026
   routing fix — the offers table has no row for that ID and
   fetchOfferById returns null. Best-effort UX: redirect to /deals so
   the visitor sees real products instead of a 404 dead end. */
const SYNTHETIC_PDP_PREFIXES = ["aliex-", "paapi-", "konga-", "serp-"];

export default async function ProductPage({ params }: PageProps) {
  const country = getCountry(params.country);
  if (!COUNTRIES.some((c) => c.code === country.code)) notFound();

  /* Synthetic-id soft redirect — see SYNTHETIC_PDP_PREFIXES comment.
     User report May 2026: /ng/p/aliex-1005007312017504 returned a hard
     404 when typed/shared even though the link-generation path
     (pdpUrlForOffer) routes those correctly to /p/live. */
  if (SYNTHETIC_PDP_PREFIXES.some((p) => params.id.startsWith(p))) {
    redirect(`/${country.code}/deals`);
  }

  /* Colon-prefixed anchor keys ('oid:<uuid>', 'live:<slug>') come from
     /api/compare when the underlying product_id is missing (orphaned by
     the resignature migration, or live-search result). Strip the prefix
     and try the UUID lookup; if that still misses, soft-redirect to
     /deals rather than hard-404. */
  if (params.id.includes(":")) {
    const stripped = params.id.split(":").slice(1).join(":");
    const fallbackOffer = await fetchOfferById(stripped);
    if (!fallbackOffer) redirect(`/${country.code}/deals`);
    params.id = stripped;
  }

  /* Resolve product_id FIRST (stable canonical), offer_id as fallback for
     legacy/crawled URLs. React.cache dedups with generateMetadata. */
  const offer = (await fetchOfferByProductId(params.id)) ?? (await fetchOfferById(params.id));
  if (!offer) notFound();
  /* Stable canonical key for every URL this page emits (canonical, OG,
     breadcrumb, JSON-LD @id, productID). product_id never churns. */
  const canonicalId = offer.product_id ?? offer.offer_id;

  /* products.description / gtin / mpn for the JSON-LD. The ONE remaining
     server-side DB read besides the offer itself — kept here (not moved
     to the client pipeline) because the structured data must be in the
     initial crawlable HTML. Cached 1h, tagged so a description backfill
     can invalidate it. The heavy comparison reads stream client-side. */
  const fetchProductMetaCached = unstable_cache(
    async (productId: string) => fetchProductMeta(productId),
    ["pdp-product-meta"],
    { revalidate: 3600, tags: ["pdp-product-description"] },
  );
  const productMeta = offer.product_id ? await fetchProductMetaCached(offer.product_id) : null;
  const productDescriptionRaw = productMeta?.description ?? null;

  /* Cross-border check — PURE (no IO), so it stays server-side and drives
     the hero banner immediately. The local ALTERNATIVE inside the banner
     needs the heavy anchor pool, so it streams in with PdpInteractive's
     /api/pdp fetch (undefined until then → the banner renders its
     "visit the store to confirm shipping" variant in the meantime). */
  const isLocallyShoppable = isOfferAllowedForCountry(
    {
      storeId:         offer.store_id,
      storeName:       offer.store_name,
      isInternational: offer.is_international,
      /* DB-tagged country anchor — primary signal in
         isOfferAllowedForCountry; avoids the JS COUNTRY_STORES roster
         fallback that mis-flagged DB-tagged stores (e.g. `onbuy` UK). */
      storeCountry:    offer.store_country ?? null,
    },
    country,
  );

  const heroData = offerRowToHero(offer);

  /* Display label for the category crumb + keep-browsing link. Pure
     registry lookup, no IO — categories.ts owns the canonical name
     ("Home & Kitchen" not "home"); fall back to a plain capitalised
     slug when the slug isn't in the registry. */
  const fallbackCategoryName = offer.category_slug
    ? getCategory(offer.category_slug)?.name ??
      offer.category_slug.charAt(0).toUpperCase() + offer.category_slug.slice(1)
    : null;

  /* Brand-hub slug for the keep-browsing rail (M2 de-orphaning). Empty
     when the offer has no usable brand — slugifyBrand trims + normalises
     so a whitespace-only brand collapses to "" and the rail link is
     suppressed rather than pointing at /[cc]/brand/ with an empty slug. */
  const brandHubSlug = offer.brand ? slugifyBrand(offer.brand) : "";

  /* JSON-LD: Product schema (single Offer) + BreadcrumbList. */
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
    { name: "Products",   url: `${SITE_URL}/${country.code}/deals` },
    /* Category crumb — links the PDP UP to its category hub
       (/[cc]/deals/[slug]). Part of the M2 de-orphaning chain. Emitted
       only when the offer carries a category slug we can name. */
    ...(offer.category_slug && fallbackCategoryName
      ? [{
          name: fallbackCategoryName,
          url:  `${SITE_URL}/${country.code}/deals/${offer.category_slug}`,
        }]
      : []),
    { name: offer.title,  url: `${SITE_URL}/${country.code}/p/${canonicalId}` },
  ]);

  const productUrl = `${SITE_URL}/${country.code}/p/${canonicalId}`;
  /* JSON-LD description: prefer the real merchant body when we have one
     (richer, on-topic prose Google's NLP weights highly), fall back to
     the templated line otherwise. Cap at 500 chars; strip inline HTML so
     entities and tags don't pollute the JSON. */
  const merchantDescriptionForLd = productDescriptionRaw
    ? productDescriptionRaw
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500)
    : null;
  /* Marketplace listings (eBay etc.) often set the "description" to the
     product TITLE, which already heads the About section — so rendering it as
     body prose just echoes the title (the "dell inspiron ... / dell inspiron
     ... / Havlo tracks the dell inspiron ..." repetition). Detect a
     description that IS the title (or the title plus a few trailing chars) and
     treat it as no-description, so the About block renders the templated
     variant once instead of three times. */
  const normForCompare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const descNorm  = normForCompare(merchantDescriptionForLd ?? "");
  const titleNorm = normForCompare(offer.title);
  const descIsJustTitle = !!descNorm && (
    descNorm === titleNorm ||
    (descNorm.startsWith(titleNorm)  && descNorm.length  - titleNorm.length < 30) ||
    (titleNorm.startsWith(descNorm)  && titleNorm.length - descNorm.length  < 30)
  );
  const hasRealDescription =
    !!merchantDescriptionForLd && merchantDescriptionForLd.length >= 50 && !descIsJustTitle;
  const productDescription = hasRealDescription && merchantDescriptionForLd
    ? merchantDescriptionForLd
    : offer.brand
      ? `${offer.title} from ${offer.brand}. Compare prices across stores in ${country.name} on Havlo. See similar products for less.`
      : `${offer.title}. Compare prices across stores in ${country.name} on Havlo. See similar products for less.`;
  const priceValidUntil = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  /* Single Offer block (the AggregateOffer price-range variant was
     dropped in the June 2026 streaming refactor — the cross-store pool
     is no longer computed server-side). Price is emitted in the VISITOR's
     display currency via convertForUser, the SAME conversion the visible
     on-page price uses, so the structured data can't contradict the page. */
  const offerBlock = {
    "@type":       "Offer",
    url:           productUrl,
    priceCurrency: country.currency,
    price:         Math.round(convertForUser(offer.current_price, country, offer.currency === "USD" ? "USD" : "NGN") * 100) / 100,
    availability:  offer.in_stock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    seller:        { "@type": "Organization", name: displayStoreName(offer.store_name) },
    priceValidUntil,
  };

  /* Validated commerce identifiers. canonicalGtin rejects junk in the
     gtin column (internal SKUs that fail the GTIN check digit); cleanMpn
     drops empty/oversized part numbers. Both return null when unusable
     so the spread omits the field rather than emitting a flagged id. */
  const gtin = canonicalGtin(productMeta?.gtin);
  const mpn  = cleanMpn(productMeta?.mpn);

  const productSchema = {
    "@context":         "https://schema.org",
    "@type":            "Product",
    "@id":              productUrl,
    name:               offer.title,
    description:        productDescription,
    image:              offer.image_url ? [offer.image_url] : undefined,
    brand:              offer.brand ? { "@type": "Brand", name: offer.brand } : undefined,
    category:           offer.category_slug ?? undefined,
    sku:                offer.offer_id,
    productID:          canonicalId,
    ...(gtin ? { gtin } : {}),
    ...(mpn  ? { mpn }  : {}),
    mainEntityOfPage:   productUrl,
    dateModified:       offer.scraped_at,
    offers:             offerBlock,
  };

  /* Signed server-side — see go-signing.ts. ProductHero (rendered inside
     PdpInteractive) is a client component and can't hold the HMAC secret. */
  const signedOutboundUrl = appendSignature(getClickThroughUrl({
    url:       heroData.url,
    id:        heroData.offerId,
    title:     heroData.title,
    storeId:   heroData.storeId,
    storeName: heroData.storeName,
    country:   country.code,
  }));

  return (
    <main className="bg-bg">
      {/* JSON-LD: breadcrumb + product, both server-rendered inline so
          Google's initial crawl picks them up (vs a hydration-deferred
          next/script). */}
      <JsonLd data={[breadcrumb, productSchema]} />

      {/* PDP view event capture — fire-and-forget client effect. Does not
          block render or critical-path interaction. */}
      <PdpViewTracker productId={offer.product_id} offerId={offer.offer_id} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Back link — context-aware via document.referrer. Defaults to
            /[country]/deals; upgrades to the referrer when the visitor
            came from /compare. */}
        <PdpBackLink countryCode={country.code} />

        {/* Hero + comparison + rails. PdpInteractive renders the hero CORE
            instantly from heroData (server-passed) and streams the heavy
            comparison (price bar, store count, "you may also like" rail,
            price chart, other configs) from /api/pdp/[id] with skeletons.
            Keeps the ISR render cheap so a cold navigation paints the
            shell immediately instead of freezing on the previous page. */}
        <PdpInteractive
          offer={heroData}
          countryCode={country.code}
          signedOutboundUrl={signedOutboundUrl}
          isLocallyShoppable={isLocallyShoppable}
        />

        {/* About / details — SERVER-RENDERED unique body text.
            The merchant description was previously fed ONLY to the Product
            JSON-LD; the visible PDP was almost text-free (title + widgets +
            "keep browsing" links), which is exactly the thin-content profile
            Google parks in "Crawled - currently not indexed" (GSC). Surfacing
            the real description here gives each page genuine, unique, on-topic
            prose (and is useful to shoppers); a truthful templated line is the
            floor when no merchant body exists. No em dashes / no "surface"
            verb per the house voice rules. */}
        <section className="mt-12 sm:mt-16 pt-8 border-t border-border" aria-label="Product details">
          {hasRealDescription ? (
            <>
              <h2 className="text-base font-semibold text-ink mb-3">
                About the {offer.title}
              </h2>
              <p className="text-[15px] text-ink-2 leading-relaxed max-w-2xl">
                {merchantDescriptionForLd}
              </p>
              <p className="text-[13px] text-ink-3 leading-relaxed max-w-2xl mt-4">
                Havlo tracks its price across the stores we cover in {country.name} and keeps a price history. Currently listed at {displayStoreName(offer.store_name)}.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-ink mb-3">
                The {offer.title} in {country.name}
              </h2>
              <p className="text-[15px] text-ink-2 leading-relaxed max-w-2xl">
                Havlo checks this price against the other stores we cover in {country.name} and tracks how it moves over time. Currently listed at {displayStoreName(offer.store_name)}.
              </p>
            </>
          )}
        </section>

        {/* Keep-browsing rail — crawlable hub links (M2 de-orphaning).
            Server-rendered <Link>s so they sit in the crawlable HTML, not
            behind hydration. */}
        <nav aria-label="Keep browsing" className="mt-12 sm:mt-16 pt-8 border-t border-border">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-3 mb-4">
            Keep browsing
          </h2>
          <div className="flex flex-wrap gap-2">
            {offer.category_slug && fallbackCategoryName ? (
              <Link
                href={`/${country.code}/deals/${offer.category_slug}`}
                className="px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
              >
                More {fallbackCategoryName} deals
              </Link>
            ) : null}
            {brandHubSlug ? (
              <Link
                href={`/${country.code}/brand/${brandHubSlug}`}
                className="px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
              >
                All {offer.brand} prices
              </Link>
            ) : null}
            <Link
              href={`/${country.code}/deals`}
              className="px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
            >
              All {country.name} deals
            </Link>
            <Link
              href={`/${country.code}/brands`}
              className="px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
            >
              Shop by brand
            </Link>
          </div>
        </nav>
      </div>
      {/* Newsletter signup at the bottom of the PDP. */}
      <NewsletterStrip />
    </main>
  );
}
