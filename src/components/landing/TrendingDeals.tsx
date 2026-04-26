import Link from "next/link";
import { getActiveBrowseProvider } from "@/lib/providers";
import type { Deal } from "@/types";
import MasonryCard, {
  MASONRY_ASPECTS,
  chunkLeftToRight,
} from "@/components/deals/MasonryCard";
import AnimateIn from "@/components/ui/AnimateIn";

/* Deterministic seed bucketed into 5-minute windows so picks rotate
   every 5 min. Server-rendered → no hydration mismatch. */
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

function MasonryColumn({
  items, gapClass, startIndex, eagerFirst = 0,
}: { items: Deal[]; gapClass: string; startIndex: number; eagerFirst?: number }) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {items.map((d, i) => (
        <AnimateIn key={d.id} delay={Math.min(i, 6) * 60}>
          <MasonryCard
            deal={d}
            aspect={MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]}
            priority={i < eagerFirst}
          />
        </AnimateIn>
      ))}
    </div>
  );
}

export default async function TrendingDeals() {
  /* Pull from whichever browse provider is active (DB when populated,
     static fallback otherwise). Sort by discount → over-sample top N
     → shuffle → per-store cap → take 16. */
  const provider = await getActiveBrowseProvider();

  /* Fetch local + international pools SEPARATELY so the locality quota
     can actually be honored. Earlier we sorted by discount across the
     whole pool — international deals tend to carry larger discount %,
     so the top 60 ended up mostly USD and the local quota under-filled.
     Splitting upstream guarantees enough local candidates to draw from. */
  const [localPool, intlPool] = await Promise.all([
    provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "local" }),
    provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "intl" }),
  ]);

  const qualityFilter = (d: Deal) =>
    d.title.length >= 10 &&
    d.title.length <= 70 &&
    !d.title.includes("\\") &&
    !(d.currency === "USD" && d.salePrice < 10);

  const localQuality = localPool.filter(qualityFilter);
  const intlQuality  = intlPool.filter(qualityFilter);

  if (localQuality.length + intlQuality.length === 0) return null;

  // Independent seeded shuffles so each pool rotates its own picks
  const rng = makeRng(freshnessSeed());
  const localShuffled = seededShuffle(localQuality.slice(0, 60), rng);
  const intlShuffled  = seededShuffle(intlQuality.slice(0, 60), rng);

  /* Dedupe + per-store cap + locality quota.
     Havlo is Nigeria-first, so the homepage should feel like a Nigerian
     marketplace with international deals as accent — not the other way
     around. Target ratio: ~70% local (NGN), 30% international (USD).
     Caps below are computed from TARGET_TOTAL so the math stays obvious. */
  const TARGET_TOTAL = 16;
  const LOCAL_QUOTA  = Math.round(TARGET_TOTAL * 0.7); // 11
  const INTL_QUOTA   = TARGET_TOTAL - LOCAL_QUOTA;     // 5

  const seen = new Set<string>();
  const storeCount: Record<string, number> = {};
  const picks: Deal[] = [];

  function tryPush(d: Deal, perStoreCap = 4): boolean {
    const sc = storeCount[d.storeId] ?? 0;
    if (sc >= perStoreCap) return false;
    const key = d.storeId + d.title.slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    storeCount[d.storeId] = sc + 1;
    picks.push(d);
    return true;
  }

  // Fill quotas from the dedicated pools first
  let localPicks = 0;
  let intlPicks  = 0;
  for (const d of localShuffled) {
    if (localPicks >= LOCAL_QUOTA) break;
    if (tryPush(d)) localPicks++;
  }
  for (const d of intlShuffled) {
    if (intlPicks >= INTL_QUOTA) break;
    if (tryPush(d)) intlPicks++;
  }

  /* Backfill from whichever side has more candidates if either pool
     under-filled (e.g. local pool too thin at this rotation window).
     Prefer local backfill so the homepage stays Naira-leaning. */
  if (picks.length < TARGET_TOTAL) {
    for (const d of localShuffled) {
      if (picks.length >= TARGET_TOTAL) break;
      tryPush(d);
    }
  }
  if (picks.length < TARGET_TOTAL) {
    for (const d of intlShuffled) {
      if (picks.length >= TARGET_TOTAL) break;
      tryPush(d);
    }
  }

  if (picks.length === 0) return null;

  const mobileCols  = chunkLeftToRight(picks, 2);
  const tabletCols  = chunkLeftToRight(picks, 3);
  const desktopCols = chunkLeftToRight(picks, 4);

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

        {/* eagerFirst={1} on each column: only the topmost card per column
            is eagerly loaded. That's the LCP candidate set on every viewport
            without flooding the network with priority hints. */}
        <div className="flex gap-2 sm:hidden">
          {mobileCols.map((col, i) => (
            <MasonryColumn key={i} items={col} gapClass="gap-2" startIndex={i * 100} eagerFirst={1} />
          ))}
        </div>
        <div className="hidden sm:flex lg:hidden gap-3">
          {tabletCols.map((col, i) => (
            <MasonryColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} eagerFirst={1} />
          ))}
        </div>
        <div className="hidden lg:flex gap-4">
          {desktopCols.map((col, i) => (
            <MasonryColumn key={i} items={col} gapClass="gap-4" startIndex={i * 100} eagerFirst={1} />
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
