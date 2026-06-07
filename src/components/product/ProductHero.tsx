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

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Tag, Store as StoreIcon, Globe, AlertTriangle } from "lucide-react";
import {
  cleanTitle,
  displayDiscountPct,
  proxiedImageUrl,
  downscaleCardImageUrl,
  getClickThroughUrl,
  formatUSDPrice,
  formatCompact,
  isStoreSearchUrl,
  freshnessOf,
  timeAgo,
} from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
import { brandDisplay } from "@/lib/brand-display";
import { landedTotal } from "@/lib/landed-price";
import PriceComparisonBar from "@/components/product/PriceComparisonBar";
import PriceAlertButton from "@/components/product/PriceAlertButton";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
import MerchantVerifiedChip from "@/components/ui/MerchantVerifiedChip";
import InfoTip from "@/components/ui/InfoTip";
import type { MerchantTrust } from "@/lib/merchant-trust";
import type { PerStoreOffer } from "@/lib/pdp-stats";
import type { PriceHistorySummary } from "@/lib/search/price-history";
import {
  USD_FX,
  formatLocal,
  resolveStoreCountry,
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
  /** DB-authoritative anchor market (stores.country, uppercase ISO).
      Mapped from OfferRow.store_country in the PDP page's
      offerRowToHero. Preferred over the JS roster by
      resolveStoreCountry so the cross-border check and the
      PriceComparisonBar "ships from" label classify the store by its
      real market, not its USD-normalised currency. */
  storeCountry?:   string | null;
  /** `false` only when explicitly out of stock. `undefined` /
      missing values are treated as in-stock — the product_best_offers
      view filters for in_stock=true by construction and drops the
      column from the projection, so casting raw view rows blind
      would otherwise misfire the out-of-stock badge on every PDP. */
  inStock:         boolean | undefined;
  scrapedAt:       string;
  /** Per-merchant trust tier (merchant-trust.ts), resolved server-
      side in the PDP page. "established" => curated, link-verified
      retailer; drives the "Verified" eyebrow pill. Absent / undefined
      for synthetic /p/live offers and lesser-known stores (no pill). */
  trust?:          MerchantTrust;
}

interface Props {
  offer:        OfferData;
  countryCode:  string;
  /** Server-signed /api/go outbound URL for the View-at-merchant
      CTA. The PDP page computes and signs it (the HMAC needs a
      server-only secret); ProductHero just renders it. Falls back
      to an unsigned client-built URL when absent — that still
      works, it just degrades to a Havlo page at /api/go rather
      than reaching the merchant. */
  signedOutboundUrl?: string;
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
  /** Cross-border context banner. When the visited offer's store
      isn't shoppable from the visitor's country, this banner
      surfaces a warning ("Doesn't ship to NG") and links to the
      best locally-shoppable alternative if one exists. Replaces
      the previous silent redirect that was confusing users — see
      the comment in /[country]/p/[id]/page.tsx where this is
      computed. Undefined for normal in-country offers. */
  localAlternative?: {
    offerId:   string;
    /** Price is in NGN. The compare/anchor matcher
        (pgFtsAnchorOffersByProductId -> offerToStoreOffer) normalises
        every StoreOffer.price to NGN regardless of the offer's native
        currency, and the PDP passes that value straight through. The
        banner MUST convert NGN -> visitor currency before display
        (see convertToUserCurrency at the render site). */
    storeName: string;
    price:     number;
    url:       string;
  } | null;
  /** Whether the visited offer's store IS shoppable from the
      visitor's country. Only relevant when localAlternative is
      surfaced — drives the banner's wording. */
  isLocallyShoppable?: boolean;
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

export default function ProductHero({ offer, countryCode, totalStores, perStoreOffers, priceHistory, signedOutboundUrl, localAlternative, isLocallyShoppable }: Props) {
  const country = getCountry(countryCode);
  const [imgFailed, setImgFailed] = useState(false);

  const cleanedTitle = cleanTitle(offer.title);
  /* Cross-border banner copy. Only renders when isLocallyShoppable
     is explicitly false — undefined leaves the banner off (for the
     vast majority of PDPs where the offer is in-country). */
  const showCrossBorderBanner = isLocallyShoppable === false;
  /* Normalise the storeName for display — handles raw SerpAPI strings
     like "Amazon.co.uk - Amazon.co.uk-Seller" that escaped ingest-
     time canonicalisation (older DB rows). Pure function, idempotent,
     so calling on already-clean names ("Currys") is a no-op. */
  const displayStore = displayStoreName(offer.storeName);
  /* Hero image source. We clamp the RAW CDN url BEFORE wrapping it in
     the proxy: the Amazon/Cloudinary size tokens downscaleCardImageUrl
     rewrites only survive on the bare url — once it's URL-encoded inside
     /api/img-proxy?url=… the token is opaque and can't be rewritten.
     The proxy itself is a referer-rewriting pass-through (no resize),
     so a real width-based srcset is only possible via the token rewrite. */
  const rawImg = offer.imageUrl ?? null;
  const imgSrc = rawImg ? proxiedImageUrl(rawImg) : null;
  /* Emit a 2-width srcset ONLY when the clamp produces distinct urls
     (i.e. the source is a token-bearing Amazon/Cloudinary CDN). For
     small/un-rewritable sources w640 === w1280, so we drop srcSet and
     keep the proven single-src path untouched — no broken descriptors. */
  const heroSrcSet = (() => {
    if (!rawImg) return undefined;
    const w640  = downscaleCardImageUrl(rawImg, 640);
    const w1280 = downscaleCardImageUrl(rawImg, 1280);
    if (w640 === w1280) return undefined;
    return `${proxiedImageUrl(w640)} 640w, ${proxiedImageUrl(w1280)} 1280w`;
  })();

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

  /* Cross-border signal — matches MasonryCard's three-step logic
     plus the May 2026 fix that triggers cross-border when the
     store is anchored to ANY country other than the user's
     (not just on currency mismatch). UK Currys viewed by a US
     user with both prices normalised to USD still gets the
     cross-border treatment.
     June 2026: resolution prefers the DB-authoritative
     offer.storeCountry over the JS roster (resolveStoreCountry), so
     long-tail UK/DE stores absent from the roster no longer fall to
     the `!sameCcy` hint and get wrongly flagged INTL on their own
     market's PDP. Also sharpens the PriceComparisonBar "ships from"
     label, which reads the same dealStoreCountry. */
  const dealStoreCountry = resolveStoreCountry(offer.storeId, offer.storeName, offer.storeCountry);
  const storeIsLocalToUser = dealStoreCountry !== null && dealStoreCountry.toLowerCase() === country.code.toLowerCase();
  const storeIsGlobalIntl  = dealStoreCountry === null && isGlobalIntlStore(offer.storeId, offer.storeName);
  const isCrossBorder      = !storeIsLocalToUser && (
    dealStoreCountry !== null ||
    storeIsGlobalIntl ||
    !sameCcy
  );

  /* Secondary price line — completely rewritten May 2026 after QA
     report. Old behaviour: showed `≈ $12.02 in USD` as a spot FX
     conversion on every cross-border PDP. That's both jargon-heavy
     AND mis-described (the user doesn't pay $12.02 — they pay the
     local store's price plus shipping + customs).

     New behaviour: always shows the LANDED TOTAL in the user's own
     currency for cross-border purchases — same +30% formula
     MasonryCard already uses. Matches the rest of the surface so
     a card → PDP transition doesn't change what "total" means.
     For genuine currency hints (e.g. AliExpress NGN price on a US
     PDP), we fall through to a small parenthetical original-
     currency note BELOW the landed total. */
  let secondaryStr: string | null = null;
  if (isCrossBorder) {
    /* Primary line: landed total in user's currency. landedTotal()
       centralises the +30% allowance; "(est.)" keeps it honestly
       framed as a rough estimate, never precise per-item cost. (#14) */
    const landedAmount = Math.round(landedTotal(primaryAmount));
    const landedFmt = country.currency === "NGN"
      ? formatCompact(landedAmount)
      : country.currency === "USD"
        ? formatUSDPrice(landedAmount)
        : formatLocal(landedAmount, country);
    secondaryStr = `≈ ${landedFmt} total (est.)`;
  }

  /* Resolved /api/go URL for the View-at-merchant CTA. The wrapper
     attaches the title + storeId + storeName fallback hints so
     /api/go can complete the redirect even if the underlying URL
     is a Google relay that needs merchant-fallback resolution. */
  const outboundUrl = signedOutboundUrl ?? getClickThroughUrl({
    url:       offer.url,
    id:        offer.offerId,
    title:     offer.title,
    storeId:   offer.storeId,
    storeName: offer.storeName,
    /* country threaded through so Ubuy/etc country-routed merchants
       resolve via merchantSearchUrl with the right subdomain. Also
       drives the SSR google-relay pre-resolve added May 2026
       re-audit (see getClickThroughUrl docstring). */
    country:   countryCode,
  });

  /* OFF% derived from the prices actually shown (struck original →
     current), NOT the provider's offer.discountPercent. The two are
     independent DB columns, so the provider % can be computed off a
     pre-import list price we never display — and the old gate
     (discountPercent > 0 alone) could even badge a "20% off" with no
     real struck markdown when original_price defaulted to current.
     Deriving keeps the badge, the struck-through price, and the "You
     save" line consistent; displayDiscountPct also drops implausible
     (> 95%) markdowns that signal a bad feed original_price. */
  const derivedPct  = displayDiscountPct(offer.originalPrice, offer.currentPrice);
  const hasDiscount = derivedPct > 0;
  const savingsAbs  = hasDiscount ? offer.originalPrice - offer.currentPrice : 0;

  return (
    <>
      {/* Cross-border context banner — only when the visited offer's
          store doesn't ship to the visitor's country (BackMarket /
          93mobiles / FoneZone / refurbed-de on NG, etc.). Replaces
          the old silent redirect (see /[country]/p/[id]/page.tsx
          comment). Renders ABOVE the hero so the user sees the
          context BEFORE the price + CTA. When a local alternative
          exists, the banner doubles as a one-click route to it. */}
      {showCrossBorderBanner && (
        <div className="mb-5 sm:mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              {/* Advisory copy — was previously "{Store} doesn't typically
                  ship to {Country}" which was too definitive. Many
                  retailers we flag as "external" actually CAN ship cross-
                  border via freight forwarders, store-side international
                  programs (Amazon Global, ASOS Premier), or third-party
                  couriers — Havlo can't reliably tell which path the user
                  has access to. Soften to "may not ship directly" and
                  let the user decide. May 2026 user report: "when you
                  say a store doesn't ship to a country, i need you to
                  fact check that and correct the necessary ones because
                  some are wrong." */}
              <div className="text-sm font-semibold text-ink mb-1">
                International seller - check shipping to {country.name}
              </div>
              <div className="text-xs text-ink-2">
                {localAlternative
                  /* localAlternative.price is NGN (matcher-normalised).
                     Convert to the visitor's currency before formatting,
                     same path the primary price takes. Bare formatLocal
                     here previously printed the raw NGN integer with the
                     local symbol: a 111.75 USD Frasers offer became
                     178,800 NGN and rendered as "£178,800" on /uk
                     (user-reported). NG pages looked correct only because
                     NGN already matches the page currency. */
                  ? <><span className="font-semibold text-ink">{displayStore}</span> may not ship directly to {country.name}. The same product is available at <span className="font-semibold text-ink">{displayStoreName(localAlternative.storeName)}</span> for <span className="font-semibold text-ink">{formatLocal(convertToUserCurrency(localAlternative.price, "NGN", country), country)}</span>.</>
                  : <><span className="font-semibold text-ink">{displayStore}</span> may not ship directly to {country.name} - visit the store to confirm shipping options before ordering.</>}
              </div>
            </div>
            {localAlternative && (
              <a
                href={localAlternative.url}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-ink text-bg text-sm font-semibold whitespace-nowrap hover:bg-ink-2 transition-colors"
              >
                View at {displayStoreName(localAlternative.storeName)}
              </a>
            )}
          </div>
        </div>
      )}
    <section className="grid md:grid-cols-[1fr,minmax(0,1.05fr)] gap-6 sm:gap-10 lg:gap-14">
      {/* ── Image column ─────────────────────────────────────────── */}
      {/* White tile when an image is present so dark products (black
          phones, speakers, TVs) don't vanish into the dark surface;
          object-contain letterboxes, so the container colour shows
          around the photo. Keeps bg-surface-2 for the no-image
          HavloLogoFallback, which is designed for the dark surface. */}
      <div className={`relative aspect-square md:aspect-[4/5] rounded-2xl sm:rounded-3xl border border-border overflow-hidden ${imgSrc && !imgFailed ? "bg-white" : "bg-surface-2"}`}>
        {imgSrc && !imgFailed ? (
          /* Plain <img> (May 2026 v3) — was next/image with priority.
             Vercel free-tier image transformation cap (5K/mo) was
             exhausted; LCP candidates kept erroring on new variants.
             The trade-off is no AVIF/WebP for PDP hero images, but
             the PDP renders one hero per page so the cumulative
             bandwidth impact is negligible. fetchPriority="high"
             still gives LCP its preload signal.
             object-contain + absolute fill keeps small source images
             (300-500px from Jumia/Konga/SerpAPI) from upscaling blur. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imgSrc}
            alt={cleanedTitle.slice(0, 120)}
            /* Intrinsic dims are advisory only — the aspect-ratio
               container + w-full/h-full object-contain drive actual
               layout (so CLS is already reserved). 4:5 matches the
               md:aspect-[4/5] hero ratio; gives the SEO/Lighthouse
               "explicit width/height" check a value to read. */
            width={1000}
            height={1250}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-contain p-3 sm:p-4"
            {...(heroSrcSet
              ? { srcSet: heroSrcSet, sizes: "(max-width: 767px) 92vw, 520px" }
              : {})}
          />
        ) : (
          /* Havlo logo fallback matches MasonryCard's ResilientImage
             so the empty state reads consistent across surfaces. */
          <HavloLogoFallback size="lg" />
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
            aria-label={`${derivedPct}% off`}
          >
            <span className="text-[20px] sm:text-[24px] font-black leading-none tracking-tight">
              {derivedPct}%
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
          {/* Per-merchant trust pill — only for curated, link-verified
              retailers. Matches the sibling store / brand / Intl pills
              so it reads as quiet metadata, not a loud badge. */}
          <MerchantVerifiedChip trust={offer.trust} variant="pill" />
          {isCrossBorder && (
            /* Same shape as the store + brand pills next to it —
               neutral surface, neutral border. The amber tint lives
               only on the Globe icon now, which is enough signal
               for a status tag (vs. a warning that needs to be
               read). When the eyebrow runs store + brand + International,
               keeping all three pills visually identical reads as a
               consistent metadata row, not "one of these is a problem."
               May 29 2026 trust-signal refinement. */
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] text-ink-2">
              <Globe size={12} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>International</span>
            </div>
          )}
          {offer.brand && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] text-ink-2">
              <Tag size={12} aria-hidden="true" />
              {/* brandDisplay handles the casing — DB stores brand
                  lowercase ("apple"), display wants "Apple" / "LG" /
                  "iRobot". Shared helper across hero + ProductAbout
                  so the same input renders the same string. */}
              <span>{brandDisplay(offer.brand)}</span>
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
            /* Cross-border landed total — mirrors the card treatment
               from MasonryCard so the PDP transition stays visually
               consistent. InfoTip explains the +30% shipping/customs
               assumption so users know what's actually in the
               number. */
            <p className="text-sm text-ink-3 mt-1 flex items-center gap-1 tabular-nums">
              {secondaryStr}
              <InfoTip
                label="What's included in the total"
                text="Estimated total: product price + ~30% for cross-border shipping and customs. Actual cost varies by carrier, weight, and customs assessment."
                size={13}
              />
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

        {/* Staleness warning — shown only when the offer's scrapedAt
            is more than a week old. Sits between the bold price
            block and the FTC line so the user reads it on the same
            eye-track as the number they're about to trust. May 29 2026
            trust-break report: user saw "Verified 2w ago" on the
            spectrum's trust strip (small + grey) and went ahead and
            clicked through, then found the merchant price had
            changed. The chart's freshness strip and the spectrum's
            "Verified X ago" line now ALSO recolour to amber on stale
            data, but this hero-level chip is the loudest signal
            because it's the closest to the headline price + the
            Visit CTA, and the only one most quick visitors will
            actually read. */}
        {(() => {
          const fresh = freshnessOf(offer.scrapedAt);
          if (!fresh.warn) return null;
          /* Inline annotation, not a card. The earlier amber-bg +
             amber-border treatment was claiming banner-grade real
             estate for a chip that fires on ~20% of PDPs at any
             given time (Mon/Wed/Fri ingest cadence + 7-day stale
             threshold + 14-day TTL means a healthy slice of the
             catalog sits in the 7–13d-old window). When a "warning"
             reads as default UI chrome it loses urgency — exactly
             the opposite of the trust play we're making. AlertTriangle
             + amber-800 text on the plain surface still catches the
             eye via the icon and color shift, but reads as honest
             annotation instead of "Havlo thinks this price is
             broken." May 29 2026 trust-signal refinement. */
          return (
            <p className="mb-3 inline-flex items-start gap-1.5 text-[12px] text-amber-800 dark:text-amber-400 leading-snug">
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-[1px]" aria-hidden="true" />
              <span>
                Price last verified {timeAgo(offer.scrapedAt).toLowerCase()}, it may have changed at {displayStore}.
              </span>
            </p>
          );
        })()}

        {/* FTC affiliate-disclosure inline above the click-out CTA.
            16 CFR Part 255 requires the disclosure to be clear-and-
            conspicuous "near the triggering claim" — for outbound
            CTAs, the immediate-vicinity-of-the-button placement is
            the gold standard. Slim 11px / ink-3 so it doesn't dominate
            but is comfortably readable. rel="sponsored" on the anchor
            below also satisfies the platform-level FTC + Amazon
            Associates rel-attribute requirement. */}
        <p className="text-[11px] text-ink-3 mb-1.5 leading-snug">
          Havlo may earn a commission from this link - at no extra cost to you.
        </p>

        {/* Primary CTA — outbound to merchant via /api/go */}
        <a
          href={outboundUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ink text-bg font-semibold text-[15px] hover:opacity-90 transition-opacity mb-3"
        >
          Visit {displayStore}
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
            /* Pass pid only when it's a real product_id (UUID
               shape). Curated Amazon rows carry a synthetic slug
               like 'amazon-us-iphone-15-pro-max' as their pseudo-
               product_id; sending that through `?pid=` causes the
               compare RPC to fail (products.id is uuid-typed) and
               the user lands on "Nothing found" even though the
               PDP can render the product fine. */
            const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (offer.productId && looksLikeUuid.test(offer.productId)) {
              params.set("pid", offer.productId);
            }
            /* `oid` is the ultimate fallback. /api/compare uses it
               to fetch the offer + product + store from the same
               sources the PDP uses (product_best_offers view,
               offers+products+stores join, curated Amazon catalog)
               and synthesises a single-offer anchor when pid + FTS
               both miss. Guarantees: if the user can see this PDP,
               the compare click ALWAYS shows at least this offer. */
            if (offer.offerId) params.set("oid", offer.offerId);
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

        {/* Tertiary CTA — set a price alert. Tucked below the
            compare CTA as a quiet text link with a bell icon so it
            doesn't compete with the primary "Visit" / secondary
            "Compare" affordances. Expands inline to a popover form
            on click. Persists to /api/alerts + fires a confirmation
            email; the cron (/scripts/cron/check-price-alerts.ts)
            fires the trigger email when conditions match.

            Mounted after the secondary CTA so the visual progression
            stays "buy now → compare → track for later" — three
            intents at decreasing immediacy. */}
        {/* Right-aligned so it reads as a tertiary affordance
            visually separated from the left-stack of primary
            actions. The popover expands rightward from the link
            (max-w-sm cap inside PriceAlertButton keeps it from
            ballooning past the column). */}
        <div className="mb-4 flex justify-end">
          <PriceAlertButton
            productId={offer.productId}
            productTitle={offer.title}
            currentPriceNgn={anchorPriceNgn}
            country={country}
          />
        </div>

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
    </>
  );
}
