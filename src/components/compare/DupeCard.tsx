"use client";

import Image from "next/image";
import { TrendingDown, Minus, ExternalLink, Plane } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import { trackClick } from "@/lib/trackClick";
import type { DupeResult } from "@/lib/search";

export default function DupeCard({
  dupe,
  rank,
  query = "",
  mode = "similar",
}: {
  dupe: DupeResult;
  rank: number;
  query?: string;
  mode?: string;
}) {
  const hasSavings = dupe.savingsPercent > 0;
  const savingsColor =
    dupe.savingsPercent >= 60
      ? "from-emerald-400 to-green-300"
      : dupe.savingsPercent >= 30
        ? "from-emerald-400 to-teal-300"
        : "from-teal-400 to-cyan-300";

  // Best (cheapest) offer for primary CTA
  const bestOffer = dupe.offers[0];

  return (
    <div
      className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02]
                 hover:border-white/[0.14] hover:bg-white/[0.04] transition-all duration-300
                 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,200,150,0.08)] overflow-hidden"
      style={{ animationDelay: `${rank * 60}ms` }}
    >
      {/* Savings / similar-price ribbon */}
      <div className="absolute top-3 right-3 z-10">
        {hasSavings ? (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-navy-900
                          bg-gradient-to-r ${savingsColor} shadow-lg`}>
            <TrendingDown size={11} strokeWidth={2.5} />
            {dupe.savingsPercent}% less
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold
                          bg-white/10 text-slate-300 backdrop-blur-sm">
            <Minus size={11} strokeWidth={2.5} />
            Similar price
          </div>
        )}
      </div>

      {/* Image */}
      <div className="relative w-full aspect-square overflow-hidden bg-white">
        {dupe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dupe.imageUrl}
            alt={dupe.title}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
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

      {/* Content */}
      <div className="flex-1 flex flex-col p-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
          {dupe.brand ?? dupe.category}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-white leading-snug line-clamp-2">
          {dupe.title}
        </h3>

        <div className="mt-auto pt-3">
          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white">
              {formatNaira(dupe.bestPrice)}
            </span>
          </div>
          {/* Savings line */}
          {hasSavings ? (
            <p className="mt-1 text-xs text-emerald-400/90 font-medium">
              Save {formatNaira(dupe.savingsVsAnchor)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Alternative option
            </p>
          )}
        </div>
      </div>

      {/* Store links — direct to product pages */}
      <div className="px-4 pb-4 pt-0 space-y-1.5">
        {dupe.offers.slice(0, 3).map((offer) => (
          <a
            key={`${offer.storeId}-${offer.price}`}
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => trackClick(dupe.key, query, rank, mode)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-white/[0.06]
                       hover:border-white/[0.15] hover:bg-white/[0.04] transition-all text-xs group/link"
          >
            <div className="w-5 h-5 rounded flex items-center justify-center bg-white/[0.08] shrink-0 overflow-hidden">
              <Image src={offer.storeLogoUrl} alt={offer.storeName} width={16} height={16}
                     className="object-contain"
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <span className="text-slate-400 truncate flex-1">{offer.storeName}</span>
            <div className="text-right shrink-0">
              <span className="font-semibold text-white">{formatNaira(offer.price)}</span>
              {offer.isInternational && offer.landedCostExtra > 0 && (
                <div className="flex items-center gap-0.5 text-[9px] text-amber-400/80">
                  <Plane size={8} />
                  <span>+{formatNaira(offer.landedCostExtra)} landed</span>
                </div>
              )}
            </div>
            <ExternalLink size={10} className="text-slate-600 group-hover/link:text-brand-400 shrink-0 transition-colors" />
          </a>
        ))}
        {dupe.offers.length > 3 && (
          <p className="text-center text-[10px] text-slate-600">
            +{dupe.offers.length - 3} more store{dupe.offers.length - 3 > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
