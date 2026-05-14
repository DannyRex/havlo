"use client";

/* Fallback rail shown on PDPs when pgFtsFindDupes returns nothing
   relevant — curated Amazon entries with unique titles, AliExpress
   garbled titles that don't match any other DB rows, very niche
   products. Without this rail the PDP renders a hero and then a
   blank wall.

   Shape matches SimilarProducts deliberately so the visual treatment
   feels continuous: same CSS-columns masonry, same MasonryCard, same
   aspect rotation. Just a different data source (raw Deal[] from a
   category fetch) and a different section header above the grid
   (set by the caller in [country]/p/[id]/page.tsx).

   Single-render CSS-columns approach matches /deals + SimilarProducts
   so we don't multi-mount the same MasonryCard across viewport
   breakpoints. */

import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
import type { Deal } from "@/types";

interface Props {
  deals: Deal[];
}

export default function FallbackCategoryRail({ deals }: Props) {
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
