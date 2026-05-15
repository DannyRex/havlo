"use client";

/* Three-column masonry layout for /compare's "Cheaper alternatives"
   grid. Extracted from compare/page.tsx (May 2026, phase 3 refactor).

   Renders three column-distributed variants (mobile 2-col / tablet
   3-col / desktop 4-col) so cards flow left-to-right with varied
   heights from the cycled aspect ratios. The same layout pattern
   the homepage and /deals use — see components/deals/masonry-layout
   for the shared chunking + aspect rotation. */

import DupeCard from "@/components/compare/DupeCard";
import AnimateIn from "@/components/ui/AnimateIn";
import { MASONRY_ASPECTS, chunkLeftToRight } from "@/components/deals/masonry-layout";
import type { DupeResult } from "@/lib/search";

interface ColumnProps {
  items:       DupeResult[];
  gapClass:    string;
  startIndex:  number;
  query:       string;
}

function DupeColumn({ items, gapClass, startIndex, query }: ColumnProps) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {items.map((dupe, i) => (
        <AnimateIn key={dupe.key} delay={Math.min(i, 6) * 60}>
          <DupeCard
            dupe={dupe}
            rank={startIndex + i}
            query={query}
            mode="similar"
            aspect={MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]}
          />
        </AnimateIn>
      ))}
    </div>
  );
}

interface Props {
  dupes: DupeResult[];
  query: string;
}

export default function DupeMasonry({ dupes, query }: Props) {
  const mobileCols  = chunkLeftToRight(dupes, 2);
  const tabletCols  = chunkLeftToRight(dupes, 3);
  const desktopCols = chunkLeftToRight(dupes, 4);
  return (
    <>
      <div className="flex gap-3 sm:hidden">
        {mobileCols.map((col, i) => (
          <DupeColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} query={query} />
        ))}
      </div>
      <div className="hidden sm:flex lg:hidden gap-3">
        {tabletCols.map((col, i) => (
          <DupeColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} query={query} />
        ))}
      </div>
      <div className="hidden lg:flex gap-4">
        {desktopCols.map((col, i) => (
          <DupeColumn key={i} items={col} gapClass="gap-4" startIndex={i * 100} query={query} />
        ))}
      </div>
    </>
  );
}
