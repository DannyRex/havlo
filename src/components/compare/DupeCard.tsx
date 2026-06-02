"use client";

import Link from "next/link";
import { TrendingDown, ArrowRight, Plane, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatPriceForUser, cleanTitle } from "@/lib/utils";
import { pdpUrlForOffer } from "@/lib/pdp-url";
import { useCountry } from "@/components/providers/CountryProvider";
import { inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
import { effectiveLandedPrice } from "@/lib/landed-price";
import { displayStoreName } from "@/lib/store-display";
import { storeLogoInvertOnLight } from "@/lib/store-logo-invert";
import { trackClick } from "@/lib/trackClick";
import type { DupeResult, StoreOffer } from "@/lib/search";

/* Store-logo chip for the cheaper-alternatives card CTAs.

   Rendered on a CONSTANT white plate (never theme-flipping) for one
   reason: it makes every store logo visible in BOTH light and dark
   mode without a per-store registry. Dark + full-colour wordmarks
   read on white in either theme; the only marks that would vanish on
   white are the light-on-transparent ones (3C Hub), which
   storeLogoInvertOnLight flips to dark.

   A letter badge is ALWAYS painted underneath, so a 404 / blank
   favicon / hidden image never leaves an empty box — the store's
   initial shows through instead. Replaces the previous bespoke <img>
   that hid itself on error (empty chip) and used the theme-flipping
   invert, under which dozens of dark-on-transparent logos (adidas,
   shein, eBay, …) were invisible in dark mode. */
function LogoChip({
  storeId,
  storeName,
  storeLogoUrl,
  size = 16,
}: {
  storeId: string;
  storeName: string;
  storeLogoUrl: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initial = storeName.trim().charAt(0).toUpperCase() || "•";
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded bg-white ring-1 ring-black/[0.08]"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center font-bold leading-none text-gray-500 select-none"
        style={{ fontSize: Math.max(8, Math.round(size * 0.58)) }}
      >
        {initial}
      </span>
      {storeLogoUrl && !failed && (
        /* Plain <img> — 16px store logos don't benefit from
           next/image's optimizer enough to justify a transform each
           (Vercel cap). storeLogoInvertOnLight is theme-independent
           because the plate is a constant white. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={storeLogoUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 m-auto h-full w-full object-contain p-[1.5px] ${storeLogoInvertOnLight(storeId)}`}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

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
            /* #16a34a → #15803d (green-700): white text on the brighter
               green was only 3.30:1 (WCAG AA fail). green-700 lifts the
               "−X% less" to 5.0:1 white-on-fill. Shadow tint left as-is. */
            background: "#15803d",
            boxShadow: "0 4px 12px rgba(22,163,74,0.35), 0 0 0 3px rgba(255,255,255,0.85)",
          }}
        >
          <span className="text-[14px] sm:text-[17px] font-black leading-none tracking-tight">
            −{dupe.savingsPercent}%
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5">
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
          {cleanTitle(dupe.title)}
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
          {/* "est." cue when the headline bakes in the ~30% landed
              allowance — same guard as the Plane chip below so the
              number and the badge always agree. (#14) */}
          {bestOffer && isIntlForUser(bestOffer) && bestOffer.landedCostExtra > 0 && (
            <span className="text-[10px] font-normal text-ink-3">est.</span>
          )}
          {hasSavings && (
            <span className="text-[11px] text-success font-semibold">
              save {formatPriceForUser(dupe.savingsVsAnchor, country)}
            </span>
          )}
        </div>

        {/* Used / refurbished — the headline price is the cheapest
            offer (dupe.offers[0]); if that's a pre-owned / refurbished
            listing, say so rather than presenting it as a like-for-like
            cheaper alternative. Amber = context, not a positive. */}
        {bestOffer?.isUsed && (
          <span className="mt-1.5 inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            Used / Refurbished
          </span>
        )}

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
              <LogoChip
                storeId={bestOffer.storeId}
                storeName={bestOffer.storeName}
                storeLogoUrl={bestOffer.storeLogoUrl}
              />
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
          aria-label={`View ${cleanTitle(dupe.title)} details`}
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
                    <LogoChip
                      storeId={offer.storeId}
                      storeName={offer.storeName}
                      storeLogoUrl={offer.storeLogoUrl}
                    />
                    <span className="text-ink-2 truncate flex-1">
                      {displayStoreName(offer.storeName)}
                      {offer.isUsed && <span className="text-amber-600 dark:text-amber-400 font-medium"> · Used</span>}
                    </span>
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
