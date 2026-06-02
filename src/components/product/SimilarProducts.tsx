"use client";

/* "Cheaper alternatives" grid on the PDP. Takes DupeResult[] from
   pgFtsFindDupes and renders one MasonryCard per group, where each
   card points at the cheapest offer in that group.

   Layout: a left-to-right responsive GRID (#19). It used to be a CSS
   multi-column masonry, but `columns-*` fills VERTICALLY — card 1 sits
   above card 2 in the first column, so the eye reads top-to-bottom
   instead of across. Users expect "You may also like" to read left to
   right (card 1, 2, 3 across the first row). A grid does exactly that in
   a single DOM pass (no triple-DOM mobile/tablet/desktop trick that 3x'd
   image fetches), at the cost of the staggered-height masonry look — so
   every card gets the SAME aspect for clean, aligned rows. */

import MasonryCard from "@/components/deals/MasonryCard";
import type { DupeResult } from "@/lib/search";
import type { Deal } from "@/types";

/* Uniform card aspect so grid rows align cleanly (no masonry stagger).
   4:5 portrait suits product imagery without over-cropping. */
const SIMILAR_ASPECT = "aspect-[4/5]";

interface Props {
  dupes:       DupeResult[];
  /** Country code threaded through so the per-card link target is
      country-aware (`/uk/compare?q=…` not `/compare?q=…`). */
  countryCode: string;
}

/* Convert a DupeResult (pooled product across stores) into a Deal
   the existing MasonryCard knows how to render. Use the CHEAPEST
   offer in the group as the card's anchor — that's the price the
   user will see if they click through.

   Why one card per group, not one card per offer: visual parity with
   /deals (where each card is one product/best-offer pair) and to
   avoid the user scrolling 12 alternatives that are really 4 unique
   products. The compare page already does the per-offer breakdown
   when the user wants that level of detail. */
function dupeToDeal(d: DupeResult): Deal {
  /* Sort the dupe's offers by landed price (price + cross-border
     shipping/customs estimate) so the card surfaces the truly
     cheapest option including delivery. landedPrice falls back to
     price when the offer isn't international. */
  const best = [...d.offers].sort((a, b) => a.landedPrice - b.landedPrice)[0];

  return {
    /* Use the BEST offer's real offer_id so the card's link target
       resolves to a real PDP. Falls back to the synthetic
       storeId:productKey form (which routes to /compare via the
       linkHref override below) only when the dupes engine couldn't
       attach an offer_id — e.g. live-search results that aren't in
       the DB. */
    id:              best.offerId || (best.storeId + ":" + d.key),
    title:           d.title,
    description:     d.title,
    category:        d.category ?? "general",
    categorySlug:    d.category ?? "all",
    storeId:         best.storeId,
    storeName:       best.storeName,
    originalPrice:   best.originalPrice || best.price,
    salePrice:       best.price,
    discountPercent: best.discountPercent || 0,
    currency:        best.currency,
    /* Thread the DB-authoritative store_country through so MasonryCard's
       cross-border check (resolveStoreCountry) classifies the alt rail
       by the store's real market, not the USD-normalised currency. Was
       dropped before June 2026, so long-tail UK/DE stores on a UK PDP's
       "You may also like" rail leaked ≈ $X / INTL badges. */
    storeCountry:    best.storeCountry ?? null,
    imageUrl:        d.imageUrl ?? best.imageUrl,
    url:             best.url,
    expiresAt:       null,
    isHot:           (best.discountPercent ?? 0) >= 30,
    isFeatured:      false,
    tags:            [best.storeName, d.category ?? ""].filter(Boolean),
    saves:           0,
    clicks:          0,
    postedAt:        new Date().toISOString().slice(0, 10),
  };
}

export default function SimilarProducts({ dupes, countryCode }: Props) {
  const deals = dupes.map(dupeToDeal);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
      {deals.map((deal, i) => (
        /* Each card links to the real PDP for the cheapest offer of
           this dupe (deal.id is the offer_id via the offerId
           propagation through StoreOffer). Falls back to
           /compare?q={title} when the offer_id couldn't be attached —
           rare edge case for live results that aren't in the DB.
           Uniform aspect → the grid reads cleanly left-to-right (#19). */
        <MasonryCard
          key={deal.id + ":" + i}
          deal={deal}
          aspect={SIMILAR_ASPECT}
          priority={i < 2}
        />
      ))}
    </div>
  );
}
