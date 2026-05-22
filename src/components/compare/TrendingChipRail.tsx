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

import { useEffect, useMemo, useState } from "react";
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
  /** Ms between auto-rotations. Default 5000 (matches the
      SearchBar "Try:" chip cadence so the rotation feels uniform
      across surfaces). 0 disables rotation. */
  rotateEveryMs?: number;
}

/* Deterministic seeded shuffle so SSR + first client paint pick
   the same chip order (no hydration mismatch). Once the first
   rotation tick fires, we switch to Math.random()-based shuffles
   for variety. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

export default function TrendingChipRail({
  countryCode,
  limit = 10,
  rotateEveryMs = 5000,
}: Props) {
  const [items, setItems] = useState<MultiStoreChip[]>([]);
  const [loading, setLoading] = useState(true);
  /* Rotation tick counter — bumps every rotateEveryMs to trigger a
     fresh random pick from the pool. Memoized visible list re-
     evaluates whenever this changes. */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trending-chips?country=${encodeURIComponent(countryCode)}`)
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

  /* Auto-rotate. Stops when the pool fits in one frame (no point
     rotating if every chip is already shown) or when rotateEveryMs
     is 0 (caller opted out). */
  useEffect(() => {
    if (rotateEveryMs <= 0) return;
    if (items.length <= limit) return;
    const id = setInterval(() => setTick((t) => t + 1), rotateEveryMs);
    return () => clearInterval(id);
  }, [items.length, limit, rotateEveryMs]);

  /* Visible chips. Only products carried by 2 or more distinct stores
     belong in a "Popular comparisons" rail; the storeCount filter is a
     defensive second gate on top of the API, which already filters to
     multi-store products.

     Selection is grouped by category and drawn round-robin (one chip
     per category each pass) so every category with comparable data
     gets an even share of the rail. A category with no >= 2-store
     products simply is not in the pool, so its slots redistribute to
     the categories that do have data (the requested fallback). tick 0
     is seeded so the first paint is stable; later ticks use
     Math.random() for rotation variety. */
  const visible = useMemo<MultiStoreChip[]>(() => {
    const pool = items.filter((c) => c.storeCount >= 2);
    if (pool.length === 0) return [];

    /* Group the >= 2-store pool into per-category buckets. */
    const byCategory = new Map<string, MultiStoreChip[]>();
    for (const c of pool) {
      const cat = c.categorySlug ?? "other";
      const arr = byCategory.get(cat) ?? [];
      arr.push(c);
      byCategory.set(cat, arr);
    }

    /* Shuffle within each bucket, and shuffle the category order, so
       the rail varies between page loads and rotations. */
    const buckets = Array.from(byCategory.values()).map((arr, i) =>
      tick === 0 ? seededShuffle(arr, arr.length + i + 1) : pickRandom(arr, arr.length),
    );
    const ordered = tick === 0
      ? seededShuffle(buckets, buckets.length + 1)
      : pickRandom(buckets, buckets.length);

    /* Round-robin: one chip per category each pass until the rail is
       full or every bucket is drained. Even representation; a category
       that runs out drops from the rotation and its slots go to the
       rest. */
    const out: MultiStoreChip[] = [];
    let drew = true;
    while (out.length < limit && drew) {
      drew = false;
      for (const bucket of ordered) {
        if (out.length >= limit) break;
        const next = bucket.shift();
        if (next) { out.push(next); drew = true; }
      }
    }
    return out;
  }, [items, tick, limit]);

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
        {/* Skeleton mirrors the real-state layout (flex-wrap with
            natural-width chips) so there's no layout jump when the
            fetched chips replace the placeholders. Mixed widths
            approximate the eventual ragged-edge rhythm.

            Class names listed statically so Tailwind's JIT picks
            them up — dynamic interpolation (w-${w}) doesn't work. */}
        <div className="flex flex-wrap gap-2">
          {["w-24", "w-28", "w-20", "w-32", "w-24", "w-20"].map((w, i) => (
            <span
              key={i}
              className={`h-8 rounded-full bg-surface-2 animate-pulse ${w}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    );
  }

  /* Hide the whole rail when there are no genuinely-comparable chips,
     rather than rendering a "Popular comparisons" header with nothing
     (or single-store filler) under it. */
  if (visible.length === 0) return null;

  return (
    <section className="mt-6 sm:mt-8" aria-label="Popular comparisons">
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles size={12} className="text-ink-3" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          Popular comparisons
        </span>
      </div>
      {/* Layout: natural-width chips with flex-wrap on every
          breakpoint. Names render in full (no ellipsis), rows wrap
          as needed when long chip names push beyond the row.
          User direction after iterating through scroll + grid
          variants — full names beat fixed-grid alignment.

          Trade-off: rows are ragged when chip lengths vary widely.
          Acceptable because the value of each chip is the product
          name being legible at a glance. */}
      <div className="flex flex-wrap gap-2">
        {visible.map((chip) => (
          <Link
            /* Key includes the rotation tick so each rotation mounts
               a fresh DOM node and re-plays the fade-in animation.
               Same pattern as the SearchBar "Try:" chips. */
            key={`${chip.title}-${tick}`}
            /* searchQuery is the RAW DB title (better FTS hit) used
               for display + URL sharing. pid is the product_id
               backstop — if the catalog shifts between chip-pool
               generation and this click (orphan cleanup, signature
               merge), /api/compare falls back to direct lookup so
               the user ALWAYS sees the comparison the chip promised.
               Round-4 QA: user clicked a chip and got "Nothing in
               our local index" because of exactly that timing gap. */
            href={`/${countryCode}/compare?q=${encodeURIComponent(chip.searchQuery)}&pid=${chip.productId}&mode=similar`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border hover:border-border-strong hover:shadow-card transition-all whitespace-nowrap active:scale-95 animate-fade-in"
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
