import Link from "next/link";
import { ArrowRight, TrendingDown } from "lucide-react";
import { deals as staticDeals } from "@/lib/data/deals";
import { getActiveBrowseProvider } from "@/lib/providers";
import { filterDealsForCountry } from "@/lib/country";
import { displayStoreName } from "@/lib/store-display";
import type { Deal } from "@/types";

/* 5-min seeded PRNG so the collage rotates with the rest of the page.
   Same bucket pattern as TrendingDeals + TrendingSearches — keeps every
   "live" element on the page in sync. */
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

/* Pick `n` items from an already-shuffled list, constrained to one
   per unique store. Without this constraint the collage can show 3
   AliExpress cards (UK pool is 72% AliExpress) or 3 Essenza cards
   (NG pool is heavy on the recently-added Shopify retailers) — which
   reads as "Havlo only knows about one store" rather than the
   intended "Havlo aggregates across many stores".

   Two-pass: first pick one per unique storeId, then if we couldn't
   reach `n` distinct stores (rare — happens in narrow markets like
   ZA where 100% of intl is AliExpress), backfill from the remaining
   shuffled pool so the collage still gets 3 cards rather than 1 or 2. */
function pickDistinctStores<T extends { storeId: string }>(items: T[], n: number): T[] {
  const picked: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (picked.length >= n) break;
    if (seen.has(item.storeId)) continue;
    picked.push(item);
    seen.add(item.storeId);
  }
  /* Backfill — if catalog is too narrow to fill `n` distinct stores,
     keep the card count by allowing repeats from the shuffled tail. */
  if (picked.length < n) {
    for (const item of items) {
      if (picked.length >= n) break;
      if (picked.includes(item)) continue;
      picked.push(item);
    }
  }
  return picked;
}

/* Pick three country-appropriate product images, fresh every 5-min
   rotation. Server-rendered → SSR and CSR see the same picks (no
   hydration mismatch).

   Source priority (Bucket 2#1 + Bucket 3#1 fixes from QA audit):
     1. Live browse provider, filtered through filterDealsForCountry
        so a UK visitor sees Currys / Argos / John Lewis cards, a US
        visitor sees Walmart / Best Buy / Macy's, etc.
     2. Static `deals` array filtered by currency (NGN out for
        non-NG, kept for NG). Fallback when the live DB is thin or
        the filter trims everything.
   The static fallback prevents an empty collage on early traffic to
   a country whose catalog is still small. */
async function pickCollage(country: { code: string; name: string }): Promise<Deal[]> {
  const isNG = country.code === "ng";

  /* Try the live catalog first. fetchDeals returns the country's
     existing rows; we filter further to discount-worthy items with
     short clean titles for the polaroid aesthetic. */
  let candidates: Deal[] = [];
  try {
    const provider = await getActiveBrowseProvider();
    const live = await provider.fetchDeals({
      sort: "discount",
      minDiscount: 20,
      origin: isNG ? "all" : "intl",
    });
    const liveFiltered = filterDealsForCountry(
      live.filter((d) => d.imageUrl && d.title.length < 60),
      country as Parameters<typeof filterDealsForCountry>[1],
    );
    if (liveFiltered.length >= 3) candidates = liveFiltered;
  } catch {/* fall through to static */}

  /* Static fallback. Same currency filter as before so non-NG users
     never see Konga / 3C Hub products even when the live DB is empty. */
  if (candidates.length < 3) {
    candidates = staticDeals.filter((d) => {
      if (!d.imageUrl) return false;
      if (d.discountPercent < 20) return false;
      if (d.title.length >= 60) return false;
      if (!isNG && d.currency === "NGN") return false;
      return true;
    });
  }

  if (candidates.length < 3) return candidates;
  const rng = makeRng(freshnessSeed());
  /* Distinct-store constraint replaces the previous .slice(0, 3).
     Without it, dominant stores (AliExpress in UK, Essenza in NG)
     would land all three picks on the same brand. With it, the
     collage rotates across the full retailer mix Havlo aggregates,
     which is the actual product proof the homepage needs to make. */
  return pickDistinctStores(seededShuffle(candidates, rng), 3);
}

/* Reusable mini product card used in the collage */
function CollageCard({
  img, store, title, percent, w, h, rotate, top, left, right, bottom, z, badgeSize, className = "",
}: {
  img: string; store: string; title: string; percent: number;
  w: string; h: string; rotate: number;
  top?: string; left?: string; right?: string; bottom?: string;
  z?: number; badgeSize?: "sm" | "md" | "lg"; className?: string;
}) {
  const sz = badgeSize ?? "md";
  const badgeWH =
    sz === "lg" ? "w-14 h-14" : sz === "sm" ? "w-11 h-11" : "w-12 h-12";
  const numClass =
    sz === "lg" ? "text-base" : sz === "sm" ? "text-[13px]" : "text-sm";
  /* Normalise once for both the alt text and the visible caption.
     Collage cards pull storeName straight off the Deal, which can
     carry an "eBay - <seller-handle>" marketplace string — run it
     through the same display cleaner every other card uses so the
     homepage proof never leaks a raw seller handle. */
  const displayStore = displayStoreName(store);
  return (
    <div
      /* bg-white + fixed dark text so cards stay readable in BOTH themes —
         using semantic bg-bg/text-ink would invert in dark mode and the
         card would blend into the dark panel. Real product cards from
         retail sites are always white-bg too. */
      className={`absolute ${w} ${h} rounded-2xl bg-white overflow-hidden shadow-2xl pointer-events-auto ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        top, left, right, bottom,
        zIndex: z,
      }}
    >
      {/* True polaroid: 12px white gutter on all sides (from the outer
          card's bg-white showing through), image inset within. The inner
          frame previously used bg-zinc-50 which was too close to white
          to read as a frame — now transparent so the card's true white
          surrounds the image cleanly. */}
      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="flex-1 overflow-hidden rounded-lg ring-1 ring-zinc-100">
          {/* Alt text was previously alt="" which hid these product
             photos from screen readers entirely. The collage IS the
             product proof on the homepage CTA — the surrounding
             headline doesn't repeat what each card shows. Surface
             the title + store so an assistive-tech user knows what
             real catalog samples Havlo is showing them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={`${title} at ${displayStore}, ${percent}% off`} className="w-full h-full object-cover" />
        </div>
        <div className="pt-2.5 px-0.5">
          <p className="text-[11px] text-zinc-500 truncate">{displayStore}</p>
          <p className="text-[13px] font-semibold text-zinc-900 truncate mt-0.5">{title}</p>
        </div>
      </div>
      {/* Discount badge — anchored to the card corner, sits on the image edge */}
      <div
        className={`absolute top-3 right-3 ${badgeWH} rounded-full bg-red-600 text-white flex flex-col items-center justify-center`}
        style={{ boxShadow: "0 4px 12px rgba(220,38,38,0.4), 0 0 0 3px rgba(255,255,255,0.9)" }}
      >
        <span className={`${numClass} font-black leading-none`}>{percent}%</span>
        <span className="text-[8px] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-90">off</span>
      </div>
    </div>
  );
}

/* `country` arrives as a prop from the page so this component stays
   statically renderable per /[country]/. The cookies() read here was
   one of the six locations that forced the homepage out of ISR
   (May 2026 perf fix). */
export default async function CTA({ country }: { country: import("@/lib/country").Country }) {
  const collage = await pickCollage(country);

  return (
    <section className="py-14 sm:py-24 bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Outer relative wrapper — does NOT clip, lets cards bleed past panel */}
        <div className="relative">

          {/* Dark panel — fixed-color (zinc-950) instead of semantic bg-ink so
              it stays consistently dark in both themes. With bg-ink the panel
              would invert to near-white in dark mode and clash with the page. */}
          <div className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] bg-zinc-950 text-white lg:min-h-[480px]">
            {/* Left column lives in normal flow */}
            <div className="relative grid lg:grid-cols-2 items-center">
              <div className="px-6 py-12 sm:px-12 sm:py-16 lg:py-14 lg:pr-6">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/60 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Free · No account required
                </p>

                {/* Bottom CTA picks up the line that used to be the
                    hero H1. Keeps the 'similar products for less'
                    keyword visible on the page after the hero swap
                    so SEO + brand-voice continuity both hold. */}
                <h2 className="text-[32px] sm:text-5xl font-bold text-white tracking-[-0.035em] leading-[1.04] mb-5">
                  Find similar products
                  <br />
                  <span className="text-white/75">for less.</span>
                </h2>

                <p className="text-white/70 text-[15px] sm:text-lg leading-relaxed max-w-md mb-8">
                  Paste a link or search any product. We find the same item, or a cheaper alternative, at the stores you already shop.
                </p>

                {/* Country-prefixed hrefs. A bare /compare or /deals
                    would be bounced through middleware, which falls
                    back to the cookie when there's no URL segment to
                    read from. A stale cookie (e.g. last visit was
                    /uk, this visit is /ng) then redirects to the
                    WRONG country. Always carry country.code from the
                    prop so the link is country-correct. */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href={`/${country.code}/compare`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm bg-white text-zinc-950 hover:bg-white/90 transition-colors active:scale-[0.98]"
                  >
                    <TrendingDown size={16} />
                    Find for less
                  </Link>
                  <Link
                    href={`/${country.code}/deals`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm text-white border border-white/25 hover:bg-white/10 transition-colors active:scale-[0.98]"
                  >
                    Browse deals
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              {/* Right column = empty placeholder; the cards float outside on top */}
              <div aria-hidden="true" className="hidden lg:block" />
            </div>
          </div>

          {/* ── Tablet only (sm–md): cards positioned mostly ABOVE the panel
                 in the section's top whitespace, so they never overlap CTA
                 text. CTA section py-24 (96px) + StoreLogos py-20 bottom
                 (80px) = ~176px of clear space between StoreLogos content
                 and the CTA panel — plenty of room for the cards to float.
                 Mobile (<sm) has no cards — see prior commit reasoning.
                 Desktop (lg+) gets the full 3-card collage further down. ── */}
          {collage.length >= 2 && (
            <div className="absolute inset-0 pointer-events-none hidden sm:block lg:hidden">
              {/* Primary card — top of card sits 140px above the panel; card
                  bottom (panel_top + ~64) lands exactly where the panel's
                  top padding ends, just before the headline. No text overlap. */}
              <CollageCard
                img={collage[1].imageUrl ?? ""}
                store={collage[1].storeName}
                title={collage[1].title}
                percent={collage[1].discountPercent}
                w="w-40"
                h="h-52"
                rotate={6}
                top="-100px"
                right="20px"
                z={2}
                badgeSize="sm"
              />
              {/* Second card — bottom lands ~56px into panel padding (still
                  no text), tilted left, slightly behind the primary */}
              <CollageCard
                img={collage[0].imageUrl ?? ""}
                store={collage[0].storeName}
                title={collage[0].title}
                percent={collage[0].discountPercent}
                w="w-36"
                h="h-44"
                rotate={-8}
                top="-90px"
                right="200px"
                z={1}
                badgeSize="sm"
              />
            </div>
          )}

          {/* ── Desktop: 3-card collage bleeding past edges ── */}
          {collage.length === 3 && (
            <div className="hidden lg:block absolute inset-0 pointer-events-none">
              {/* Back card — extends slightly above the panel */}
              <CollageCard
                img={collage[0].imageUrl ?? ""}
                store={collage[0].storeName}
                title={collage[0].title}
                percent={collage[0].discountPercent}
                w="w-60" h="h-80"
                rotate={-7}
                top="-24px" left="52%"
                z={1}
                badgeSize="md"
              />

              {/* Main card — bleeds past the right edge of the panel */}
              <CollageCard
                img={collage[1].imageUrl ?? ""}
                store={collage[1].storeName}
                title={collage[1].title}
                percent={collage[1].discountPercent}
                w="w-72" h="h-[26rem]"
                rotate={5}
                top="40px" right="-48px"
                z={2}
                badgeSize="lg"
              />

              {/* Front card — smaller + lowered so it doesn't smother the
                 main card's caption behind it. Tilted left, peeks below panel. */}
              <CollageCard
                img={collage[2].imageUrl ?? ""}
                store={collage[2].storeName}
                title={collage[2].title}
                percent={collage[2].discountPercent}
                w="w-44" h="h-60"
                rotate={-4}
                bottom="-72px" left="50%"
                z={3}
                badgeSize="sm"
              />
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
