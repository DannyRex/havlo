import Link from "next/link";
import { getActiveBrowseProvider } from "@/lib/providers";
import { filterDealsForCountry, type Country } from "@/lib/country";
import { classifyDeal, spaceByStore } from "@/lib/providers/curated-helper";
import type { Deal } from "@/types";
import TrendingDealsGrid from "@/components/landing/TrendingDealsGrid";

/* ── Seeded RNG ─────────────────────────────────────────────────────
   mulberry32 PRNG + Fisher-Yates shuffle. Each trending VARIANT is a
   composition of the candidate pool under a distinct shuffle seed. */
function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
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

/* Distinct shuffle seeds — TrendingDeals composes one full 16-card
   variant per seed and ships them all in the ISR payload;
   <TrendingDealsGrid/> rotates between them client-side, one per
   visit. 6 variants × the grid's 5-minute rotation bucket = a
   30-minute cycle, so a visitor returning within the half hour
   reliably sees a fresh set even though the page HTML is ISR-cached
   (revalidate=3600) and identical for every visitor in that window.

   Why not just rotate server-side? ISR means the server renders the
   homepage once per cache window and every visitor gets that same
   HTML — a server-picked seed is frozen for the whole hour. Rotation
   has to happen on the client. See TrendingDealsGrid for the detail.

   The seed values are arbitrary well-known hash constants; only their
   distinctness matters — each yields a different Fisher-Yates order,
   so each variant draws a near-disjoint set from the (deep) pool.
   Across the 6 variants a visitor sees ~6× more distinct products
   over a session than the previous single frozen pick did. */
const VARIANT_SEEDS = [
  0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xff51afd7,
] as const;

/* ── Trending composition ───────────────────────────────────────────
   composeVariant() is pure — (pool, isNG, seed) → Deal[] — so the
   server can run it once per VARIANT_SEED at no extra DB cost (the
   pool is fetched once; only the in-memory shuffle/fill repeats).

   Composition is bucket-based, not origin-based:
     local      → country-native retailers the visitor can shop
                  same-day. For NG: only is_international=false rows
                  (Konga, Jumia, 3C Hub, Slot, HealthPlus, Supermart).
                  For non-NG: anything not Amazon/AliExpress in the
                  country-filtered intl pool (Currys, ASOS, Best Buy…).
     amazon     → all amazon-* marketplaces (.com/.co.uk/.de/.ae/.in).
                  The biggest commission stream we have.
     aliexpress → just the one storeId. Cross-border tail.
     intl-other → NG-only. Non-monetised cross-border retailers
                  (Best Buy, Currys, ASOS, Macy's…). NG shoppers DO
                  use these via freight forwarders, but they shouldn't
                  crowd same-day NG retailers out of the local quota.

   Target mix: 9 local / 4 Amazon / 1 AliExpress / 2 intl-other = 16
   (≈55% local, ≈30% Amazon+AliExpress, ≈12.5% intl-other). Reasoning:
     • 55% local keeps the homepage anchored in stores the visitor
       already trusts and can buy from same-day.
     • Amazon + AliExpress at ≈30% keeps the monetised affiliate
       streams visible without over-rotating to them. Split 4:1 —
       Amazon has higher commission per click and stronger NG delivery
       via marketplace sellers.
     • intl-other gets a dedicated 2-slot quota so cross-border
       retailers surface every rotation for freight-forwarder users.

   If a bucket is thin for a given seed the cascade backfills from the
   others — never showing fewer than 16 cards while the pool allows. */
const TARGET_TOTAL = 16;
const Q_LOCAL = 9;
const Q_AMAZON = 4;
const Q_ALIEXPRESS = 1;
const Q_INTL_OTHER = 2;

function composeVariant(pool: Deal[], isNG: boolean, seed: number): Deal[] {
  const rng = makeRng(seed);

  /* Bucket the pool by classification.

     NG nuance: classifyDeal treats anything-not-Amazon-not-AliExpress
     as "local", which works for non-NG countries (the pool is pre-
     filtered to country-appropriate stores by filterDealsForCountry).
     For NG it leaks — Best Buy, Currys, ASOS, etc. all fall into
     'local' and crowd actual NG retailers out of the local quota. So
     for NG, route non-NGN intl rows into a separate intl-other
     bucket: they keep their own small quota but don't take from the
     local quota up-front. */
  const bucketed: Record<"local" | "amazon" | "aliexpress" | "intl-other", Deal[]> = {
    local: [],
    amazon: [],
    aliexpress: [],
    "intl-other": [],
  };
  for (const d of pool) {
    const base = classifyDeal(d);
    if (isNG && base === "local" && d.currency !== "NGN") {
      bucketed["intl-other"].push(d);
    } else {
      bucketed[base].push(d);
    }
  }
  bucketed.local = seededShuffle(bucketed.local, rng);
  bucketed.amazon = seededShuffle(bucketed.amazon, rng);
  bucketed.aliexpress = seededShuffle(bucketed.aliexpress, rng);
  bucketed["intl-other"] = seededShuffle(bucketed["intl-other"], rng);

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

  /* Per-store cap. Local bucket is many-store so we size cap =
     quota / distinct-stores with a floor of 3 so a thin pool still
     fills. Amazon needs a higher cap because each marketplace counts
     as its own storeId despite shared commission economics.
     AliExpress is one storeId so its cap is the full quota. */
  function distinctStoreCap(bucket: Deal[], quota: number, floor = 3): number {
    const stores = new Set(bucket.map((d) => d.storeId)).size;
    if (stores === 0) return floor;
    return Math.max(floor, Math.ceil(quota / stores));
  }
  const capLocal = distinctStoreCap(bucketed.local, Q_LOCAL);
  const capAmazon = Math.max(3, distinctStoreCap(bucketed.amazon, Q_AMAZON, 3));
  const capAliExpress = Q_ALIEXPRESS;
  const capIntlOther = distinctStoreCap(bucketed["intl-other"], Q_INTL_OTHER, 1);

  function fill(bucket: Deal[], quota: number, cap: number): number {
    let added = 0;
    for (const d of bucket) {
      if (added >= quota) break;
      if (tryPush(d, cap)) added++;
    }
    return added;
  }

  fill(bucketed.local, Q_LOCAL, capLocal);
  fill(bucketed.amazon, Q_AMAZON, capAmazon);
  fill(bucketed.aliexpress, Q_ALIEXPRESS, capAliExpress);
  fill(bucketed["intl-other"], Q_INTL_OTHER, capIntlOther);

  /* NG-only: guarantee at least 2 Jumia cards in the rotation. Jumia's
     ingest pulls a high-volume catalogue but the offers tend to have
     small or zero discounts (SerpAPI google rich-snippets often skip
     the strikethrough), so they get crowded out by higher-discount
     Konga / MedPlus rows. Without this floor Jumia can rotate to zero
     cards for a given seed even though the pool has hundreds of fresh
     Jumia rows. Only kicks in when the pool actually has Jumia rows. */
  if (isNG) {
    const JUMIA_FLOOR = 2;
    const jumiaInPool = pool.filter((d) => d.storeId === "jumia");
    const currentJumia = picks.filter((d) => d.storeId === "jumia").length;
    if (jumiaInPool.length > 0 && currentJumia < JUMIA_FLOOR) {
      const need = Math.min(JUMIA_FLOOR - currentJumia, jumiaInPool.length);
      const jumiaShuffled = seededShuffle(jumiaInPool, rng);
      let added = 0;
      for (const d of jumiaShuffled) {
        if (added >= need) break;
        const key = d.storeId + d.title.slice(0, 20);
        if (seen.has(key)) continue;
        /* Displace the lowest-priority current pick (intl-other →
           aliexpress → amazon → anything-non-Jumia) so we don't push
           out a Konga/3C Hub local card when we can drop an
           intl-other instead. */
        const displaceOrder: Array<(p: Deal) => boolean> = [
          (p) => bucketed["intl-other"].some((x) => x.id === p.id),
          (p) => p.storeId === "aliexpress",
          (p) => bucketed.amazon.some((x) => x.id === p.id),
          (p) => p.storeId !== "jumia",
        ];
        let displaced = false;
        for (const matches of displaceOrder) {
          for (let i = picks.length - 1; i >= 0; i--) {
            if (matches(picks[i])) {
              const removed = picks.splice(i, 1)[0];
              storeCount[removed.storeId] = (storeCount[removed.storeId] ?? 1) - 1;
              displaced = true;
              break;
            }
          }
          if (displaced) break;
        }
        if (displaced || picks.length < TARGET_TOTAL) {
          seen.add(key);
          storeCount[d.storeId] = (storeCount[d.storeId] ?? 0) + 1;
          picks.push(d);
          added++;
        }
      }
    }
  }

  /* Backfill cascade — ordered by what we'd rather show if a bucket
     under-filled: local first (trust + same-day delivery), then
     Amazon (highest commission), AliExpress, then intl-other. A
     generous per-store cap lets a thin pool still reach 16. */
  if (picks.length < TARGET_TOTAL) {
    for (const bucket of [
      bucketed.local,
      bucketed.amazon,
      bucketed.aliexpress,
      bucketed["intl-other"],
    ]) {
      for (const d of bucket) {
        if (picks.length >= TARGET_TOTAL) break;
        tryPush(d, 4);
      }
      if (picks.length >= TARGET_TOTAL) break;
    }
  }

  if (picks.length === 0) return [];

  /* Spread same-storeId items so the masonry doesn't stack 4 Konga
     cards in one column. minGap=4 matches the desktop column count. */
  return spaceByStore(picks, 4);
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

  /* Build the candidate pool. NG users get both local NGN + intl USD
     pools merged; non-NG users only see intl filtered to their
     country.

     NG-only third pool — `localFresh` — fetches 0%-discount local
     inventory sorted by newest. This is the bridge for retailers
     whose ingest path doesn't carry original_price metadata (Jumia
     via SerpAPI Google site-filter, Bitmarte, HealthPlus, etc).
     Without it they're invisible on the homepage because the
     discount>=15 floor on the other two pools excludes every row with
     discountPercent=0. The fourth pool is a Jumia-only direct pull as
     a backstop so the NG Jumia floor in composeVariant always has
     inventory to displace into the rotation. */
  let pool: Deal[];
  if (!isNG) {
    /* Non-NG markets used to pull a single discount-sorted pool, which
       left the trending grid drawing from at most ~500 country-relevant
       deals after quality filtering — small enough that the 6 seeded
       variants overlapped heavily and the random-pick rotation read as
       "same products" (user report from /uk). Parallel-fetch a second
       "newest" pool (any discount) so freshly-ingested low- and
       zero-discount inventory can surface alongside the high-discount
       items. Roughly doubles the candidate pool, makes the variants
       more distinct, and brings non-NG closer to NG's multi-pool
       composition. */
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
      provider.fetchDeals({ sort: "newest", minDiscount: 0, origin: "local" }),
      provider.fetchDeals({ sort: "newest", minDiscount: 0, origin: "local", stores: ["jumia"] }),
    ]);
    pool = [
      ...localPool.filter(qualityFilter),
      ...intlPool.filter(qualityFilter),
      ...localFreshPool.filter(qualityFilter),
      ...jumiaOnlyPool.filter(qualityFilter),
    ];
  }

  if (pool.length === 0) return null;

  /* Compose one full trending variant per seed. The pool is fetched
     once above; composeVariant is pure in-memory work, so six
     variants cost six array shuffles, not six DB round-trips.
     <TrendingDealsGrid/> rotates between them client-side per visit. */
  const variants = VARIANT_SEEDS.map((seed) => composeVariant(pool, isNG, seed)).filter(
    (v) => v.length > 0,
  );

  if (variants.length === 0) return null;

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

        {/* Card grid is a client component so it can rotate between the
            precomposed variants per visit — see TrendingDealsGrid. */}
        <TrendingDealsGrid variants={variants} />

        <div className="mt-8 text-center sm:hidden">
          <Link href="/deals" className="btn-secondary">
            See all deals →
          </Link>
        </div>
      </div>
    </section>
  );
}
