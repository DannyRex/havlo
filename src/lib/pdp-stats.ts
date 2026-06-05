/* PDP comparison-pool helpers.

   Extracted from /[country]/p/[id]/page.tsx (May 2026 audit, phase 3
   decomposition). The PDP page was running >700 lines because the
   data pipeline lived inline; these helpers carry the parts that
   need to stay consistent with /compare's anchor section.

   Two surfaces depend on this output:
     - ProductHero's "Compare prices across N stores" CTA   (totalStores)
     - PriceComparisonBar's "where this price sits across…" (priceStats)

   Both surfaces describe THE SAME pool — the anchor product's
   offers (this product + signature-tight siblings) after country
   filtering and same-store/same-price dedup. Audit May 2026 caught
   the previous mismatch: bar was fed by dupes (different products),
   so a £200 iPhone 15 Pro PDP showed 'lowest £40' from a base
   iPhone 15 dupe. computeAnchorStats centralises the pool +
   dedup so both surfaces can never drift again. */

import type { StoreOffer } from "@/lib/search";
import { type Country, isOfferAllowedForCountry } from "@/lib/country";
import { isCrossBorderForUser } from "@/lib/landed-price";
import { isAccessoryListing, isUsedListing } from "@/lib/search/price-floor";

/* Per-store summary the new PriceComparisonBar needs to plot dots
   along the spectrum. One row per distinct store remaining after
   the country + same-store-same-price dedup pass. */
export interface PerStoreOffer {
  storeId:       string;
  storeName:     string;
  storeLogoUrl:  string;
  effectiveNgn:  number;       // raw merchant price (NGN); landed is shown only as a labelled "(est.)" total (#16)
  isCrossBorder: boolean;      // for the visitor specifically
  offerId:       string;       // for "cheaper at [Store]" deep-link
  /** Used / refurbished / open-box listing (high-precision detection
      via store + title). The bar excludes these from the headline
      "cheapest" / verdict math and surfaces them as a separately
      LABELLED line so a used unit never silently undercuts the new
      price. May 2026 PDP-trust fix. */
  isUsed:        boolean;
}

export interface AnchorStats {
  /** Unique-stores count for the "Compare prices across N stores" CTA.
      Floored at 1 so curated rows (which return an empty anchor pool
      from pgFtsAnchorOffersByProductId) still render a sensible
      label. */
  totalStores: number;
  /** Price-comparison-bar summary stats. Undefined when the anchor
      has ≤ 1 offer after filtering — the bar's single-store path
      activates via the absence of this prop. */
  priceStats: {
    thisPriceNgn: number;
    lowest:  number;
    highest: number;
    /** OTHER stores compared (excludes the anchor offer itself). */
    count:   number;
  } | undefined;
  /** Per-store rows for the new bar's store-dot plotting. Always
      present even when there's only 1 row (single-store path uses
      this for the "you are at <Store>" labelling). Sorted cheapest
      first by effectiveNgn so cheapest-store lookups are
      O(1) via perStoreOffers[0]. */
  perStoreOffers: PerStoreOffer[];
  /** The full StoreOffers behind totalStores (one per store, cheapest-first,
      new-only with all-used fallback). For callers that RENDER the rows (the
      /compare anchor card) so the displayed rows ARE the counted set. */
  comparableOffers: StoreOffer[];
}

/* Same-store + same-price dedup on the RAW merchant price (#16: the PDP
   now leads with the raw price on every surface — hero, chart, spectrum
   — and shows the cross-border landed total only as a labelled "(est.)".
   So the spectrum's pool, sort and "cheapest" all key off o.price, never
   the landed estimate, which is what kept the spectrum's headline out of
   step with the hero + chart). Round to nearest ₦100 so trivial
   FX-rounding differences don't leak through as separate rows. */
function dedupAnchorOffers(offers: StoreOffer[]): StoreOffer[] {
  const seen = new Set<string>();
  return offers
    .filter((o) => o.price > 0)
    .filter((o) => {
      const key = `${o.storeId}|${Math.round(o.price / 100) * 100}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/* Compute totalStores + priceStats from the anchor's pooled offers.

   Pipeline:
     1. Country filter (NG keeps everything; non-NG drops NG-anchored
        + foreign-roster + currency-mismatched rows).
     2. Same-store/same-effective-price dedup (₦100 buckets).
     3. Count + min/max for the bar.

   anchorPriceNgn is the offer's own price normalised to NGN —
   passed in because the PDP already computed it for the dupes
   price-band gate. Used as the bar's thisPriceNgn (the verdict
   marker position).

   Floors totalStores at 1 so curated rows (empty offers array)
   render a sensible CTA label without breaking the JSX branching
   elsewhere. */
export function computeAnchorStats(
  anchorOffers: StoreOffer[],
  anchorPriceNgn: number,
  country: Country,
  family?: string | null,
  anchorTitle?: string | null,
): AnchorStats {
  const countryFiltered = country.code === "ng"
    ? anchorOffers
    : anchorOffers.filter((o) => isOfferAllowedForCountry(o, country));

  /* Accessory guard (May 2026 PDP-trust fix). A "Replacement Earpads
     for Bose QC Ultra" or "Silicone Cover for Sony WH-1000XM5" listing
     priced like the parent was sinking to the bottom of the pool and
     becoming the "cheapest". Drop accessory/part rows — but ONLY when
     the anchor itself isn't an accessory, so an all-earpads product
     still compares earpad prices normally (asymmetric by design). */
  const anchorIsAccessory = isAccessoryListing(anchorTitle);
  const accessoryFiltered = anchorIsAccessory
    ? countryFiltered
    : countryFiltered.filter((o) => !isAccessoryListing(o.productTitle));

  const deduped = dedupAnchorOffers(accessoryFiltered);

  /* Outlier filter — defense against over-merged products in the DB
     AND against legitimate-but-misleading storage-tier spreads (the
     QA report May 2026 caught Galaxy S24 Ultra showing 2.27× because
     256GB and 1TB share product_id by design — color/storage are
     intentionally not part of the signature key).

     Tightened to a family-aware band so phones/electronics get a
     2.5× ceiling (catches storage-tier outliers without losing
     legitimate cross-store price variation) while fashion/beauty
     stay at 4× (real cross-store spread is wider there). */
  const ANCHOR_OUTLIER_RATIO =
    family === "fashion"  || family === "beauty"  || family === "sports" ? 4 :
    family === "home"     || family === "health" ? 3 :
    /* phones, electronics, computing, audio, gaming, default */         2.5;
  const offerPrices = deduped.map((o) => o.price).filter((p) => p > 0);
  let medianPrice = 0;
  if (offerPrices.length > 0) {
    const sorted = [...offerPrices].sort((a, b) => a - b);
    /* True median: average the two middle values for even-length
       arrays. Old code (sorted[Math.floor(N/2)]) picked the UPPER
       middle for even N — e.g. [100,200,300,400] returned 300 not
       250, which biased the outlier band high enough to drop the
       cheapest legitimate offer as an "outlier" relative to its
       inflated centre. Odd-N case unchanged: floor(N/2) is the
       true middle index. */
    const mid = Math.floor(sorted.length / 2);
    medianPrice = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  const referencePrice = anchorPriceNgn > 0 ? anchorPriceNgn : medianPrice;
  const dedupedFiltered = referencePrice > 0
    ? deduped.filter((o) => {
        const p = o.price;
        if (p <= 0) return false;
        const ratio = p / referencePrice;
        return ratio >= 1 / ANCHOR_OUTLIER_RATIO && ratio <= ANCHOR_OUTLIER_RATIO;
      })
    : deduped;

  /* Per-store rows for the PriceComparisonBar. Sorted cheapest first so
     the bar can plot dots in display order and the 'cheapest at [Store]'
     lookup is perStoreOffers[0]. effectiveNgn is the RAW merchant price
     (#16) so the spectrum's headline / "cheapest" agrees with the hero
     big-price and the price-history chart, which both lead with the raw
     price. isCrossBorder still drives the "+ ~30% shipping/customs" est.
     disclaimer so the cross-border caveat is never lost. */
  const perStoreOffers: PerStoreOffer[] = dedupedFiltered
    .map((o) => ({
      storeId:       o.storeId,
      storeName:     o.storeName,
      storeLogoUrl:  o.storeLogoUrl,
      effectiveNgn:  o.price,
      isCrossBorder: isCrossBorderForUser(o, country),
      offerId:       o.offerId,
      isUsed:        isUsedListing(o.storeName, o.productTitle),
    }))
    .filter((r) => r.effectiveNgn > 0)
    .sort((a, b) => a.effectiveNgn - b.effectiveNgn);

  const effectives = perStoreOffers.map((r) => r.effectiveNgn);

  /* totalStores MUST count the SAME set the PriceComparisonBar headlines, or
     ProductHero's "Compare prices across N stores" CTA contradicts the bar
     sitting right beneath it (reported June 2026). The bar plots its spectrum,
     every "across N stores" label, and its dots over the NEW-only, priced
     subset (used/refurb become a separate labelled line; zero-price rows are
     dropped). dedupedFiltered.length counted both, so a 6-new + 2-used product
     headlined "across 8 stores" above a 6-store spectrum. Recount off
     perStoreOffers (already price>0 filtered) minus used, mirroring the bar's
     exact all-used fallback (PriceComparisonBar L168-169): when EVERY listing
     is used, keep counting them all since there's no new price to compare. */
  const newStoreCount    = perStoreOffers.filter((r) => !r.isUsed).length;
  const comparableStores = newStoreCount > 0 ? newStoreCount : perStoreOffers.length;

  /* The canonical store set behind totalStores, as full StoreOffers (one per
     store, cheapest-first), so a caller that RENDERS rows (the /compare anchor
     card) shows exactly the set we counted -- no second, divergent dedup. Same
     new-only + all-used fallback + price>0 + sort as perStoreOffers/totalStores
     above, just preserving the whole offer (url, title, logo) instead of the
     thin per-store projection. */
  const pricedOffers = dedupedFiltered.filter((o) => o.price > 0);
  const newPriced    = pricedOffers.filter((o) => !isUsedListing(o.storeName, o.productTitle));
  const comparableOffers = (newPriced.length > 0 ? newPriced : pricedOffers)
    .slice()
    .sort((a, b) => a.price - b.price);

  return {
    totalStores: Math.max(1, comparableStores),
    priceStats: effectives.length > 1
      ? {
          thisPriceNgn: anchorPriceNgn,
          lowest:  Math.min(...effectives),
          highest: Math.max(...effectives),
          count:   effectives.length - 1,
        }
      : undefined,
    perStoreOffers,
    comparableOffers,
  };
}
