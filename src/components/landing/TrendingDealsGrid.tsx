"use client";

/* ──────────────────────────────────────────────────────────────────
   Homepage "Trending right now" grid — social-feed-style per-visit rotation.

   The country home is ISR-cached (page.tsx `revalidate`), so every visitor in
   the cache window receives the SAME server HTML — we can't personalise on the
   server. Variety has to come from the client after hydration.

   The problem this solves: the old grid re-picked the whole grid on every mount
   with an unseeded shuffle from a stable ~200-card pool and NO memory, so
   reloads + return visits kept surfacing the same faces — a new visitor could
   reasonably think the catalogue is thin.

   Approach (social feed): a per-country "recently-seen" window. A product that
   was just shown is held OUT of the next pick until the window ages out, so
   every reload / return surfaces FRESH inventory drawn from the deep pool. The
   change is new products appearing (reads as depth), not the same products
   reshuffling (reads as jitter). The grid is composed once per mount and never
   reshuffles while the user is looking.

   LCP + hydration: the server preloads composePicks(buckets,false)[0]'s image
   and renders that deterministic order; SSR == the first client render (picks
   === null → `base`), so there's no hydration mismatch. The mount effect then
   swaps in the fresh, exclusion-aware pick — the same whole-grid swap the page
   has always done (founder direction June 2026: "full rotation, nothing
   pinned"), now drawing genuinely fresh cards.

   Per country: the seen-window is keyed by countryCode; the buckets are already
   per-country (getTrendingBuckets), and a country switch re-runs the effect
   against the new country's window. */

import { useEffect, useMemo, useState } from "react";
import type { Deal } from "@/types";
import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
import AnimateIn from "@/components/ui/AnimateIn";
import { type TrendingBuckets, composePicks, TARGET } from "./trending-compose";

/* Re-exported so existing importers can keep pulling the type from here. */
export type { TrendingBuckets };

/* Recently-seen exclusion window (per country, localStorage). Window-level TTL
   (one timestamp from when the window began), not per-item, to keep the payload
   tiny. The window resets only after EXCLUSION_TTL_MS from its start, so a
   return visit hours (or a day or two) later still skips what was already seen;
   the FIFO cap below is what re-circulates the catalogue for active users, so
   nothing is excluded forever even within a window. */
const EXCLUSION_TTL_MS = 72 * 60 * 60 * 1000; // window lives ~3 days from its first visit
const EXCLUSION_CAP    = 120;                 // hold out at most ~7 grids' worth of products...
const EXCLUSION_TRIM   = 80;                  // ...then FIFO-trim to this so the deep pool keeps headroom
const seenKey = (cc: string) => `havlo:trending-seen:${cc}`;

interface SeenWindow { version: number; windowStart: number; dealIds: string[] }

/* Read the active window. Returns a FRESH window (empty, windowStart=now) when
   storage is empty, malformed, unavailable (private mode), or aged out. */
function readSeen(cc: string, now: number): { windowStart: number; ids: string[] } {
  try {
    const raw = localStorage.getItem(seenKey(cc));
    if (raw) {
      const w = JSON.parse(raw) as Partial<SeenWindow>;
      if (
        typeof w.windowStart === "number" &&
        now - w.windowStart < EXCLUSION_TTL_MS &&
        Array.isArray(w.dealIds)
      ) {
        return { windowStart: w.windowStart, ids: w.dealIds.filter((x) => typeof x === "string") };
      }
    }
  } catch { /* private mode / parse error — treat as a fresh window */ }
  return { windowStart: now, ids: [] };
}

function writeSeen(cc: string, windowStart: number, ids: string[]): void {
  try {
    const capped = ids.length > EXCLUSION_CAP ? ids.slice(ids.length - EXCLUSION_TRIM) : ids;
    localStorage.setItem(
      seenKey(cc),
      JSON.stringify({ version: 1, windowStart, dealIds: capped }),
    );
  } catch { /* private mode / quota — silent no-op */ }
}

export default function TrendingDealsGrid({
  buckets,
  countryCode,
}: {
  buckets: TrendingBuckets;
  countryCode: string;
}) {
  /* SSR-stable deterministic order — identical on server + the first client
     render so hydration matches and the server-preloaded lead image is the one
     painted first. */
  const base = useMemo(() => composePicks(buckets, false), [buckets]);

  const [picks, setPicks] = useState<Deal[] | null>(null);
  useEffect(() => {
    /* Storage access is isolated to readSeen / writeSeen, which guard their own
       faults (private mode, quota, malformed JSON) and degrade to a fresh
       window. So the pick logic below runs UNGUARDED on purpose — it's pure
       array work over the server-supplied pool and can't realistically throw,
       and not catching means a genuine bug surfaces instead of silently
       reverting to the old unseeded shuffle. If the effect ever did throw
       before setPicks, the grid simply keeps the deterministic SSR `base`. */
    const now = Date.now();
    const all = [
      ...buckets.local,
      ...buckets.amazon,
      ...buckets.aliexpress,
      ...buckets.intlOther,
    ];
    const { windowStart, ids } = readSeen(countryCode, now);
    const seen = new Set(ids);

    /* Drop recently-seen products, then pick fresh from the deep pool. */
    const next = composePicks(
      {
        local:      buckets.local.filter((d) => !seen.has(d.id)),
        amazon:     buckets.amazon.filter((d) => !seen.has(d.id)),
        aliexpress: buckets.aliexpress.filter((d) => !seen.has(d.id)),
        intlOther:  buckets.intlOther.filter((d) => !seen.has(d.id)),
      },
      true,
    );

    /* Backfill from the full pool (re-allowing seen) ONLY if exclusions left
       the grid short — thin market or heavy reloading. Never under-fills below
       what the whole pool can supply. */
    if (next.length < TARGET) {
      const have = new Set(next.map((d) => d.id));
      for (const d of all) {
        if (next.length >= TARGET) break;
        if (!have.has(d.id)) { next.push(d); have.add(d.id); }
      }
    }

    /* Record what we just showed so the next visit skips it (FIFO, capped). */
    const shown = next.map((d) => d.id);
    const shownSet = new Set(shown);
    writeSeen(countryCode, windowStart, [...ids.filter((id) => !shownSet.has(id)), ...shown]);

    setPicks(next);
  }, [buckets, countryCode]);

  const deals = picks ?? base;
  if (deals.length === 0) return null;

  /* CSS columns fill column-major (top-to-bottom down each column). The
     top-left card renders eager (priority, no fade) so the homepage paints a
     lead image fast; the rest fade in with a gentle low stagger. */
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
