"use client";

import { Globe } from "lucide-react";
import { pdpUrlForDeal } from "@/lib/pdp-url";
import {
  formatUSDPrice,
  savings,
  formatCompact,
} from "@/lib/utils";
import { MASONRY_ASPECTS, chunkLeftToRight } from "@/components/deals/masonry-layout";
import { useCountry } from "@/components/providers/CountryProvider";
import { USD_FX, formatLocal, inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import { displayStoreName } from "@/lib/store-display";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
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

  /* Currency strategy (May 2026): show the user's local currency as
     the PRIMARY price on every live card. Was: USD primary for SerpAPI
     rows + a small "≈ £Y" hint underneath. UK / DE / NG / etc. users
     would see "$X.xx" as the headline price across the live-deals
     section, while every other card on the page (anchor + dupes)
     showed local currency. Asymmetric. User report: "All items in
     the 9 live deals from global stores section are in usd, they
     should be in local currency. All items at all times in all
     pages should primarily be in local currency."

     Behaviour:
       - USD deal + user in non-USD market: primary = local currency
         (£21, ₦12k, AED 80, etc.), secondary hint = original $X.xx
       - USD deal + USD-market user: primary = USD (no conversion)
       - Non-USD deal: render in stored currency via formatCompact
         (legacy NGN path used by older non-SerpAPI ingests). */
  const isCrossCurrency = isUSD && country.currency !== "USD";
  const localOf = (usdAmount: number): number =>
    country.currency === "USD"
      ? Math.round(usdAmount * 100) / 100
      : Math.round(usdAmount * USD_FX[country.currency]);
  const formatLocalOrUSD = (usdAmount: number): string =>
    country.currency === "USD"
      ? formatUSDPrice(usdAmount)
      : formatLocal(localOf(usdAmount), country);
  const priceFmt = isUSD ? formatLocalOrUSD(deal.salePrice)     : formatCompact(deal.salePrice);
  const origFmt  = isUSD ? formatLocalOrUSD(deal.originalPrice) : formatCompact(deal.originalPrice);
  const saveFmt  = saved > 0 ? (isUSD ? formatLocalOrUSD(saved) : formatCompact(saved)) : null;

  /* Secondary hint — shows the ORIGINAL USD price when we converted
     to the user's local currency for the primary. Gives shoppers a
     reference point for the listed-price context (especially useful
     for cross-border deals where the original-currency price helps
     judge whether the converted total feels right). Skipped when no
     conversion happened. */
  const originalHint = isCrossCurrency
    ? `≈ ${formatUSDPrice(deal.salePrice)} in USD`
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
      /* Click model (May 2026): live results route to a PDP first
         (real /p/[offer_id] for DB-backed rows, synthetic /p/live?…
         for SerpAPI rows that aren't in the DB), not outbound to
         the merchant. The actual /api/go affiliate wrap fires at
         the PDP's "View at {merchant}" CTA — matches the site-wide
         "no product across the site should go directly to merchant"
         rule. */
      href={pdpUrlForDeal(country.code, deal)}
      aria-label={`${deal.title}, ${priceFmt} at ${displayStoreName(deal.storeName)}. Open details.`}
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
          <HavloLogoFallback size="md" />
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
          {displayStoreName(deal.storeName)}
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

        {originalHint && (
          <p className="text-[10px] text-ink-3 mt-0.5">{originalHint}</p>
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

  /* Caption is country-aware and reflects the new currency model:
     prices are now shown in the user's local currency (May 2026
     localisation pass). USD is still the source data — surfaced as
     a secondary "≈ $X in USD" hint per card — but the headline is
     local. */
  const caption = country.code === "ng"
    ? "Live picks from global stores. Prices in ₦, ships to Nigeria."
    : `Live picks from global stores. Prices in ${country.currency}.`;

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
