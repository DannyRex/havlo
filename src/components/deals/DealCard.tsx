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

  const isUSD = deal.currency === "USD";
  const salePriceStr = isUSD ? formatUSD(deal.salePrice) : formatNaira(deal.salePrice);
  const origPriceStr = isUSD ? formatUSD(deal.originalPrice) : formatNaira(deal.originalPrice);
  const ngnEquivStr  = isUSD ? `≈${formatCompact(usdToNgn(deal.salePrice))}` : null;
  const hasDiscount  = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;

  return (
    <Link
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group block"
    >
      {/* Image area — clean white background, image dominant */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white">
        {showImage ? (
          <Image
            src={deal.imageUrl!}
            alt={deal.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl text-slate-300">
            {deal.imageEmoji}
          </div>
        )}

        {/* Subtle discount tag — only if real discount */}
        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded-md bg-navy-900/85 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            −{deal.discountPercent}%
          </span>
        )}
      </div>

      {/* Content — minimal: store, title, price */}
      <div className="pt-2.5 px-0.5">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          {deal.storeName}
        </p>

        <h3 className="mt-0.5 text-sm text-white leading-snug line-clamp-2 group-hover:text-brand-400 transition-colors">
          {deal.title}
        </h3>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">
            {salePriceStr}
          </span>
          {hasDiscount && (
            <span className="text-xs text-slate-500 line-through">
              {origPriceStr}
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
