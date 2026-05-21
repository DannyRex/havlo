"use client";

/* ──────────────────────────────────────────────────────────────────
   Homepage "Trending right now" grid — client-side variant rotation.

   Why this is a client component:
   The country home is ISR-cached (revalidate=3600 in page.tsx), so
   every visitor inside the cache window is served the SAME static
   HTML. A trending shuffle seeded on the server is therefore frozen
   for up to an hour — every visit shows the identical 16 cards. That
   is the "I keep seeing the same products" report.

   Fix: TrendingDeals (server) precomputes several fully-composed
   16-card VARIANTS — each a valid, quota-balanced, store-capped draw
   from a different shuffle seed — and ships all of them in the ISR
   payload. This component picks ONE variant per visit, keyed to a
   wall-clock time bucket. The pick runs after hydration, so it varies
   between visits even though the cached HTML is identical for
   everyone. Rotation happens per VISIT (mount), not on a timer — the
   grid never reshuffles while the user is looking at it.

   No visible swap:
     · First render uses variant 0 — matches the SSR HTML, so there is
       no hydration mismatch.
     · A mount effect then selects the time-bucket variant. Every
       MasonryCard starts at opacity:0 inside AnimateIn, and React 18
       batches the variant swap into a single re-render before any
       card is painted visible — so the user only ever sees the final
       variant fade in on scroll.
     · `priority` (eager image loading) is withheld until the variant
       is settled, so variant 0's above-the-fold images aren't fetched
       only to be replaced a frame later.
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { Deal } from "@/types";
import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
import AnimateIn from "@/components/ui/AnimateIn";

/* Rotation cadence. With N variants this is an N×5-minute cycle: a
   visitor returning at least one bucket later lands on a different
   set. 5 min mirrors the <RefreshOnInterval/> cadence on the page. */
const ROTATION_MS = 5 * 60 * 1000;

export default function TrendingDealsGrid({ variants }: { variants: Deal[][] }) {
  /* null = not yet picked → render variant 0. Variant 0 also matches
     the server HTML, so first client render hydrates cleanly. The
     mount effect below then sets the real time-bucket index. */
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (variants.length === 0) return;
    /* Pick once, on mount — keyed to the current wall-clock bucket so
       each visit rotates. Deliberately NOT re-run on an interval:
       variants.length is constant for the page's lifetime, so this
       fires exactly once and the grid never swaps under the user. */
    const bucket = Math.floor(Date.now() / ROTATION_MS);
    setIndex(bucket % variants.length);
  }, [variants.length]);

  const settled = index !== null;
  const deals = variants[index ?? 0] ?? [];
  if (deals.length === 0) return null;

  /* Single render via CSS columns (not three media-query-hidden DOM
     copies): column-count picks the column count per viewport from
     one rendering, and break-inside-avoid keeps each card intact.
     `priority` is approximated as the first 4 cards in source order
     since the browser decides column allocation at paint time. */
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
      {deals.map((d, i) => (
        <div key={d.id} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
          <AnimateIn delay={Math.min(i, 6) * 60}>
            <MasonryCard
              deal={d}
              aspect={MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]}
              priority={settled && i < 4}
            />
          </AnimateIn>
        </div>
      ))}
    </div>
  );
}
