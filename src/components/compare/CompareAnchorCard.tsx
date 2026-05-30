"use client";

/* Anchor hero card for the /compare page.

   Extracted from the compare/page.tsx top-level CompareContent
   component (May 2026 audit, phase 3 decomposition). The inline
   anchor card was ~290 lines of JSX + two IIFEs inside the parent
   page. As a separate component it's easier to reason about, can
   memoize render work, and keeps compare/page.tsx focused on the
   data-fetching state machine.

   Rendered when SearchOutput.mode === "similar". Three nested
   visual blocks:
     1. Product info (image + brand + title + price summary + alts hint)
     2. Store rows (deduped anchor offers, sorted by effective price)
     3. Disclosures (cross-border landed estimate + affiliate)
     4. Connector chip (only when dupes.length > 0)

   Compare-pool dedup matches the PDP's totalStores / priceStats
   pipeline (src/lib/pdp-stats.ts) so the count rendered here equals
   the "Compare prices across N stores" CTA on the originating PDP.
   Audit May 2026 caught that mismatch. */

import Link from "next/link";
import { Star, Plane, ChevronRight, ArrowDown, ShieldCheck } from "lucide-react";
import { formatPriceForUser } from "@/lib/utils";
import { pdpUrlForOffer } from "@/lib/pdp-url";
import {
  effectiveLandedPrice,
  effectiveDeliveryDays,
  anyCrossBorderForUser,
  isCrossBorderForUser,
} from "@/lib/landed-price";
import { isOfferAllowedForCountry } from "@/lib/country";
import { trackClick } from "@/lib/trackClick";
import StoreLogo from "@/components/compare/StoreLogo";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
import MerchantVerifiedChip from "@/components/ui/MerchantVerifiedChip";
import type { Country } from "@/lib/country";
import type { ProductGroup, DupeResult } from "@/lib/search";

interface Props {
  anchor: ProductGroup;
  dupes:  DupeResult[];
  country: Country;
  query:  string;
}

export default function CompareAnchorCard({ anchor, dupes, country, query }: Props) {
  /* Price summary line — cheapest store's price as headline,
     spread vs the most-expensive store ("save up to X across
     stores"). Sort by EFFECTIVE landed price (country-aware) so
     UK shoppers looking at a UK retailer don't see a 30% landed
     adder baked into the headline. */
  const withEff = anchor.offers
    .filter((o) => o.landedPrice > 0)
    .map((o) => ({ o, eff: effectiveLandedPrice(o, country) }))
    .sort((a, b) => a.eff - b.eff);
  const cheapest = withEff[0];
  const dearest  = withEff[withEff.length - 1];
  const spread   = dearest && cheapest && dearest.eff > cheapest.eff
    ? dearest.eff - cheapest.eff
    : 0;

  /* Deduped store rows — same-store + same-effective-price (rounded
     to ₦100 buckets) collapses identical AliExpress listings from
     multiple ingest cycles into a single row. Different prices
     from the same store stay (256GB vs 512GB SKU variants are
     real choices). Mirrors lines 558-566 of the pre-refactor
     compare/page.tsx exactly. */
  const seenRowKeys = new Set<string>();
  const sortedRows = anchor.offers
    .filter((o) => o.landedPrice > 0)
    .filter((o) => {
      const eff = effectiveLandedPrice(o, country);
      const key = `${o.storeId}|${Math.round(eff / 100) * 100}`;
      if (seenRowKeys.has(key)) return false;
      seenRowKeys.add(key);
      return true;
    })
    .sort((a, b) => effectiveLandedPrice(a, country) - effectiveLandedPrice(b, country));

  const rowsCheapest    = sortedRows.length > 0 ? effectiveLandedPrice(sortedRows[0], country) : 0;
  const isSingleStore   = sortedRows.length === 1;
  const hasDupes        = dupes.length > 0;
  const cheapestDupeBest = hasDupes ? dupes.reduce((min, d) => Math.min(min, d.bestPrice), Infinity) : 0;

  return (
    <div className="relative max-w-3xl mx-auto mb-8 sm:mb-10">
      <div className="relative rounded-2xl border border-border bg-surface p-4 sm:p-6 overflow-hidden">

        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          {/* Image — was next/image with priority for LCP. Switched
              to plain <img> May 2026 v3 after the Vercel free-tier
              transformation cap exhausted (5K/month). The anchor
              card renders ONE image per /compare load, but external
              CDN URLs (SerpAPI gstatic, Amazon CDN, etc.) need a
              fresh transformation per unique URL. Skipping the
              optimizer avoids broken-image holes during the rest
              of the cycle. Trade-off: image not AVIF/WebP-converted,
              but next/image's value on a single static-aspect cell
              was modest anyway. */}
          {anchor.imageUrl ? (
            <div className="relative w-full sm:w-28 h-40 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={anchor.imageUrl}
                alt={anchor.title}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 w-full h-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="relative w-full sm:w-28 h-40 sm:h-28 rounded-xl overflow-hidden flex-shrink-0">
              <HavloLogoFallback size="md" />
            </div>
          )}

          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-2 bg-surface-2 px-2 py-0.5 rounded">
                Your pick
              </span>
              {anchor.brand && (
                <span className="text-[10px] uppercase tracking-wider text-ink-3">
                  {anchor.brand}
                </span>
              )}
            </div>
            <h2 className="text-[15px] sm:text-lg font-semibold text-ink leading-snug line-clamp-2">
              {anchor.title}
            </h2>

            {anchor.offers.length > 0 && anchor.bestPrice > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
                <span className="text-lg sm:text-xl font-bold text-ink">
                  {formatPriceForUser(cheapest?.eff ?? anchor.bestPrice, country)}
                </span>
                {spread > 0 && (
                  <span className="text-xs text-ink-3">
                    Save up to <span className="text-success font-semibold">{formatPriceForUser(spread, country)}</span> across stores
                  </span>
                )}
              </div>
            )}

            {hasDupes && dupes[0].savingsPercent > 0 && (
              <p className="mt-2 text-xs text-success font-medium">
                Alternatives from {formatPriceForUser(cheapestDupeBest, country)}
              </p>
            )}
          </div>
        </div>

        {sortedRows.length >= 1 && (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
                {isSingleStore
                  ? "Available at"
                  : `Across ${sortedRows.length.toLocaleString()} stores`}
              </p>
              {!isSingleStore && (
                /* Payout-neutral ranking promise, surfaced AT the
                   decision point (top of the store rows) rather than
                   buried in a footer. Still tells the user the list is
                   price-ordered ("by price") while making the
                   neutrality claim the headline and linking to the
                   full explanation. Turns /how-we-make-money into a
                   trust asset (Spoken learning #1). */
                <Link
                  href="/how-we-make-money"
                  className="group inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink transition-colors"
                  title="How Havlo makes money"
                >
                  <ShieldCheck
                    size={12}
                    strokeWidth={2}
                    className="text-success/80 group-hover:text-success transition-colors"
                    aria-hidden="true"
                  />
                  <span className="underline-offset-2 group-hover:underline">
                    Sorted by price, not payout
                  </span>
                </Link>
              )}
            </div>
            {/* FTC affiliate-disclosure inline at the store-row surface
                — clear-and-conspicuous standard (16 CFR Part 255). Sits
                directly above the click-out rows so it's visible at
                the moment the user is about to outbound. Links to the
                full disclosure page. Slim enough not to dominate the
                rail, prominent enough that we're not hiding it. */}
            <p className="text-[11px] text-ink-3 mb-2 leading-snug">
              Havlo may earn a commission from these links - at no extra cost to you. <Link href="/how-we-make-money" className="underline underline-offset-2 hover:text-ink">How we make money</Link>.
            </p>
            <ul className="space-y-1.5">
              {sortedRows.map((offer, i) => {
                const isBest   = !isSingleStore && i === 0;
                const eff      = effectiveLandedPrice(offer, country);
                const savings  = eff - rowsCheapest;
                const subtitle = (offer.productTitle && offer.productTitle !== anchor.title)
                  ? offer.productTitle
                  : null;
                const deliveryDays = effectiveDeliveryDays(offer, country);
                const isXBorder    = isCrossBorderForUser(offer, country);
                /* Country-reachability flag — drives the cross-border
                   chip label (informational) but no longer affects
                   click routing. EVERY row routes to /p/<offerId>
                   regardless of country-shoppability so the user's
                   click goes to the store they actually clicked.
                   The PDP renders a clear cross-border banner when
                   the offer's store isn't country-allowed and lets
                   the user see both the price they came for and any
                   local alternative side-by-side. See the PDP page
                   handler (no silent redirect for cross-border) in
                   src/app/[country]/p/[id]/page.tsx. */
                const isShoppableHere = isOfferAllowedForCountry(offer, country);
                return (
                  <li key={`${offer.storeId}-${offer.price}-${i}`}>
                    {/* Whole row is the click target — Spoken pattern.
                        Routes to the PDP for this offer, not directly
                        outbound. PDP-first click model is consistent
                        across /deals, TrendingDeals, the PDP "You may
                        also like" rail, and this anchor row.
                        pdpUrlForOffer falls back to /p/live for
                        synthetic offers. */}
                    <a
                      href={pdpUrlForOffer(country.code, offer)}
                      onClick={() => trackClick(anchor.key, query, i, "anchor-comparison")}
                      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isBest
                          ? "border-success/40 bg-success/5 hover:bg-success/10"
                          : "border-border bg-bg/50 hover:border-border-strong hover:bg-surface-2/50"
                      }`}
                    >
                      <StoreLogo
                        storeId={offer.storeId}
                        storeName={offer.storeName}
                        storeLogoUrl={offer.storeLogoUrl}
                        merchantUrl={offer.url}
                        size={40}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isBest && (
                            <Star
                              size={13}
                              strokeWidth={2}
                              className="text-success fill-success shrink-0"
                              aria-label="Best price"
                            />
                          )}
                          <span className="text-sm font-semibold text-ink truncate">
                            {offer.storeName}
                          </span>
                          {/* Per-merchant trust cue — icon-only here to
                              keep dense rows uncluttered. Shows only for
                              curated, link-verified retailers; lesser-
                              known stores get nothing (not penalised). */}
                          <MerchantVerifiedChip trust={offer.trust} />
                          {/* Cross-border tag — uses isCrossBorderForUser
                              (visitor-aware) rather than the raw
                              isInternational DB flag, so a UK retailer
                              doesn't carry the tag for a UK user even
                              though the row was ingested USD-normalised.
                              Same fix shape as DupeCard / MasonryCard.

                              For NON-SHOPPABLE-from-country stores
                              (BackMarket / refurbed-de / fonezone /
                              bigbasket / 93mobiles on NG, etc.) we
                              swap the label to "External" so users
                              don't misread "Cross-border" as "yes I
                              can buy this with a freight forwarder".
                              The row routes directly outbound for
                              these stores (see rowHref above). */}
                          {isXBorder && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] shrink-0 ${isShoppableHere ? "text-amber-500" : "text-ink-3"}`}>
                              <Plane size={10} /> {isShoppableHere ? "Cross-border" : "External"}
                            </span>
                          )}
                        </div>
                        {subtitle ? (
                          <p className="text-[11px] text-ink-3 mt-0.5 truncate">
                            {subtitle}
                          </p>
                        ) : (
                          <p className="text-[11px] text-ink-3 mt-0.5">
                            {deliveryDays
                              ? `${deliveryDays} ${deliveryDays === 1 ? "day" : "days"} delivery`
                              : "Delivery varies"}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-base font-bold tabular-nums ${isBest ? "text-success" : "text-ink"}`}>
                          {formatPriceForUser(eff, country)}
                        </p>
                        {savings > 0 && (
                          <p className="text-[11px] text-ink-3 tabular-nums">
                            +{formatPriceForUser(savings, country)}
                          </p>
                        )}
                      </div>

                      <ChevronRight
                        size={16}
                        strokeWidth={2}
                        className="shrink-0 text-ink-3 group-hover:text-ink-2 transition-colors"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>

            {/* Cross-border landed-cost disclosure — gated on
                anyCrossBorderForUser (visitor-aware) so it doesn't
                surface for UK-shopper-looking-at-UK-retailer rows. */}
            {anyCrossBorderForUser(sortedRows, country) && (
              <p className="mt-3 text-[11px] text-ink-3 leading-relaxed">
                <span className="text-amber-500">⚑</span>{" "}
                Cross-border prices include a ~30% landed estimate (shipping + customs).
                Final total varies by carrier and customs assessment.
              </p>
            )}
            {/* Price-as-last-seen honesty (Spoken learning #4). Prices
                are scraped on a cadence, not live, so frame them as
                last-recorded rather than guaranteed-current. Quiet,
                always-on cue for the at-a-glance comparison; the PDP
                carries the louder per-offer staleness warning at the
                actual click-out. Out-of-stock offers are already
                dropped upstream (buildAnchorGroup in pg-fts.ts). */}
            <p className="mt-3 text-[11px] text-ink-3 leading-relaxed">
              Prices are the latest we recorded and may have changed at the store.
            </p>
          </div>
        )}
      </div>

      {/* Connector chip — only shows when there are dupes below.
          Visually links the anchor card to the cheaper-alternatives
          grid that follows. */}
      {hasDupes && (
        <div className="flex flex-col items-center mt-5 mb-2">
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-success/10 border border-success/20">
            <ArrowDown size={12} className="text-success" />
            <span className="text-xs font-semibold text-success">
              {dupes.length.toLocaleString()} alternative{dupes.length > 1 ? "s" : ""} found
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
