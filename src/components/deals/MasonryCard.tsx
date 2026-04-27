"use client";

/* Country-aware product card.
   Reads useCountry() so prices show in the user's preferred currency:
     - NG user, USD-priced deal → primary $ + ≈ ₦ equivalent (existing behavior)
     - UK user, USD-priced deal → primary £ + ≈ $ original
     - UK user, NGN-priced deal → primary £ (converted) + ≈ ₦
   Layout utilities (chunkLeftToRight, MASONRY_ASPECTS) live in
   masonry-layout.ts so server components can still import them. */

import {
  cleanTitle,
  formatCompact,
  formatUSDPrice,
  savings,
  timeAgo,
} from "@/lib/utils";
import { useCountry } from "@/components/providers/CountryProvider";
import {
  USD_FX, formatLocal, type Country,
} from "@/lib/country";
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

export default function MasonryCard({ deal, aspect, showOriginBadge = true, priority = false }: Props) {
  const { country } = useCountry();
  const dealCcy = deal.currency as Country["currency"];
  const sameCcy = dealCcy === country.currency;

  const cleanedTitle = cleanTitle(deal.title);
  const saved = savings(deal.originalPrice, deal.salePrice);
  const hasDiscount = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;

  /* Primary price = user's preferred currency.
     Secondary price = original currency (only when different) so the
     user can sanity-check against the source listing. */
  const primarySale = sameCcy ? deal.salePrice : convertToUserCurrency(deal.salePrice, deal.currency, country);
  const primaryOrig = sameCcy ? deal.originalPrice : convertToUserCurrency(deal.originalPrice, deal.currency, country);
  const primarySaved = primaryOrig > primarySale ? primaryOrig - primarySale : 0;

  const priceFmt = formatLocal(primarySale, country);
  const origFmt  = formatLocal(primaryOrig, country);
  const saveFmt  = primarySaved > 0 ? formatLocal(primarySaved, country) : null;

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
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${cleanedTitle}, ${priceFmt} at ${deal.storeName}`}
      className="group block"
    >
      <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-surface-2 border border-border ${aspect}`}>
        {deal.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={deal.imageUrl}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding={priority ? "sync" : "async"}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-5xl"
            aria-hidden="true"
          >
            {deal.imageEmoji}
          </div>
        )}

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
      </div>
    </a>
  );
}
