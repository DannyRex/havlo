"use client";

import Image from "next/image";
import { TrendingDown, ExternalLink, Plane, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatNaira, getClickThroughUrl } from "@/lib/utils";
import { trackClick } from "@/lib/trackClick";
import type { DupeResult } from "@/lib/search";

export default function DupeCard({
  dupe,
  rank,
  query = "",
  mode = "similar",
  aspect = "aspect-square",
}: {
  dupe: DupeResult;
  rank: number;
  query?: string;
  mode?: string;
  /** Image aspect class for masonry-style varying heights */
  aspect?: string;
}) {
  const hasSavings = dupe.savingsPercent > 0;
  const bestOffer = dupe.offers[0];
  const extraStores = dupe.offers.length - 1;
  const [showAll, setShowAll] = useState(false);
  const visibleOffers = showAll ? dupe.offers : dupe.offers.slice(0, 1);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:border-border-strong hover:-translate-y-0.5 hover:shadow-card transition-all duration-200">

      {/* Savings badge — perfect circle, top-right, on the image */}
      {hasSavings && (
        <div
          className="absolute top-2.5 right-2.5 z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center text-white select-none"
          style={{
            background: "#16a34a",
            boxShadow: "0 4px 12px rgba(22,163,74,0.35), 0 0 0 3px rgba(255,255,255,0.85)",
          }}
        >
          <span className="text-[14px] sm:text-[17px] font-black leading-none tracking-tight">
            −{dupe.savingsPercent}%
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-90">
            less
          </span>
        </div>
      )}

      {/* Image — varied aspect for masonry feel */}
      <div className={`relative w-full overflow-hidden bg-white ${aspect}`}>
        {dupe.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={dupe.imageUrl}
            alt={dupe.title}
            className="w-full h-full object-contain p-3 group-hover:scale-[1.04] transition-transform duration-500"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-4xl"
            style={{ background: dupe.imageGradient }}
          >
            {dupe.imageEmoji}
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="flex-1 flex flex-col px-3.5 pt-3 pb-3.5">
        <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-semibold">
          {dupe.brand ?? dupe.category}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-ink leading-snug line-clamp-2 tracking-[-0.005em]">
          {dupe.title}
        </h3>

        {/* Price + savings line */}
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-base font-bold text-ink">
            {formatNaira(dupe.bestPrice)}
          </span>
          {hasSavings && (
            <span className="text-[11px] text-success font-semibold">
              save {formatNaira(dupe.savingsVsAnchor)}
            </span>
          )}
        </div>

        {/* Primary store CTA — best (cheapest) offer prominent */}
        {bestOffer && (
          <a
            href={getClickThroughUrl({ url: bestOffer.url, id: `${dupe.key}-${bestOffer.storeId}` })}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => trackClick(dupe.key, query, rank, mode)}
            className="mt-3 inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-ink text-bg text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className="w-4 h-4 rounded overflow-hidden bg-white shrink-0 flex items-center justify-center">
                <Image
                  src={bestOffer.storeLogoUrl}
                  alt=""
                  width={16}
                  height={16}
                  className="object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </span>
              <span className="truncate">View on {bestOffer.storeName}</span>
              {bestOffer.isInternational && bestOffer.landedCostExtra > 0 && (
                <Plane size={11} className="text-amber-300 shrink-0" />
              )}
            </span>
            <ExternalLink size={12} className="shrink-0 opacity-80" />
          </a>
        )}

        {/* Other offers — collapsible */}
        {extraStores > 0 && (
          <div className="mt-2">
            {!showAll ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
              >
                +{extraStores} more store{extraStores > 1 ? "s" : ""}
                <ChevronDown size={12} />
              </button>
            ) : (
              <div className="space-y-1">
                {visibleOffers.slice(1).map((offer) => (
                  <a
                    key={`${offer.storeId}-${offer.price}`}
                    href={getClickThroughUrl({ url: offer.url, id: `${dupe.key}-${offer.storeId}` })}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    onClick={() => trackClick(dupe.key, query, rank, mode)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border hover:border-border-strong hover:bg-surface-2 transition-colors text-[11px]"
                  >
                    <div className="w-4 h-4 rounded overflow-hidden bg-surface-2 shrink-0 flex items-center justify-center">
                      <Image
                        src={offer.storeLogoUrl}
                        alt=""
                        width={16}
                        height={16}
                        className="object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <span className="text-ink-2 truncate flex-1">{offer.storeName}</span>
                    <span className="font-semibold text-ink tabular-nums">{formatNaira(offer.price)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
