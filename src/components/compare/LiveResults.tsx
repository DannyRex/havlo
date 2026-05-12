"use client";

import { Globe } from "lucide-react";
import {
  formatUSDPrice,
  savings,
  formatCompact,
  getClickThroughUrl,
} from "@/lib/utils";
import { MASONRY_ASPECTS, chunkLeftToRight } from "@/components/deals/masonry-layout";
import { useCountry } from "@/components/providers/CountryProvider";
import { USD_FX, formatLocal, inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import type { Deal } from "@/types";

interface Props {
  items: Deal[];
  loading: boolean;
  providers: string[];
}

/* ── Single live-result card — compact, image-first, varied aspect ── */
function LiveCard({ deal, aspect }: { deal: Deal; aspect: string }) {
  const { country } = useCountry();
  const isUSD = deal.currency === "USD";
  const saved = savings(deal.originalPrice, deal.salePrice);
  const priceFmt = isUSD ? formatUSDPrice(deal.salePrice)     : formatCompact(deal.salePrice);
  const origFmt  = isUSD ? formatUSDPrice(deal.originalPrice) : formatCompact(deal.originalPrice);
  const saveFmt  = saved > 0 ? (isUSD ? formatUSDPrice(saved) : formatCompact(saved)) : null;
  /* Secondary hint — converts USD primary to the USER'S local
     currency. Was hardcoded to NGN, which surfaced "≈ ₦806K" on
     /uk/compare for a UK shopper (round-4 QA). Now NG sees ₦, UK
     sees £, DE sees €, etc. Skipped when there's no conversion to
     do (USD shopper looking at USD deal). */
  const ngnEquiv = isUSD && country.currency !== "USD"
    ? `≈ ${formatLocal(Math.round(deal.salePrice * USD_FX[country.currency]), country)}`
    : null;
  const hasDiscount = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;

  /* Country chip — three sources, in order:
       1. SerpAPI's specific country tag (`country:us` → `US`)
       2. Tagged "intl" / "live" → fall back to `INTL`
       3. Nothing.

     Then suppress the chip entirely when the store's anchored
     country matches the visitor's country (using inferStoreCountry,
     same roster as MasonryCard / PriceResults). Without this
     suppression, a UK user looking at Argos would see "UK" or
     "INTL" on every card — visually noisy and incorrectly
     classifying a local retailer as cross-border. */
  const countryTag = deal.tags.find((t) => t.startsWith("country:"))?.split(":")[1];
  const isIntl = deal.tags.includes("intl") || deal.tags.includes("live");
  const storeCountry = inferStoreCountry(deal.storeId, deal.storeName);
  const storeIsLocalToUser =
    storeCountry !== null && storeCountry.toLowerCase() === country.code.toLowerCase();
  /* Global cross-border stores (AliExpress, Shein, Temu, …) always
     show the INTL chip regardless of the user's currency match —
     mirroring the same short-circuit MasonryCard / PriceResults
     / DupeCard apply. Without this, AliExpress USD-priced live
     results suppressed the chip for US users. */
  const storeIsGlobalIntl = storeCountry === null && isGlobalIntlStore(deal.storeId, deal.storeName);
  /* Renamed from `country` (collided with the user-country from
     useCountry above, added during the round-4 currency-display
     fix). */
  const dealCountryChip = storeIsLocalToUser
    ? null
    : storeIsGlobalIntl
      ? "INTL"
      : countryTag
        ? countryTag.toUpperCase()
        : isIntl
          ? "INTL"
          : null;

  return (
    <a
      /* /api/go applies wrapWithAffiliate so the right ?tag= /
         ?subId= / ?aff_short_key= gets appended for the matching
         retailer. Without this wrap, none of our wired affiliate
         programs ever earn commission. */
      href={getClickThroughUrl(deal)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${deal.title}, ${priceFmt} at ${deal.storeName}`}
      className="group card card-hover overflow-hidden flex flex-col"
    >
      {/* Image — varied aspect for masonry feel */}
      <div className={`relative overflow-hidden bg-white ${aspect}`}>
        {deal.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={deal.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain p-3 group-hover:scale-[1.04] transition-transform duration-500 motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-4xl"
            aria-hidden="true"
          >
            {deal.imageEmoji}
          </div>
        )}

        {/* Discount badge — perfect circle, top-right */}
        {hasDiscount && (
          <div
            className="absolute top-2 right-2 w-11 h-11 rounded-full flex flex-col items-center justify-center text-white select-none"
            style={{
              background: "#dc2626",
              boxShadow: "0 3px 10px rgba(220,38,38,0.35), 0 0 0 3px rgba(255,255,255,0.85)",
            }}
          >
            <span className="text-[13px] font-black leading-none tracking-tight">
              {deal.discountPercent}%
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-90">
              off
            </span>
          </div>
        )}

        {/* Country chip — subtle, bottom-left */}
        {dealCountryChip && (
          <span
            className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <Globe size={9} />
            {dealCountryChip}
          </span>
        )}
      </div>

      {/* Caption */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-semibold truncate">
          {deal.storeName}
        </p>
        <p className="mt-1 text-sm font-medium text-ink leading-snug line-clamp-2 tracking-[-0.005em]">
          {deal.title}
        </p>

        <div className="mt-auto pt-2.5 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-ink">{priceFmt}</span>
          {hasDiscount && (
            <span className="text-[11px] text-ink-3 line-through">{origFmt}</span>
          )}
          {saveFmt && (
            <span className="ml-auto text-[11px] font-semibold text-success">
              −{saveFmt}
            </span>
          )}
        </div>

        {ngnEquiv && (
          <p className="text-[10px] text-ink-3 mt-0.5">{ngnEquiv}</p>
        )}
      </div>
    </a>
  );
}

/* ── Skeleton card ───────────────────────────────────────────────── */
function SkeletonCard({ aspect }: { aspect: string }) {
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className={`skeleton ${aspect}`} />
      <div className="p-3 space-y-2">
        <div className="skeleton h-2.5 w-1/3 rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/3 rounded mt-1" />
      </div>
    </div>
  );
}

/* ── Masonry column wrapper ───────────────────────────────────────── */
function LiveColumn({
  items, gapClass, startIndex,
}: { items: Deal[]; gapClass: string; startIndex: number }) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {items.map((d, i) => (
        <LiveCard key={d.id} deal={d} aspect={MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]} />
      ))}
    </div>
  );
}

function SkeletonColumn({
  count, gapClass, startIndex,
}: { count: number; gapClass: string; startIndex: number }) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} aspect={MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]} />
      ))}
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────────── */
export default function LiveResults({ items, loading, providers }: Props) {
  const { country } = useCountry();
  // Don't render anything if not loading and zero results
  if (!loading && items.length === 0) return null;

  /* Caption is country-aware. The original "Prices in USD, ships to
     Nigeria." was hardcoded — it appeared on every country's /compare
     page including UK / DE / etc., where it was misleading (a UK
     shopper doesn't ship from the US to Nigeria). QA round 3 caught
     this on /uk/compare. */
  const caption = country.code === "ng"
    ? "Prices in USD, ships to Nigeria."
    : "Prices shown in USD for cross-border comparison.";

  return (
    <section className="mt-12 sm:mt-16">

      {/* Section header */}
      <div className="max-w-3xl mx-auto mb-5 sm:mb-6 px-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success">
            Live, on sale now
          </span>
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-ink tracking-[-0.02em]">
          {items.length > 0
            ? `${items.length.toLocaleString()} live deals from global stores`
            : "Live deals from global stores"}
        </h3>
        <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
          {caption}
        </p>
      </div>

      {/* Masonry — left-to-right column distribution, varying aspects */}
      {loading ? (
        <>
          <div className="flex gap-3 sm:hidden">
            <SkeletonColumn count={4} gapClass="gap-3" startIndex={0} />
            <SkeletonColumn count={4} gapClass="gap-3" startIndex={100} />
          </div>
          <div className="hidden sm:flex lg:hidden gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonColumn key={i} count={3} gapClass="gap-3" startIndex={i * 100} />
            ))}
          </div>
          <div className="hidden lg:flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonColumn key={i} count={2} gapClass="gap-4" startIndex={i * 100} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-3 sm:hidden">
            {chunkLeftToRight(items, 2).map((col, i) => (
              <LiveColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} />
            ))}
          </div>
          <div className="hidden sm:flex lg:hidden gap-3">
            {chunkLeftToRight(items, 3).map((col, i) => (
              <LiveColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} />
            ))}
          </div>
          <div className="hidden lg:flex gap-4">
            {chunkLeftToRight(items, 4).map((col, i) => (
              <LiveColumn key={i} items={col} gapClass="gap-4" startIndex={i * 100} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
