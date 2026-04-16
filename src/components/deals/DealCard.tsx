"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, ExternalLink, Clock, Flame, ArrowRight } from "lucide-react";
import { formatNaira, savings, timeAgo, daysUntil, cn } from "@/lib/utils";
import type { Deal } from "@/types";

interface Props {
  deal: Deal;
  featured?: boolean;
}

export default function DealCard({ deal, featured = false }: Props) {
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(deal.saves);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    setSaved(!saved);
    setSaveCount((c) => (saved ? c - 1 : c + 1));
  };

  const savingsAmount = savings(deal.originalPrice, deal.salePrice);
  const expiresIn = deal.expiresAt ? daysUntil(deal.expiresAt) : null;

  return (
    <div className={cn(
      "group relative glass rounded-2xl overflow-hidden border border-white/[0.06]",
      "hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-0.5",
      featured ? "ring-1 ring-brand-600/20 shadow-brand-glow" : "",
    )}>

      {/* Image area */}
      <div className="relative h-44 flex items-center justify-center overflow-hidden"
           style={{ background: deal.imageGradient }}>

        {/* Emoji */}
        <span className="text-6xl select-none transition-transform duration-300 group-hover:scale-105 drop-shadow-lg">
          {deal.imageEmoji}
        </span>

        {/* Hot badge */}
        {deal.isHot && (
          <div className="absolute top-3 left-3 badge-hot gap-1 py-1 px-2">
            <Flame size={9} />
            Hot
          </div>
        )}

        {/* Discount badge */}
        <div className="absolute top-3 right-3 badge-discount text-sm font-black px-2.5 py-1">
          −{deal.discountPercent}%
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          aria-label={saved ? "Unsave deal" : "Save deal"}
          className={cn(
            "absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
            saved
              ? "bg-red-500 text-white scale-110"
              : "bg-black/40 text-white/50 hover:bg-black/60 hover:text-white"
          )}
        >
          <Heart size={13} fill={saved ? "currentColor" : "none"} />
        </button>

        {/* Expiry ribbon */}
        {expiresIn !== null && expiresIn <= 3 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg
                          bg-deal-orange/90 text-white text-xs font-semibold">
            <Clock size={9} />
            {expiresIn === 0 ? "Expires today" : `${expiresIn}d left`}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">

        {/* Store + time */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="badge-store tracking-[-0.01em]">{deal.storeName}</span>
          <span className="text-xs text-slate-600 tracking-[-0.01em]">{timeAgo(deal.postedAt)}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-white leading-snug mb-2 line-clamp-2
                       tracking-[-0.02em] group-hover:text-brand-400 transition-colors">
          {deal.title}
        </h3>

        {/* Prices */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-black text-white tracking-[-0.03em]">
            {formatNaira(deal.salePrice)}
          </span>
          <span className="text-xs text-slate-600 line-through">
            {formatNaira(deal.originalPrice)}
          </span>
        </div>

        {/* Savings pill */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-deal-green tracking-[-0.01em]"
               style={{ background: "rgba(0,214,143,0.08)", border: "1px solid rgba(0,214,143,0.18)" }}>
            Save {formatNaira(savingsAmount)}
          </div>
          <span className="text-xs text-slate-600 flex items-center gap-1 tracking-[-0.01em]">
            <Heart size={10} />
            {saveCount.toLocaleString()}
          </span>
        </div>

        {/* CTA */}
        <Link
          href={deal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold
                     text-white transition-all duration-200 tracking-[-0.01em]"
          style={{ background: "linear-gradient(135deg, #0057FF 0%, #0041CC 100%)" }}
        >
          Get Deal
          <ExternalLink size={12} />
        </Link>

        {/* Compare link */}
        <Link
          href={`/compare?q=${encodeURIComponent(deal.title)}`}
          className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-500
                     hover:text-brand-400 transition-colors tracking-[-0.01em]"
        >
          Compare prices
          <ArrowRight size={10} />
        </Link>
      </div>
    </div>
  );
}
