"use client";

import Link from "next/link";
import { formatNaira, proxiedImageUrl, cleanTitle, formatCount } from "@/lib/utils";
import type { ProductGroup } from "@/lib/search";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";

export default function GroupCard({ g }: { g: ProductGroup }) {
  return (
    <Link href={`/compare?q=${encodeURIComponent(g.title)}&key=${encodeURIComponent(g.key)}`}
          className="group flex flex-row sm:flex-col gap-3 sm:gap-0 p-2 sm:p-0 rounded-xl hover:bg-surface-2 transition-colors">
      {/* Image */}
      <div className="relative w-24 h-24 shrink-0 sm:w-full sm:h-auto sm:aspect-square overflow-hidden rounded-xl bg-white">
        {g.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxiedImageUrl(g.imageUrl)}
            alt={cleanTitle(g.title).slice(0, 120)}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <HavloLogoFallback size="sm" />
        )}
        {g.storeCount > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
            {formatCount(g.storeCount)} stores
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 sm:pt-2.5 flex flex-col justify-center sm:justify-start min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-ink-3 truncate">
          {g.brand ?? g.category}
        </p>
        <h3 className="mt-0.5 text-sm text-ink leading-snug line-clamp-2 group-hover:text-brand transition-colors">
          {cleanTitle(g.title)}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-sm font-bold text-ink">{formatNaira(g.bestPrice)}</span>
          {g.maxSavings > 0 && g.storeCount > 1 && (
            <span className="text-[11px] text-success font-medium">save up to {formatNaira(g.maxSavings)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
