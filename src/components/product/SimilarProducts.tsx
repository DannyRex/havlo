"use client";

/* "Cheaper alternatives" grid on the PDP. Takes DupeResult[] from
   pgFtsFindDupes and renders one MasonryCard per group, where each
   card points at the cheapest offer in that group.

   Same visual treatment as /deals so the user feels the cards are
   the same primitive they're already familiar with. The masonry
   columns layout is also lifted from TrendingDeals — single-render
   via CSS columns (no triple-DOM mobile/tablet/desktop trick that
   3x'd image fetches pre-Bucket-1-fix). */

import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
import type { DupeResult } from "@/lib/search";
import type { Deal } from "@/types";

interface Props {
  dupes: DupeResult[];
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
    id:              best.storeId + ":" + d.key, // synthetic; cards don't use it for routing in this path
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
    imageUrl:        d.imageUrl ?? best.imageUrl,
    imageGradient:   d.imageGradient ?? "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    imageEmoji:      d.imageEmoji ?? "🛍️",
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

export default function SimilarProducts({ dupes }: Props) {
  const deals = dupes.map(dupeToDeal);

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
      {deals.map((deal, i) => (
        <div key={deal.id + ":" + i} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
          <MasonryCard
            deal={deal}
            aspect={MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]}
            priority={i < 2}
          />
        </div>
      ))}
    </div>
  );
}
