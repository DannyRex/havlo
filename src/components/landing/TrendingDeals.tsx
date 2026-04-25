"use client";

import { useMemo } from "react";
import Link from "next/link";
import { deals } from "@/lib/data/deals";
import type { Deal } from "@/types";
import MasonryCard, {
  MASONRY_ASPECTS,
  chunkLeftToRight,
} from "@/components/deals/MasonryCard";

function MasonryColumn({
  items, gapClass, startIndex,
}: { items: Deal[]; gapClass: string; startIndex: number }) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {items.map((d, i) => (
        <MasonryCard
          key={d.id}
          deal={d}
          aspect={MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]}
        />
      ))}
    </div>
  );
}

export default function TrendingDeals() {
  const picks = useMemo(() => {
    const filtered = deals
      .filter(
        (d) =>
          d.discountPercent >= 15 &&
          d.title.length >= 10 &&
          d.title.length <= 70 &&
          !d.title.includes("\\") &&
          !(d.currency === "USD" && d.salePrice < 10),
      )
      .sort((a, b) => b.discountPercent - a.discountPercent);

    const seen = new Set<string>();
    const storeCount: Record<string, number> = {};
    const out: Deal[] = [];
    for (const d of filtered) {
      if (out.length >= 16) break;
      const sc = storeCount[d.storeId] ?? 0;
      if (sc >= 4) continue;
      const key = d.storeId + d.title.slice(0, 20);
      if (seen.has(key)) continue;
      seen.add(key);
      storeCount[d.storeId] = sc + 1;
      out.push(d);
    }
    return out;
  }, []);

  const mobileCols  = useMemo(() => chunkLeftToRight(picks, 2), [picks]);
  const tabletCols  = useMemo(() => chunkLeftToRight(picks, 3), [picks]);
  const desktopCols = useMemo(() => chunkLeftToRight(picks, 4), [picks]);

  if (picks.length === 0) return null;

  return (
    <section className="py-12 sm:py-20 bg-bg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">

        <div className="flex items-end justify-between mb-6 sm:mb-8 gap-4 px-1 sm:px-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success">
                Live
              </span>
            </div>
            <h2 className="text-[26px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
              Trending right now
            </h2>
            <p className="text-sm sm:text-base text-ink-2 mt-1.5 hidden sm:block">
              The biggest price drops we&apos;ve found across stores today.
            </p>
          </div>
          <Link
            href="/deals"
            className="text-sm font-medium text-ink-2 hover:text-ink transition-colors hidden sm:inline-flex items-center gap-1 shrink-0"
          >
            See all →
          </Link>
        </div>

        {/* Mobile — 2 cols, L→R */}
        <div className="flex gap-2 sm:hidden">
          {mobileCols.map((col, i) => (
            <MasonryColumn key={i} items={col} gapClass="gap-2" startIndex={i * 100} />
          ))}
        </div>

        {/* Tablet — 3 cols */}
        <div className="hidden sm:flex lg:hidden gap-3">
          {tabletCols.map((col, i) => (
            <MasonryColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} />
          ))}
        </div>

        {/* Desktop — 4 cols */}
        <div className="hidden lg:flex gap-4">
          {desktopCols.map((col, i) => (
            <MasonryColumn key={i} items={col} gapClass="gap-4" startIndex={i * 100} />
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link href="/deals" className="btn-secondary">
            See all deals →
          </Link>
        </div>

      </div>
    </section>
  );
}
