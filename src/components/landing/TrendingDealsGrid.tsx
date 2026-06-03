"use client";

/* ──────────────────────────────────────────────────────────────────
   Homepage "Trending right now" grid — client-side per-visit picks.

   The country home is ISR-cached (page.tsx `revalidate`), so every
   visitor inside the cache window receives the SAME cached HTML. We
   can't pick per-visit on the server. The earlier approach was to
   pre-compose 6 balanced 16-card VARIANTS server-side and have the
   client random-pick one — but that capped the entire ISR window's
   variety at ~50-60 distinct cards (6 variants × 16 with overlap),
   so after a few reloads the cards felt recycled (user feedback on
   /uk after the random-variant-pick shipped).

   New shape:
     · Server ships a wider, balanced POOL of ~80 candidates split
       into category buckets (local / amazon / aliexpress / intlOther).
     · This component picks 16 on every mount, sampling per quota from
       each bucket so the result stays balanced. With ~80 cards in the
       pool, the number of distinct 16-card subsets is combinatorially
       large — every reload feels fresh, even within a single ISR
       window.

   Hydration + LCP (May 2026 rework): the grid is split into a stable
   HEAD and a randomized TAIL.

     · HEAD (first 4 cards) is the deterministic take-first selection,
       computed identically on server and client (useMemo). It renders
       eager + fetchPriority=high and is NOT wrapped in AnimateIn, so
       it ships in the SSR HTML, is discoverable immediately, paints
       without an opacity:0 fade, and never swaps on mount. That makes
       a HEAD image the LCP element and kills the old ~2s LCP penalty
       where the whole grid was client-picked: the LCP <img> used to
       ship lazy in SSR, then get replaced + faded in after hydration.

     · TAIL (cards 5-16) still re-picks randomly in a mount effect for
       per-visit freshness, and keeps the AnimateIn fade.

   LCP rework v5 (May 2026): the pick logic (composePicks / composeTail
   / HEAD / quotas) moved to ./trending-compose so the page SERVER
   component can compute the exact deterministic HEAD[0], preload its
   image, and render this grid in the first SSR flush (no Suspense
   chunk). See trending-compose.ts + page.tsx. This component is
   otherwise unchanged: it still re-picks the TAIL on mount.

   Tradeoff: the top row no longer varies on every reload within a
   15-min ISR window (it refreshes each window). The 12 tail cards
   still reshuffle per visit, so the page keeps feeling fresh. */

import { useEffect, useMemo, useState } from "react";
import type { Deal } from "@/types";
import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
import AnimateIn from "@/components/ui/AnimateIn";
import {
  type TrendingBuckets,
  composePicks,
} from "./trending-compose";

/* Re-exported so existing importers (TrendingDeals) can keep pulling
   the type from here OR from trending-compose interchangeably. */
export type { TrendingBuckets };

export default function TrendingDealsGrid({ buckets }: { buckets: TrendingBuckets }) {
  /* SSR-stable deterministic order — identical on server + the FIRST
     client render so hydration matches and the server-preloaded lead
     image (composePicks[0]) is the one painted first. */
  const base = useMemo(() => composePicks(buckets, false), [buckets]);

  /* Re-pick the WHOLE grid on mount so EVERY card — including the
     top-left lead — is fresh per visit (founder direction June 2026:
     full rotation, nothing pinned). The OLD code pinned a 4-card HEAD;
     because CSS columns fill top-to-bottom, that head WAS the left
     column, so it never rotated while the rest did. null until the mount
     effect so SSR + the first client render both use `base` (no hydration
     mismatch + the server-preloaded lead paints first); then it swaps to
     a fresh random pick. Not on an interval — never reshuffles
     mid-session. */
  const [picks, setPicks] = useState<Deal[] | null>(null);
  useEffect(() => {
    setPicks(composePicks(buckets, true));
  }, [buckets]);

  const deals = picks ?? base;
  if (deals.length === 0) return null;

  /* CSS columns fill column-major, i.e. top-to-bottom down each column
     before moving right — that's the reading order we want. The top-left
     card renders eager (priority, no fade) so the homepage paints a lead
     image fast; every card rotates per visit, and the rest fade in with a
     gentle, low stagger so the grid reveals as a soft top-to-bottom wash
     rather than a left-column-first block. */
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
      {deals.map((d, i) => {
        const isLead = i === 0;
        const card = (
          <MasonryCard
            deal={d}
            aspect={MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]}
            priority={isLead}
          />
        );
        return (
          <div key={d.id} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
            {isLead ? card : <AnimateIn delay={Math.min(i, 8) * 30}>{card}</AnimateIn>}
          </div>
        );
      })}
    </div>
  );
}
