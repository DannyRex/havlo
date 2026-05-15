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
import { ExternalLink, Tag, Store as StoreIcon, Globe } from "lucide-react";
import {
  cleanTitle,
  proxiedImageUrl,
  getClickThroughUrl,
  formatUSDPrice,
  formatCompact,
  isStoreSearchUrl,
} from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
import PriceComparisonBar from "@/components/product/PriceComparisonBar";
import type { PerStoreOffer } from "@/lib/pdp-stats";
import type { PriceHistorySummary } from "@/lib/search/price-history";
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
  /** Per-store breakdown for the new PriceComparisonBar (store dots
      + cheapest-at action + verdict math). All effective prices are
      country-aware NGN — formatPriceForUser converts at render time.
      Empty array when the anchor pool is empty (curated PDPs with
      synthetic product_id). */
  perStoreOffers?: PerStoreOffer[];
  /** Price history summary — drives "all-time low" + "this store's
      lowest" callouts on the bar. Undefined when product_price_history
      RPC is unavailable or the product has no history rows yet. */
  priceHistory?: PriceHistorySummary;
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

export default function ProductHero({ offer, countryCode, totalStores, perStoreOffers, priceHistory }: Props) {
  const country = getCountry(countryCode);
  const [imgFailed, setImgFailed] = useState(false);

  const cleanedTitle = cleanTitle(offer.title);
  /* Normalise the storeName for display — handles raw SerpAPI strings
     like "Amazon.co.uk - Amazon.co.uk-Seller" that escaped ingest-
     time canonicalisation (older DB rows). Pure function, idempotent,
     so calling on already-clean names ("Currys") is a no-op. */
  const displayStore = displayStoreName(offer.storeName);
  const imgSrc       = offer.imageUrl ? proxiedImageUrl(offer.imageUrl) : null;

  /* Primary price in the user's currency. */
  const primaryAmount = convertToUserCurrency(offer.currentPrice, offer.currency, country);

  /* PriceComparisonBar takes NGN values and runs the user-currency
     conversion at render time via formatPriceForUser. Pass priceStats
     through unchanged. The previous version converted to user currency
     here AND let the bar convert again, which produced "£0 cheapest /
     £0 highest" on every UK PDP because the second division by 1600
     rounds typical product prices to zero. The single-store fallback
     (no priceStats) still needs an NGN anchor value for the bar's
     props, computed inline below. */
  const anchorPriceNgn = offer.currency === "USD"
    ? Math.round(offer.currentPrice * USD_FX.NGN)
    : offer.currentPrice;

  const primaryStr = country.currency === "NGN"
    ? formatCompact(primaryAmount)
    : country.currency === "USD"
      ? formatUSDPrice(primaryAmount)
      : formatLocal(primaryAmount, country);

  const sameCcy = offer.currency === country.currency;

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

  /* Secondary price — only show the original-currency hint when the
     store is genuinely cross-border for this visitor. For local
     stores the stored "USD" is a SerpAPI normalisation artifact
     (every UK / US / DE retailer is normalised to USD at ingest);
     surfacing "≈ $1,141.73 in USD" on a Currys card to a UK shopper
     reads as if Currys prices in USD, which they don't. User report
     May 2026: "Currys is UK, not intl. Why does the price show
     USD?" — gated behind isCrossBorder so the secondary only
     renders when the foreign-currency context is real. */
  let secondaryStr: string | null = null;
  if (!sameCcy && isCrossBorder) {
    if (offer.currency === "NGN") secondaryStr = `≈ ${formatCompact(offer.currentPrice)}`;
    else if (offer.currency === "USD") secondaryStr = `≈ ${formatUSDPrice(offer.currentPrice)}`;
  }

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
            <span className="font-medium text-ink">{displayStore}</span>
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
          View at {displayStore}
          <ExternalLink size={16} aria-hidden="true" />
        </a>

        {/* Secondary action — compare across stores. Routes to /compare
            with the product title as the query, surfacing the broader
            search-results view including dupes + live results.

            Label is dynamic: "Compare prices across N stores" when
            totalStores is known and > 1, so the user can see at a
            glance how broad the compare view will be. Falls back to
            generic copy when the count isn't computable (e.g. a curated
            row without a dupes pre-fetch).

            We pass `pid` (the anchor's product_id) alongside `q` so
            /api/compare's pid-backstop can find the product directly
            when FTS over the title misses. FTS misses are common for
            unique product titles — pg_trgm similarity is naturally
            low for short or unusual phrasings. User report May 2026:
            "coming from the pdp page of S61 Wireless Bluetooth
            Speaker Superbass Microphone, i clicked compare across
            stores and it didn't find anything." That's the exact
            shape FTS struggles with — a model code + generic terms,
            no canonical brand/SKU to anchor scoring on. The
            backstop in /api/compare:129 picks the product up by ID
            and returns the anchor + any dupes, so the user always
            sees their product on /compare. Synthetic productIds
            (curated Amazon slugs like 'amazon-us-iphone-15-pro-max')
            return empty from the backstop and are harmless — the
            primary FTS path is still the main route for those. */}
        {/* CTA always visible, regardless of totalStores. Founder
            direction May 2026: keep the affordance present even
            when there's only 1 known listing — the comparison
            view itself communicates "we're watching for more"
            and gives users the same price-bar context, so the
            button is a useful shortcut even when N=1. Briefly
            tried hiding when N <= 1 (84d1767) — reverted. */}
        <Link
          href={(() => {
            const params = new URLSearchParams({ q: offer.title, mode: "similar" });
            if (offer.productId) params.set("pid", offer.productId);
            return `/${countryCode}/compare?${params.toString()}`;
          })()}
          /* prefetch={false}: this is a secondary CTA on a page
             where the primary action is "View at {Merchant}". Most
             visitors won't click here, but Next.js's default
             prefetch=true would fetch the /compare RSC payload on
             every PDP view — wasted server work + bandwidth.
             Loading on click is fine; /compare loads in <300ms on
             a warm cache. */
          prefetch={false}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-border-strong text-ink font-medium text-[14px] hover:bg-surface-2 transition-colors mb-4"
        >
          {/* Label intentionally says "Compare prices across N stores".
              Audit May 2026 raised that the PDP's N didn't match the
              N rendered by /compare's anchor section ("Available at" /
              "Across N stores"). The fix is on the COUNT, not the
              copy — totalStores is now computed from the anchor
              product's pooled offers (this product + signature-tight
              siblings → country-filtered → same-store/same-price
              deduped) so the value here equals what the user sees
              after clicking through. Falls back to a count-less
              variant when totalStores isn't computable (curated
              Amazon rows whose product_id isn't in the products
              table). */}
          {typeof totalStores === "number" && totalStores > 1
            ? <>Compare prices across {totalStores} stores</>
            : <>Compare prices across stores</>}
        </Link>

        {/* Price-vs-market visual signal. Replaces the previous
            "Last checked / Store country" tiles + the standalone
            staleness paragraph. The bar shows where THIS price sits
            between the cheapest and dearest known prices for the
            same product across other stores — a strong "is this a
            good deal?" cue at a glance. The verification + ships-
            from facts now live INSIDE the bar's footer strip,
            keeping the same trust signals but inverting the
            information hierarchy: comparison signal first, facts
            secondary.

            QA report May 2026: "the boring last checked + store
            country tiles. Last Checked is not intuitive — is it
            the last time I or havlo checked it?" — fixed via
            "Verified by Havlo" labelling inside the bar. */}
        <PriceComparisonBar
          thisPriceNgn={anchorPriceNgn}
          /* Original price → MSRP tick mark on the spectrum.
             Normalised to NGN inline; the bar only renders the
             tick when originalPriceNgn > thisPriceNgn. */
          originalPriceNgn={
            offer.originalPrice && offer.originalPrice > 0
              ? (offer.currency === "USD"
                  ? Math.round(offer.originalPrice * USD_FX.NGN)
                  : offer.originalPrice)
              : undefined
          }
          thisStoreId={offer.storeId}
          thisStoreName={displayStore}
          thisIsCrossBorder={isCrossBorder}
          country={country}
          perStoreOffers={perStoreOffers ?? []}
          priceHistory={priceHistory}
          lastCheckedAt={offer.scrapedAt}
          storeCountry={dealStoreCountry}
          outOfStock={offer.inStock === false}
          countryCode={countryCode}
          productId={offer.productId}
          productSearchTitle={offer.title}
        />
      </div>
    </section>
  );
}
