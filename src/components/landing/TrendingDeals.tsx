import Link from "next/link";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry } from "@/lib/country";
import { classifyDeal, spaceByStore } from "@/lib/providers/curated-helper";
import type { Deal } from "@/types";
import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
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

export default async function TrendingDeals() {
  /* Pull from whichever browse provider is active (DB when populated,
     static fallback otherwise). Sort by discount → over-sample top N
     → shuffle → per-store cap → take 16. */
  const provider = await getActiveBrowseProvider();

  const country = getServerCountry();
  const isNG = country.code === "ng";

  const qualityFilter = (d: Deal) =>
    d.title.length >= 10 &&
    d.title.length <= 70 &&
    !d.title.includes("\\") &&
    !(d.currency === "USD" && d.salePrice < 10);

  /* Composition is now bucket-based, not origin-based.

     Buckets:
       local      → everything that isn't Amazon or AliExpress.
                    For NG: Konga, Jumia, 3C Hub, Slot, etc.
                    For non-NG: country-native stores (Currys, ASOS,
                    Best Buy, Walmart, John Lewis, …).
       amazon     → all amazon-* marketplaces (.com, .co.uk, .de, .ae,
                    .in). The biggest commission stream we have.
       aliexpress → just the one storeId. Cross-border tail.

     Target mix: 50% local, ~37.5% Amazon, ~12.5% AliExpress (8 / 6 / 2
     of 16). Reasoning:
       • 50% local keeps the homepage feeling rooted in stores the
         visitor already trusts and can buy from same-day.
       • 50% combined Amazon + AliExpress maximises monetised clicks
         since those are the affiliate networks Havlo actively earns
         from. Amazon gets the larger slice (higher commission per
         click + higher cart values + faster delivery via local FBA);
         AliExpress gets the tail slot for cross-border discovery.

     If a bucket is thin at the current rotation window, the cascade
     backfills from the others — never showing fewer than 16 cards. */
  const TARGET_TOTAL = 16;
  const Q_LOCAL      = 8;
  const Q_AMAZON     = 6;
  const Q_ALIEXPRESS = 2;

  const rng = makeRng(freshnessSeed());

  /* Build the candidate pool. NG users get both local NGN + intl USD
     pools merged; non-NG users only see intl filtered to their country. */
  let pool: Deal[];
  if (!isNG) {
    const raw = await provider.fetchDeals({
      sort: "discount", minDiscount: 15, origin: "intl",
    });
    pool = filterDealsForCountry(raw.filter(qualityFilter), country);
  } else {
    const [localPool, intlPool] = await Promise.all([
      provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "local" }),
      provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "intl" }),
    ]);
    pool = [
      ...localPool.filter(qualityFilter),
      ...intlPool.filter(qualityFilter),
    ];
  }

  if (pool.length === 0) return null;

  /* Bucket the pool by classification, then shuffle each bucket
     within the rotation window so picks rotate every 5 min. */
  const bucketed: Record<"local" | "amazon" | "aliexpress", Deal[]> = {
    local: [], amazon: [], aliexpress: [],
  };
  for (const d of pool) bucketed[classifyDeal(d)].push(d);
  bucketed.local      = seededShuffle(bucketed.local,      rng);
  bucketed.amazon     = seededShuffle(bucketed.amazon,     rng);
  bucketed.aliexpress = seededShuffle(bucketed.aliexpress, rng);

  const seen = new Set<string>();
  const storeCount: Record<string, number> = {};
  const picks: Deal[] = [];

  function tryPush(d: Deal, perStoreCap: number): boolean {
    const sc = storeCount[d.storeId] ?? 0;
    if (sc >= perStoreCap) return false;
    const key = d.storeId + d.title.slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    storeCount[d.storeId] = sc + 1;
    picks.push(d);
    return true;
  }

  /* Per-store cap. Local bucket is many-store (Konga, Jumia, 3C Hub,
     ASOS, Currys, …) so we size cap = quota / distinct-stores with a
     floor of 3 so a thin pool still fills up. Amazon needs a higher
     cap (3-4) because each marketplace counts as its own storeId
     even though they share commission economics. AliExpress only
     has one storeId so its cap is the full quota. */
  function distinctStoreCap(pool: Deal[], quota: number, floor = 3): number {
    const stores = new Set(pool.map((d) => d.storeId)).size;
    if (stores === 0) return floor;
    return Math.max(floor, Math.ceil(quota / stores));
  }
  const capLocal      = distinctStoreCap(bucketed.local,      Q_LOCAL);
  const capAmazon     = Math.max(3, distinctStoreCap(bucketed.amazon, Q_AMAZON, 3));
  const capAliExpress = Q_ALIEXPRESS;

  function fill(bucket: Deal[], quota: number, cap: number): number {
    let added = 0;
    for (const d of bucket) {
      if (added >= quota) break;
      if (tryPush(d, cap)) added++;
    }
    return added;
  }

  fill(bucketed.local,      Q_LOCAL,      capLocal);
  fill(bucketed.amazon,     Q_AMAZON,     capAmazon);
  fill(bucketed.aliexpress, Q_ALIEXPRESS, capAliExpress);

  /* Backfill cascade — ordered by what we'd rather show if a bucket
     under-filled. Local first (trust + same-day delivery), then Amazon
     (highest commission), then AliExpress. Use a generous per-store
     cap during backfill so a thin pool can still reach 16. */
  if (picks.length < TARGET_TOTAL) {
    for (const bucket of [bucketed.local, bucketed.amazon, bucketed.aliexpress]) {
      for (const d of bucket) {
        if (picks.length >= TARGET_TOTAL) break;
        tryPush(d, 4);
      }
      if (picks.length >= TARGET_TOTAL) break;
    }
  }

  if (picks.length === 0) return null;

  /* Spread same-storeId items so the masonry doesn't show 4 Konga
     cards stacked vertically in column 0. spaceByStore is a single
     swap-pass over the flat array; chunkLeftToRight then distributes
     the result into 2/3/4 columns. With 7+ distinct stores across 16
     cards the resulting columns end up visually mixed. */
  const staggered = spaceByStore(picks);

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

        {/* Single render via CSS columns — addresses Bucket 1#24 from
            QA audit. Previously rendered three full DOM copies (mobile
            2-col / tablet 3-col / desktop 4-col), CSS-hidden via media
            queries. Each <img> still fetched even when the parent was
            display:none, costing 3× network requests for the trending
            grid. CSS column-count picks the right column count per
            viewport from a single rendering, and break-inside-avoid
            keeps each card intact. eagerFirst is approximated as
            'first 4 cards across all columns' since the browser
            decides column allocation at paint time. */}
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
          {staggered.map((d, i) => (
            <div key={d.id} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
              <AnimateIn delay={Math.min(i, 6) * 60}>
                <MasonryCard
                  deal={d}
                  aspect={MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]}
                  priority={i < 4}
                />
              </AnimateIn>
            </div>
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
