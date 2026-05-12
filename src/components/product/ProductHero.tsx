"use client";

/* Product detail page hero — image on the left (square aspect on
   desktop, full-bleed on mobile), product info on the right.
   Composes with /api/go for the "View at {Merchant}" outbound CTA
   so the affiliate-wrapping pipeline stays the chokepoint for every
   outbound click (consistent with /deals' MasonryCard).

   Visual reference: spoken.io's product page — generous whitespace,
   a clear primary action, brand/category microcopy above the title,
   useful supplementary info (last seen, store badge, savings %)
   without crowding. */

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Tag, Clock, Store as StoreIcon, ShieldCheck, Globe } from "lucide-react";
import {
  cleanTitle,
  proxiedImageUrl,
  getClickThroughUrl,
  formatUSDPrice,
  formatCompact,
  isStoreSearchUrl,
  timeAgo,
} from "@/lib/utils";
import {
  USD_FX,
  formatLocal,
  inferStoreCountry,
  isGlobalIntlStore,
  getCountry,
  type Country,
} from "@/lib/country";

/* Shape passed from the server-rendered page. Mirrors the offer
   fields the page already has — no separate fetch from the client. */
export interface OfferData {
  offerId:         string;
  productId:       string;
  storeId:         string;
  storeName:       string;
  storeLogoUrl:    string | null;
  title:           string;
  category:        string;
  brand:           string | null;
  imageUrl?:       string;
  url:             string;
  currentPrice:    number;
  originalPrice:   number;
  discountPercent: number;
  currency:        "NGN" | "USD";
  inStock:         boolean;
  scrapedAt:       string;
}

interface Props {
  offer:       OfferData;
  countryCode: string;
}

/* Convert any price (NGN or USD) to the user's preferred currency.
   Same helper as MasonryCard / ListCard — kept inline here so the
   PDP doesn't pull in those card files just for the conversion. */
function convertToUserCurrency(
  amount: number,
  dealCurrency: "NGN" | "USD",
  country: Country,
): number {
  if (dealCurrency === country.currency) return amount;
  /* Both NGN and USD route through USD as the intermediate currency
     since USD_FX is "1 USD = X local". Round to whole units for
     non-USD targets to match formatLocal's display rounding. */
  const usd = dealCurrency === "USD" ? amount : amount / USD_FX.NGN;
  const out = usd * USD_FX[country.currency];
  return country.currency === "USD" ? Math.round(out * 100) / 100 : Math.round(out);
}

export default function ProductHero({ offer, countryCode }: Props) {
  const country = getCountry(countryCode);
  const [imgFailed, setImgFailed] = useState(false);

  const cleanedTitle = cleanTitle(offer.title);
  const imgSrc       = offer.imageUrl ? proxiedImageUrl(offer.imageUrl) : null;

  /* Primary price in the user's currency. */
  const primaryAmount = convertToUserCurrency(offer.currentPrice, offer.currency, country);
  const primaryStr = country.currency === "NGN"
    ? formatCompact(primaryAmount)
    : country.currency === "USD"
      ? formatUSDPrice(primaryAmount)
      : formatLocal(primaryAmount, country);

  /* Secondary price — show the original currency hint when it
     differs from the user's, matching MasonryCard's pattern so the
     PDP price visualisation feels familiar. */
  const sameCcy = offer.currency === country.currency;
  let secondaryStr: string | null = null;
  if (!sameCcy) {
    if (offer.currency === "NGN") secondaryStr = `≈ ${formatCompact(offer.currentPrice)}`;
    else if (offer.currency === "USD") secondaryStr = `≈ ${formatUSDPrice(offer.currentPrice)}`;
  }

  /* "from" price prefix — when the outbound link is a store search
     URL rather than a specific product page (Currys, Argos, John
     Lewis search-fallback, Amazon /s, etc.) the displayed price is
     the cheapest reference we have for the product family, not a
     guarantee for the specific item the user lands on. */
  const isPriceFromOnly = isStoreSearchUrl(offer.url);

  /* Cross-border signal — same three-step logic as MasonryCard:
     store-country roster first, then global-intl short-circuit
     (catches AliExpress/Shein/Temu/etc.), then currency-mismatch
     fallback. */
  const dealStoreCountry = inferStoreCountry(offer.storeId, offer.storeName);
  const storeIsLocalToUser = dealStoreCountry !== null && dealStoreCountry.toLowerCase() === country.code.toLowerCase();
  const storeIsGlobalIntl  = dealStoreCountry === null && isGlobalIntlStore(offer.storeId, offer.storeName);
  const isCrossBorder      = !storeIsLocalToUser && (storeIsGlobalIntl || !sameCcy);

  /* Resolved /api/go URL for the View-at-merchant CTA. The wrapper
     attaches the title + storeId + storeName fallback hints so
     /api/go can complete the redirect even if the underlying URL
     is a Google relay that needs merchant-fallback resolution. */
  const outboundUrl = getClickThroughUrl({
    url:       offer.url,
    id:        offer.offerId,
    title:     offer.title,
    storeId:   offer.storeId,
    storeName: offer.storeName,
  });

  const hasDiscount = offer.discountPercent > 0;
  const savingsAbs  = hasDiscount ? offer.originalPrice - offer.currentPrice : 0;

  return (
    <section className="grid md:grid-cols-[1fr,minmax(0,1.05fr)] gap-6 sm:gap-10 lg:gap-14">
      {/* ── Image column ─────────────────────────────────────────── */}
      <div className="relative aspect-square md:aspect-[4/5] rounded-2xl sm:rounded-3xl bg-surface-2 border border-border overflow-hidden">
        {imgSrc && !imgFailed ? (
          <Image
            src={imgSrc}
            alt={cleanedTitle.slice(0, 120)}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            onError={() => setImgFailed(true)}
            className="object-contain p-6 sm:p-10"
          />
        ) : (
          /* Gradient + emoji fallback matches MasonryCard's
             ResilientImage so the empty state reads consistent
             across surfaces. */
          <div
            className="absolute inset-0 flex items-center justify-center text-7xl sm:text-8xl"
            style={{ background: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)" }}
            aria-hidden="true"
          >
            <span className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]">🛍️</span>
          </div>
        )}

        {/* Discount badge — top-right, same circular treatment as
            MasonryCard so the PDP feels visually consistent. */}
        {hasDiscount && (
          <div
            className="absolute top-4 right-4 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center text-white select-none"
            style={{
              background: "#dc2626",
              boxShadow: "0 4px 12px rgba(220,38,38,0.35), 0 0 0 3px rgba(255,255,255,0.85)",
            }}
            aria-label={`${offer.discountPercent}% off`}
          >
            <span className="text-[20px] sm:text-[24px] font-black leading-none tracking-tight">
              {offer.discountPercent}%
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-90">
              off
            </span>
          </div>
        )}
      </div>

      {/* ── Info column ──────────────────────────────────────────── */}
      <div className="flex flex-col">
        {/* Eyebrow: store badge + cross-border tag */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] text-ink-2">
            <StoreIcon size={12} aria-hidden="true" />
            <span className="font-medium text-ink">{offer.storeName}</span>
          </div>
          {isCrossBorder && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-300/40 text-[12px] text-amber-800 dark:text-amber-200">
              <Globe size={12} aria-hidden="true" />
              <span>International</span>
            </div>
          )}
          {offer.brand && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] text-ink-2">
              <Tag size={12} aria-hidden="true" />
              <span>{offer.brand}</span>
            </div>
          )}
        </div>

        {/* H1 — the title. Limited to 3 lines so absurdly-long
            scraped titles don't push the price below the fold. */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-[-0.02em] leading-[1.15] mb-5 line-clamp-3">
          {cleanedTitle}
        </h1>

        {/* Price block */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            {isPriceFromOnly && (
              <span className="text-sm sm:text-base text-ink-3 font-medium">from</span>
            )}
            <span className="text-3xl sm:text-4xl font-bold text-ink tracking-[-0.02em] tabular-nums">
              {primaryStr}
            </span>
            {hasDiscount && (
              <span className="text-base sm:text-lg text-ink-3 line-through tabular-nums">
                {country.currency === "USD"
                  ? formatUSDPrice(convertToUserCurrency(offer.originalPrice, offer.currency, country))
                  : country.currency === "NGN"
                    ? formatCompact(convertToUserCurrency(offer.originalPrice, offer.currency, country))
                    : formatLocal(convertToUserCurrency(offer.originalPrice, offer.currency, country), country)}
              </span>
            )}
          </div>
          {secondaryStr && (
            <p className="text-sm text-ink-3 mt-1 tabular-nums">
              {secondaryStr} <span className="text-ink-3/70">in {offer.currency}</span>
            </p>
          )}
          {hasDiscount && savingsAbs > 0 && (
            <p className="text-sm text-success mt-2 font-medium">
              You save {country.currency === "USD"
                ? formatUSDPrice(convertToUserCurrency(savingsAbs, offer.currency, country))
                : country.currency === "NGN"
                  ? formatCompact(convertToUserCurrency(savingsAbs, offer.currency, country))
                  : formatLocal(convertToUserCurrency(savingsAbs, offer.currency, country), country)}
            </p>
          )}
        </div>

        {/* Primary CTA — outbound to merchant via /api/go */}
        <a
          href={outboundUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ink text-bg font-semibold text-[15px] hover:opacity-90 transition-opacity mb-3"
        >
          View at {offer.storeName}
          <ExternalLink size={16} aria-hidden="true" />
        </a>

        {/* Secondary action — compare across stores. Routes to /compare
            with the product title as the query, surfacing the broader
            search-results view including more dupes than the focused
            "Cheaper alternatives" rail below. */}
        <Link
          href={`/${countryCode}/compare?q=${encodeURIComponent(offer.title)}&mode=similar`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-border-strong text-ink font-medium text-[14px] hover:bg-surface-2 transition-colors mb-7"
        >
          Compare prices across stores
        </Link>

        {/* Useful info row — paste of small facts users want before
            clicking through. Modelled on spoken.io's product detail
            page which surfaces designer / category / materials / etc.
            We don't have spec-level metadata, but the four below give
            useful trust signal:
              • Last seen — when our scraper last checked this offer
              • Store country — where the retailer is anchored
              • Affiliate disclosure — quiet but legally required
              • In-stock note — explicit when out of stock */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border">
            <Clock size={14} className="text-ink-3 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-ink-3 text-[11px] uppercase tracking-[0.08em] font-semibold mb-0.5">
                Last checked
              </dt>
              <dd className="text-ink-2">{timeAgo(offer.scrapedAt)}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border">
            <StoreIcon size={14} className="text-ink-3 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-ink-3 text-[11px] uppercase tracking-[0.08em] font-semibold mb-0.5">
                Store country
              </dt>
              <dd className="text-ink-2">
                {dealStoreCountry ? dealStoreCountry : "International"}
              </dd>
            </div>
          </div>

          {!offer.inStock && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-300/40 sm:col-span-2">
              <Clock size={14} className="text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-red-700 dark:text-red-300 text-[11px] uppercase tracking-[0.08em] font-semibold mb-0.5">
                  Out of stock
                </dt>
                <dd className="text-red-800/80 dark:text-red-200/80">
                  Last seen unavailable. Cheaper alternatives below may still be in stock.
                </dd>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border sm:col-span-2">
            <ShieldCheck size={14} className="text-ink-3 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-ink-3 text-[11px] uppercase tracking-[0.08em] font-semibold mb-0.5">
                Affiliate disclosure
              </dt>
              <dd className="text-ink-2 leading-relaxed">
                Some outbound links may earn us a small commission at no extra cost to you. The cheapest verified option always ranks first.
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </section>
  );
}
