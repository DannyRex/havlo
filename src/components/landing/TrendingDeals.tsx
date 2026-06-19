import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getActiveBrowseProvider } from "@/lib/providers";
import { filterDealsForCountry, type Country } from "@/lib/country";
import { classifyDeal } from "@/lib/providers/curated-helper";
import type { Deal, OriginFilter, SortOption } from "@/types";
import TrendingDealsGrid from "@/components/landing/TrendingDealsGrid";
import type { TrendingBuckets } from "@/components/landing/trending-compose";

/* Shared pool cache across ISR builds.

   Each composeBuckets pool requires 2–4 calls to provider.fetchDeals.
   Each call fans out to a 3-pass RPC (Pass A/B/C in browse-db.ts) so
   the homepage cold SSR was firing 6–12 RPCs every revalidate window.

   /api/deals had its own in-memory POOL_CACHE for the same fetch
   pipeline (Map+TTL, per Vercel instance). The homepage's TrendingDeals
   was *separate*, so it never shared a hit even when a visitor had just
   loaded /deals on the same instance.

   unstable_cache here gives:
     • Cross-build caching (the Next 14 data cache persists across ISR
       revalidations, so the 15-min revalidate window doesn't trigger
       a cold DB hit every time).
     • Cross-route sharing (if /api/deals later switches to
       unstable_cache too they'd share the same data cache).
     • Tag-based invalidation (`trending-pool`) so an ingest cron can
       call revalidateTag('trending-pool') to bust everything at once
       after a fresh scrape.

   TTL: 30 minutes. Same shape as the rest of the PDP data caches and
   half the homepage's revalidate window, so the pool can't drift more
   than half an ISR cycle behind. */
/* Longer RPC budget for the trending pool fetch than /api/deals' 2.5s
   default. This fetch only runs on a background ISR revalidation (the
   route is stale-while-revalidate, so no visitor ever waits on it), and
   on a cold serverless instance the first Supabase RPC can take >2.5s
   just to open the connection. At the tight default it trips the
   timeout → curated-Amazon-only fallback → capPerStore collapses it to
   one amazon store → the homepage renders 5 cards instead of 16, and
   that thin pool then poisons this 30-min cache. 6s clears a cold
   connection while staying well under Vercel's 30s function ceiling. */
const TRENDING_FETCH_TIMEOUT_MS = 6000;

const fetchPoolCached = unstable_cache(
  async (params: {
    sort:        SortOption;
    minDiscount: number;
    origin:      OriginFilter;
    country:     string;
    stores?:     string[];
  }): Promise<Deal[]> => {
    const provider = await getActiveBrowseProvider();
    /* noCuratedFallback: on a Pass A RPC failure, fetchDeals THROWS
       instead of returning the curated-only pool. Next does not persist
       a rejected cached fn, so a transient DB blip stays out of this
       cache (getTrendingBuckets catches it per-pool) and self-heals on
       the next render — instead of caching 5 curated cards for 30 min. */
    return provider.fetchDeals(
      {
        sort:         params.sort,
        minDiscount:  params.minDiscount,
        origin:       params.origin,
        country:      params.country,
        stores:       params.stores,
      },
      { timeoutMs: TRENDING_FETCH_TIMEOUT_MS, noCuratedFallback: true },
    );
  },
  /* v2 (May 2026): bumped from v1 to evict any 5-card degraded pools
     persisted by the pre-fix timeout fallback on first render after deploy. */
  ["trending-pool-v2"],
  { revalidate: 1800, tags: ["trending-pool"] },
);

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

   Per-bucket POOL CAPS are sized at roughly 12× the per-visit quota
   (#17, up from 5×) so the client's random 16-pick draws from a much
   deeper pool every reload and a repeat visitor stops seeing the same
   faces. The catalog easily backs this: ~6.4k qualifying deals for UK
   (3.4k at ≥15% off), ~9.5k for NG — the old ~80-item pool was
   throttling a catalog with thousands of eligible products. PER_STORE_CAP
   keeps one dominant retailer (Currys for UK, Konga for NG, …) from
   monopolising its bucket, so the deeper pool stays spread across many
   stores rather than 100 rows of one. */
const PER_STORE_CAP       = 5;
const POOL_CAP_LOCAL      = 110;
const POOL_CAP_AMAZON     = 48;
const POOL_CAP_ALIEXPRESS = 14;
const POOL_CAP_INTL_OTHER = 28;

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

/* Order a bucket so genuinely-clicked products lead (#18: "trending
   should actually reflect what people click"). The sort is STABLE, so
   among equal click counts the existing discount/freshness order is
   preserved — clicks are the PRIMARY signal, discount the secondary.

   This is a boost, not a swap: because the deterministic HEAD takes the
   FIRST items of each bucket (composePicks with randomize=false), the
   most-clicked products own the above-the-fold hero band, while the deep
   tail — almost all 0-click, the bulk of the ~200-item pool from #17 —
   still fills the bucket and randomizes per visit. So popularity drives
   what's featured without collapsing the larger-pool freshness. As click
   volume is still thin (a few hundred outbound clicks), most buckets have
   only a handful of clicked rows, and everything else simply keeps its
   discount order. Deal.clicks is populated upstream by rowToDeal from
   outbound_clicks over the last 30 days. */
function byClicksDesc(bucket: Deal[]): Deal[] {
  return [...bucket].sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));
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
  /* byClicksDesc before the per-store cap (#18) so a popular store's
     most-clicked rows survive the cap, and clicked rows lead each bucket
     → the stable HEAD features them. */
  return {
    local:      capPerStore(byClicksDesc(bucketed.local),         PER_STORE_CAP).slice(0, POOL_CAP_LOCAL),
    amazon:     capPerStore(byClicksDesc(bucketed.amazon),        PER_STORE_CAP).slice(0, POOL_CAP_AMAZON),
    aliexpress: capPerStore(byClicksDesc(bucketed.aliexpress),    PER_STORE_CAP).slice(0, POOL_CAP_ALIEXPRESS),
    intlOther:  capPerStore(byClicksDesc(bucketed["intl-other"]), PER_STORE_CAP).slice(0, POOL_CAP_INTL_OTHER),
  };
}

/* ── getTrendingBuckets ─────────────────────────────────────────────
   The fetch + compose pipeline, lifted out of the component (LCP
   rework v5, May 2026) so the PAGE SHELL can await it and render the
   grid in the first SSR flush instead of behind a Suspense chunk.
   Awaiting it in the shell is cheap on warm renders (every fetch is
   unstable_cache-backed, 30-min TTL) and never blocks a real visitor:
   the route is ISR (stale-while-revalidate), so the only render that
   pays the cold DB cost is a background revalidation no user waits on.

   Returns null when the pool / candidate set is empty so the caller
   can skip the section (and its image preload) entirely.

   `country` arrives as a param (not a cookies() read) so the page
   stays statically renderable per /[country]/. Removing the cookies()
   read was part of the May 2026 perf fix that unlocked ISR caching. */
export async function getTrendingBuckets(country: Country): Promise<TrendingBuckets | null> {
  const isNG = country.code === "ng";

  /* The homepage is the front door — never feature a card that renders
     blank or dead. Two guards added June 2026 after a post-deploy cache
     rebuild surfaced a thin window of imageless / dead-passthrough cards:
       1. require a real image (the old filter checked title + price only,
          so an imageless row fell straight through to the Havlo-logo
          fallback on the most prominent surface).
       2. exclude dead Google-Shopping passthroughs — offers whose
          outbound URL is a google.com/search?ibp=os redirect (no real
          product page), which the PDP liveness gate then renders as
          "No longer available" on click. Matched in both raw and
          URL-encoded form since the URL is wrapped in /api/go?url=. */
  const isDeadPassthrough = (u: string | undefined) =>
    !!u && /ibp(?:=|%3d)os|google\.[a-z.]+(?:\/|%2f)search/i.test(u);
  const qualityFilter = (d: Deal) =>
    d.title.length >= 10 &&
    d.title.length <= 70 &&
    !d.title.includes("\\") &&
    !(d.currency === "USD" && d.salePrice < 10) &&
    Boolean(d.imageUrl) &&
    !isDeadPassthrough(d.url);

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
     Konga/Ajebomarket-heavy.

     Every fetch routes through fetchPoolCached (defined above) so
     repeat ISR builds within the 30-min TTL hit the data cache
     instead of re-firing 3 RPCs per pool. Country is part of the
     cache key so per-market shards stay isolated. */
  let pool: Deal[];
  if (!isNG) {
    /* .catch(→[]) per pool: a Pass A RPC failure THROWS out of
       fetchPoolCached (so the blip isn't cached). Swallow it to an
       empty pool for THIS render so one failing fetch can't 500 the
       page — the other pool still supplies real cards, and the cache
       stays clean for the next render to retry. */
    const [discountPool, freshPool] = await Promise.all([
      fetchPoolCached({ sort: "discount", minDiscount: 15, origin: "intl", country: country.code }).catch(() => [] as Deal[]),
      fetchPoolCached({ sort: "newest",   minDiscount: 0,  origin: "intl", country: country.code }).catch(() => [] as Deal[]),
    ]);
    pool = filterDealsForCountry(
      [...discountPool, ...freshPool].filter(qualityFilter),
      country,
    );
  } else {
    /* .catch(→[]) per pool — see the non-NG branch above. A thrown
       (uncached) Pass A failure degrades to an empty pool for this
       render instead of 500ing; the surviving pools still fill the grid. */
    const [localPool, intlPool, localFreshPool, jumiaOnlyPool] = await Promise.all([
      fetchPoolCached({ sort: "discount", minDiscount: 15, origin: "local", country: country.code }).catch(() => [] as Deal[]),
      fetchPoolCached({ sort: "discount", minDiscount: 15, origin: "intl",  country: country.code }).catch(() => [] as Deal[]),
      fetchPoolCached({ sort: "newest",   minDiscount: 0,  origin: "local", country: country.code }).catch(() => [] as Deal[]),
      fetchPoolCached({ sort: "newest",   minDiscount: 0,  origin: "local", country: country.code, stores: ["jumia"] }).catch(() => [] as Deal[]),
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

  /* Rotate each bucket by a time-derived offset before returning. The grid
     HEAD (composePicks(..., false)) is DETERMINISTIC for the LCP byte-match,
     so without this it freezes on whatever leads each bucket — and since the
     non-NG pool is sorted discount-desc, the single highest-discount Amazon
     item (e.g. the Kindle Paperwhite in uk/us) sat in the featured band on
     EVERY rebuild. The offset advances hourly and is baked into the
     server-serialized buckets, so the server LCP preload and the client HEAD
     still agree within a render — only WHICH item leads cycles across the
     hourly ISR rebuilds. Clicks remain the primary upstream sort
     (byClicksDesc); at today's thin click volume that mostly ties, so this
     restores variety without discarding a genuine popularity signal. */
  const rot = Math.floor(Date.now() / 3_600_000); // advances every hour
  const rotate = <T,>(a: T[]): T[] => {
    if (a.length < 2) return a;
    const k = rot % a.length;
    return k === 0 ? a : [...a.slice(k), ...a.slice(0, k)];
  };
  return {
    local:      rotate(buckets.local),
    amazon:     rotate(buckets.amazon),
    aliexpress: rotate(buckets.aliexpress),
    intlOther:  rotate(buckets.intlOther),
  };
}

/* ── TrendingDeals (presentational) ─────────────────────────────────
   Takes the pre-fetched buckets from getTrendingBuckets (awaited in
   the page shell) so this renders synchronously in the first flush —
   the LCP product image now ships in the initial SSR HTML alongside
   the document + its <link rel=preload>, instead of arriving in a
   second Suspense streaming chunk. countryCode is passed instead of
   the full Country so the component stays a thin presentational leaf. */
export default function TrendingDeals({
  buckets,
  countryCode,
}: {
  buckets: TrendingBuckets;
  countryCode: string;
}) {
  return (
    <section className="py-10 sm:py-14 bg-bg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6 sm:mb-8 gap-4 px-1 sm:px-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success">
                Trending now
              </span>
            </div>
            <h2 className="text-[26px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
              Never overpay shopping online
            </h2>
            <p className="text-sm sm:text-base text-ink-2 mt-1.5 hidden sm:block">
              The biggest price drops we&apos;ve found across stores today.
            </p>
          </div>
          {/* Country-prefixed href — a bare /deals would get bounced
              through middleware, which falls back to the cookie when
              there's no URL country segment. A stale cookie (the
              visitor was on /uk last week, is on /ng today) then
              redirects them to the WRONG country's deals page. Always
              carry countryCode from the prop so the link is
              country-correct for the surface it renders on. */}
          <Link
            href={`/${countryCode}/deals`}
            className="text-sm font-medium text-ink-2 hover:text-ink transition-colors hidden sm:inline-flex items-center gap-1 shrink-0"
          >
            See all →
          </Link>
        </div>

        {/* Card grid is a client component: it re-picks ALL 16 cards on
            every fresh page load (founder direction June 2026 — full
            rotation, nothing pinned; the left column used to be a static
            4-card head), so per-visit variety isn't capped by the ISR
            window. The server still preloads the SSR lead's image so the
            first paint is fast even though the client then reshuffles. */}
        <TrendingDealsGrid buckets={buckets} countryCode={countryCode} />

        <div className="mt-8 text-center sm:hidden">
          <Link href={`/${countryCode}/deals`} className="btn-secondary">
            See all deals →
          </Link>
        </div>
      </div>
    </section>
  );
}
