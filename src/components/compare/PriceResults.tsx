"use client";

import Image from "next/image";
import { ExternalLink, Trophy, Truck, Globe, Star } from "lucide-react";
import { formatPriceForUser, proxiedImageUrl, cleanTitle } from "@/lib/utils";
import { useCountry } from "@/components/providers/CountryProvider";
import { trackClick } from "@/lib/trackClick";
import type { ProductGroup } from "@/lib/search";

export default function PriceResults({
  group,
  query = "",
  mode = "single",
}: {
  group: ProductGroup;
  query?: string;
  mode?: string;
}) {
  const { country } = useCountry();
  const { offers, bestPrice, maxSavings, title, imageUrl, imageEmoji, imageGradient, category, storeCount } = group;

  return (
    <div>
      {/* Product header */}
      <div className="flex items-start gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl bg-surface-2 border border-border mb-6">
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
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
               style={{ background: imageGradient }}>
            {imageEmoji}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-ink-3">{category}</p>
          <h2 className="text-base sm:text-lg font-semibold text-ink leading-snug mt-0.5 line-clamp-2">{title}</h2>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-3">
            <div>
              <span className="text-[11px] text-ink-3">Best price · </span>
              <span className="text-lg font-bold text-success">{formatPriceForUser(bestPrice, country)}</span>
            </div>
            {maxSavings > 0 && (
              <div className="text-xs text-ink-2">
                Save up to <span className="font-semibold text-ink">{formatPriceForUser(maxSavings, country)}</span> vs. highest
              </div>
            )}
            <div className="text-xs text-ink-3">
              {storeCount} store{storeCount > 1 ? "s" : ""}
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
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                   style={{
                     background: isBest ? "linear-gradient(135deg,#FFD600,#FF9900)" : "rgba(255,255,255,0.06)",
                     color: isBest ? "#000" : "#94a3b8",
                   }}>
                {isBest ? <Trophy size={12} /> : i + 1}
              </div>

              {/* Logo */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-2 p-1.5 shrink-0">
                <Image src={p.storeLogoUrl} alt={p.storeName} width={28} height={28} className="object-contain"
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
                  <span className="text-sm font-semibold text-ink">{p.storeName}</span>
                  {isBest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-semibold uppercase tracking-wide">Best</span>
                  )}
                  {p.isInternational && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium flex items-center gap-1">
                      <Globe size={9} /> INTL
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
                  {formatPriceForUser(p.price, country)}
                </p>
                {extra > 0 && <p className="text-[11px] text-ink-3">+{formatPriceForUser(extra, country)}</p>}
              </div>

              <ExternalLink size={14} className="text-ink-3 shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
