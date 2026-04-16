"use client";

import { cn } from "@/lib/utils";
import type { DiscountTier, SortOption } from "@/types";
import { ArrowUpDown } from "lucide-react";

const tiers: { value: DiscountTier; label: string }[] = [
  { value: "all", label: "Any %" },
  { value: "10",  label: "10%+"  },
  { value: "20",  label: "20%+"  },
  { value: "30",  label: "30%+"  },
  { value: "50",  label: "50%+"  },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest",     label: "Newest"    },
  { value: "discount",   label: "Top Discount" },
  { value: "popular",    label: "Most Popular" },
  { value: "price_asc",  label: "Price: Low→High" },
  { value: "price_desc", label: "Price: High→Low" },
];

interface Props {
  activeTier: DiscountTier;
  activeSort: SortOption;
  onTierChange: (tier: DiscountTier) => void;
  onSortChange: (sort: SortOption) => void;
  resultCount: number;
}

export default function DiscountFilter({
  activeTier, activeSort, onTierChange, onSortChange, resultCount,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

      {/* Discount tiers */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap mr-1 flex-shrink-0">Discount:</span>
        {tiers.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onTierChange(value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all",
              activeTier === value
                ? "text-white"
                : "text-slate-500 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]"
            )}
            style={
              activeTier === value
                ? { background: "linear-gradient(135deg, #FF3333 0%, #CC0000 100%)" }
                : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right side: result count + sort */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-slate-600">{resultCount} deals</span>
        <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs glass
                        border border-white/[0.06] text-slate-400 cursor-pointer group">
          <ArrowUpDown size={12} />
          <select
            value={activeSort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="appearance-none bg-transparent text-slate-400 text-xs outline-none cursor-pointer
                       hover:text-white transition-colors"
          >
            {sortOptions.map(({ value, label }) => (
              <option key={value} value={value} className="bg-navy-800 text-white">
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
