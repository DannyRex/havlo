/* List-style card used on /deals when the user toggles "list view"
   on mobile. Image left, all text on the right, more info per row
   than the masonry grid. Better for buying-intent scanning, worse
   for casual visual browsing — that's why it's a user choice. */

import {
  cleanTitle,
  formatCompact,
  formatUSDPrice,
  savings,
  timeAgo,
  usdToNgn,
} from "@/lib/utils";
import type { Deal } from "@/types";

interface Props {
  deal: Deal;
}

export default function ListCard({ deal }: Props) {
  const isUSD = deal.currency === "USD";
  const saved = savings(deal.originalPrice, deal.salePrice);
  const cleanedTitle = cleanTitle(deal.title);

  const priceFmt = isUSD ? formatUSDPrice(deal.salePrice)     : formatCompact(deal.salePrice);
  const origFmt  = isUSD ? formatUSDPrice(deal.originalPrice) : formatCompact(deal.originalPrice);
  const saveFmt  = saved > 0
    ? (isUSD ? formatUSDPrice(saved) : formatCompact(saved))
    : null;
  const ngnEquivStr = isUSD ? `≈ ${formatCompact(usdToNgn(deal.salePrice))}` : null;
  const hasDiscount = deal.originalPrice > deal.salePrice && deal.discountPercent > 0;

  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${cleanedTitle}, ${priceFmt} at ${deal.storeName}`}
      className="group flex gap-3 items-start p-2.5 rounded-2xl border border-border bg-surface hover:border-border-strong hover:shadow-card transition-all"
    >
      {/* Image — square thumbnail on the left */}
      <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-white border border-border">
        {deal.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={deal.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain p-1.5 group-hover:scale-[1.04] transition-transform duration-300 motion-reduce:group-hover:scale-100"
          />
        ) : (
          /* Gradient + emoji fallback — same treatment as MasonryCard. */
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl"
            style={{ background: deal.imageGradient }}
            aria-hidden="true"
          >
            <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {deal.imageEmoji}
            </span>
          </div>
        )}

        {/* Discount badge — perfect circle, top-right of the thumbnail */}
        {hasDiscount && (
          <div
            className="absolute top-1 right-1 w-9 h-9 rounded-full flex flex-col items-center justify-center text-white"
            style={{
              background: "#dc2626",
              boxShadow: "0 2px 6px rgba(220,38,38,0.35), 0 0 0 2px rgba(255,255,255,0.85)",
            }}
          >
            <span className="text-[11px] font-black leading-none">{deal.discountPercent}%</span>
            <span className="text-[7px] font-bold uppercase tracking-[0.05em] mt-0.5 opacity-90">off</span>
          </div>
        )}
      </div>

      {/* Right column — store · time, title, price row */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center gap-1 text-[11px] text-ink-3 leading-none">
          <span className="font-medium truncate text-ink-2">{deal.storeName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{timeAgo(deal.postedAt)}</span>
        </div>

        <p className="mt-1.5 text-[13px] font-medium text-ink leading-snug line-clamp-2 tracking-[-0.005em]">
          {cleanedTitle}
        </p>

        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-ink">{priceFmt}</span>
          {hasDiscount && (
            <span className="text-[11px] text-ink-3 line-through">{origFmt}</span>
          )}
          {saveFmt && (
            <span className="ml-auto text-[11px] font-semibold text-success">
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
