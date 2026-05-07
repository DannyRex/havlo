"use client";

/* Country-aware product card.
   Reads useCountry() so prices show in the user's preferred currency:
     - NG user, USD-priced deal → primary $ + ≈ ₦ equivalent (existing behavior)
     - UK user, USD-priced deal → primary £ + ≈ $ original
     - UK user, NGN-priced deal → primary £ (converted) + ≈ ₦
   Layout utilities (chunkLeftToRight, MASONRY_ASPECTS) live in
   masonry-layout.ts so server components can still import them. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cleanTitle,
  formatCompact,
  formatUSDPrice,
  getClickThroughUrl,
  proxiedImageUrl,
  savings,
  timeAgo,
} from "@/lib/utils";
import { useCountry } from "@/components/providers/CountryProvider";
import {
  USD_FX, formatLocal, type Country,
} from "@/lib/country";
import { getCashbackForStore } from "@/lib/cashback";
import InfoTip from "@/components/ui/InfoTip";
import { track } from "@/lib/analytics";
import type { Deal } from "@/types";

interface Props {
  deal: Deal;
  aspect: string;
  /** Show the small INTL chip on items priced in a non-local currency */
  showOriginBadge?: boolean;
  /** Above-the-fold cards opt in to eager + high-priority image loading
      so the LCP pixel arrives without waiting for the lazy heuristic. */
  priority?: boolean;
}

/* Convert a Deal's native price into the user's preferred currency.
   Handles three cases:
     1. Deal currency already matches user currency → no conversion
     2. Deal in USD, user not USD → multiply by USD_FX
     3. Deal in NGN, user not NGN → divide by USD_FX[NGN], multiply by user's
   Returns 0 when conversion is impossible (defensive — shouldn't happen). */
function convertToUserCurrency(amount: number, dealCurrency: string, country: Country): number {
  const dealCcy = dealCurrency as Country["currency"];
  if (dealCcy === country.currency) return amount;

  // Convert deal currency → USD as intermediate hop
  const inUsd = dealCcy === "USD"
    ? amount
    : amount / (USD_FX[dealCcy] ?? 1);

  // USD → user currency
  return Math.round(inUsd * (USD_FX[country.currency] ?? 1));
}

/* Resilient image renderer. Tries the deal's imageUrl; on load
   failure (DNS, 404, CORS, deleted file), swaps to the gradient +
   emoji fallback so users never see a broken image icon. */
function ResilientImage({ deal, priority }: { deal: Deal; priority: boolean }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !deal.imageUrl || failed;

  if (showFallback) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center text-5xl sm:text-6xl"
        style={{ background: deal.imageGradient }}
        aria-hidden="true"
      >
        <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
          {deal.imageEmoji}
        </span>
      </div>
    );
  }

  /* alt = product title (truncated). Empty alt was an a11y miss
     (screen readers skipped product images entirely) and an SEO
     miss (Google Image Search ignores unlabeled product photos).
     Truncate to ~120 chars so we don't blow up on absurdly long
     scraped titles. */
  const altText = cleanTitle(deal.title).slice(0, 120);

  /* Proxy external image URLs through /api/img-proxy to avoid hotlink
     blocks from Amazon/ASOS/AliExpress (Critical 4 in QA audit: 65
     of 85 imgs on /ng failed to load). The proxy rewrites Referer
     so the upstream CDN sees a request from its own merchant
     domain. Direct-load whitelist (Konga, 3C Hub, Cloudinary, etc.)
     skips the proxy. */
  const imgSrc = proxiedImageUrl(deal.imageUrl);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={imgSrc}
      alt={altText}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] motion-reduce:group-hover:scale-100"
    />
  );
}

export default function MasonryCard({ deal, aspect, showOriginBadge = true, priority = false }: Props) {
  const { country } = useCountry();
  const router      = useRouter();
  const dealCcy = deal.currency as Country["currency"];
  const sameCcy = dealCcy === country.currency;

  const cleanedTitle = cleanTitle(deal.title);
  const saved = savings(deal.originalPrice, deal.salePrice);
  const hasDiscount = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;
  /* Cashback rate for the deal's store — null when no rate is set
     (no badge shown). Phase 1 is display-only; Phase 2 wires this
     to actual user accounts + payouts. */
  const cashback = getCashbackForStore(deal.storeId);

  /* Primary price = user's preferred currency.
     Secondary price = original currency (only when different) so the
     user can sanity-check against the source listing. */
  const primarySale = sameCcy ? deal.salePrice : convertToUserCurrency(deal.salePrice, deal.currency, country);
  const primaryOrig = sameCcy ? deal.originalPrice : convertToUserCurrency(deal.originalPrice, deal.currency, country);
  const primarySaved = primaryOrig > primarySale ? primaryOrig - primarySale : 0;

  const priceFmt = formatLocal(primarySale, country);
  const origFmt  = formatLocal(primaryOrig, country);
  const saveFmt  = primarySaved > 0 ? formatLocal(primarySaved, country) : null;

  /* Landed-cost estimate for cross-border purchases. Uses the same
     30% markup as the /compare anchor row (offerToStoreOffer in
     pg-fts.ts) so users see consistent numbers across surfaces.
     The 30% covers shipping + customs + handling fees as a rough
     blanket estimate — accurate-ish for clothing / small
     electronics, may overstate for heavy items or undercut for
     fashion behind import duties. The 'Estimate' label and tooltip
     make the assumption explicit so users don't treat it as a
     quote. Only renders when the deal's currency differs from the
     user's display currency (proxy for 'this is cross-border'). */
  const isCrossBorder = !sameCcy;
  const landedFmt = isCrossBorder
    ? formatLocal(Math.round(primarySale * 1.30), country)
    : null;

  /* Secondary price (the original-currency hint) — small, italic, below the
     primary line. Skipped when currency matches. NGN gets formatCompact for
     the "₦47K" feel; USD gets formatUSDPrice; others use Intl. */
  let secondaryStr: string | null = null;
  if (!sameCcy) {
    if (dealCcy === "NGN") secondaryStr = `≈ ${formatCompact(deal.salePrice)}`;
    else if (dealCcy === "USD") secondaryStr = `≈ ${formatUSDPrice(deal.salePrice)}`;
    else secondaryStr = `≈ ${formatLocal(deal.salePrice, { ...country, currency: dealCcy } as Country)}`;
  }

  /* "INTL" chip = the deal isn't from the user's country.
     For NG users: USD-priced deals are intl (existing behavior).
     For others: NGN-priced deals are intl (rare after country filter
     removes NG stores), or any deal whose currency != user's. */
  const showIntl = showOriginBadge && !sameCcy;

  return (
    <a
      /* Routes through /api/go so wrapWithAffiliate appends the right
         ?tag= for Amazon, ?subId= for Konga, etc. before sending the
         user to the merchant. Without this wrap, the affiliate tags
         the project has wired up never actually fire. */
      href={getClickThroughUrl(deal)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${cleanedTitle}, ${priceFmt} at ${deal.storeName}`}
      className="group block"
    >
      <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-surface-2 border border-border ${aspect}`}>
        <ResilientImage deal={deal} priority={priority} />
        {/* When the image fails to load (CDN block, deleted file, network),
            we swap to the gradient + emoji at runtime via state in
            ResilientImage below. Users never see a broken image icon —
            either the real photo loads, or they see a clean intentional
            fallback card. Same defense-in-depth pattern as StoreLogoChip. */}

        {/* Discount badge — perfect circle, top-right */}
        {hasDiscount && (
          <div
            className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center text-white select-none"
            style={{
              background: "#dc2626",
              boxShadow: "0 4px 12px rgba(220,38,38,0.35), 0 0 0 3px rgba(255,255,255,0.85)",
            }}
          >
            <span className="text-[14px] sm:text-[17px] font-black leading-none tracking-tight">
              {deal.discountPercent}%
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-90">
              off
            </span>
          </div>
        )}

        {/* Cashback badge — top-left, opposite corner from the
            discount circle. As of QA Bucket 2#26, the badge is
            both a tooltip AND a clickable shortcut to the cashback
            explainer page. Implemented as a <button> instead of a
            nested <a> so the parent /api/go anchor stays valid HTML
            (nesting two anchors breaks browsers). onClick swallows
            propagation + the default to keep the parent click from
            also firing, then routes to the country-aware cashback
            page imperatively via next/navigation. */}
        {cashback && (
          /* Cashback badge — discoverability fix (QA Bucket 4 #11):
             previously it looked like a static label and shoppers
             didn't realise it was a shortcut to the cashback page.
             Now: a small ChevronRight icon makes the affordance
             obvious, and a subtle hover underline + ring on focus
             confirms it's a button. */
          <button
            type="button"
            title={`Earn ${cashback.percent}% cashback when you shop through Havlo. Coming soon. Tap to learn more.`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              track({
                name: "cashback_badge_click",
                props: {
                  store_id: deal.storeId,
                  percent: cashback.percent,
                  country: country.code,
                },
              });
              router.push(`/${country.code}/cashback`);
            }}
            className="absolute left-2 top-2 group/cashback inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:brightness-110 hover:shadow-md active:brightness-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none"
            style={{ background: "rgba(16, 185, 129, 0.95)" }}
            aria-label={`Earn ${cashback.percent}% cashback. Open cashback details.`}
          >
            <span className="group-hover/cashback:underline underline-offset-2 decoration-white/80">
              Earn {cashback.percent}%
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="opacity-90 transition-transform duration-150 group-hover/cashback:translate-x-0.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {showIntl && (
          <span
            className="absolute left-2 bottom-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            INTL
          </span>
        )}
      </div>

      <div className="pt-2 sm:pt-2.5 px-0.5">
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-ink-3 mb-0.5 sm:mb-1 leading-none min-w-0">
          <span className="font-medium text-ink-2 truncate">{deal.storeName}</span>
          <span aria-hidden="true" className="shrink-0 hidden sm:inline">·</span>
          <span className="shrink-0 hidden sm:inline">{timeAgo(deal.postedAt)}</span>
        </div>

        <p className="text-[12px] sm:text-[13px] font-medium text-ink leading-snug line-clamp-2 mb-1 sm:mb-1.5 tracking-[-0.005em]">
          {cleanedTitle}
        </p>

        <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
          <span className="text-[13px] sm:text-sm font-bold text-ink">{priceFmt}</span>
          {hasDiscount && (
            <span className="text-[10px] sm:text-[11px] text-ink-3 line-through">{origFmt}</span>
          )}
          {saveFmt && (
            <span className="ml-auto text-[10px] sm:text-[11px] font-semibold text-success">
              −{saveFmt}
            </span>
          )}
        </div>

        {secondaryStr && (
          <p className="text-[10px] text-ink-3 mt-0.5">{secondaryStr}</p>
        )}

        {landedFmt && (
          /* Cross-border total. Was "landed" with a `title=...` HTML
             tooltip — but that doesn't render on touch devices, and
             "landed" is logistics jargon most shoppers don't parse.
             Now: "≈ {price} total" + a clickable Info icon that
             explains the +30% shipping/customs assumption. Tap-friendly
             on mobile, hover/click on desktop. */
          <p className="text-[10px] text-ink-3 mt-0.5 flex items-center gap-1">
            <span aria-hidden="true">≈</span>
            <span className="text-ink-2 font-medium">{landedFmt}</span>
            <span>total</span>
            <InfoTip
              label="What's included in the total"
              text="Estimated total: product price + ~30% for cross-border shipping and customs. Actual cost varies by carrier, weight, and customs assessment."
              size={11}
            />
          </p>
        )}
      </div>
    </a>
  );
}
