/* Pure layout utilities for the masonry grid.
   Lives in its own file so server components can import them while
   MasonryCard.tsx itself is a client component (uses useCountry). */

/** Aspect ratios that interleave nicely for the masonry feel */
export const MASONRY_ASPECTS = [
  "aspect-[3/4]",
  "aspect-[2/3]",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-[2/3]",
  "aspect-[4/5]",
  "aspect-[5/6]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[2/3]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[5/6]",
  "aspect-[2/3]",
];

/** Distribute items into N columns left-to-right (item 0 → col 0, item 1 → col 1, …) */
export function chunkLeftToRight<T>(items: T[], cols: number): T[][] {
  const buckets: T[][] = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => buckets[i % cols].push(it));
  return buckets;
}
