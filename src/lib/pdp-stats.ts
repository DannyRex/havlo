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
import { effectiveLandedPrice } from "@/lib/landed-price";

export interface AnchorStats {
  /** Unique-stores count for the "Compare prices across N stores" CTA.
      Floored at 1 so curated rows (which return an empty anchor pool
      from pgFtsAnchorOffersByProductId) still render a sensible
      label. */
  totalStores: number;
  /** Price-comparison-bar stats. Undefined when the anchor has ≤ 1
      offer after filtering — the bar's single-store path activates
      via the absence of this prop. */
  priceStats: {
    thisPriceNgn: number;
    lowest:  number;
    highest: number;
    /** OTHER stores compared (excludes the anchor offer itself), per
        the bar's prop contract. */
    count:   number;
  } | undefined;
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

  const effectives = deduped
    .map((o) => effectiveLandedPrice(o, country))
    .filter((p) => p > 0);

  return {
    totalStores: Math.max(1, deduped.length),
    priceStats: effectives.length > 1
      ? {
          thisPriceNgn: anchorPriceNgn,
          lowest:  Math.min(...effectives),
          highest: Math.max(...effectives),
          count:   effectives.length - 1,
        }
      : undefined,
  };
}
