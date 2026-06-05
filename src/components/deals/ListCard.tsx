"use client";

/* List-style card used on /deals when the user toggles "list view"
   on mobile. Image left, all text on the right, more info per row
   than the masonry grid. Better for buying-intent scanning, worse
   for casual visual browsing — that's why it's a user choice. */

import { useState } from "react";
import Link from "next/link";
import {
  cleanTitle,
  isStoreSearchUrl,
  proxiedImageUrl,
  timeAgo,
} from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
import InfoTip from "@/components/ui/InfoTip";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
import { useCountry } from "@/components/providers/CountryProvider";
import { USD_FX, formatLocal, inferStoreCountry, isGlobalIntlStore, type Country } from "@/lib/country";
import { pdpUrlForDeal } from "@/lib/pdp-url";
import { landedTotal } from "@/lib/landed-price";
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
   when the image fails to load OR is missing entirely, swap to the
   Havlo logo mark so users never see a broken image icon. */
function ResilientThumb({ deal }: { deal: Deal }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !deal.imageUrl || failed;

  if (showFallback) {
    return <HavloLogoFallback size="sm" />;
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
  /** Override the default `/[country]/p/[deal.id]` PDP link.
      Same purpose as MasonryCard.linkHref — used by surfaces with
      synthetic Deal IDs (SimilarProducts / LiveAlternatives) so
      cards route somewhere meaningful instead of 404ing the PDP. */
  linkHref?: string;
}

export default function ListCard({ deal, linkHref }: Props) {
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
  const displayStore = displayStoreName(deal.storeName);

  /* Amazon search-URL deals — see MasonryCard for the full rationale.
     The cheapest reference price is real, but the destination is a
     search results page, not a specific item. "from " makes that
     honest. Same flag must apply on both card layouts so the framing
     stays consistent across grid + list views. */
  /* "from $X" prefix when the outbound link is a store search page
     rather than a specific product page. Generalised across all
     retailers so Currys / Argos / Walmart / etc. search-fallback
     URLs surface as "from" prices, matching the existing Amazon
     treatment. See isStoreSearchUrl() for the detection rules. */
  /* Precomputed by /api/deals (May 2026 payload trim) — fall back
     to the old client-side detection for callers passing full Deal
     objects with `url` populated. */
  const isPriceFromOnly = (deal as Deal & { isPriceFromOnly?: boolean }).isPriceFromOnly
    ?? (deal.url ? isStoreSearchUrl(deal.url) : false);

  /* Three-step cross-border check (matches MasonryCard exactly).
     Step 2 — the global-intl short-circuit — fixes AliExpress /
     Shein / Temu being flagged as local for US users by the bare
     currency-match fallback. Hoisted ABOVE the secondary-price
     and landed-cost code (May 2026) so both gate on the corrected
     check, not the raw `!sameCcy` which fires for UK Currys
     (USD-stored, GBP user). */
  const dealStoreCountry = inferStoreCountry(deal.storeId, deal.storeName);
  const storeIsLocalToUser = dealStoreCountry !== null && dealStoreCountry.toLowerCase() === country.code.toLowerCase();
  const storeIsGlobalIntl  = dealStoreCountry === null && isGlobalIntlStore(deal.storeId, deal.storeName);
  const isCrossBorder = !storeIsLocalToUser && (storeIsGlobalIntl || !sameCcy);

  /* Secondary price hint — shows the deal's NATIVE currency (what
     the merchant actually charges) when the store is GENUINELY
     cross-border for this visitor. For local stores the stored
     "USD" is a SerpAPI normalisation artifact; surfacing "≈ $X.XX"
     on a Currys listing to a UK shopper reads as if Currys prices
     in USD, which they don't. User report May 2026: "Currys is UK,
     not intl. Why does the price show USD?" */
  const isUSD = deal.currency === "USD";
  const ngnEquivStr = isCrossBorder && !sameCcy && isUSD
    ? `≈ $${deal.salePrice.toFixed(2)}`
    : null;

  /* Cross-border total estimate (price + ~30% shipping/customs).
     Already gated on isCrossBorder — same store-roster check, no
     change. */
  const landedNgnStr = isCrossBorder ? `≈ ${formatLocal(Math.round(landedTotal(primarySale)), country)}` : null;

  return (
    <Link
      /* Click model change (May 2026): routes to the product detail
         page rather than jumping outbound. The PDP carries the
         merchant info and a "View at {Merchant}" CTA — the actual
         /api/go affiliate-wrapped outbound now fires at that CTA
         click instead of this card click. Matches MasonryCard. */
      /* Default href uses pdpUrlForDeal so synthetic IDs from live
         search providers (aliex-, paapi-, konga-, serp-) route to
         /p/live instead of 404ing the standard /p/[id] route. The
         live-search persist path is paused, so those IDs never
         resolve in the offers table. linkHref override still wins
         where callers need a custom destination. */
      href={linkHref ?? pdpUrlForDeal(country.code, deal)}
      aria-label={`${cleanedTitle}, ${isPriceFromOnly ? "from " : ""}${priceFmt} at ${displayStore}. Open details.`}
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
        {/* Store (left) + last-verified time pinned to the far right —
            matches the masonry card's mobile layout (justify-between, no
            inline · separator). */}
        <div className="flex items-center justify-between gap-1.5 text-[11px] text-ink-3 leading-none">
          <span className="font-medium truncate text-ink-2">{displayStore}</span>
          {/* suppressHydrationWarning — same SSR/CSR Date.now()
              divergence as the masonry version. */}
          <span className="shrink-0" suppressHydrationWarning>found {timeAgo(deal.postedAt).toLowerCase()}</span>
        </div>

        <p className="mt-1.5 text-[13px] font-medium text-ink leading-snug line-clamp-2 tracking-[-0.005em]">
          {cleanedTitle}
        </p>

        {/* Used / refurbished label — mirror of MasonryCard. Keeps a
            pre-owned or refurbished listing from reading as a fresh
            "deal". Amber = context, not a positive. */}
        {deal.isUsed && (
          <span className="inline-flex items-center mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            Used / Refurbished
          </span>
        )}

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

        {/* "Lowest in 30 days" badge — mirror of MasonryCard's badge.
            Same offers_at_30d_low signal, same visual treatment so
            list + grid views stay consistent. */}
        {deal.at30DayLow && (
          <p className="text-[10px] text-success font-semibold mt-1 inline-flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-success" aria-hidden="true" />
            Lowest price in 30 days
          </p>
        )}

        {landedNgnStr && (
          <p className="text-[10px] text-ink-3 mt-0.5 flex items-center gap-1">
            <span>{landedNgnStr}</span>
            <span>total</span>
            <InfoTip
              label="What's included in the total"
              text="A rough estimate: the item price plus about 30% for cross-border shipping and customs. The real total varies by carrier, weight and customs."
              size={11}
            />
          </p>
        )}
      </div>
    </Link>
  );
}
