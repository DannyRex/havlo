import Link from "next/link";
import { getActiveBrowseProvider } from "@/lib/providers";
import { filterDealsForCountry, type Country } from "@/lib/country";
import { classifyDeal } from "@/lib/providers/curated-helper";
import type { Deal } from "@/types";
import TrendingDealsGrid, { type TrendingBuckets } from "@/components/landing/TrendingDealsGrid";

/* ── Trending pool composition ──────────────────────────────────────
   Builds the balanced multi-bucket POOL the homepage trending grid
   draws from. The actual per-visit pick (which 16 cards show) happens
   client-side in TrendingDealsGrid — see that file for why.

   Bucket-based, not origin-based:
     local      → country-native retailers the visitor can shop
                  same-day. For NG: only is_international=false rows
                  (Konga, Jumia, 3C Hub, Slot, HealthPlus, Supermart).
                  For non-NG: anything not Amazon/AliExpress in the
                  country-filtered intl pool (Currys, ASOS, Best Buy…).
     amazon     → all amazon-* marketplaces (.com/.co.uk/.de/.ae/.in).
     aliexpress → just the one storeId. Cross-border tail.
     intl-other → NG-only. Non-monetised cross-border retailers
                  (Best Buy, Currys, ASOS, Macy's…). NG shoppers use
                  these via freight forwarders, but they shouldn't
                  crowd same-day NG retailers out of the local quota.

   Target visit mix: 9 local / 4 Amazon / 1 AliExpress / 2 intl-other
   = 16 (≈55% local, ≈30% Amazon+AliExpress, ≈12.5% intl-other). The
   client picks against that quota per visit; backfill there tops up
   from any non-empty bucket when one (e.g. intlOther on non-NG) is
   thin or empty.

   Per-bucket POOL CAPS are sized at roughly 5× the per-visit quota so
   the client's random 16-pick has real depth to draw from on every
   reload. PER_STORE_CAP keeps one dominant retailer (Currys for UK,
   Konga for NG, …) from monopolising its bucket. */
const PER_STORE_CAP       = 5;
const POOL_CAP_LOCAL      = 45;
const POOL_CAP_AMAZON     = 20;
const POOL_CAP_ALIEXPRESS = 5;
const POOL_CAP_INTL_OTHER = 10;

function capPerStore(bucket: Deal[], cap: number): Deal[] {
  const seen = new Map<string, number>();
  const out: Deal[] = [];
  for (const d of bucket) {
    const c = seen.get(d.storeId) ?? 0;
    if (c >= cap) continue;
    seen.set(d.storeId, c + 1);
    out.push(d);
  }
  return out;
}

function composeBuckets(pool: Deal[], isNG: boolean): TrendingBuckets {
  /* Bucket the pool by classification.

     NG nuance: classifyDeal treats anything-not-Amazon-not-AliExpress
     as "local", which works for non-NG countries (the pool is
     pre-filtered to country-appropriate stores by
     filterDealsForCountry). For NG it leaks — Best Buy, Currys, ASOS,
     etc. all fall into 'local' and crowd actual NG retailers out of
     the local quota. So for NG, route non-NGN intl rows into a
     separate intl-other bucket: they keep their own small quota but
     don't take from the local quota up-front. */
  const bucketed: Record<"local" | "amazon" | "aliexpress" | "intl-other", Deal[]> = {
    local: [], amazon: [], aliexpress: [], "intl-other": [],
  };
  for (const d of pool) {
    const base = classifyDeal(d);
    if (isNG && base === "local" && d.currency !== "NGN") {
      bucketed["intl-other"].push(d);
    } else {
      bucketed[base].push(d);
    }
  }
  return {
    local:      capPerStore(bucketed.local,         PER_STORE_CAP).slice(0, POOL_CAP_LOCAL),
    amazon:     capPerStore(bucketed.amazon,        PER_STORE_CAP).slice(0, POOL_CAP_AMAZON),
    aliexpress: capPerStore(bucketed.aliexpress,    PER_STORE_CAP).slice(0, POOL_CAP_ALIEXPRESS),
    intlOther:  capPerStore(bucketed["intl-other"], PER_STORE_CAP).slice(0, POOL_CAP_INTL_OTHER),
  };
}

/* `country` arrives as a prop from the page so this component stays
   statically renderable per /[country]/. Removing the cookies() read
   here was part of the May 2026 perf fix that unlocked ISR caching. */
export default async function TrendingDeals({ country }: { country: Country }) {
  /* Pull from whichever browse provider is active (DB when populated,
     static fallback otherwise). */
  const provider = await getActiveBrowseProvider();

  const isNG = country.code === "ng";

  const qualityFilter = (d: Deal) =>
    d.title.length >= 10 &&
    d.title.length <= 70 &&
    !d.title.includes("\\") &&
    !(d.currency === "USD" && d.salePrice < 10);

  /* Build the candidate pool. NG users get four merged pools; non-NG
     users get two — both more than the previous one-pool fetch, so
     the client's per-visit pick has real depth to draw from.

     NG localFresh fetches 0%-discount local inventory sorted by
     newest. Bridge for retailers whose ingest path doesn't carry
     original_price metadata (Jumia via SerpAPI Google site-filter,
     Bitmarte, HealthPlus, etc): without it they'd be invisible on the
     homepage because the discount>=15 floor on the other pools
     excludes every row with discountPercent=0. The fourth NG pool is
     a Jumia-only direct pull as a backstop so Jumia inventory is
     always available even when localFresh's merged result is
     Konga/Ajebomarket-heavy. */
  let pool: Deal[];
  if (!isNG) {
    const [discountPool, freshPool] = await Promise.all([
      provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "intl" }),
      provider.fetchDeals({ sort: "newest",   minDiscount: 0,  origin: "intl" }),
    ]);
    pool = filterDealsForCountry(
      [...discountPool, ...freshPool].filter(qualityFilter),
      country,
    );
  } else {
    const [localPool, intlPool, localFreshPool, jumiaOnlyPool] = await Promise.all([
      provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "local" }),
      provider.fetchDeals({ sort: "discount", minDiscount: 15, origin: "intl" }),
      provider.fetchDeals({ sort: "newest",   minDiscount: 0,  origin: "local" }),
      provider.fetchDeals({ sort: "newest",   minDiscount: 0,  origin: "local", stores: ["jumia"] }),
    ]);
    pool = [
      ...localPool.filter(qualityFilter),
      ...intlPool.filter(qualityFilter),
      ...localFreshPool.filter(qualityFilter),
      ...jumiaOnlyPool.filter(qualityFilter),
    ];
  }

  if (pool.length === 0) return null;

  /* Compose the multi-bucket pool the client picks against. The
     server still does the heavy DB + classification work (cached by
     ISR); the client gets a ready-to-sample structure. */
  const buckets = composeBuckets(pool, isNG);
  const totalCandidates =
    buckets.local.length + buckets.amazon.length +
    buckets.aliexpress.length + buckets.intlOther.length;
  if (totalCandidates === 0) return null;

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

        {/* Card grid is a client component: it picks 16 randomly from
            the buckets on every fresh page load, so per-visit variety
            isn't capped by the ISR window the way the old 6-variant
            composition was. */}
        <TrendingDealsGrid buckets={buckets} />

        <div className="mt-8 text-center sm:hidden">
          <Link href="/deals" className="btn-secondary">
            See all deals →
          </Link>
        </div>
      </div>
    </section>
  );
}
