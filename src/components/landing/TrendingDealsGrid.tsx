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

   Hydration: useState starts at null, so SSR + first client render
   show the deterministic take-first-N default. A mount effect then
   re-picks randomly. AnimateIn keeps every card at opacity:0 on first
   paint and React 18 batches the swap, so the user only sees the
   final random picks fade in. */

import { useEffect, useState } from "react";
import type { Deal } from "@/types";
import { spaceByStore } from "@/lib/providers/curated-helper";
import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
import AnimateIn from "@/components/ui/AnimateIn";

export interface TrendingBuckets {
  local:      Deal[];
  amazon:     Deal[];
  aliexpress: Deal[];
  intlOther:  Deal[];
}

/* Per-visit quota — same 56/25/6/13 split the prior variant
   composition enforced. Sums to 16. Backfill below tops up the rest
   from any non-empty bucket when one comes back thin (e.g. non-NG
   markets have an empty intlOther bucket by classification). */
const Q_LOCAL      = 9;
const Q_AMAZON     = 4;
const Q_ALIEXPRESS = 1;
const Q_INTL_OTHER = 2;
const TARGET       = 16;

/* Pull n unique items from `bucket` into `out`, deduping via `seen`.
   randomize=true uses a partial Fisher-Yates so each call returns a
   fresh random subset; randomize=false takes the first n in order
   (the SSR-stable default before the mount effect runs). */
function selectFrom(
  bucket: Deal[],
  n: number,
  randomize: boolean,
  out: Deal[],
  seen: Set<string>,
): void {
  if (n <= 0 || bucket.length === 0) return;
  const arr = randomize ? [...bucket] : bucket;
  if (randomize) {
    const limit = Math.min(n, arr.length);
    for (let i = 0; i < limit; i++) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  let added = 0;
  for (const d of arr) {
    if (added >= n) break;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(d);
    added++;
  }
}

function composePicks(buckets: TrendingBuckets, randomize: boolean): Deal[] {
  const picks: Deal[] = [];
  const seen  = new Set<string>();

  selectFrom(buckets.local,      Q_LOCAL,      randomize, picks, seen);
  selectFrom(buckets.amazon,     Q_AMAZON,     randomize, picks, seen);
  selectFrom(buckets.aliexpress, Q_ALIEXPRESS, randomize, picks, seen);
  selectFrom(buckets.intlOther,  Q_INTL_OTHER, randomize, picks, seen);

  /* Backfill: any bucket that came back thin (non-NG has no
     intlOther, AliExpress is sometimes empty per country) gets
     compensated by drawing more from the other buckets so the grid
     never under-fills to <16. */
  if (picks.length < TARGET) {
    const need = TARGET - picks.length;
    const all  = [
      ...buckets.local,
      ...buckets.amazon,
      ...buckets.aliexpress,
      ...buckets.intlOther,
    ];
    selectFrom(all, need, randomize, picks, seen);
  }

  /* Spread same-storeId items so the masonry doesn't stack four
     Konga (or four Currys) cards in one column. minGap=4 matches the
     desktop column count. */
  return spaceByStore(picks, 4);
}

export default function TrendingDealsGrid({ buckets }: { buckets: TrendingBuckets }) {
  /* null = not yet picked. SSR and the first client render fall
     through to the deterministic take-first default below (matches
     the SSR HTML so hydration is clean). The mount effect then
     re-picks randomly per visit. */
  const [picks, setPicks] = useState<Deal[] | null>(null);

  useEffect(() => {
    /* Pick once on mount — fresh random selection per page load.
       Deliberately NOT re-run on an interval: the grid never
       reshuffles under the user mid-session. */
    setPicks(composePicks(buckets, true));
  }, [buckets]);

  const settled = picks !== null;
  const deals   = picks ?? composePicks(buckets, false);
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
