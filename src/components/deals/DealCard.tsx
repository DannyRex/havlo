"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { formatNaira, formatUSD, usdToNgn, formatCompact } from "@/lib/utils";
import type { Deal } from "@/types";

interface Props {
  deal: Deal;
}

export default function DealCard({ deal }: Props) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!deal.imageUrl && !imgError;

  const isUSD       = deal.currency === "USD";
  const salePriceStr = isUSD ? formatUSD(deal.salePrice)       : formatNaira(deal.salePrice);
  const ngnEquivStr  = isUSD ? `≈ ${formatCompact(usdToNgn(deal.salePrice))}` : null;
  const hasDiscount  = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;
  const savingStr    = hasDiscount
    ? (isUSD ? formatUSD(deal.originalPrice - deal.salePrice) : formatNaira(deal.originalPrice - deal.salePrice))
    : null;

  return (
    <Link
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group flex flex-row sm:flex-col gap-3 sm:gap-0 transition-transform duration-200 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative w-28 h-28 shrink-0 sm:w-full sm:h-auto sm:aspect-square overflow-hidden rounded-xl bg-white">
        {showImage ? (
          <Image
            src={deal.imageUrl!}
            alt={deal.title}
            fill
            sizes="(max-width: 640px) 112px, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-2 sm:p-3 transition-transform duration-300 group-hover:scale-[1.04]"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">
            {deal.imageEmoji}
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2 flex flex-col items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-400 shadow-md rotate-6 select-none">
            <span className="text-[12px] sm:text-[15px] font-black text-white leading-none tracking-tight">
              -{deal.discountPercent}%
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold text-red-100 uppercase tracking-widest leading-none mt-0.5">
              off
            </span>
          </div>
        )}

        {/* INTL tag */}
        {isUSD && (
          <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            INTL
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 sm:flex-none sm:pt-2.5 sm:px-0.5 flex flex-col justify-center sm:justify-start min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 truncate">
          {deal.storeName}
        </p>

        <h3 className="mt-0.5 text-sm text-white leading-snug line-clamp-1 sm:line-clamp-2 group-hover:text-brand-400 transition-colors">
          {deal.title}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold text-white">
            {salePriceStr}
          </span>
          {savingStr && (
            <span className="text-xs font-semibold text-emerald-400">
              Save {savingStr}
            </span>
          )}
        </div>

        {ngnEquivStr && (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {ngnEquivStr} NGN
          </p>
        )}
      </div>
    </Link>
  );
}
