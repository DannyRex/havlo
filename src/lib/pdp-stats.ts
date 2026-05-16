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
import { effectiveLandedPrice, isCrossBorderForUser } from "@/lib/landed-price";

/* Per-store summary the new PriceComparisonBar needs to plot dots
   along the spectrum. One row per distinct store remaining after
   the country + same-store-same-price dedup pass. */
export interface PerStoreOffer {
  storeId:       string;
  storeName:     string;
  storeLogoUrl:  string;
  effectiveNgn:  number;       // country-aware (local: base; intl: landed)
  isCrossBorder: boolean;      // for the visitor specifically
  offerId:       string;       // for "cheaper at [Store]" deep-link
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
}

/* Same-store + same-effective-price dedup — country-aware via
   effectiveLandedPrice. Round to nearest ₦100 so trivial
   FX-rounding differences don't leak through as separate rows.
   Mirrors lines 558-566 of /[country]/compare/page.tsx so the
   PDP CTA's N matches the compare anchor section's N exactly. */
function dedupAnchorOffers(offers: StoreOffer[], country: Country): StoreOffer[] {
  const seen = new Set<string>();
  return offers
    .filter((o) => o.landedPrice > 0)
    .filter((o) => {
      const eff = effectiveLandedPrice(o, country);
      const key = `${o.storeId}|${Math.round(eff / 100) * 100}`;
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
): AnchorStats {
  const countryFiltered = country.code === "ng"
    ? anchorOffers
    : anchorOffers.filter((o) => isOfferAllowedForCountry(o, country));

  const deduped = dedupAnchorOffers(countryFiltered, country);

  /* Outlier filter — defense against over-merged products in the DB.
     QA report May 2026 found a PDP whose product_id contained a £14
     accessory listing alongside the real £400+ Dyson V11 offers (the
     accessory was mis-signed at ingest and merged by the resignature
     script before the price-spread guard was added). At render time
     we don't have access to re-validate the merge, but we can refuse
     to plot an offer whose effective price is more than 4× off the
     anchor or more than 4× off the median offer.

     Median chosen over mean because a single £14 outlier wrecks the
     mean for a 5-offer spectrum. 4× chosen to match the resignature
     guard's MAX_GROUP_RATIO. Cross-border landed prices are used so
     the comparison apples-to-apples in the user's currency. */
  const ANCHOR_OUTLIER_RATIO = 4;
  const offerPrices = deduped.map((o) => effectiveLandedPrice(o, country)).filter((p) => p > 0);
  let medianPrice = 0;
  if (offerPrices.length > 0) {
    const sorted = [...offerPrices].sort((a, b) => a - b);
    medianPrice = sorted[Math.floor(sorted.length / 2)];
  }
  const referencePrice = anchorPriceNgn > 0 ? anchorPriceNgn : medianPrice;
  const dedupedFiltered = referencePrice > 0
    ? deduped.filter((o) => {
        const p = effectiveLandedPrice(o, country);
        if (p <= 0) return false;
        const ratio = p / referencePrice;
        return ratio >= 1 / ANCHOR_OUTLIER_RATIO && ratio <= ANCHOR_OUTLIER_RATIO;
      })
    : deduped;

  /* Per-store rows for the new PriceComparisonBar. Sorted cheapest
     first so the bar can plot dots in display order and the
     'cheapest at [Store]' lookup is perStoreOffers[0].
     effectiveNgn is country-aware via effectiveLandedPrice — local
     stores show base price, cross-border show landed (+ ~30%
     shipping/customs estimate). */
  const perStoreOffers: PerStoreOffer[] = dedupedFiltered
    .map((o) => ({
      storeId:       o.storeId,
      storeName:     o.storeName,
      storeLogoUrl:  o.storeLogoUrl,
      effectiveNgn:  effectiveLandedPrice(o, country),
      isCrossBorder: isCrossBorderForUser(o, country),
      offerId:       o.offerId,
    }))
    .filter((r) => r.effectiveNgn > 0)
    .sort((a, b) => a.effectiveNgn - b.effectiveNgn);

  const effectives = perStoreOffers.map((r) => r.effectiveNgn);

  return {
    totalStores: Math.max(1, dedupedFiltered.length),
    priceStats: effectives.length > 1
      ? {
          thisPriceNgn: anchorPriceNgn,
          lowest:  Math.min(...effectives),
          highest: Math.max(...effectives),
          count:   effectives.length - 1,
        }
      : undefined,
    perStoreOffers,
  };
}
