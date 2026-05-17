"use client";

import Image from "next/image";
import Link from "next/link";
import { TrendingDown, ArrowRight, Plane, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatPriceForUser } from "@/lib/utils";
import { pdpUrlForOffer } from "@/lib/pdp-url";
import { useCountry } from "@/components/providers/CountryProvider";
import { inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
import { effectiveLandedPrice } from "@/lib/landed-price";
import { displayStoreName } from "@/lib/store-display";
import { storeLogoInvertClass } from "@/lib/store-logo-invert";
import { trackClick } from "@/lib/trackClick";
import type { DupeResult, StoreOffer } from "@/lib/search";

export default function DupeCard({
  dupe,
  rank,
  query = "",
  mode = "similar",
  aspect = "aspect-square",
}: {
  dupe: DupeResult;
  rank: number;
  query?: string;
  mode?: string;
  /** Image aspect class for masonry-style varying heights */
  aspect?: string;
}) {
  const { country } = useCountry();
  const hasSavings = dupe.savingsPercent > 0;
  const bestOffer = dupe.offers[0];
  const extraStores = dupe.offers.length - 1;
  const [showAll, setShowAll] = useState(false);
  const visibleOffers = showAll ? dupe.offers : dupe.offers.slice(0, 1);

  /* Runtime "INTL for this visitor" check — same fix shape as
     PriceResults and MasonryCard. The StoreOffer.isInternational
     flag from pg-fts.ts is a GLOBAL store-currency property
     (currency === "USD") not a per-visitor judgement, so it
     misfires for every UK / US / DE retailer when the visitor IS
     in that retailer's home market. */
  const isIntlForUser = (offer: Pick<StoreOffer, "storeId" | "storeName" | "currency" | "isInternational">): boolean => {
    const storeCountry = inferStoreCountry(offer.storeId, offer.storeName);
    if (storeCountry !== null) {
      return storeCountry.toLowerCase() !== country.code.toLowerCase();
    }
    /* Global cross-border short-circuit before the currency fallback —
       same fix MasonryCard / PriceResults apply. */
    if (isGlobalIntlStore(offer.storeId, offer.storeName)) return true;
    return offer.currency !== country.currency && offer.isInternational;
  };

  /* Whole-card click target — Link wraps the upper portion (image +
     caption + primary CTA button) so taps on any of those route to
     the PDP. The "+N more stores" expandable below stays OUTSIDE
     the Link so its per-store Links don't nest (invalid HTML +
     React hydration warning).

     User report May 2026: "shouldn't the card be clickable and not
     only the view on merchant button?"

     When bestOffer is null (defensive — pgFtsFindDupes shouldn't
     return offer-less rows, but FTS edge cases occasionally do)
     we render a non-interactive <div> instead of a `href="#"` Link.
     `href="#"` is an a11y smell — keyboard / screen-reader users
     get a focusable element that does nothing, and the URL fragment
     mutates on click. */
  const cardHref = bestOffer ? pdpUrlForOffer(country.code, { ...bestOffer, title: dupe.title }) : null;

  const upperContent = (
    <>
      {/* Savings badge — perfect circle, top-right, on the image */}
      {hasSavings && (
        <div
          className="absolute top-2.5 right-2.5 z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center text-white select-none"
          style={{
            background: "#16a34a",
            boxShadow: "0 4px 12px rgba(22,163,74,0.35), 0 0 0 3px rgba(255,255,255,0.85)",
          }}
        >
          <span className="text-[14px] sm:text-[17px] font-black leading-none tracking-tight">
            −{dupe.savingsPercent}%
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-90">
            less
          </span>
        </div>
      )}

      {/* Image — varied aspect for masonry feel */}
      <div className={`relative w-full overflow-hidden bg-white ${aspect}`}>
        {dupe.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={dupe.imageUrl}
            alt={dupe.title}
            className="w-full h-full object-contain p-3 group-hover:scale-[1.04] transition-transform duration-500"
          />
        ) : (
          <HavloLogoFallback size="md" />
        )}
      </div>

      {/* Caption */}
      <div className="flex-1 flex flex-col px-3.5 pt-3 pb-3.5">
        <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-semibold">
          {dupe.brand ?? dupe.category}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-ink leading-snug line-clamp-2 tracking-[-0.005em]">
          {dupe.title}
        </h3>

        {/* Price + savings line — country-aware. dupe.bestPrice is the
            ingest-time landedPrice (price + 30% for stores flagged
            international). For a visitor in the store's anchored
            country (UK shopper, UK retailer) the landed adder is
            wrong — they pay the merchant price directly. Recompute
            from the cheapest offer using effectiveLandedPrice so the
            headline matches the merchant's own checkout total. */}
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-base font-bold text-ink">
            {formatPriceForUser(
              bestOffer ? effectiveLandedPrice(bestOffer, country) : dupe.bestPrice,
              country,
            )}
          </span>
          {hasSavings && (
            <span className="text-[11px] text-success font-semibold">
              save {formatPriceForUser(dupe.savingsVsAnchor, country)}
            </span>
          )}
        </div>

        {/* Primary CTA — visual only. The whole upper-card Link
            wrapper handles the click. This span carries the same
            button styling so the user has the familiar visual
            anchor + arrow affordance, but no nested anchor. Text
            updated from "View on {Store}" to "View product" to
            match the PDP-first click model — clicking takes you
            to a Havlo PDP, not directly to the merchant. */}
        {bestOffer && (
          <span
            className="mt-3 inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-ink text-bg text-xs font-semibold group-hover:opacity-90 transition-opacity"
          >
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className="w-4 h-4 rounded overflow-hidden bg-surface-2 shrink-0 flex items-center justify-center">
                {/* Theme-aware invert for white-on-transparent wordmarks
                    (3C Hub, etc.) so the logo stays visible inside the
                    light bg-surface-2 chip in light mode. Shared util
                    keeps DupeCard / PriceResults / StoreLogo in sync. */}
                {/* Plain <img> — 16×16 store logos don't benefit
                    enough from next/image's optimizer to justify
                    a transformation each. Avoids the Vercel cap. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bestOffer.storeLogoUrl}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  decoding="async"
                  className={`object-contain ${storeLogoInvertClass(bestOffer.storeId)}`}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </span>
              <span className="truncate">View product</span>
              {isIntlForUser(bestOffer) && bestOffer.landedCostExtra > 0 && (
                <Plane size={11} className="text-amber-300 shrink-0" />
              )}
            </span>
            <ArrowRight size={12} className="shrink-0 opacity-80" />
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:border-border-strong hover:-translate-y-0.5 hover:shadow-card transition-all duration-200">

      {cardHref ? (
        <Link
          href={cardHref}
          onClick={() => trackClick(dupe.key, query, rank, mode)}
          className="block"
          aria-label={`View ${dupe.title} details`}
        >
          {upperContent}
        </Link>
      ) : (
        <div className="block">
          {upperContent}
        </div>
      )}
      {/* "+N more stores" expandable lives OUTSIDE the upper-card
          Link so each per-store Link below doesn't nest invalidly.
          Wrapper picks up the card's hover styles via the parent
          `group` class on the outer div. */}
      <div className="px-3.5 pb-3.5">


        {/* Other offers — collapsible */}
        {extraStores > 0 && (
          <div className="mt-2">
            {!showAll ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
              >
                +{extraStores} more store{extraStores > 1 ? "s" : ""}
                <ChevronDown size={12} />
              </button>
            ) : (
              <div className="space-y-1">
                {visibleOffers.slice(1).map((offer) => (
                  <a
                    key={`${offer.storeId}-${offer.price}`}
                    /* Same PDP-first click model as the primary CTA
                       above. Routes to /p/[id] for DB-backed offers
                       or /p/live for synthetic ones. */
                    href={pdpUrlForOffer(country.code, { ...offer, title: dupe.title })}
                    onClick={() => trackClick(dupe.key, query, rank, mode)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border hover:border-border-strong hover:bg-surface-2 transition-colors text-[11px]"
                  >
                    <div className="w-4 h-4 rounded overflow-hidden bg-surface-2 shrink-0 flex items-center justify-center">
                      {/* Same invert rule as the primary CTA above.
                          Plain <img> to skip Vercel transform cap. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={offer.storeLogoUrl}
                        alt=""
                        width={16}
                        height={16}
                        loading="lazy"
                        decoding="async"
                        className={`object-contain ${storeLogoInvertClass(offer.storeId)}`}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <span className="text-ink-2 truncate flex-1">{displayStoreName(offer.storeName)}</span>
                    {/* Country-aware price — match the headline above
                        (line ~135). Was bare `offer.price`, which read
                        as cross-border merchant-price WITHOUT the
                        landed-cost estimate the headline already
                        includes. Same product, two visibly different
                        prices on the same card. Audit May 2026. */}
                    <span className="font-semibold text-ink tabular-nums">{formatPriceForUser(effectiveLandedPrice(offer, country), country)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
