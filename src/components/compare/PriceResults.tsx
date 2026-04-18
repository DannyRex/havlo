import { ExternalLink, CheckCircle2, XCircle, Truck, Star, Trophy } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import type { SearchResult } from "@/types";

interface Props {
  result: SearchResult;
}

const conditionLabel: Record<string, { label: string; color: string }> = {
  new:          { label: "New",         color: "#00D68F" },
  refurbished:  { label: "Refurbished", color: "#F59E0B" },
  used:         { label: "Used",        color: "#94A3B8" },
};

export default function PriceResults({ result }: Props) {
  const sorted = [...result.prices].sort((a, b) => a.price - b.price);
  const lowestPrice = sorted[0]?.price ?? 0;

  return (
    <div>

      {/* Product header */}
      <div className="glass rounded-2xl p-4 sm:p-5 border border-white/[0.06] mb-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0 border border-white/[0.06]"
               style={{ background: result.product.imageGradient }}>
            {result.product.imageEmoji}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">{result.product.category}</p>
            <h2 className="text-base sm:text-xl font-bold text-white leading-tight">{result.product.title}</h2>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 sm:gap-6 mt-4 pt-4 border-t border-white/[0.06]">
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 block">Best price</span>
            <p className="text-lg sm:text-xl font-black truncate" style={{ color: "#00D68F" }}>
              {formatNaira(lowestPrice)}
            </p>
          </div>
          <div className="h-8 w-px bg-white/[0.08] flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 block">You save up to</span>
            <p className="text-lg sm:text-xl font-black text-deal-orange truncate">{formatNaira(result.maxSavings)}</p>
          </div>
          <div className="h-8 w-px bg-white/[0.08] flex-shrink-0 hidden sm:block" />
          <div className="hidden sm:block">
            <span className="text-[11px] text-slate-500 block">Stores checked</span>
            <p className="text-lg sm:text-xl font-black text-white">{result.prices.length}</p>
          </div>
        </div>
      </div>

      {/* Price table */}
      <div className="space-y-3">
        {sorted.map((p, i) => {
          const isBest  = p.price === lowestPrice && p.inStock;
          const extra   = p.price - lowestPrice;
          const cond    = conditionLabel[p.condition];

          return (
            <div key={p.storeId}
                 className={`glass rounded-2xl p-3 sm:p-4 border transition-all duration-200 hover:-translate-y-0.5
                              ${isBest
                                ? "border-deal-green/30 shadow-[0_0_24px_rgba(0,214,143,0.1)]"
                                : "border-white/[0.05] hover:border-white/[0.12]"}`}>

              {/* Desktop layout */}
              <div className="hidden sm:flex items-center gap-4">
                {/* Rank */}
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                     style={{
                       background: i === 0 ? "linear-gradient(135deg, #FFD600, #FF9900)" : "rgba(255,255,255,0.06)",
                       color: i === 0 ? "#000" : "#64748b",
                     }}>
                  {i === 0 ? <Trophy size={12} /> : i + 1}
                </div>

                {/* Store logo */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                     style={{ background: p.storeColor }}>
                  {p.storeLogo}
                </div>

                {/* Store info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{p.storeName}</span>
                    {isBest && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold text-black"
                            style={{ background: "linear-gradient(135deg, #00D68F, #00A86B)" }}>
                        Best Price
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                          style={{ background: `${cond.color}20`, color: cond.color }}>
                      {cond.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      {p.inStock
                        ? <CheckCircle2 size={11} className="text-deal-green" />
                        : <XCircle size={11} className="text-red-500" />}
                      {p.inStock ? "In stock" : "Out of stock"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck size={11} />
                      {p.deliveryDays === 1 ? "Next day" : `${p.deliveryDays} days`}
                    </span>
                    {p.rating && (
                      <span className="flex items-center gap-1">
                        <Star size={11} className="text-yellow-400" />
                        {p.rating}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price + CTA */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-black ${isBest ? "text-deal-green" : "text-white"}`}>
                    {formatNaira(p.price)}
                  </p>
                  {extra > 0 && (
                    <p className="text-xs text-slate-600">+{formatNaira(extra)} more</p>
                  )}
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                     className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                 transition-all ${!p.inStock ? "opacity-50 pointer-events-none" : ""}
                                 ${isBest ? "text-black" : "text-white"}`}
                     style={{
                       background: isBest
                         ? "linear-gradient(135deg, #00D68F, #00A86B)"
                         : "rgba(255,255,255,0.08)",
                     }}>
                    Buy here
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Mobile layout */}
              <div className="sm:hidden">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                       style={{
                         background: i === 0 ? "linear-gradient(135deg, #FFD600, #FF9900)" : "rgba(255,255,255,0.06)",
                         color: i === 0 ? "#000" : "#64748b",
                       }}>
                    {i === 0 ? <Trophy size={10} /> : i + 1}
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                       style={{ background: p.storeColor }}>
                    {p.storeLogo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">{p.storeName}</span>
                      {isBest && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-black"
                              style={{ background: "linear-gradient(135deg, #00D68F, #00A86B)" }}>
                          Best
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-base font-black flex-shrink-0 ${isBest ? "text-deal-green" : "text-white"}`}>
                    {formatNaira(p.price)}
                  </p>
                </div>
                <div className="flex items-center justify-between pl-[3.75rem]">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-0.5">
                      {p.inStock
                        ? <CheckCircle2 size={10} className="text-deal-green" />
                        : <XCircle size={10} className="text-red-500" />}
                      {p.inStock ? "In stock" : "OOS"}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Truck size={10} />
                      {p.deliveryDays}d
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: `${cond.color}20`, color: cond.color }}>
                      {cond.label}
                    </span>
                  </div>
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                     className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold
                                 transition-all ${!p.inStock ? "opacity-50 pointer-events-none" : ""}
                                 ${isBest ? "text-black" : "text-white"}`}
                     style={{
                       background: isBest
                         ? "linear-gradient(135deg, #00D68F, #00A86B)"
                         : "rgba(255,255,255,0.08)",
                     }}>
                    Buy
                    <ExternalLink size={9} />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
