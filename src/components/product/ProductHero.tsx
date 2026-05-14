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
import { ExternalLink, Tag, Clock, Store as StoreIcon, Globe } from "lucide-react";
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
  /** `false` only when explicitly out of stock. `undefined` /
      missing values are treated as in-stock — the product_best_offers
      view filters for in_stock=true by construction and drops the
      column from the projection, so casting raw view rows blind
      would otherwise misfire the out-of-stock badge on every PDP. */
  inStock:         boolean | undefined;
  scrapedAt:       string;
}

interface Props {
  offer:        OfferData;
  countryCode:  string;
  /** Total count of stores carrying this product (anchor + dupes).
      Drives the "Compare prices across N stores" CTA label so the
      user knows how much broader the compare view is than the PDP. */
  totalStores?: number;
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

export default function ProductHero({ offer, countryCode, totalStores }: Props) {
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
            search-results view including dupes + live results.

            Label is dynamic: "Compare prices across N stores" when
            totalStores is known and > 1, so the user can see at a
            glance how broad the compare view will be. Falls back to
            generic copy when the count isn't computable (e.g. a curated
            row without a dupes pre-fetch). */}
        <Link
          href={`/${countryCode}/compare?q=${encodeURIComponent(offer.title)}&mode=similar`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-border-strong text-ink font-medium text-[14px] hover:bg-surface-2 transition-colors mb-4"
        >
          {typeof totalStores === "number" && totalStores > 1
            ? <>Compare prices across {totalStores} stores</>
            : <>Compare prices across stores</>}
        </Link>

        {/* Price-staleness disclosure. We refresh the catalog on a
            scrape cadence (every few hours for most stores), so the
            price/availability shown here is a snapshot — not live. The
            merchant CAN change either between our last scrape and the
            user's click-through. Better to set the expectation upfront
            than have users feel misled when they hit a 4xx on the
            merchant page. Short, honest, no scary language. */}
        <p className="text-[12px] text-ink-3 leading-relaxed mb-7 -mt-1">
          Price and availability shown reflect our last check
          {offer.scrapedAt ? <> {timeAgo(offer.scrapedAt)}</> : null}. The merchant may have updated either since. We&apos;ll send you to their page so you can verify before you buy.
        </p>

        {/* Useful info row — small facts shoppers want before clicking
            through. Affiliate disclosure removed (May 2026) — it lives
            on /how-we-make-money for users who want the detail, and
            peer comparison sites (Dupe, etc.) don't surface it inline
            on each PDP. The remaining tiles are direct trust signals:
              • Last seen — when our scraper last checked
              • Store country — retailer anchor (or 'International')
              • Out of stock notice — only when in_stock = false */}
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

          {/* Out-of-stock tile — only when in_stock is explicitly false.
              Defaults to in-stock when the field is missing (the
              product_best_offers view filters for in_stock=true by
              construction, so the column drops out of the projection
              and would otherwise show the badge for every row). */}
          {offer.inStock === false && (
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
        </dl>
      </div>
    </section>
  );
}
