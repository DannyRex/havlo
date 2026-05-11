"use client";

/* Chip rail on /compare.

   Surfaces the same multi-store cross-store-overlap pool that lived
   on the homepage in round 3, but with two changes from QA round 4:

     1. Moved here. The homepage section was competing with
        TrendingDeals + CategoryGrid for the same attention; this
        page is where users actively want comparison shortcuts.

     2. Friendlified consumer labels. The previous chips read like
        DB rows ("APPLE AIRPODS 4", "Samsung Galaxy A06-A065F
        Android Mobile Smart Phone With 64GB+4GB") — felt hostile
        as click targets. Labels are now "AirPods 4", "Galaxy A06",
        "iPhone 17 Pro" etc. via friendlifyChipTitle in
        src/lib/chip-titles.ts.

   Loads on mount via /api/trending-chips. Hides itself if the pool
   is empty or the fetch fails (better than rendering an empty rail).

   Renders directly above the search input area on the empty-state
   /compare page so a first-time visitor sees an immediate
   "here's what to click" affordance before they have to type. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { MultiStoreChip } from "@/lib/trending-multi-store";

interface Props {
  /** Country code from the URL params, used to namespace the
      /compare links so a UK user clicking "AirPods 4" lands on
      /uk/compare. */
  countryCode: string;
  /** Max chips to render. Default 10 — keeps the rail compact. */
  limit?: number;
}

export default function TrendingChipRail({ countryCode, limit = 10 }: Props) {
  const [items, setItems] = useState<MultiStoreChip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trending-chips")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems((data.items ?? []) as MultiStoreChip[]);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* Loading skeleton — small placeholder chips so the layout doesn't
     jump when the real data arrives a moment later. */
  if (loading) {
    return (
      <section className="mt-6 sm:mt-8" aria-label="Popular comparisons (loading)">
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles size={12} className="text-ink-3" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Popular comparisons
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="h-8 w-24 rounded-full bg-surface-2 animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  const visible = items.slice(0, limit);

  return (
    <section className="mt-6 sm:mt-8" aria-label="Popular comparisons">
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles size={12} className="text-ink-3" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          Popular comparisons
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((chip) => (
          <Link
            key={chip.title}
            /* searchQuery is the RAW DB title (better FTS hit) used
               for display + URL sharing. pid is the product_id
               backstop — if the catalog shifts between chip-pool
               generation and this click (orphan cleanup, signature
               merge), /api/compare falls back to direct lookup so
               the user ALWAYS sees the comparison the chip promised.
               Round-4 QA: user clicked a chip and got "Nothing in
               our local index" because of exactly that timing gap. */
            href={`/${countryCode}/compare?q=${encodeURIComponent(chip.searchQuery)}&pid=${chip.productId}&mode=similar`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border hover:border-border-strong hover:shadow-card transition-all whitespace-nowrap active:scale-95"
            aria-label={`${chip.title}, available across ${chip.storeCount.toLocaleString()} stores`}
          >
            <span className="text-[13px] font-medium text-ink">{chip.title}</span>
            <span className="text-[10px] font-semibold text-ink-3 tabular-nums">
              {chip.storeCount}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
