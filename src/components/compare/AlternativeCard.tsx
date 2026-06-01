import Link from "next/link";
import { ArrowRight, TrendingDown, Store } from "lucide-react";
import { formatNaira, proxiedImageUrl, cleanTitle, formatCount } from "@/lib/utils";
import type { Alternative } from "@/types";
import HavloLogoFallback from "@/components/ui/HavloLogoFallback";

interface Props {
  alt: Alternative;
}

export default function AlternativeCard({ alt }: Props) {
  const isCheaper = alt.savingsPercent > 0;

  return (
    <div className="card rounded-2xl overflow-hidden border border-border
                    hover:border-border-strong transition-all duration-300 hover:-translate-y-1 group">

      {/* Image */}
      <div className="relative h-28 sm:h-32 flex items-center justify-center border-b border-border overflow-hidden">
        {alt.imageUrl ? (
          /* Below-the-anchor → lazy + low priority. proxiedImageUrl
             handles Amazon / ASOS / AliExpress hotlink blocks. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={proxiedImageUrl(alt.imageUrl)}
            alt={cleanTitle(alt.title).slice(0, 120)}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain p-3 bg-white"
          />
        ) : (
          <HavloLogoFallback size="md" />
        )}

        {/* Similarity badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
             style={{ background: "rgba(0,87,255,0.5)", color: "#93c5fd" }}>
          {alt.similarity}% match
        </div>

        {/* Savings badge */}
        {isCheaper && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-black"
               style={{ background: "linear-gradient(135deg, #00D68F, #00A86B)" }}>
            <TrendingDown size={10} />
            -{alt.savingsPercent}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-[11px] text-ink-3 mb-0.5">{alt.brand}</p>
        <h3 className="text-sm font-bold text-ink mb-2 line-clamp-2 group-hover:text-brand transition-colors leading-snug">
          {alt.title}
        </h3>

        {/* Price range */}
        <div className="mb-3">
          <span className="text-lg font-black text-ink">
            {formatNaira(alt.priceRange.min)}
          </span>
          {alt.priceRange.max !== alt.priceRange.min && (
            <span className="text-xs text-ink-3 ml-1">
              – {formatNaira(alt.priceRange.max)}
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {alt.tags.slice(0, 3).map((tag) => (
            <span key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-md text-ink-2 bg-surface-2 border border-border">
              {tag}
            </span>
          ))}
        </div>

        {/* Store info */}
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mb-3">
          <Store size={11} />
          From {alt.topStore} · {formatCount(alt.storeCount)} stores
        </div>

        {/* CTA */}
        <Link
          href={`/compare?q=${encodeURIComponent(alt.title)}`}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold
                     text-ink transition-all duration-200 hover:bg-surface-2"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Compare prices
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
