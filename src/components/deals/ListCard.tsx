"use client";

/* List-style card used on /deals when the user toggles "list view"
   on mobile. Image left, all text on the right, more info per row
   than the masonry grid. Better for buying-intent scanning, worse
   for casual visual browsing — that's why it's a user choice. */

import { useState } from "react";
import {
  cleanTitle,
  getClickThroughUrl,
  isAmazonSearchUrl,
  proxiedImageUrl,
  timeAgo,
} from "@/lib/utils";
import InfoTip from "@/components/ui/InfoTip";
import { useCountry } from "@/components/providers/CountryProvider";
import { USD_FX, formatLocal, inferStoreCountry, type Country } from "@/lib/country";
import type { Deal } from "@/types";

/* Convert any Deal price (NGN or USD) into the user's preferred
   currency. Mirrors MasonryCard's same-named helper so the two cards
   never disagree on price. */
function convertToUserCurrency(amount: number, dealCurrency: string, country: Country): number {
  const dealCcy = dealCurrency as Country["currency"];
  if (dealCcy === country.currency) return amount;
  const inUsd = dealCcy === "USD" ? amount : amount / (USD_FX[dealCcy] ?? 1);
  return Math.round(inUsd * (USD_FX[country.currency] ?? 1));
}

/* Same onError fallback pattern as MasonryCard's ResilientImage —
   when the image fails to load, swap to the gradient + emoji
   fallback so users never see a broken image icon. */
function ResilientThumb({ deal }: { deal: Deal }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !deal.imageUrl || failed;

  if (showFallback) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center text-3xl"
        style={{ background: deal.imageGradient }}
        aria-hidden="true"
      >
        <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
          {deal.imageEmoji}
        </span>
      </div>
    );
  }

  /* Proxy external images so Amazon / ASOS / AliExpress hotlink-block
     CDNs don't blank these thumbnails. See proxiedImageUrl(). */
  const altText = cleanTitle(deal.title).slice(0, 120);
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={proxiedImageUrl(deal.imageUrl)}
      alt={altText}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-full object-contain p-1.5 group-hover:scale-[1.04] transition-transform duration-300 motion-reduce:group-hover:scale-100"
    />
  );
}

interface Props {
  deal: Deal;
}

export default function ListCard({ deal }: Props) {
  const { country } = useCountry();
  const dealCcy = deal.currency as Country["currency"];
  const sameCcy = dealCcy === country.currency;

  const cleanedTitle = cleanTitle(deal.title);

  /* Country-aware prices — fixes the user-reported bug where US
     country was showing Naira on mobile because ListCard always
     called formatCompact() with the deal's NGN price. Now the same
     conversion path MasonryCard already uses applies here too. */
  const primarySale = sameCcy ? deal.salePrice : convertToUserCurrency(deal.salePrice, deal.currency, country);
  const primaryOrig = sameCcy ? deal.originalPrice : convertToUserCurrency(deal.originalPrice, deal.currency, country);
  const primarySaved = primaryOrig > primarySale ? primaryOrig - primarySale : 0;

  const priceFmt = formatLocal(primarySale, country);
  const origFmt  = formatLocal(primaryOrig, country);
  const saveFmt  = primarySaved > 0 ? formatLocal(primarySaved, country) : null;
  const hasDiscount = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;

  /* Amazon search-URL deals — see MasonryCard for the full rationale.
     The cheapest reference price is real, but the destination is a
     search results page, not a specific item. "from " makes that
     honest. Same flag must apply on both card layouts so the framing
     stays consistent across grid + list views. */
  const isPriceFromOnly = isAmazonSearchUrl(deal.url);

  /* Secondary price hint — shows the deal's NATIVE currency (what
     the merchant actually charges) when the user's display currency
     is different. Was hardcoded to NGN, which surfaced "≈ ₦806K" on
     /uk/deals — a non-sequitur for a UK shopper looking at a Currys
     listing. Round-4 QA caught. The primary already shows the user's
     local currency (via convertToUserCurrency above); the secondary
     reveals the merchant's actual charge so the user knows what
     they'll see at checkout. */
  const isUSD = deal.currency === "USD";
  const ngnEquivStr = !sameCcy && isUSD
    ? `≈ $${deal.salePrice.toFixed(2)}`
    : null;

  /* Cross-border total estimate (price + ~30% shipping/customs).
     Now formatted in the user's currency. Replaces the previous
     hardcoded ₦ rendering that broke for non-NG mobile users. */
  /* Cross-border check uses store country (not currency) — same fix
     applied in MasonryCard. SerpAPI normalises all UK retailer
     prices to USD, so a currency-only check would mark every Argos
     row as cross-border for UK users. */
  const dealStoreCountry = inferStoreCountry(deal.storeId, deal.storeName);
  const storeIsLocalToUser = dealStoreCountry !== null && dealStoreCountry.toLowerCase() === country.code.toLowerCase();
  const isCrossBorder = !storeIsLocalToUser && !sameCcy;
  const landedNgnStr = isCrossBorder ? `≈ ${formatLocal(Math.round(primarySale * 1.30), country)}` : null;

  return (
    <a
      /* Routes through /api/go for affiliate tag wrapping — same
         reason as MasonryCard. */
      href={getClickThroughUrl(deal)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${cleanedTitle}, ${isPriceFromOnly ? "from " : ""}${priceFmt} at ${deal.storeName}`}
      className="group flex gap-3 items-start p-2.5 rounded-2xl border border-border bg-surface hover:border-border-strong hover:shadow-card transition-all"
    >
      {/* Image — square thumbnail on the left */}
      <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-white border border-border">
        <ResilientThumb deal={deal} />

        {/* Discount badge — perfect circle, top-right of the thumbnail */}
        {hasDiscount && (
          <div
            className="absolute top-1 right-1 w-9 h-9 rounded-full flex flex-col items-center justify-center text-white"
            style={{
              background: "#dc2626",
              boxShadow: "0 2px 6px rgba(220,38,38,0.35), 0 0 0 2px rgba(255,255,255,0.85)",
            }}
          >
            <span className="text-[11px] font-black leading-none">{deal.discountPercent}%</span>
            <span className="text-[7px] font-bold uppercase tracking-[0.05em] mt-0.5 opacity-90">off</span>
          </div>
        )}

        {/* INTL badge — bottom-left of the thumbnail. Same visual
            language as MasonryCard so list + grid views stay
            consistent. Shows when the deal's store isn't anchored
            in the user's country (via inferStoreCountry). Was
            missing on list view; only the masonry view had it. */}
        {isCrossBorder && (
          <span
            className="absolute left-1 bottom-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium text-white/95 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            INTL
          </span>
        )}
      </div>

      {/* Right column — store · time, title, price row */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center gap-1 text-[11px] text-ink-3 leading-none">
          <span className="font-medium truncate text-ink-2">{deal.storeName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{timeAgo(deal.postedAt)}</span>
        </div>

        <p className="mt-1.5 text-[13px] font-medium text-ink leading-snug line-clamp-2 tracking-[-0.005em]">
          {cleanedTitle}
        </p>

        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
          {isPriceFromOnly && (
            <span className="text-[11px] font-medium text-ink-3 leading-none">from</span>
          )}
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

        {ngnEquivStr && (
          <p className="text-[10px] text-ink-3 mt-0.5">{ngnEquivStr}</p>
        )}

        {landedNgnStr && (
          <p className="text-[10px] text-ink-3 mt-0.5 flex items-center gap-1">
            <span>{landedNgnStr}</span>
            <span>total</span>
            <InfoTip
              label="What's included in the total"
              text="Estimated total: product price + ~30% for cross-border shipping and customs. Actual cost varies."
              size={11}
            />
          </p>
        )}
      </div>
    </a>
  );
}
