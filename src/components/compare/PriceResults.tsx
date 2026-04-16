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
      <div className="glass rounded-2xl p-5 border border-white/[0.06] mb-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-xl flex items-center justify-center text-4xl flex-shrink-0 border border-white/[0.06]"
             style={{ background: result.product.imageGradient }}>
          {result.product.imageEmoji}
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">{result.product.category}</p>
          <h2 className="text-xl font-bold text-white">{result.product.title}</h2>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <span className="text-xs text-slate-500">Best price</span>
              <p className="text-xl font-black" style={{ color: "#00D68F" }}>
                {formatNaira(lowestPrice)}
              </p>
            </div>
            <div className="h-8 w-px bg-white/[0.08]" />
            <div>
              <span className="text-xs text-slate-500">You save up to</span>
              <p className="text-xl font-black text-deal-orange">{formatNaira(result.maxSavings)}</p>
            </div>
            <div className="h-8 w-px bg-white/[0.08]" />
            <div>
              <span className="text-xs text-slate-500">Stores checked</span>
              <p className="text-xl font-black text-white">{result.prices.length}</p>
            </div>
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
                 className={`glass rounded-2xl p-4 border transition-all duration-200 hover:-translate-y-0.5
                              ${isBest
                                ? "border-deal-green/30 shadow-[0_0_24px_rgba(0,214,143,0.1)]"
                                : "border-white/[0.05] hover:border-white/[0.12]"}`}>
              <div className="flex items-center gap-4">

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
            </div>
          );
        })}
      </div>
    </div>
  );
}
