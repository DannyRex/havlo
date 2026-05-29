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
import { getCountry } from "@/lib/country";
import { unstable_cache } from "next/cache";
import { COUNTRIES } from "@/lib/country";
import { SITE_URL, buildBreadcrumbList, buildHreflangAlternates } from "@/lib/seo";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { pgFtsFindDupes, pgFtsAnchorOffersByProductId } from "@/lib/search/pg-fts";
import { isOfferAllowedForCountry, filterDealsForCountry } from "@/lib/country";
import { computeAnchorStats } from "@/lib/pdp-stats";
import {
  fetchProductPriceHistory,
  rollupPriceHistory,
  fetchProductPriceTimeseries,
  sanitisePriceTimeseries,
} from "@/lib/search/price-history";
import { effectiveLandedPrice } from "@/lib/landed-price";
import { partitionDupesByVariantMatch, variantOffers } from "@/lib/search/variant-pooling";
import { partitionDupesByVariantMatchDeep } from "@/lib/search/variant-pooling-deep";
import { fetchOfferById, type OfferRow } from "@/lib/offers/fetch-offer-by-id";
import { usdToNgn } from "@/lib/utils";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getCategory } from "@/lib/data/categories";
import JsonLd from "@/components/seo/JsonLd";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import ProductHero, { type OfferData } from "@/components/product/ProductHero";
import PdpViewTracker from "@/components/product/PdpViewTracker";
import { getClickThroughUrl } from "@/lib/utils";
import { appendSignature } from "@/lib/go-signing";
import PdpBackLink from "@/components/product/PdpBackLink";
import PriceHistoryChartSkeleton from "@/components/product/PriceHistoryChartSkeleton";
import { ArrowDown } from "lucide-react";
import type { Deal } from "@/types";
import dynamic from "next/dynamic";

/* Below-the-fold rails — code-split via next/dynamic so their JS
   isn't parsed during the PDP's initial paint (May 2026 perf pass).
   All three render BELOW the ProductHero, so deferring their bundle
   shaves ~30-50 kB of parse work off LCP without changing what the
   first paint looks like.

   ssr: true (default) keeps the HTML server-rendered for SEO + CLS
   protection — only the client JS chunk loads lazily.

   The price-history chart gets a dedicated skeleton because its
   chunk is larger than the others (~10 kB of curve math + tooltip
   logic) and its absence would leave a tall empty patch in the page
   during the brief hydration window. The skeleton renders SAME
   dimensions as the real chart so the swap-in is invisible. */
const SimilarProducts     = dynamic(() => import("@/components/product/SimilarProducts"));
const FallbackCategoryRail = dynamic(() => import("@/components/product/FallbackCategoryRail"));
const PriceHistoryChart    = dynamic(
  () => import("@/components/product/PriceHistoryChart"),
  { loading: () => <PriceHistoryChartSkeleton /> },
);

/* Offers churn frequently (every ingest cycle adds + retires rows).
   ISR revalidate keeps the cached HTML fresh without re-rendering
   on every request. 1 hour is a sensible default — the underlying
   price/availability changes slowly enough that an hour of staleness
   is invisible to users, and the warm cache keeps SSR latency low. */
/* ISR window bumped May 2026 v3 from 1h → 6h to cut Vercel Fluid
   Active CPU. PDP content (anchor offer + dupes + price-history)
   changes slowly — Mon+Thu ingest is the only real source of
   freshness, and any stale window between cron runs is irrelevant
   to user trust. 6h means each unique PDP regenerates ~4× per day
   instead of ~24×. */
export const revalidate = 21600;

interface PageProps {
  params: { country: string; id: string };
}

/* ── Data fetch ──────────────────────────────────────────────────── */
/* fetchOfferById + OfferRow live in lib/offers/fetch-offer-by-id.ts
   so /api/compare's oid-fallback path can reuse the same 3-source
   resolution (view / manual join / curated catalogue) — guarantees
   that anything visible on this PDP is also resolvable from the
   compare flow. */

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
  const offer = await fetchOfferById(params.id);
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

   Live-search synthetic IDs aren't directly persisted under that
   id — when persist re-enables (now active per /api/live-search),
   the underlying offer lands in the offers table with the real
   storeId + url, but the synthetic `serp-<run>-<i>` id never
   becomes a stable key. Best-effort UX: redirect to /deals so
   the visitor sees real
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

  /* Colon-prefixed anchor keys ('oid:<uuid>', 'live:<slug>') come
     from /api/compare when the underlying product_id is missing
     (orphaned by the resignature migration, or live-search result).
     Strip the prefix and try the UUID lookup; if that still misses,
     soft-redirect to /deals rather than hard-404. */
  if (params.id.includes(":")) {
    const stripped = params.id.split(":").slice(1).join(":");
    /* Try the stripped id as an offer_id lookup. fetchOfferById
       already tries product_id → offer_id → curated, so we just
       hand it the bare id. */
    const fallbackOffer = await fetchOfferById(stripped);
    if (!fallbackOffer) redirect(`/${country.code}/deals`);
    /* Replace params for the rest of the function. */
    params.id = stripped;
  }

  const offer = await fetchOfferById(params.id);
  if (!offer) notFound();

  /* Two independent Supabase reads — fired in parallel:
       (a) cached dupes fetch (pgFtsFindDupes over the anchor title)
       (b) cached anchor-pool fetch (this product + signature
           siblings → store offers)

     Both are wrapped in unstable_cache so repeat PDP loads within
     the 5-minute window skip the round-trip entirely. Cache keys
     are scoped to the input identifiers; the country filter runs
     AFTER cache lookup so country-specific dropping doesn't shard
     the cache (one cached value serves all visitors, the filter
     personalises at render). 5-min TTL is tighter than the page's
     1-hour ISR so the cache can't drift further than the page.

     anchorPriceNgn=0 in the dupes call means "no price ceiling" —
     PDP 'You may also like' is a browse rail (broader than
     /compare's strict cheaper-only rail). User report May 2026:
     "filter by iPhone 15 Pro shows multiple products on /deals but
     PDP shows no cheaper alternatives" — anchoring on the price
     ceiling was hiding same-priced legit alternatives.

     Dupes limit history:
       16 (initial) → 8 (May 2026, Supabase egress) → 20 (May 2026
       v2, user report 'You may also like is too sparse')
     The 8-row cap was over-aggressive for the rail. By the time
     country filter + price-band gate + dedup + sibling exclusion
     ran, the rail was down to 1-3 cards. Pushing back to 20 gives
     each downstream filter headroom to drop without emptying the
     rail. Supabase egress impact is bounded by the 5-min
     unstable_cache TTL plus the 1-hour ISR — a single cached value
     serves every visitor for the cache window. */
  const fetchDupesCached = unstable_cache(
    /* lenient + 20 — same reasoning as /api/compare. The partition
       below (partitionDupesByVariantMatch) correctly splits same-
       product candidates into the spectrum, sibling SKUs out of the
       rail, and cross-tier alternatives into 'You may also like'.
       Feeding strict candidates starves the rail without benefit
       since the partition already enforces strictness for the
       spectrum-bound subset. */
    async (title: string) => pgFtsFindDupes(title, 0, { limit: 30, strict: false }),
    /* Cache key bumped to v2-relaxed after 2937139 relaxed
       pgFtsFindDupes' strict-family gate and lifted the limit
       20 -> 30. Without the bump the prior 30-min TTL on the
       v1 entries kept serving the pre-relaxation results, so a
       PDP whose dupes were re-fetched 5 minutes before deploy
       would show 1 alternative for the next 25 minutes despite
       the new gates returning ~10. */
    ["pdp-dupes-v2-relaxed"],
    /* TTL bumped May 2026 v3 (300s → 1800s) for Fluid CPU relief.
       Dupes pool changes only on ingest, fine to cache 30min. */
    { revalidate: 1800, tags: ["pdp-dupes"] },
  );
  const fetchAnchorOffersCached = unstable_cache(
    async (productId: string) => pgFtsAnchorOffersByProductId(productId),
    ["pdp-anchor-offers"],
    /* TTL bumped May 2026 v3 (300s → 1800s) for Fluid CPU relief. */
    { revalidate: 1800, tags: ["pdp-anchor-offers"] },
  );
  /* Price-history reads moved UP here (May 2026 perf pass) so they
     parallelise with dupes + anchorOffers in a single Promise.all
     wave. Previously they ran AFTER the deep-partition step which
     itself runs after dupes — a 3-stage waterfall that serialised
     ~200-400ms of independent Supabase round trips for no reason
     (both reads only depend on offer.product_id, which we already
     have from offer above).

     Cache wrappers are now declared in this block so the
     `unstable_cache` factory call is co-located with its invocation
     in the Promise.all — keeps the dependency graph readable.

     fetchProductPriceHistory returns null when the migration hasn't
     been applied or the product has no history rows yet (curated
     synthetic-ids). In both cases the bar / chart fall back to the
     current-prices-only spectrum / empty state gracefully. */
  const fetchPriceHistoryCached = unstable_cache(
    async (productId: string) => fetchProductPriceHistory(productId, 90),
    ["pdp-price-history"],
    { revalidate: 1800, tags: ["pdp-price-history"] },
  );
  /* Time-series for the PriceHistoryChart. Separate RPC from the
     rollup above — same offer_price_history table but bucketed
     by day with min-across-stores per bucket. 365-day window so
     the client-side range toggle (30D / 90D / All) is instant
     without refetching. */
  const fetchPriceTimeseriesCached = unstable_cache(
    async (productId: string) => fetchProductPriceTimeseries(productId, 365),
    ["pdp-price-timeseries-v2"],
    { revalidate: 1800, tags: ["pdp-price-timeseries"] },
  );
  const [dupes, anchorOffers, priceHistoryRows, priceTimeseries] = await Promise.all([
    fetchDupesCached(offer.title),
    fetchAnchorOffersCached(offer.product_id),
    offer.product_id ? fetchPriceHistoryCached(offer.product_id) : Promise.resolve(null),
    offer.product_id ? fetchPriceTimeseriesCached(offer.product_id) : Promise.resolve(null),
  ]);

  /* ── Anchor country-relevance guard ───────────────────────────────
     If the visitor is on /<country>/p/<offerId> but the offer's
     store doesn't serve that country (e.g. an NG visitor lands on a
     PDP whose anchor is amazon.ae), the CTA button would route them
     to a merchant they can't actually buy from. User report May 2026
     v3:
       "https://havlo.io/ng/p/7e817add-... points to amazon.ae"

     Recovery strategy: look for the SAME product at a country-
     appropriate store and redirect to that offer's PDP. Two pools:
       1. anchorOffers — pgFtsAnchorOffersByProductId returns same-
          product offers across all stores (matched by signature).
          Empty for curated Amazon rows whose product_id is a
          synthetic slug, not a real products.id UUID.
       2. dupes — broader FTS title match. Catches the curated case
          AND near-duplicate products where the strict signature
          pool missed.

     If neither pool has a country-appropriate alternative, fall
     through to notFound() rather than render a CTA the visitor
     can't use. We avoid silently rendering the anchor anyway
     because the PDP's outbound CTA is the value proposition — a
     PDP that can't deliver a working CTA is broken UX. */
  const anchorAsOfferLike = {
    storeId:         offer.store_id,
    storeName:       offer.store_name,
    isInternational: offer.is_international,
    /* DB-tagged country anchor — primary signal in
       isOfferAllowedForCountry. Without this, the gate fell through
       to the JS COUNTRY_STORES roster and dropped DB-tagged stores
       not in the hardcoded roster (e.g. `onbuy` for UK). Re-audit
       caught the resulting infinite-redirect loop on /uk/p/661bbc27...
       (Nokia 3310 at onbuy, country=UK in DB but not in JS roster). */
    storeCountry:    offer.store_country ?? null,
  };
  /* Cross-border / not-locally-shoppable detection.
     ─────────────────────────────────────────────────────────────
     Was previously a SILENT REDIRECT — when the visited offer's
     store wasn't in the visitor's country allowlist (BackMarket /
     93mobiles / FoneZone / refurbed-de etc. on /ng/...), the page
     bounced to the cheapest locally-shoppable alternative. The
     destination's CTA then read "Visit Jumia" even though the
     user had clicked "BackMarket" upstream — user-reported UX bug
     because the redirect happened with no explanation.

     New approach (May 2026 v4): NEVER silently redirect away from
     a clicked offer. Always render the PDP for the offer the user
     actually clicked, so the "Visit X" CTA matches the store label
     they came from. Compute the country-appropriate alternative
     (if any) as a `localAlternative` value passed to ProductHero,
     which renders a context banner: "BackMarket doesn't ship to
     Nigeria — same product at Jumia for ₦850,000 →"

     Hard 404 fallback only when there's NO alternative AND the
     offer's data is structurally broken (no URL, no store name,
     etc.). Cross-border-but-data-intact offers stay rendered with
     the banner.

     The redirect's original purpose (prevent users landing on a
     PDP whose outbound CTA can't deliver) is preserved by the
     banner — the user gets the warning AND the local alternative
     AND retains the freedom to click through to the original store
     if they have a freight forwarder. */
  const isLocallyShoppable = isOfferAllowedForCountry(anchorAsOfferLike, country);
  let localAlternative: { offerId: string; storeName: string; price: number; url: string } | null = null;
  if (!isLocallyShoppable) {
    const sameProduct = anchorOffers
      .filter((o) => o.offerId && o.offerId !== offer.offer_id)
      .filter((o) => isOfferAllowedForCountry(o, country))
      .sort((a, b) => a.price - b.price);
    const broaderMatch = sameProduct.length === 0
      ? dupes
          .flatMap((d) => d.offers)
          .filter((o) => o.offerId && o.offerId !== offer.offer_id)
          .filter((o) => isOfferAllowedForCountry(o, country))
          .sort((a, b) => a.price - b.price)
      : [];
    const alt = sameProduct[0] ?? broaderMatch[0] ?? null;
    if (alt) {
      localAlternative = {
        offerId:   alt.offerId,
        storeName: alt.storeName,
        price:     alt.price,
        url:       `/${country.code}/p/${alt.offerId}`,
      };
    }
    /* No alternative AND offer data is structurally broken → hard
       404 fallback (no merchant URL at all means the "Visit X" CTA
       would be a dead link). Cross-border WITH a real merchant URL
       always renders. */
    if (!localAlternative && (!offer.url || offer.url.trim().length === 0)) {
      redirect(`/${country.code}/deals`);
    }
  }

  /* Drop dupe-offers from stores that aren't appropriate for the
     visitor's market (e.g. NG-anchored Konga rows on a UK PDP).
     Same shape /api/compare/dupes already applies.

     NG-tightening May 2026 v3 — was previously `country.code === "ng" ? dupes : ...`
     i.e. NG visitors saw EVERYTHING including Amazon AE / Amazon IN /
     Amazon DE / Flipkart, on the theory that NG shoppers cross-border
     so they tolerate more variety. But the broader country-awareness
     audit established NG should only see NG-anchored + US + UK + truly
     global stores (AliExpress / Shein / Temu / etc.). User report:
     "/ng PDP showed amazon.ae link" — exactly the case this fix
     stops. isOfferAllowedForCountry now uniformly applies for every
     country including NG. */
  const countryFilteredDupes = dupes
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

  /* Anchor's EFFECTIVE landed price for the visitor — the price the
     band gate below should compare alternatives against.

     Why this exists (May 2026 audit fix): the band gate previously
     compared alternatives' landed price (which the dupes engine
     bakes with +30% for intl stores) against the anchor's BARE
     price (anchorPriceNgn). Asymmetric for any PDP where the
     anchor is cross-border for the visitor — e.g. NG visitor on
     an Amazon US PDP. Some legitimate alternatives dropped out as
     too expensive because their landed-side was inflated relative
     to the anchor's bare reference; some too-expensive ones
     survived for the inverse reason.

     Now: compute the anchor's own landed price (price + 30%
     surcharge when intl for visitor, else bare), and compare like-
     with-like via effectiveLandedPrice. Local-anchor case
     unchanged because effective === bare when not cross-border. */
  const anchorOfferLike = {
    storeId:         offer.store_id,
    storeName:       offer.store_name,
    isInternational: offer.is_international,
    storeCountry:    offer.store_country ?? null,
    /* currency stays NGN here because anchorPriceNgn is already
       NGN-normalised above. landedCostExtra = price × 0.3 mirrors
       the bake-time computation used by the dupes engine. */
    currency:        "NGN" as const,
    price:           anchorPriceNgn,
    landedCostExtra: Math.round(anchorPriceNgn * 0.3),
    landedPrice:     Math.round(anchorPriceNgn * 1.3),
  };
  const anchorEffectiveNgn = effectiveLandedPrice(anchorOfferLike, country);

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
  /* Price band for the "You may also like" rail. Loosened May 2026 v2
     (0.25-3.0 → 0.15-5.0) after user feedback that the rail was too
     sparse. The rail is a BROWSE surface — it's meant to show related
     products, not just same-price-tier alternatives. The narrower
     0.25-3.0 band was over-correcting for the "£5 vs £100" trust
     concern; widening to 0.15-5.0 still catches the obvious
     accessory-vs-parent mismatches but lets legitimate
     cross-tier alternatives (premium variants, deeply-discounted
     basics) surface in the rail. */
  const FLOOR_RATIO   = 0.15;  // alt ≥ 15% of anchor (still drops "£1 sticker for £50 product")
  const CEILING_RATIO = 5.00;  // alt ≤ 5x anchor   (still drops "£50 vs £500 bundle")
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
       [anchorEffective * FLOOR_RATIO, anchorEffective * CEILING_RATIO].
       Both sides now use effectiveLandedPrice with the visitor's
       country so the comparison is symmetric (visitor-cross-border-
       inflated against the same definition on both sides). */
    if (anchorEffectiveNgn > 0) {
      const best = [...d.offers].sort(
        (a, b) => effectiveLandedPrice(a, country) - effectiveLandedPrice(b, country),
      )[0];
      if (best) {
        const bestEffective = effectiveLandedPrice(best, country);
        if (bestEffective < anchorEffectiveNgn * FLOOR_RATIO)   return false;
        if (bestEffective > anchorEffectiveNgn * CEILING_RATIO) return false;
      }
    }

    /* Dedupe by best-offer id (defensive — dupes engine already
       groups by signature, but FTS scoring sometimes splits near-
       identical titles into separate groups). Use the same
       effective-price sort so the "best" offer is consistent with
       the band-gate logic above. */
    const best = [...d.offers].sort(
      (a, b) => effectiveLandedPrice(a, country) - effectiveLandedPrice(b, country),
    )[0];
    const id = best?.offerId || (best?.storeId + ":" + d.key);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    /* Same-store + same-title dedupe — keeps the cheapest
       representative when a merchant has multiple listings of the
       same product (Fashion Nova SKU variants, AliExpress
       multi-seller listings). Different store + same title is a
       legit cross-store alternative and falls through this check
       because storeTitleKey differs.

       Why TITLE-based (not price-based) dedup here, while the
       compare anchor section uses PRICE-based dedup:
         - This list (`filteredDupes`) is DIFFERENT PRODUCTS
           ranked as alternatives. Same store + same title = same
           offering presented twice, so collapse to cheapest.
         - The compare anchor section is THE SAME PRODUCT across
           stores. Two different effective prices at the same store
           = two real SKU variants (256GB vs 512GB iPhone, S vs L
           apparel) so PRICE-based dedup is right there — drop
           identical-price duplicates, keep different-price ones.
       Intentional split. If you unify, you change the trust
       contract on one of the two surfaces. */
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
      { revalidate: 1800, tags: ["pdp-fallback"] },
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

  /* Anchor pool stats — drives both the "Compare prices across N
     stores" CTA in ProductHero AND the PriceComparisonBar's range
     numbers. Same pool, same dedup, same country filter — the CTA
     and the bar describe the same scope so they can never disagree.

     Pipeline (in src/lib/pdp-stats.ts):
       1. Country filter (NG keeps everything; non-NG drops NG-anchored
          + foreign-roster rows via isOfferAllowedForCountry).
       2. Same-store + same-effective-price dedup (₦100 buckets,
          country-aware via effectiveLandedPrice) — mirrors lines
          558-566 of /[country]/compare/page.tsx.
       3. totalStores = max(1, deduped.length); priceStats from
          min/max of effective prices when ≥ 2 stores remain.

     Curated Amazon PDPs (product_id is a synthetic slug, not a real
     DB row) return an empty offer array from
     pgFtsAnchorOffersByProductId. The floor-at-1 inside the helper
     keeps the CTA copy correct ("Compare prices across stores"
     without a number) since the anchor at least carries the
     curated offer itself.

     anchorOffers is fetched in parallel with dupes above
     (Promise.all) so the two reads complete in one network
     round-trip rather than two serial ones. */
  /* Variant-aware spectrum pooling.

     The strict signature pool (pgFtsAnchorOffersByProductId) only
     finds same-product offers when the brand+model parser hit at
     ingest time. For Stanley Quencher tumblers, MacBook Pros,
     AirPods, and many other catalog rows whose titles defeat the
     parser, the strict pool collapses to "1 store · watching for
     more" — even when the dupes engine clearly found the same
     product at other stores via FTS title overlap.

     Fix: partition the country-filtered dupes into:
       likelyVariants — pass isLikelySameProduct (brand + family +
                        variant + size + model + price band).
                        Their offers merge into the spectrum pool
                        so the bar plots them as dots and the CTA
                        counts them as stores.
       otherProducts  — different size / generation / sub-model /
                        broader similarity. Stay in the "You may
                        also like" rail as cheaper alternatives.

     Variants are matched against the COUNTRY-FILTERED dupes
     directly (not filteredDupes which has additional dedup +
     anchor-removal) so we don't lose candidates that the rail's
     filters drop. Anchor-removal isn't needed here because the
     anchor's own product_id was already excluded by pgFtsFindDupes
     pre-filter. */
  /* DEEP path (Phases 2/3/4) when product_id is known. Routes the
     partition through image-phash + title-embedding + LLM-judge fast-
     paths via partitionDupesByVariantMatchDeep. Sync fallback when
     anchor has no products row (synthetic / live PDP).

     family threads through to the gate so fashion / beauty / home
     get their family-conditional loosenings (wider price band,
     lenient size matching). category_slug from the products row
     is the authoritative source — falls back to title-detection
     inside the gate when null.

     Cost on the happy path: 1 extra bulk SELECT (~50-100ms) for the
     anchor + every dupe's enrichment. Cold-cache LLM consultations
     add ~200-500ms each but only fire in the JUDGE_BAND (0.55-0.85)
     and cache forever in match_decisions. */
  const supaForDeepPartition = offer.product_id ? getSupabaseAdmin() : null;
  const partition = supaForDeepPartition && offer.product_id
    ? await partitionDupesByVariantMatchDeep(
        supaForDeepPartition,
        { id: offer.product_id, title: offer.title, brand: offer.brand, priceNgn: anchorPriceNgn, family: offer.category_slug ?? null },
        countryFilteredDupes,
      )
    : partitionDupesByVariantMatch(
        { title: offer.title, brand: offer.brand, priceNgn: anchorPriceNgn, family: offer.category_slug ?? null },
        countryFilteredDupes,
      );
  const augmentedAnchorOffers = [
    ...anchorOffers,
    ...variantOffers(partition.likelyVariants),
  ];

  const { totalStores, perStoreOffers } = computeAnchorStats(
    augmentedAnchorOffers,
    anchorPriceNgn,
    country,
    offer.category_slug ?? null,
  );

  /* Strip variants from the "You may also like" rail. They're now
     plotted on the spectrum as same-product price points; rendering
     them again as cheaper-alternative cards would duplicate the
     same offers across two places on the same page.

     Also strip siblingVariants (same brand + same model line, but
     different sub-tier — iPhone 15 ↔ iPhone 15 Plus, Galaxy S24 ↔
     S24 Ultra, MacBook Pro M3 ↔ M4). QA report May 2026 flagged
     these as misleading "cheaper alternatives" — a user looking
     at iPhone 15 doesn't want iPhone 15 Plus suggested as a cheaper
     swap because they're different products at different price
     tiers. Sibling SKUs get their own dedicated rail downstream. */
  const variantProductIds = new Set([
    ...partition.likelyVariants.map((v) => v.key),
    ...partition.siblingVariants.map((v) => v.key),
  ]);
  const variantOfferIds   = new Set([
    ...partition.likelyVariants.flatMap((v) => v.offers.map((o) => o.offerId)),
    ...partition.siblingVariants.flatMap((v) => v.offers.map((o) => o.offerId)),
  ]);
  const dupesForRail = filteredDupes
    .filter((d) => {
      if (variantProductIds.has(d.key)) return false;
      /* Defensive: if any of the dupe's offers got merged into the
         spectrum (FTS sometimes splits same-product into two
         group rows), drop the rail entry too. */
      if (d.offers.some((o) => variantOfferIds.has(o.offerId))) return false;
      return true;
    })
    /* Sort cheapest-first to match the rail's header copy
       ("Sorted by best value, cheapest first.") — May 29 2026 user
       report flagged the section was unsorted (filtered only). The
       per-dupe cheapest is the min country-aware effective landed
       price across its offers, matching the same definition the
       band-gate and SimilarProducts card use so the order surfaced
       in the rail is the order the user sees on each card. */
    .sort((a, b) => {
      const minEffective = (d: typeof a) => {
        let lowest = Infinity;
        for (const o of d.offers) {
          const v = effectiveLandedPrice(o, country);
          if (v > 0 && v < lowest) lowest = v;
        }
        return lowest === Infinity ? Number.MAX_SAFE_INTEGER : lowest;
      };
      return minEffective(a) - minEffective(b);
    });

  /* Sibling rail — same brand + same model line + different sub-tier.
     Surfaces iPhone 15 Plus / Pro / Pro Max when viewing iPhone 15,
     Galaxy S24 Ultra / FE when viewing Galaxy S24, etc. Excluded
     from the cross-brand 'Cheaper alternatives' rail above so the
     two surfaces are semantically distinct:
       Other models in this line  → siblingsForRail (same product family)
       Cheaper alternatives       → dupesForRail (different products) */
  const siblingsForRail = filteredDupes.filter((d) =>
    partition.siblingVariants.some((s) => s.key === d.key),
  );

  /* priceHistoryRows + priceTimeseries are now fetched UP TOP in
     the same Promise.all as dupes + anchorOffers — see the May 2026
     perf comment above. Only the JS-side rollup happens here.

     Title + category are passed through to sanitisePriceHistory
     (inside rollupPriceHistory) so corrupt pre-fix rows — captured
     before the signature-leak fix + ingest-side price guard — don't
     poison the "Lowest tracked" line. A real flash sale survives
     priceLooksPlausible; a $10-on-a-$300-iPhone history row does not. */
  const priceHistorySummary = priceHistoryRows
    ? rollupPriceHistory(
        priceHistoryRows,
        offer.store_id,
        usdToNgn,
        offer.title,
        offer.category_slug ?? null,
      ) ?? undefined
    : undefined;
  /* Same gate on the chart's per-day timeseries — drops day buckets
     whose min(price) across stores falls below the plausibility
     floor. Real low days survive; bogus days create a gap in the
     line rather than a fake dip. */
  const priceTimeseriesSane = priceTimeseries
    ? sanitisePriceTimeseries(priceTimeseries, offer.title, offer.category_slug ?? null)
    : null;
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",          url: `${SITE_URL}/${country.code}` },
    { name: country.name,     url: `${SITE_URL}/${country.code}` },
    { name: "Products",       url: `${SITE_URL}/${country.code}/deals` },
    { name: offer.title,      url: `${SITE_URL}/${country.code}/p/${offer.offer_id}` },
  ]);

  /* Product structured data — May 29 2026 SEO enrichment pass.
     Adds the fields Google's Rich Results validator + Search Console
     repeatedly flag as "Missing" on Shopping rich results:
       • description       — falls back to a constructed sentence so
                              every PDP carries one
       • sku / productID   — uses the canonical offer_id
       • mainEntityOfPage  — explicit canonical the parser respects
       • priceValidUntil   — 30 days out (Google warns when absent)
       • aggregateOffer    — when multiple stores carry this product,
                              swap the single Offer for an
                              AggregateOffer with lowPrice/highPrice/
                              offerCount so the SERP can show price
                              ranges instead of a single store's
                              number
       • dateModified      — most recent scrape timestamp; Google uses
                              this as a freshness signal */
  const productUrl = `${SITE_URL}/${country.code}/p/${offer.offer_id}`;
  const productDescription = offer.brand
    ? `${offer.title} from ${offer.brand}. Compare prices across stores in ${country.name} on Havlo. See similar products for less.`
    : `${offer.title}. Compare prices across stores in ${country.name} on Havlo. See similar products for less.`;
  const priceValidUntil = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  /* Build offer block — single Offer when only one store, or
     AggregateOffer when multiple stores carry the same product
     (perStoreOffers from computeAnchorStats above). lowPrice /
     highPrice are in the visiting offer's currency to match the
     other PDP signals; numbers come from the country-aware
     effectiveLandedPrice rollup the spectrum already uses. */
  const offerBlock = perStoreOffers.length > 1
    ? {
        "@type":         "AggregateOffer",
        url:             productUrl,
        priceCurrency:   offer.currency,
        lowPrice:        Math.min(...perStoreOffers.map((o) => o.effectiveNgn)),
        highPrice:       Math.max(...perStoreOffers.map((o) => o.effectiveNgn)),
        offerCount:      perStoreOffers.length,
        availability:    offer.in_stock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        priceValidUntil,
      }
    : {
        "@type":         "Offer",
        url:             productUrl,
        priceCurrency:   offer.currency,
        price:           offer.current_price,
        availability:    offer.in_stock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        seller:          { "@type": "Organization", name: offer.store_name },
        priceValidUntil,
      };

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
    productID:          offer.offer_id,
    mainEntityOfPage:   productUrl,
    dateModified:       offer.scraped_at,
    offers:             offerBlock,
  };

  return (
    <main className="bg-bg">
      {/* JSON-LD: breadcrumb + product, both server-rendered inline.
          The product schema was previously injected via next/script
          with strategy=afterInteractive, which deferred the <script>
          tag until after hydration — invisible to Google's initial
          crawl. Switched to <JsonLd /> (raw inline <script>) May 2026
          launch-readiness pass so Rich Results pick it up. */}
      <JsonLd data={[breadcrumb, productSchema]} />

      {/* PDP view event capture — May 29 2026 B2B data-tap addition.
          Fire-and-forget client effect. Does not block render or
          critical-path interaction. See docs/b2b-data-strategy.md
          for the rationale; this is the foundational event stream
          that unlocks funnel + engagement reports. */}
      <PdpViewTracker productId={offer.product_id} offerId={offer.offer_id} />

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
          /* Signed server-side — see go-signing.ts. ProductHero is a
             client component and can't hold the HMAC secret. */
          signedOutboundUrl={appendSignature(getClickThroughUrl({
            url:       heroData.url,
            id:        heroData.offerId,
            title:     heroData.title,
            storeId:   heroData.storeId,
            storeName: heroData.storeName,
            country:   country.code,
          }))}
          totalStores={totalStores}
          perStoreOffers={perStoreOffers}
          priceHistory={priceHistorySummary}
          /* Cross-border context — renders an above-hero banner when
             the visited offer's store doesn't ship to the visitor's
             country. Replaces the previous silent-redirect behaviour
             that confused users (BackMarket click → Jumia PDP).
             localAlternative is null when the catalog has no in-
             country equivalent — the banner still renders without
             the "View local price" CTA in that case. */
          isLocallyShoppable={isLocallyShoppable}
          localAlternative={localAlternative}
        />

        {/* Price history chart — only renders for products with a real
            product_id (curated synthetic-id PDPs and live-search PDPs
            have no history rows). The component itself handles its
            own empty state for products that DO have a product_id but
            haven't seen a price change yet. */}
        {/* The price-history section ALWAYS renders. The chart owns
            its own empty state — the page just hands it whatever
            points it has (could be a full year of data, an empty
            array for valid-UUID-but-unhistoried products, or null
            for synthetic-id anchors like the curated Amazon catalog
            and live-search).

            Why we render unconditionally now (May 2026 follow-up):
              • Bucket 1 — valid UUID + ≥ 1 history row: full chart.
              • Bucket 2 — valid UUID + 0 history rows: the chart
                renders its "No price activity yet" empty state.
              • Bucket 3 — synthetic id (curated / live-search):
                priceTimeseries is null, the chart treats it as []
                and shows the same empty state. The section is no
                longer silently missing from the page layout for
                this PDP shape, which used to make the page feel
                inconsistent ("why does this PDP have a chart and
                that one doesn't?"). */}
        <div className="mt-6 sm:mt-8">
          {/* dataSource picks the empty-state copy:
                "curated" → synthetic-id anchor (offer.product_id is
                            non-UUID e.g. "amazon-ae-airpods-pro-2"
                            from curated-amazon.ts, or "serp-…" from
                            live-search). These products live in
                            static catalogs that don't get tracked in
                            offer_price_history, so the empty state
                            explains tracking just doesn't apply
                            here rather than implying it's about to
                            start. Detection mirrors the UUID guard
                            in lib/search/price-history.ts so both
                            sides agree on what "tracked" means.
                "tracked" → real DB product whose history table just
                            hasn't accumulated rows yet. Forward-
                            looking copy invites the visitor back. */}
          <PriceHistoryChart
            points={priceTimeseriesSane ?? []}
            currentNgn={anchorPriceNgn}
            country={country}
            visitingStoreName={offer.store_name}
            dataSource={
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offer.product_id ?? "")
                ? "tracked"
                : "curated"
            }
          />
        </div>

        {dupesForRail.length > 0 ? (
          /* Cheaper alternatives section — moved ABOVE the sibling
             rail per user preference (May 2026 v3). Cross-brand /
             cross-tier cheaper picks are the higher-intent surface
             ("can I get this product cheaper / different brand?"),
             siblings ("other configurations in this line") are the
             secondary browse. */
          <section className="mt-12 sm:mt-16">
            <header className="mb-6 sm:mb-8">
              <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
                {/* Always "You may also like" now that the siblings
                    rail is gone (May 2026 launch-readiness re-audit).
                    The dynamic "Cheaper alternatives" label tied to
                    siblings existence didn't make sense once the
                    sibling rail was removed. */}
                You may also like
              </h2>
              {/* Green "N alternatives found" pill — mirrors the
                  CompareAnchorCard connector chip so the design
                  language stays consistent across compare + PDP. */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-success/10 border border-success/20 mt-2">
                <ArrowDown size={12} className="text-success" />
                <span className="text-xs font-semibold text-success">
                  {dupesForRail.length} {dupesForRail.length === 1 ? "alternative" : "alternatives"} found
                </span>
              </div>
              <p className="text-sm sm:text-base text-ink-2 mt-3">
                Sorted by best value, cheapest first.
              </p>
            </header>
            <SimilarProducts dupes={dupesForRail} countryCode={country.code} />
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

        {/* "Other models in this line" sibling rail REMOVED May 2026
            launch-readiness re-audit. Surfacing iPhone 15 Plus when the
            anchor is iPhone 15 (or S24 Ultra when anchor is S24) was
            flagged as a sibling-gate regression — users on a base-tier
            PDP shouldn't be steered to a sub-tier they didn't ask for,
            even labelled as "Other models". If we want to bring this
            back later, gate it behind an explicit "Compare configurations"
            click rather than auto-rendering. The partition logic in
            partitionDupesByVariantMatch still computes siblingVariants
            so the spectrum pool can pull them in (likelyVariants), it
            just no longer renders as its own rail. */}

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
      {/* Newsletter signup at the bottom of the PDP. Added May 2026
          launch-readiness pass — was previously homepage-only. */}
      <NewsletterStrip />
    </main>
  );
}
