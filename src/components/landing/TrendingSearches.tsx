import Link from "next/link";
import { Store } from "lucide-react";
import { getTrendingMultiStoreTitles, type MultiStoreChip } from "@/lib/trending-multi-store";

/* ──────────────────────────────────────────────────────────────────
   Chip pool sourcing (round-3 QA refactor):
     The previous pool was a hardcoded ~60 aspirational queries
     (iPhone 15 Pro Max, Drunk Elephant Bronzing Drops, etc.). Many
     of them returned "Nothing in our local index" or anchored on
     a 1-store result — clicking a chip felt like a teaser, not a
     useful shortcut.

     Replaced with a data-driven pool: titles from products that
     have ≥2 distinct in-stock store offers in the DB. If we can
     compare it across stores, it qualifies. Otherwise we don't show
     it (yet — once a second store carries the SKU, it auto-
     enters the pool on the next 5-min cache cycle).

     Cached at the module level (unstable_cache, 5 min TTL) so all
     homepage renders in the rotation window share one DB round
     trip. Falls back to hiding the section if the catalog has no
     multi-store products (early-launch market or DB outage).
   ────────────────────────────────────────────────────────────────── */

/* ── 5-min seeded PRNG (mulberry32) ──────────────────────────────── */
const ROTATION_MS = 5 * 60 * 1000;

function freshnessSeed(): number {
  const bucket = Math.floor(Date.now() / ROTATION_MS).toString();
  let h = 2166136261;
  for (let i = 0; i < bucket.length; i++) {
    h ^= bucket.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* The fake "trend %" function and arrow icon are gone. The QA
   feedback was right — both the bare percentage and the up-arrow
   were synthetic signals with no real data behind them. The chip
   pool is now driven by ACTUAL cross-store coverage; show the real
   store count next to each chip instead. */

const VISIBLE_COUNT = 14;

/* One chip — extracted so mobile (horizontal scroll) and desktop
   (flex-wrap grid) layouts can both render it without JSX
   duplication. Round-4 QA also flagged "no separator between title
   and count" — adding mx-1 between the title text and the count
   pill so the gap is visually obvious even when icon rendering
   varies across browsers. */
function ChipLink({ title, storeCount }: MultiStoreChip) {
  return (
    <Link
      href={`/compare?q=${encodeURIComponent(title)}&mode=similar`}
      className="group inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-bg border border-border hover:border-border-strong hover:shadow-card transition-all whitespace-nowrap shrink-0 active:scale-95"
      aria-label={`${title}, available across ${storeCount.toLocaleString()} stores — open price comparison`}
    >
      <span className="text-[13px] sm:text-sm font-medium text-ink">{title}</span>
      <span
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-3 tabular-nums px-2 py-0.5 rounded-full bg-surface-2"
        title={`${storeCount} stores carry this`}
      >
        <Store size={11} strokeWidth={2.25} aria-hidden="true" />
        {storeCount.toLocaleString()}
      </span>
    </Link>
  );
}

export default async function TrendingSearches() {
  /* Pull the current cross-store-overlap pool. Cached 5 min at the
     module level so multiple homepage renders in the same rotation
     window share one DB round trip. Empty pool → hide the section
     (better than showing chips that 404 into "no results"). */
  const pool = await getTrendingMultiStoreTitles();
  if (pool.length === 0) return null;

  const rng = makeRng(freshnessSeed());
  const items: MultiStoreChip[] = seededShuffle(pool, rng).slice(0, VISIBLE_COUNT);

  return (
    <section className="py-12 sm:py-16 bg-surface-2/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-end justify-between mb-5 sm:mb-6 gap-4">
          <div>
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-1.5">
              Cross-store coverage
            </p>
            {/* Heading + framing match what the chips ACTUALLY are
                now: products where we can show real cross-store
                price differences. Was "What people are searching
                for" with a "Popular this week" eyebrow — both
                implied user-activity data we don't actually have.
                Founder voice: name the thing accurately. */}
            <h2 className="text-[22px] sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight">
              Real comparisons in your country
            </h2>
            <p className="text-[13px] text-ink-2 mt-1.5 max-w-xl">
              Each chip below opens a side-by-side of the actual stores carrying it. No teasers.
            </p>
          </div>
        </div>

        {/* Chip rail — horizontal scroll on mobile, wrap to multi-row
            grid on desktop. Was `flex overflow-x-auto sm:flex-wrap`
            which broke on desktop because overflow-x-auto and
            flex-wrap can conflict — desktop showed a single row that
            scrolled instead of wrapping (one ultra-long chip filled
            the entire viewport with the rest hidden). Round-4 QA
            caught this.

            Now: separate mobile and desktop layout via two display
            modes. Mobile keeps the scroll affordance; desktop is a
            true wrap grid with no horizontal overflow. */}
        <div className="-mx-4 sm:mx-0">
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 sm:hidden">
            {items.map(({ title, storeCount }) => (
              <ChipLink key={title} title={title} storeCount={storeCount} />
            ))}
          </div>
          <div className="hidden sm:flex sm:flex-wrap gap-2.5">
            {items.map(({ title, storeCount }) => (
              <ChipLink key={title} title={title} storeCount={storeCount} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
