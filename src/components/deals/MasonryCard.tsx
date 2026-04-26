/* No "use client" — this module exports both a React component AND plain
   utilities (chunkLeftToRight, MASONRY_ASPECTS). Client modules can't
   re-export plain functions cleanly across the RSC boundary, so we keep
   this as a server-renderable module. The component itself uses only
   server-safe APIs (no hooks, no event handlers). */

import {
  formatCompact,
  formatUSDPrice,
  savings,
  timeAgo,
  usdToNgn,
} from "@/lib/utils";
import type { Deal } from "@/types";

/** Aspect ratios that interleave nicely for the masonry feel */
export const MASONRY_ASPECTS = [
  "aspect-[3/4]",
  "aspect-[2/3]",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-[2/3]",
  "aspect-[4/5]",
  "aspect-[5/6]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[2/3]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[5/6]",
  "aspect-[2/3]",
];

/** Distribute items into N columns left-to-right (item 0 → col 0, item 1 → col 1, …) */
export function chunkLeftToRight<T>(items: T[], cols: number): T[][] {
  const buckets: T[][] = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => buckets[i % cols].push(it));
  return buckets;
}

interface Props {
  deal: Deal;
  aspect: string;
  /** Show the small INTL chip on USD-priced items */
  showOriginBadge?: boolean;
}

export default function MasonryCard({ deal, aspect, showOriginBadge = true }: Props) {
  const isUSD = deal.currency === "USD";
  const saved = savings(deal.originalPrice, deal.salePrice);

  const priceFmt = isUSD ? formatUSDPrice(deal.salePrice)     : formatCompact(deal.salePrice);
  const origFmt  = isUSD ? formatUSDPrice(deal.originalPrice) : formatCompact(deal.originalPrice);
  const saveFmt  = saved > 0 ? (isUSD ? formatUSDPrice(saved) : formatCompact(saved)) : null;
  const ngnEquivStr = isUSD ? `≈ ${formatCompact(usdToNgn(deal.salePrice))}` : null;
  const hasDiscount = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;

  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${deal.title} — ${priceFmt} at ${deal.storeName}`}
      className="group block"
    >
      {/* Image — varied aspect, edge-to-edge */}
      <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-surface-2 ${aspect}`}>
        {deal.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={deal.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-5xl"
            aria-hidden="true"
          >
            {deal.imageEmoji}
          </div>
        )}

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
              {deal.discountPercent}%
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-90">
              off
            </span>
          </div>
        )}

        {/* INTL tag */}
        {showOriginBadge && isUSD && (
          <span
            className="absolute left-2 bottom-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            INTL
          </span>
        )}
      </div>

      {/* Caption */}
      <div className="pt-2 sm:pt-2.5 px-0.5">
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-ink-3 mb-0.5 sm:mb-1 leading-none">
          <span className="font-medium truncate text-ink-2">{deal.storeName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{timeAgo(deal.postedAt)}</span>
        </div>

        <p className="text-[12px] sm:text-[13px] font-medium text-ink leading-snug line-clamp-2 mb-1 sm:mb-1.5 tracking-[-0.005em]">
          {deal.title}
        </p>

        <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
          <span className="text-[13px] sm:text-sm font-bold text-ink">{priceFmt}</span>
          {hasDiscount && (
            <span className="text-[10px] sm:text-[11px] text-ink-3 line-through">{origFmt}</span>
          )}
          {saveFmt && (
            <span className="ml-auto text-[10px] sm:text-[11px] font-semibold text-success">
              −{saveFmt}
            </span>
          )}
        </div>

        {ngnEquivStr && (
          <p className="text-[10px] text-ink-3 mt-0.5">{ngnEquivStr}</p>
        )}
      </div>
    </a>
  );
}
