"use client";

/* Country-aware product card.
   Reads useCountry() so prices show in the user's preferred currency:
     - NG user, USD-priced deal → primary $ + ≈ ₦ equivalent (existing behavior)
     - UK user, USD-priced deal → primary £ + ≈ $ original
     - UK user, NGN-priced deal → primary £ (converted) + ≈ ₦
   Layout utilities (chunkLeftToRight, MASONRY_ASPECTS) live in
   masonry-layout.ts so server components can still import them. */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cleanTitle,
  displayDiscountPct,
  downscaleCardImageUrl,
  formatCompact,
  formatUSDPrice,
  isStoreSearchUrl,
  proxiedImageUrl,
  savings,
  timeAgo,
} from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
import StoreLogo from "@/components/compare/StoreLogo";
import { useCountry } from "@/components/providers/CountryProvider";
import {
  USD_FX, formatLocal, resolveStoreCountry, isGlobalIntlStore, type Country,
} from "@/lib/country";
import { getCashbackForStore } from "@/lib/cashback";
import InfoTip from "@/components/ui/InfoTip";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
import { track } from "@/lib/analytics";
import { trackClick, isTrackableProductId } from "@/lib/trackClick";
import { pdpUrlForDeal } from "@/lib/pdp-url";
import { landedTotal } from "@/lib/landed-price";
import type { Deal } from "@/types";

interface Props {
  deal: Deal;
  aspect: string;
  /** Show the small INTL chip on items priced in a non-local currency */
  showOriginBadge?: boolean;
  /** Show the per-card "Earn N% soon" cashback badge. Default true. Set
      false on surfaces where a single page-level cashback banner already
      covers every card (e.g. the Amazon hub, where all items qualify), so
      the badge isn't repeated on every tile. */
  showCashback?: boolean;
  /** Above-the-fold cards opt in to eager + high-priority image loading
      so the LCP pixel arrives without waiting for the lazy heuristic. */
  priority?: boolean;
  /** Override the default `/[country]/p/[deal.id]` PDP link.
      Used by SimilarProducts + LiveAlternatives where the deal IDs are
      synthetic (e.g. `argos:product_key` or `serp-xxxx`) and don't
      resolve in the PDP route. Those surfaces pass a /compare-style
      URL instead so the user lands on a meaningful page rather than
      a 404. */
  linkHref?: string;
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
   failure (DNS, 404, CORS, deleted file) OR when the deal has no
   imageUrl at all, swaps to the Havlo logo fallback so users never
   see a broken image icon. May 2026: replaced the emoji+gradient
   placeholder (decorative but inconsistent) with the brand logo
   mark — reads as intentional and keeps the surface on-brand. */
function ResilientImage({ deal, priority }: { deal: Deal; priority: boolean }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !deal.imageUrl || failed;

  if (showFallback) {
    return <HavloLogoFallback size="md" />;
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
  /* downscaleCardImageUrl rewrites oversized CDN size tokens (Amazon
     _SL1500_, Cloudinary w_2000) down to ≤640px BEFORE proxying, so a
     ~180px masonry cell stops downloading a full-res hero image. Pure
     URL rewrite, downsize-only, host-gated — and ResilientImage already
     falls back to the Havlo mark if a rewritten URL ever 404s, so the
     downside is bounded. This is the lever that actually trims LCP/page
     weight now that next/image's optimizer is off (Vercel cap). */
  const imgSrc = proxiedImageUrl(downscaleCardImageUrl(deal.imageUrl));

  /* Was next/image (PSI flagged ~157 KiB savings from AVIF/WebP).
     Switched to plain <img> May 2026 v3 after the Vercel free-tier
     transformation cap exhausted (5K/mo). The masonry renders 16
     cards per /deals page load × thousands of unique products =
     the largest transformation consumer in the codebase. Skipping
     the optimizer is the single biggest cap saver.

     Trade-offs accepted:
       - No AVIF/WebP conversion (JPG/PNG serves as-is from CDN)
       - No responsive srcset (mobile downloads larger asset)
       - Loses ~150 KiB per card in modern browsers
     Mitigations in play:
       - /api/img-proxy still handles hotlink-block defense
       - loading="lazy" defers below-fold images
       - fetchPriority="high" preserves LCP signal for top cards

     Re-enable next/image when the Vercel plan can absorb the cost
     (Pro tier = 50K transformations/month, ~10× current need). */
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={imgSrc}
      alt={altText}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] motion-reduce:group-hover:scale-100"
    />
  );
}

export default function MasonryCard({ deal, aspect, showOriginBadge = true, priority = false, linkHref, showCashback = true }: Props) {
  const { country } = useCountry();
  const router      = useRouter();
  const dealCcy = deal.currency as Country["currency"];
  const sameCcy = dealCcy === country.currency;

  const cleanedTitle = cleanTitle(deal.title);
  const saved = savings(deal.originalPrice, deal.salePrice);
  /* OFF% derived from the prices actually shown (struck original →
     sale), NOT the provider's deal.discountPercent. The two are
     independent DB columns, so the provider % can be computed off a
     pre-import list price we never display — surfacing e.g. "30% off"
     above a struck pair whose real gap is 20%. Deriving keeps the
     badge, the struck-through price, and the −save line consistent;
     displayDiscountPct also suppresses implausible (> 95%) markdowns
     that signal a bad feed original_price. */
  const derivedPct  = displayDiscountPct(deal.originalPrice, deal.salePrice);
  const hasDiscount = derivedPct > 0;
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
  /* Display-clean storeName — collapses raw SerpAPI seller suffixes
     ("Amazon.de - Amazon.de-Seller" → "Amazon Germany") that escaped
     ingest-time canonicalisation on older DB rows. */
  const displayStore = displayStoreName(deal.storeName);
  /* Logo file path. eBay (and a few marketplaces) fragment into
     per-seller store ids (ebay-characteruk) whose per-seller logo files
     don't exist — collapse those to the marketplace slug so the real
     /logos/ebay.png renders. StoreLogo still falls through to a favicon
     then a letter badge for any store without a bundled asset. */
  const logoStoreId = /^ebay[-_]/i.test(deal.storeId) ? "ebay" : deal.storeId;

  /* Amazon search-URL deals (curated catalog rows that link to
     /s?k=... rather than a /dp/ASIN page). The displayed price is
     the cheapest reference value we have for the product family,
     not a guarantee for the specific item the user lands on. The
     "from " prefix tells the user that explicitly, which is the
     truthful framing the QA agent asked for. */
  /* "from $X" prefix when the outbound link is a store search page
     rather than a specific product page. Generalised from Amazon-
     only (the previous isAmazonSearchUrl check) to all retailers
     because Currys, Argos, John Lewis, Walmart and others have the
     same shape — when we don't have a direct product URL we route
     to the merchant's search results, and the displayed price is
     the cheapest reference we have for the product family, not a
     guarantee for the specific item the user lands on. The "from "
     prefix tells the user that explicitly. */
  /* `isPriceFromOnly` arrives precomputed from /api/deals (May 2026
     payload trim — `deal.url` is no longer shipped to cards because
     the click model routes to PDP first, and Google Shopping URLs
     run 1KB+ each). Fall back to the old client-side detection for
     callers (TrendingDeals, MasonryGrid) that still pass full Deal
     objects with a url field. */
  const isPriceFromOnly = (deal as Deal & { isPriceFromOnly?: boolean }).isPriceFromOnly
    ?? (deal.url ? isStoreSearchUrl(deal.url) : false);

  /* Cross-border classification — three-step decision:
       1. If resolveStoreCountry returns a country, store is local
          IFF it matches the user's country. If it's anchored to a
          DIFFERENT country, the visitor will pay cross-border
          shipping regardless of whether currencies happen to match.
       2. If store has no country anchor BUT is in GLOBAL_INTL_STORES
          (AliExpress, Shein, Temu, DHgate…), it's ALWAYS cross-
          border, regardless of currency match.
       3. Untagged store with no global-intl flag — fall back to
          currency-mismatch as a last-resort hint.
     Hoisted ABOVE landedFmt + secondaryStr (May 2026) so both gate
     on the corrected check, not the raw `!sameCcy` which fires for
     UK Currys (stored as USD but local for UK users).
     Bug fix May 2026: previously the anchored-elsewhere case (UK
     Currys viewed by a US user) didn't trigger cross-border because
     both deal currency and user currency normalised to USD — so
     `sameCcy` was true and the OR shortcut returned false. The
     extra `dealStoreCountry !== null` clause closes that hole so
     every cross-country browse on the deals page now shows the
     landed total.
     June 2026: resolution now prefers the DB-authoritative
     deal.storeCountry (stores.country) over the JS roster via
     resolveStoreCountry. The ~600 long-tail UK/US/DE stores that the
     hardcoded roster misses (lookfantastic, onbuy, refurbed-de, …)
     were USD-normalised at ingest and, absent from the roster, fell
     to the `!sameCcy` hint below and got wrongly flagged INTL on
     their own market's rails (the "₦/$ leak on /uk" report). The DB
     value resolves them to their real market, so a UK store reads
     local for a UK user. */
  const dealStoreCountry = resolveStoreCountry(deal.storeId, deal.storeName, deal.storeCountry);
  const storeIsLocalToUser = dealStoreCountry !== null && dealStoreCountry.toLowerCase() === country.code.toLowerCase();
  const storeIsGlobalIntl  = dealStoreCountry === null && isGlobalIntlStore(deal.storeId, deal.storeName);
  const isCrossBorderForUser = !storeIsLocalToUser && (
    dealStoreCountry !== null ||  // anchored to a different country
    storeIsGlobalIntl ||          // global intl roster
    !sameCcy                       // last-resort currency hint
  );
  const showIntl = showOriginBadge && isCrossBorderForUser;

  /* Landed-cost estimate for cross-border purchases. Uses the same
     30% markup as the /compare anchor row (offerToStoreOffer in
     pg-fts.ts) so users see consistent numbers across surfaces.
     Gated on isCrossBorderForUser, NOT bare !sameCcy — UK Currys
     (USD-stored, GBP user) shouldn't show "≈ £1,173 (landed)" since
     no cross-border shipping applies. */
  const landedFmt = isCrossBorderForUser
    ? formatLocal(Math.round(landedTotal(primarySale)), country)
    : null;

  /* Secondary price (the original-currency hint) — small, italic,
     below the primary line. Only renders when the store is GENUINELY
     cross-border for this visitor. For local stores the stored "USD"
     is a SerpAPI normalisation artifact (every UK / US / DE retailer
     normalises to USD at ingest); surfacing "≈ $1,141.73 in USD" on
     a Currys card to a UK shopper reads as if Currys prices in USD,
     which they don't. User report May 2026: "Currys is UK, not intl.
     Why does the price show USD?" */
  let secondaryStr: string | null = null;
  if (isCrossBorderForUser && !sameCcy) {
    if (dealCcy === "NGN") secondaryStr = `≈ ${formatCompact(deal.salePrice)}`;
    else if (dealCcy === "USD") {
      /* The stored "USD" is only the store's REAL currency for
         genuinely dollar-native sources: global-intl marketplaces
         (AliExpress / DHgate, which have no country anchor) and
         US-anchored stores. For a store anchored to a specific non-US
         country (a UK or DE retailer whose listing SerpAPI normalised
         to USD at ingest), "≈ $X" wrongly implies that store prices in
         dollars — the same class of bug the isCrossBorderForUser gate
         already fixed for LOCAL stores. Suppress the native hint there;
         the primary user-currency line + landed total still carry the
         price honestly. */
      const usdIsNative = dealStoreCountry === null || dealStoreCountry.toLowerCase() === "us";
      secondaryStr = usdIsNative ? `≈ ${formatUSDPrice(deal.salePrice)}` : null;
    }
    else secondaryStr = `≈ ${formatLocal(deal.salePrice, { ...country, currency: dealCcy } as Country)}`;
  }

  return (
    <Link
      /* Click model change (May 2026): cards now route to the
         product detail page first instead of jumping straight
         outbound. The PDP carries the merchant info, an explicit
         "View at {Merchant}" CTA, and a cheaper-alternatives rail
         so the user sees full context before leaving the site.

         The outbound /api/go affiliate wrap still happens — just at
         the PDP's primary CTA click instead of at this card click.
         Net effect: one extra hop for the user, more page views per
         session, and the affiliate chokepoint still fires on every
         actual purchase-intent click. */
      /* Default href uses pdpUrlForDeal so synthetic IDs from live
         search providers (aliex-, paapi-, konga-, serp-) route to
         /p/live instead of 404ing the standard /p/[id] route. The
         live-search persist path is paused, so those IDs never
         resolve in the offers table. linkHref override still wins
         where callers need a custom destination (rare). */
      href={linkHref ?? pdpUrlForDeal(country.code, deal)}
      aria-label={`${cleanedTitle}, ${isPriceFromOnly ? "from " : ""}${priceFmt} at ${displayStore}. Open details.`}
      className="group block"
      onClick={() => {
        /* GA4 product_click event — fires before navigation so the
           click context (store, category, surface) is captured even
           if the user closes the resulting tab quickly. No-ops when
           consent isn't granted (handled inside track()). */
        track({
          name: "product_click",
          props: {
            store_id:   deal.storeId,
            product_id: deal.id,
            category:   deal.categorySlug,
            surface:    "deals",
            country:    country.code,
          },
        });
        /* Product-view-intent click → the popularity/trending count
           (outbound_clicks), the same signal the compare rows feed.
           Skip synthetic live-search ids that don't resolve to a
           catalog product so we don't log unattributable rows. */
        if (isTrackableProductId(deal.id)) {
          trackClick(deal.id, "", 0, "card");
        }
      }}
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
              {derivedPct}%
            </span>
            {/* No opacity-90: at 90% the white "off" blended to #fce9e9
                over the red and dropped to 4.13:1 (WCAG AA fail). Full
                white on #dc2626 is 4.83:1. The number above was already
                full-white; this matches it. */}
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5">
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
        {showCashback && cashback && (
          /* Cashback badge — discoverability fix (QA Bucket 4 #11):
             previously it looked like a static label and shoppers
             didn't realise it was a shortcut to the cashback page.
             Now: a small ChevronRight icon makes the affordance
             obvious, and a subtle hover underline + ring on focus
             confirms it's a button. */
          <button
            type="button"
            title={`${cashback.percent}% back here when cashback goes live. Tap for details.`}
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
            /* min-h-[24px] floors the tap target to the WCAG 2.5.8 /
               Lighthouse target-size minimum (was ~23px tall at py-1). */
            className="absolute left-2 top-2 group/cashback inline-flex min-h-[24px] items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:brightness-110 hover:shadow-md active:brightness-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none"
            style={{ background: "rgba(16, 185, 129, 0.95)" }}
            aria-label={`Earn ${cashback.percent}% cashback when it launches. Open cashback details.`}
          >
            <span className="group-hover/cashback:underline underline-offset-2 decoration-white/80">
              Earn {cashback.percent}% soon
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
          {/* Store logo — small mark before the store name, so a card
              reads as "from {merchant}" at a glance. Resolves bundled
              /logos asset → favicon → letter badge (StoreLogo). */}
          <StoreLogo
            storeId={deal.storeId}
            storeName={deal.storeName}
            storeLogoUrl={`/logos/${logoStoreId}.png`}
            size={18}
            pad={3}
          />
          <span className="font-medium text-ink-2 truncate">{displayStore}</span>
          <span aria-hidden="true" className="shrink-0 hidden sm:inline">·</span>
          {/* Last-verified time. Was `hidden sm:inline` — desktop only —
              which dropped the freshness cue from mobile cards. Now shown
              on every breakpoint: `ml-auto` pins it to the far right on
              mobile (where the · separator is hidden), and `sm:ml-0`
              restores the inline "store · time" layout desktop already
              had. suppressHydrationWarning — timeAgo reads Date.now(), so
              SSR/CSR can differ at a minute/day boundary; harmless. */}
          <span className="shrink-0 ml-auto sm:ml-0" suppressHydrationWarning>found {timeAgo(deal.postedAt).toLowerCase()}</span>
        </div>

        <p className="text-[12px] sm:text-[13px] font-medium text-ink leading-snug line-clamp-2 mb-1 sm:mb-1.5 tracking-[-0.005em]">
          {cleanedTitle}
        </p>

        {/* Used / refurbished label — a pre-owned or refurbished item
            must never read as a fresh "deal". Amber (not green) so it
            reads as context, not a positive. Detected from the title /
            refurb store at the data layer (deal.isUsed). */}
        {deal.isUsed && (
          <span className="inline-flex items-center gap-1 mb-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            Used / Refurbished
          </span>
        )}

        <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
          {isPriceFromOnly && (
            <span className="text-[10px] sm:text-[11px] font-medium text-ink-3 leading-none">from</span>
          )}
          <span className="text-[13px] sm:text-sm font-bold text-ink">{priceFmt}</span>
          {hasDiscount && (
            <span className="text-[10px] sm:text-[11px] text-ink-3 line-through">{origFmt}</span>
          )}
          {hasDiscount && saveFmt && (
            <span className="ml-auto text-[10px] sm:text-[11px] font-semibold text-success">
              −{saveFmt}
            </span>
          )}
        </div>

        {secondaryStr && (
          <p className="text-[10px] text-ink-3 mt-0.5">{secondaryStr}</p>
        )}

        {/* "Lowest in 30 days" badge — surfaces when the offers_at_30d_low
            RPC has flagged this offer as at the 30-day price floor for
            its underlying product (across stores). Quiet emerald
            treatment so it complements the existing discount badge
            instead of competing with it: the discount badge says
            "this is cheaper than original price", the 30d badge says
            "this is the cheapest it's been recently anywhere". Both
            can fire on the same card; the visual hierarchy keeps the
            discount badge dominant since it's the primary CTA. */}
        {deal.at30DayLow && (
          <p className="text-[10px] text-success font-semibold mt-1 inline-flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-success" aria-hidden="true" />
            Lowest price in 30 days
          </p>
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
              text="A rough estimate: the item price plus about 30% for cross-border shipping and customs. The real total varies by carrier, weight and customs."
              size={11}
            />
          </p>
        )}
      </div>
    </Link>
  );
}
