/* PDP data pipeline — extracted verbatim from
   src/app/[country]/p/[id]/page.tsx's ProductPage server component
   (the parallel dupes/anchorOffers/priceHistory/timeseries fetch
   through the computation of chartPoints).

   This is a FAITHFUL mechanical extraction: business logic, filter
   thresholds, comments and cache settings are copied as-is — only the
   variable sourcing is adapted (offerId / countryCode params instead
   of page closure vars). The page component still owns the synthetic-id
   / colon redirects, the notFound() calls, generateMetadata, the
   JSON-LD construction and all JSX. The cross-border block's broken-
   offer redirect(...) is NOT reproduced here — loadPdpData just returns
   localAlternative and the caller handles the rare broken-offer case.

   Powers both the PDP server render and the on-demand /api/pdp/[id]
   data endpoint, so the two surfaces share one pipeline and can never
   drift. */

import { unstable_cache } from "next/cache";
import { getCountry } from "@/lib/country";
import { pgFtsFindDupes, pgFtsAnchorOffersByProductId, computeAnchorSpectrum, type AnchorSpectrum } from "@/lib/search/pg-fts";
import { isOfferAllowedForCountry, filterDealsForCountry } from "@/lib/country";
import {
  fetchProductPriceHistory,
  rollupPriceHistory,
  fetchProductPriceTimeseries,
  sanitisePriceTimeseries,
  type PriceHistoryPoint,
  type PriceHistorySummary,
} from "@/lib/search/price-history";
import { effectiveLandedPrice, landedTotal, LANDED_RATE } from "@/lib/landed-price";
import { selectLineConfigs } from "@/lib/search/line-configs";
import { fetchOfferById } from "@/lib/offers/fetch-offer-by-id";
import { usdToNgn } from "@/lib/utils";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getCategory } from "@/lib/data/categories";
import type { PerStoreOffer } from "@/lib/pdp-stats";
import type { DupeResult } from "@/lib/search";
import type { Deal } from "@/types";

export interface PdpData {
  totalStores: number;
  perStoreOffers: PerStoreOffer[];
  priceHistory: PriceHistorySummary | null;
  chartPoints: PriceHistoryPoint[];
  isTrackedProduct: boolean;
  anchorPriceNgn: number;
  dupesForRail: DupeResult[];
  otherConfigs: DupeResult[];
  fallbackDeals: Deal[];
  fallbackCategoryName: string | null;
  localAlternative: { offerId: string; storeName: string; price: number; url: string } | null;
}

export async function loadPdpData(offerId: string, countryCode: string): Promise<PdpData | null> {
  const country = getCountry(countryCode);

  const offer = await fetchOfferById(offerId);
  if (!offer) return null;

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
       always renders.

       NOTE: page.tsx fires a redirect(`/${country.code}/deals`) here.
       loadPdpData does NOT redirect — it just returns localAlternative
       (here null) and the caller decides whether to redirect on the
       rare broken-offer case. */
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
       NGN-normalised above. landedCostExtra = price × LANDED_RATE
       mirrors the bake-time computation used by the dupes engine;
       landedPrice goes through landedTotal so every surface shares
       one multiplier. (#14) */
    currency:        "NGN" as const,
    price:           anchorPriceNgn,
    landedCostExtra: Math.round(anchorPriceNgn * LANDED_RATE),
    landedPrice:     Math.round(landedTotal(anchorPriceNgn)),
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
  /* ISR-CRITICAL: the variant partition is wrapped in unstable_cache.
     The DEEP path (partitionDupesByVariantMatchDeep) does UNCACHEABLE IO
     during render: pgvector embedding lookups, an OpenAI LLM judge POST
     on ambiguous pairs (see match-judge.ts), and a match_decisions write
     that memoises each verdict. Any uncached fetch/write in a render path
     opts the WHOLE /[country]/p/[id] route OUT of static rendering, so
     the `export const revalidate = 3600` above silently never took
     effect: every PDP hit rendered dynamically (x-vercel-cache: MISS,
     private, no-store), ran the full Supabase fan-out, and paid 3-5s
     TTFB on the single highest-traffic page type on the site. It was the
     PDP-scoped twin of the root layout's headers() regression (see
     src/app/layout.tsx).

     unstable_cache moves that IO inside a cache boundary: the route is
     static again (ISR), the heavy match work runs once per (product,
     dupe-set, country) per 30-min window instead of on every request,
     and the verdict-memoisation write still happens on cache miss. The
     candidate pool is passed as an argument so a changed dupe set
     re-partitions; the 30-min TTL stays tighter than the page's 1h ISR
     so the rail can't drift further than the page itself.

     DO NOT call partitionDupesByVariantMatchDeep (or any other uncached
     fetch / DB write) directly in this render path. It will defeat the
     ISR again. Keep new heavy reads behind unstable_cache. */
  /* Shared anchor-spectrum (June 2026). ONE function -- computeAnchorSpectrum
     -- builds the offer set + canonical store count for BOTH this PDP (the
     "Compare prices across N stores" CTA + PriceComparisonBar + chart seed)
     and the /compare anchor card (pgFtsFindByProductId calls the same
     function). Before this they each pooled + counted via their own pipeline
     and drifted (the 3-vs-1 store report). It owns: country filter -> brand-
     gated deep variant partition -> belt-and-braces model veto -> the
     augment -> computeAnchorStats. Wrapped in unstable_cache for the same
     ISR reason the partition was (the deep path does embedding + judge IO);
     the spectrum result is plain JSON so it caches cleanly. `partition`
     remains the variable name downstream (rail + Other configs) -- it's now
     the shared spectrum object. */
  const fetchSpectrumCached = unstable_cache(
    async (
      anchorArg:   { productId: string | null; title: string; brand: string | null; priceNgn: number; family: string | null },
      baseOffers:  typeof anchorOffers,
      dupes:       typeof countryFilteredDupes,
      countryCode: string,
    ): Promise<AnchorSpectrum> => computeAnchorSpectrum(anchorArg, baseOffers, dupes, countryCode),
    ["pdp-anchor-spectrum-v1"],
    { revalidate: 1800, tags: ["pdp-partition"] },
  );
  const partition = await fetchSpectrumCached(
    { productId: offer.product_id, title: offer.title, brand: offer.brand, priceNgn: anchorPriceNgn, family: offer.category_slug ?? null },
    anchorOffers,
    countryFilteredDupes,
    country.code,
  );
  const { totalStores, perStoreOffers } = partition;

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
  /* "Other configurations" set (#15) — same brand + same model line as
     the anchor, different config (size / storage / colour / generation).
     Drawn from the partition's sibling + other-product buckets (already
     accessory/counterfeit/country-filtered by the dupes engine) and
     narrowed by selectLineConfigs. Display-only: each links to its own
     PDP and is never merged into the spectrum, so no number here can
     contradict the comparison above. Rendered via the click-gated
     OtherConfigurations disclosure further down. */
  const otherConfigs = selectLineConfigs(
    { title: offer.title, brand: offer.brand },
    [...partition.siblingVariants, ...partition.otherProducts],
  );
  const otherConfigKeys = new Set(otherConfigs.map((d) => d.key));

  const dupesForRail = filteredDupes
    .filter((d) => {
      if (variantProductIds.has(d.key)) return false;
      /* Keep the labelled "Other configurations" set out of the generic
         "You may also like" rail so each related product appears once. */
      if (otherConfigKeys.has(d.key)) return false;
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

  /* priceHistoryRows + priceTimeseries are now fetched UP TOP in
     the same Promise.all as dupes + anchorOffers — see the May 2026
     perf comment above. Only the JS-side rollup happens here.

     Title + category are passed through to sanitisePriceHistory
     (inside rollupPriceHistory) so corrupt pre-fix rows — captured
     before the signature-leak fix + ingest-side price guard — don't
     poison the "Lowest tracked" line. A real flash sale survives
     priceLooksPlausible; a $10-on-a-$300-iPhone history row does not. */
  let priceHistorySummary = priceHistoryRows
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

  /* ── #3 reconciliation: one source of truth for the historical low ──
     The comparison bar's "Lowest tracked" line and the price chart
     used to read different RPCs — the 90d product_price_history
     rollup (priceHistorySummary) vs the 365d product_price_timeseries
     the chart actually plots (priceTimeseriesSane). They could
     therefore disagree: QA caught "Lowest tracked £72" sitting beside
     a chart whose lowest plotted point was £74, with the live spectrum
     showing £77 cheapest — three numbers, no reconciliation.

     The chart IS the visible evidence, so the bar's headline low must
     be a value the user can see on it. When the rollup low diverges
     from the timeseries floor (lowest plotted point), override the bar
     to that floor and drop the rollup's per-store attribution — the
     per-day min buckets aren't store-attributed, so keeping a store id
     or "at this store" low that no longer matches the new headline
     would just reintroduce a smaller contradiction. When the two
     already agree (the common case), keep the richer rollup intact so
     the "Lowest in 90 days" verdict and the "at this store" line still
     work. App-side only; the underlying corrupt rows are swept by the
     DB migration on its own schedule. */
  if (priceHistorySummary && priceTimeseriesSane && priceTimeseriesSane.length > 0) {
    let floorNgn = priceTimeseriesSane[0].minPriceNgn;
    let floorDay = priceTimeseriesSane[0].day;
    for (const p of priceTimeseriesSane) {
      if (p.minPriceNgn < floorNgn) { floorNgn = p.minPriceNgn; floorDay = p.day; }
    }
    /* Diverged beyond a ₦1 rounding epsilon → reconcile to the chart. */
    if (Math.abs(floorNgn - priceHistorySummary.allTimeLowNgn) > 1) {
      priceHistorySummary = {
        ...priceHistorySummary,
        allTimeLowNgn:     floorNgn,
        allTimeLowAt:      `${floorDay}T00:00:00.000Z`,
        allTimeLowStoreId: "",        // per-day min isn't store-attributed
        thisStoreLowNgn:   undefined, // never show a store low under the floor
      };
    }
  }

  /* ── No-history fallback: synthesise a single "first reading" point ──
     A freshly-ingested TRACKED product carries a live price but zero
     offer_price_history rows until its price first changes OR the daily
     seed:price-history backfill runs, a 1-2 day window (the backfill
     runs on the free-daily cron, not on the Mon/Wed/Fri scrape that creates
     most new rows). Left empty, the chart shows a bare "No price activity
     yet" panel, which reads as inconsistent next to every other product's
     flat hold-line (user report, June 2026: "why no activity instead of
     a straight line like others?").

     Hand the chart the SAME single point a seed row would produce: today's
     cross-store CHEAPEST price (so the chart's "Lowest" equals the
     spectrum's cheapest and can never claim an all-time low above a price
     a store is selling at right now), tagged with the live pool's store
     count (so the chart footer's provenance matches the "Compare across N
     stores" headline, with no fluctuating store count). The chart's existing
     single-point path draws the flat line and the verdict honestly reads
     "Just started tracking". Once a real history row lands,
     priceTimeseriesSane is non-empty and this fallback disappears on its
     own. Curated / live-search anchors (non-UUID product_id) are never
     tracked, so they keep the empty state. */
  const isTrackedProduct =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      offer.product_id ?? "",
    );
  const spectrumLowNgn = perStoreOffers.length > 0
    ? Math.min(...perStoreOffers.map((o) => o.effectiveNgn))
    : anchorPriceNgn;

  /* ── Live-price clamp on "Lowest tracked" (June 2026 QA) ──────────
     The no-history fallback below already encodes the invariant — the
     chart "can never claim an all-time low above a price a store is
     selling at right now" — but it only applied when history was EMPTY.
     With sparse/sanitised history the rollup low can sit ABOVE today's
     live cheapest (QA repro: "£47 listed here" beside "Lowest tracked:
     £211" — the £47 had no surviving history row). A price on sale right
     now IS a tracked price, so clamp the summary low to the live
     spectrum floor; store attribution is dropped the same way the
     chart-floor reconciliation above drops it. */
  if (
    priceHistorySummary &&
    spectrumLowNgn > 0 &&
    priceHistorySummary.allTimeLowNgn > spectrumLowNgn
  ) {
    priceHistorySummary = {
      ...priceHistorySummary,
      allTimeLowNgn:     spectrumLowNgn,
      allTimeLowAt:      new Date().toISOString(),
      allTimeLowStoreId: "",
      thisStoreLowNgn:   undefined,
    };
  }

  const chartPoints: PriceHistoryPoint[] =
    priceTimeseriesSane && priceTimeseriesSane.length > 0
      ? priceTimeseriesSane
      : isTrackedProduct && spectrumLowNgn > 0
        ? [{
            day:         new Date().toISOString().slice(0, 10),
            minPriceNgn: Math.round(spectrumLowNgn),
            storeCount:  totalStores,
          }]
        : (priceTimeseriesSane ?? []);

  return {
    totalStores,
    perStoreOffers,
    priceHistory: priceHistorySummary ?? null,
    chartPoints,
    isTrackedProduct,
    anchorPriceNgn,
    dupesForRail,
    otherConfigs,
    fallbackDeals,
    fallbackCategoryName,
    localAlternative,
  };
}
