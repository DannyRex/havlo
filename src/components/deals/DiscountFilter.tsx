"use client";

import { cn } from "@/lib/utils";
import type { DiscountTier, SortOption } from "@/types";

const tiers: { value: DiscountTier; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "10",  label: "10%+" },
  { value: "20",  label: "20%+" },
  { value: "30",  label: "30%+" },
  { value: "50",  label: "50%+" },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest",     label: "Newest" },
  { value: "discount",   label: "Top discount" },
  { value: "popular",    label: "Most popular" },
  { value: "price_asc",  label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
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
    <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {tiers.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onTierChange(value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
              activeTier === value
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="hidden sm:inline text-xs text-slate-500">{resultCount} results</span>
        <select
          value={activeSort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="appearance-none bg-transparent text-xs text-slate-300 hover:text-white outline-none cursor-pointer"
        >
          {sortOptions.map(({ value, label }) => (
            <option key={value} value={value} className="bg-navy-800 text-white">
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
