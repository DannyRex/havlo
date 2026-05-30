/* ──────────────────────────────────────────────────────────────────
   Trending grid pick logic — shared between the SERVER (the homepage
   shell, which composes the deterministic HEAD to preload the LCP
   image and render the grid in the first flush) and the CLIENT
   (TrendingDealsGrid, which re-picks the randomized TAIL per visit).

   Extracted out of TrendingDealsGrid.tsx (May 2026, LCP rework v5) so
   the page server component can compute the exact first card without
   importing the "use client" grid. Everything here is pure + framework
   agnostic: no React, no DOM, no Math.random unless randomize=true is
   explicitly requested. That purity is what lets the server and client
   agree byte-for-byte on the deterministic HEAD. */

import type { Deal } from "@/types";
import { spaceByStore } from "@/lib/providers/curated-helper";

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
export const TARGET = 16;

/* Cards that stay stable + eager so one of them owns the LCP. 4 ≈ the
   first masonry row on desktop (lg:columns-4) and the first ~2 rows on
   mobile (columns-2), i.e. the above-the-fold band. */
export const HEAD = 4;

/* Pull n unique items from `bucket` into `out`, deduping via `seen`.
   randomize=true uses a partial Fisher-Yates so each call returns a
   fresh random subset; randomize=false takes the first n in order
   (the SSR-stable default the server + first client render share). */
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

export function composePicks(buckets: TrendingBuckets, randomize: boolean): Deal[] {
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

/* The randomized remainder (cards 5-16). Draws a fresh random+balanced
   selection, drops anything already shown in the stable head, and trims
   to fill the rest of the grid. Runs only on the client (mount effect)
   so SSR stays deterministic. */
export function composeTail(buckets: TrendingBuckets, head: Deal[]): Deal[] {
  const headIds = new Set(head.map((d) => d.id));
  const randomized = composePicks(buckets, true).filter((d) => !headIds.has(d.id));
  return randomized.slice(0, TARGET - head.length);
}
