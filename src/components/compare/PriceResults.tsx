"use client";

import { ExternalLink, Trophy, Truck, Globe, Star } from "lucide-react";
import { formatPriceForUser, formatPriceDeltaForUser, proxiedImageUrl, cleanTitle, formatCount } from "@/lib/utils";
import { useCountry } from "@/components/providers/CountryProvider";
import { inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import { displayStoreName } from "@/lib/store-display";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";
import { storeLogoInvertClass } from "@/lib/store-logo-invert";
import { trackClick } from "@/lib/trackClick";
import type { ProductGroup, StoreOffer } from "@/lib/search";

export default function PriceResults({
  group,
  query = "",
  mode = "single",
}: {
  group: ProductGroup;
  query?: string;
  mode?: string;
}) {
  const { country, fx } = useCountry();
  const { offers, bestPrice, maxSavings, title, imageUrl, category, storeCount } = group;

  /* Compute "INTL for this visitor" at the UI layer rather than
     trusting the StoreOffer.isInternational flag from pg-fts.ts.

     The flag comes from stores.is_international in the DB, which
     was set at ingest time to `currency === "USD"`. Since SerpAPI
     normalises every UK / US / DE / AE / IN / ZA retailer's price
     to USD, the flag fires `true` for the WHOLE non-NG roster,
     making every Argos / Currys / Walmart / MediaMarkt /  card
     in compare results render an INTL badge regardless of the
     visitor's actual country.

     Same fix MasonryCard applies on /deals: a deal is "INTL for
     me" if the store's anchored country (via inferStoreCountry's
     COUNTRY_STORES roster lookup) is NOT my country. Falls back to
     the currency check when the store can't be inferred (rare,
     niche scrapers). */
  const isIntlForUser = (offer: Pick<StoreOffer, "storeId" | "storeName" | "currency" | "isInternational">): boolean => {
    const storeCountry = inferStoreCountry(offer.storeId, offer.storeName);
    if (storeCountry !== null) {
      return storeCountry.toLowerCase() !== country.code.toLowerCase();
    }
    /* Explicit global cross-border stores (AliExpress, Shein, Temu,
       DHgate, …) are ALWAYS intl regardless of currency. Without
       this short-circuit AliExpress USD-priced rows flagged as local
       for US visitors (US currency = USD). */
    if (isGlobalIntlStore(offer.storeId, offer.storeName)) return true;
    /* Unknown store → fall back to currency mismatch. */
    return offer.currency !== country.currency && offer.isInternational;
  };

  return (
    <div>
      {/* Product header */}
      <div className="flex items-start gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl border border-border bg-surface-2 mb-6">
        {imageUrl ? (
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-white">
            {/* Proxied so Amazon / ASOS / AliExpress hotlink-block CDNs
                don't blank these. Eager + high priority because this is
                the LCP image on /compare anchor cards. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxiedImageUrl(imageUrl)}
              alt={cleanTitle(title).slice(0, 120)}
              loading="eager"
              fetchPriority="high"
              decoding="sync"
              className="w-full h-full object-contain p-2"
            />
          </div>
        ) : (
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0">
            <HavloLogoFallback size="sm" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-ink-3">{category}</p>
          <h2 className="text-base sm:text-lg font-semibold text-ink leading-snug mt-0.5 line-clamp-2">{cleanTitle(title)}</h2>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-3">
            <div>
              <span className="text-[11px] text-ink-3">Best price · </span>
              <span className="text-lg font-bold text-success">{formatPriceForUser(bestPrice, country, "NGN", fx)}</span>
            </div>
            {maxSavings > 0 && (
              <div className="text-xs text-ink-2">
                Save up to <span className="font-semibold text-ink">{formatPriceDeltaForUser(bestPrice + maxSavings, bestPrice, country, "NGN", fx)}</span> vs. highest
              </div>
            )}
            <div className="text-xs text-ink-3">
              {formatCount(storeCount)} store{storeCount > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="space-y-2">
        {offers.map((p, i) => {
          const isBest = p.price === bestPrice;
          const extra = p.price - bestPrice;
          return (
            <a key={`${p.storeId}-${i}`} href={p.url} target="_blank" rel="noopener noreferrer sponsored"
               onClick={() => trackClick(group.key, query, i, mode)}
               className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all hover:bg-surface-2 ${
                 isBest ? "border-success/40 bg-success/[0.04]" : "border-border"
               }`}>
              {/* Rank */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                     isBest ? "text-black" : "bg-surface-2 text-ink-3"
                   }`}
                   style={isBest ? { background: "linear-gradient(135deg,#FFD600,#FF9900)" } : undefined}>
                {isBest ? <Trophy size={12} /> : i + 1}
              </div>

              {/* Logo — same theme-aware invert as DupeCard /
                  StoreLogo so white-on-transparent wordmarks (3C Hub
                  etc.) stay visible against light bg-surface-2 in
                  light mode. */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-2 p-1.5 shrink-0">
                {/* Plain <img> — skip Vercel transform for 28×28 logo. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.storeLogoUrl} alt={displayStoreName(p.storeName)} width={28} height={28}
                     loading="lazy" decoding="async"
                     className={`object-contain ${storeLogoInvertClass(p.storeId)}`}
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>

              {/* Product thumbnail from this store (helps verify it's the same item) */}
              {p.imageUrl && (
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 hidden sm:block">
                  {/* Per-offer thumbnail. Lazy + low priority since
                      these sit below the LCP. proxiedImageUrl handles
                      cross-domain hotlink blocks. Empty alt is correct
                      here — the offer row already has the store name +
                      product title as text labels, so the image is
                      decorative. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxiedImageUrl(p.imageUrl)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
              )}

              {/* Store info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-ink">{displayStoreName(p.storeName)}</span>
                  {isBest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-semibold uppercase tracking-wide">Best</span>
                  )}
                  {isIntlForUser(p) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium flex items-center gap-1">
                      <Globe size={9} /> INTL
                    </span>
                  )}
                  {/* Used / refurbished — keep a pre-owned offer from
                      sitting silently next to new ones in the same
                      comparison. Detected at the data layer (isUsed). */}
                  {p.isUsed && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium">
                      Used / Refurbished
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-ink-3">
                  <span className="flex items-center gap-1"><Truck size={10} />{p.deliveryDays === 1 ? "Next day" : `~${p.deliveryDays}d`}</span>
                  <span className="flex items-center gap-1"><Star size={10} className="text-yellow-500/70" />{p.rating}</span>
                  {p.discountPercent > 0 && (
                    <span className="text-success font-medium">−{p.discountPercent}%</span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right shrink-0">
                <p className={`text-base sm:text-lg font-bold ${isBest ? "text-success" : "text-ink"}`}>
                  {formatPriceForUser(p.price, country, "NGN", fx)}
                </p>
                {extra > 0 && <p className="text-[11px] text-ink-3">+{formatPriceForUser(extra, country, "NGN", fx)}</p>}
              </div>

              <ExternalLink size={14} className="text-ink-3 shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
