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
import { notFound, redirect } from "next/navigation";
import Script from "next/script";

import { getCountry } from "@/lib/country";
import { unstable_cache } from "next/cache";
import { COUNTRIES } from "@/lib/country";
import { SITE_URL, buildBreadcrumbList, buildHreflangAlternates } from "@/lib/seo";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { pgFtsFindDupes, pgFtsAnchorOffersByProductId } from "@/lib/search/pg-fts";
import { isOfferAllowedForCountry, filterDealsForCountry } from "@/lib/country";
import { effectiveLandedPrice } from "@/lib/landed-price";
import { usdToNgn } from "@/lib/utils";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getCategory } from "@/lib/data/categories";
import JsonLd from "@/components/seo/JsonLd";
import ProductHero, { type OfferData } from "@/components/product/ProductHero";
import SimilarProducts from "@/components/product/SimilarProducts";
import FallbackCategoryRail from "@/components/product/FallbackCategoryRail";
import PdpBackLink from "@/components/product/PdpBackLink";
import type { Deal } from "@/types";

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

/* Synthetic-id prefixes (mirrors src/lib/pdp-url.ts's
   isSyntheticId). When a user lands on /[country]/p/aliex-{id}
   (or paapi-/konga-/serp-) directly — typed URL, bookmark, share
   link from before the May-2026 routing fix — the offers table
   has no row for that ID and fetchOffer returns null, which used
   to call notFound() and return a hard 404.

   Live-search synthetic IDs aren't persisted (live-search persist
   is paused for Supabase egress), so we can't recover the
   product data without re-running the SerpAPI / AliExpress query.
   Best-effort UX: redirect to /deals so the visitor sees real
   products instead of a 404 dead end. The route's metadata stays
   noindex so Google doesn't have us indexing dead URLs anyway. */
const SYNTHETIC_PDP_PREFIXES = ["aliex-", "paapi-", "konga-", "serp-"];

export default async function ProductPage({ params }: PageProps) {
  const country = getCountry(params.country);
  if (!COUNTRIES.some((c) => c.code === country.code)) notFound();

  /* Synthetic-id soft redirect — see SYNTHETIC_PDP_PREFIXES
     comment. User report May 2026: /ng/p/aliex-1005007312017504
     returned a hard 404 when typed/shared as a URL even though
     the link-generation path (pdpUrlForOffer) routes those
     correctly to /p/live. */
  if (SYNTHETIC_PDP_PREFIXES.some((p) => params.id.startsWith(p))) {
    redirect(`/${country.code}/deals`);
  }

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

  /* Anchor price normalised to NGN — needed UP HERE so the dupe
     price-band gate (filteredDupes below) can reference it. Moved
     from its prior location below filteredDupes when the band gate
     was added May 2026. Same conversion as before:
     USD anchors via usdToNgn, NGN anchors passthrough. */
  const anchorPriceNgn = offer.currency === "USD"
    ? usdToNgn(offer.current_price)
    : offer.current_price;

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
  const seenStoreTitle = new Set<string>();
  /* Normalise titles for comparison — strip non-alphanumerics +
     lowercase. Catches invisible Unicode, smart-quotes, en-dash vs
     hyphen, trailing punctuation. */
  const normaliseTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  /* Price-band guardrails for alternatives. Without these, an
     anchor at £60 could surface a £5 alternative ("AirPods Max
     silicone cover" matching "AirPods Max") or a £300 alternative
     ("Pro Max bundle with accessories"). Both erode user trust:
     they imply the alternative is the same product when it's
     clearly not. User report May 2026: "when the comparison
     difference is really large, like 5GBP and 100GBP for example,
     it could mean they're not the same product and may affect
     user's trust."

     Bounds chosen so legitimate deep discounts (up to 75% off) and
     legitimate premium configurations (256GB → 512GB phone variants,
     ~+50%) survive, but the obvious mismatches get filtered. The
     band shrinks naturally for cheap anchors (£5 anchor → £1.25–£15
     band, which is fine since most products in our catalogue are
     above £10 anyway). */
  const FLOOR_RATIO   = 0.25;  // alt ≥ 25% of anchor (drops "£5 vs £100" cases)
  const CEILING_RATIO = 3.00;  // alt ≤ 3x anchor   (drops "£100 vs £300+ bundle" cases)
  const filteredDupes = countryFilteredDupes.filter((d) => {
    /* Drop the ANCHOR product itself. Two signals:
         1. d.key === anchor.product_id — exact same product row.
         2. d.offers contains the anchor's own offer_id.

       NOTE: removed the prior "same-store + same-title = drop"
       hard filter (May 2026). That filter wiped out legitimate
       different listings of the same product at marketplaces like
       AliExpress, where multiple sellers (or even the same seller
       at different price points) list the same item. User report:
       a £60 umbrella PDP couldn't see the £54 alternative
       listing — both AliExpress, identical title, different
       offer_ids. The seenStoreTitle dedupe below already collapses
       same-store same-title to the CHEAPEST representative, so
       relaxing the hard drop here doesn't introduce spam. */
    if (offer.product_id && d.key === offer.product_id) return false;
    if (offer.offer_id && d.offers.some((o) => o.offerId === offer.offer_id)) return false;

    /* Price-band gate. The dupe's CHEAPEST offer must sit within
       [anchor * FLOOR_RATIO, anchor * CEILING_RATIO]. Only applies
       when we have an anchor price to compare against. */
    if (anchorPriceNgn > 0) {
      const best = [...d.offers].sort((a, b) => a.landedPrice - b.landedPrice)[0];
      if (best) {
        if (best.landedPrice < anchorPriceNgn * FLOOR_RATIO)   return false;
        if (best.landedPrice > anchorPriceNgn * CEILING_RATIO) return false;
      }
    }

    /* Dedupe by best-offer id (defensive — dupes engine already
       groups by signature, but FTS scoring sometimes splits near-
       identical titles into separate groups). */
    const best = [...d.offers].sort((a, b) => a.landedPrice - b.landedPrice)[0];
    const id = best?.offerId || (best?.storeId + ":" + d.key);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    /* Same-store + same-title dedupe — keeps the cheapest
       representative when a merchant has multiple listings of the
       same product (Fashion Nova SKU variants, AliExpress
       multi-seller listings). Different store + same title is a
       legit cross-store alternative and falls through this check
       because storeTitleKey differs. */
    const titleKey = normaliseTitle(d.title);
    const storeTitleKey = `${best?.storeId ?? ""}|${titleKey}`;
    if (seenStoreTitle.has(storeTitleKey)) return false;
    seenStoreTitle.add(storeTitleKey);
    return true;
  });

  /* Fallback rail — when FTS finds no usable dupes, the rest of
     the PDP would render as a hero + a blank wall. User report
     May 2026: "shouldn't there always be similar items in the PDP
     page?" Yes — always show SOMETHING below the hero so the page
     doesn't feel abandoned.

     Strategy (in order of preference):
       1. Same-category deals, country-filtered (most relevant).
       2. Trending deals across all categories (last resort — only
          fires when the offer has no category_slug AND categorical
          fallback returned nothing).

     The category fetch runs against the active browse provider and
     reuses the country filter we apply everywhere else, so a UK
     visitor doesn't see Konga rows in their "More from Electronics"
     fallback. Limit 8 matches SimilarProducts so the visual rhythm
     stays consistent.

     Skipped entirely when filteredDupes already has rows — that's
     ~95% of PDPs (per the rate noted on the LiveAlternatives
     removal comment) so the extra fetch only runs for the long
     tail of products without DB-matched alternatives.

     Cache key includes category + country so the fallback rail
     stays per-country aware. 5-min TTL is tighter than the page's
     1-hour ISR so the rail can't drift further than the page. */
  let fallbackDeals: Deal[] = [];
  if (filteredDupes.length === 0) {
    const fetchFallbackCached = unstable_cache(
      async (categorySlug: string | null, countryCode: string) => {
        const provider = await getActiveBrowseProvider();
        const deals = await provider.fetchDeals({
          /* `categorySlug: undefined` falls through to "all" inside the
             provider — which is exactly the trending-deals fallback we
             want when the anchor has no category. */
          categorySlug: categorySlug ?? undefined,
          minDiscount:  0,
          origin:       "all",
        });
        return deals;
      },
      ["pdp-fallback"],
      { revalidate: 300, tags: ["pdp-fallback"] },
    );
    const raw = await fetchFallbackCached(offer.category_slug, country.code);
    const countryFiltered = filterDealsForCountry(raw, country);

    /* Exclude the anchor offer + any offer that's a same-store match
       on title (covers the SKU-variant case where a merchant lists
       the same display title at two prices). Same shape as the
       dupes filter above so the fallback rail can't surface "this
       same product" or a near-clone of it. */
    const anchorTitleKey = normaliseTitle(offer.title);
    /* Looser price band than the dupes pipeline (0.25-3x) since
       the fallback rail is a "browse more in this space" affordance,
       not a direct comparison. Anything within 0.1x-10x of anchor
       reads as plausibly the same shopping context. Audit May 2026
       caught a ₦15K key-finder PDP showing ₦720K Samsung phones in
       its fallback rail (~50x ratio) — visually jarring even for an
       exploration rail. The 0.1-10x band drops obvious mismatches
       while still surfacing legit accessory↔primary or budget↔
       premium variations within a category. */
    const FALLBACK_FLOOR_RATIO   = 0.10;
    const FALLBACK_CEILING_RATIO = 10.00;
    fallbackDeals = countryFiltered
      .filter((d) => d.id !== offer.offer_id)
      .filter((d) => {
        if (normaliseTitle(d.title) === anchorTitleKey && d.storeId === offer.store_id) {
          return false;
        }
        return true;
      })
      /* Quality floor — drop very-low-confidence rows (extremely short
         titles, prices that look counterfeit). Same gate /deals applies
         on its initial pool. */
      .filter((d) => d.title.length >= 10 && d.title.length <= 90)
      /* Price-band gate — anchor-relative band so a cheap anchor
         doesn't get padded with luxury items and vice versa. Only
         applies when both sides have a usable price (anchorPriceNgn
         is defined above by this point in the file). */
      .filter((d) => {
        if (anchorPriceNgn <= 0 || d.salePrice <= 0) return true;
        /* Convert d.salePrice to NGN if the deal is USD-priced.
           Same shape utility usdToNgn is already imported above
           and used by the dupes pipeline. */
        const dealNgn = d.currency === "USD" ? usdToNgn(d.salePrice) : d.salePrice;
        if (dealNgn < anchorPriceNgn * FALLBACK_FLOOR_RATIO)   return false;
        if (dealNgn > anchorPriceNgn * FALLBACK_CEILING_RATIO) return false;
        return true;
      })
      .slice(0, 8);
  }

  /* Display label for the fallback section header. categories.ts owns
     the canonical name ("Home & Kitchen" not "home"); fall back to a
     plain capitalised slug when the slug isn't in the registry. */
  const fallbackCategoryName = offer.category_slug
    ? getCategory(offer.category_slug)?.name ??
      offer.category_slug.charAt(0).toUpperCase() + offer.category_slug.slice(1)
    : null;

  /* JSON-LD: Product schema (with offers) + BreadcrumbList. Google
     Rich Results use these for the price + availability badge in
     SERPs. Image, brand, category, price, currency, availability —
     each maps to a Schema.org Product field. */
  const heroData = offerRowToHero(offer);

  /* totalStores drives the "Compare prices across N stores" CTA in
     the hero. N MUST match what /compare's anchor section shows —
     "Available at" (single store) or "Across N stores" (multi) —
     so the click-through promise lines up with the destination
     view. User report May 2026 audit: "Compare across 3 stores"
     CTA but compare page showed 1 anchor store + alternatives
     elsewhere, so users read the CTA as a broken count.

     Mirrors /compare's anchor-section pipeline exactly:
       1. pgFtsAnchorOffersByProductId pools this product + any
          signature-tight siblings (brand AND model parsed) — same
          guard pgFtsFindByProductId uses, so the anchor offer set
          here equals the anchor offer set the compare page renders.
       2. isOfferAllowedForCountry drops store/currency-country
          mismatches for non-NG visitors (same as /api/compare's
          filterByCountry pass).
       3. Same-store + same-effective-price dedup (rounded to
          ₦100 buckets, country-aware via effectiveLandedPrice) —
          mirrors lines 558-566 of /[country]/compare/page.tsx so a
          retailer listing the product at two near-identical prices
          (FX rounding noise) doesn't double-count.

     Curated Amazon PDPs (product_id is a synthetic slug, not a real
     DB row) return an empty offer array from the helper. The
     fallback to 1 keeps the CTA copy correct ("Compare prices
     across stores" without a number) since the anchor at least
     carries the curated offer itself. */
  const anchorOffers = await pgFtsAnchorOffersByProductId(offer.product_id);
  const countryFilteredAnchorOffers = country.code === "ng"
    ? anchorOffers
    : anchorOffers.filter((o) => isOfferAllowedForCountry(o, country));
  const seenAnchorKeys = new Set<string>();
  const dedupedAnchorOffers = countryFilteredAnchorOffers
    .filter((o) => o.landedPrice > 0)
    .filter((o) => {
      const eff = effectiveLandedPrice(o, country);
      const key = `${o.storeId}|${Math.round(eff / 100) * 100}`;
      if (seenAnchorKeys.has(key)) return false;
      seenAnchorKeys.add(key);
      return true;
    });
  /* Floor at 1 so curated rows + any edge case where filtering
     wipes the set still render a sensible CTA label (the anchor
     offer itself is at minimum 1 store). */
  const totalStores = Math.max(1, dedupedAnchorOffers.length);
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",          url: `${SITE_URL}/${country.code}` },
    { name: country.name,     url: `${SITE_URL}/${country.code}` },
    { name: "Products",       url: `${SITE_URL}/${country.code}/deals` },
    { name: offer.title,      url: `${SITE_URL}/${country.code}/p/${offer.offer_id}` },
  ]);

  /* Price-vs-market stats for the PriceComparisonBar.

     Drives "where this offer's price sits among the stores carrying
     THIS product". Pool = dedupedAnchorOffers (same set the
     'Compare prices across N stores' CTA counts), so the bar and
     the CTA describe the exact same scope. Audit May 2026 caught
     the previous mismatch: bar was fed by filteredDupes — different
     PRODUCTS — so the 'lowest £X / highest £Y' range described
     cheaper alternatives rather than other stores carrying the
     anchor. A £200 iPhone 15 Pro PDP would show 'lowest £40' from
     a base iPhone 15 dupe, which the user reads as 'iPhone 15 Pro
     for £40 somewhere' — a broken trust signal.

     Currency contract: every effectiveLandedPrice value is NGN
     (StoreOffer.price/landedPrice are normalised to NGN at ingest /
     query time). The bar's formatPriceForUser converts to display
     currency at render time. Passing user-currency values here
     would round small-amount products to £0 (May 2026 bug).

     `count` is OTHER stores compared (excludes the anchor offer
     itself), per the bar's prop contract. Subtract 1 from
     anchorEffectives.length to get OTHER stores, floored at 0. */
  const anchorEffectives = dedupedAnchorOffers
    .map((o) => effectiveLandedPrice(o, country))
    .filter((p) => p > 0);
  const priceStats = anchorEffectives.length > 1
    ? {
        thisPriceNgn: anchorPriceNgn,
        lowest:  Math.min(...anchorEffectives),
        highest: Math.max(...anchorEffectives),
        count:   anchorEffectives.length - 1,
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
        {/* Back link — context-aware via document.referrer.
            Defaults to /[country]/deals (most PDP visits arrive
            from there). Upgrades to the referrer URL when the
            visitor came from /compare so they land back on the
            exact search results view they left — query, filters,
            and pagination preserved. Beats a bare browser-back
            button (which may not exist on direct PDP landings
            from a share link or SERP). See PdpBackLink for the
            referrer matching logic. */}
        <PdpBackLink countryCode={country.code} />

        <ProductHero
          offer={heroData}
          countryCode={country.code}
          totalStores={totalStores}
          priceStats={priceStats}
        />

        {filteredDupes.length > 0 ? (
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
        ) : fallbackDeals.length > 0 ? (
          /* Fallback rail — no direct dupes for this product, so we
             show same-category deals (or trending when category is
             absent). Different header copy reflects that these
             aren't direct alternatives, they're "more in this
             space". Same masonry layout as SimilarProducts so the
             rhythm of the page is unchanged. */
          <section className="mt-12 sm:mt-16">
            <header className="mb-6 sm:mb-8">
              <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
                {fallbackCategoryName ? `More ${fallbackCategoryName} deals` : "More deals to browse"}
              </h2>
              <p className="text-sm sm:text-base text-ink-2 mt-1.5">
                We could not find direct alternatives for this product. Here are top picks {fallbackCategoryName ? `from ${fallbackCategoryName.toLowerCase()}` : "across the catalog"}.
              </p>
            </header>
            <FallbackCategoryRail deals={fallbackDeals} />
          </section>
        ) : null}

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
