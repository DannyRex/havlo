"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Globe } from "lucide-react";
import CategoryNav from "./CategoryNav";
import DiscountFilter from "./DiscountFilter";
import DealCard from "./DealCard";
import type { Deal, DiscountTier, SortOption } from "@/types";

export default function DealFeed() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [tier, setTier] = useState<DiscountTier>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (tier !== "all")     params.set("minDiscount", tier);
    if (sort)               params.set("sort", sort);
    if (search)             params.set("search", search);

    const res = await fetch(`/api/deals?${params.toString()}`);
    const data = await res.json();
    setDeals(data);
    setLoading(false);
  }, [category, tier, sort, search]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const localDeals = deals.filter((d) => d.currency !== "USD");
  const intlDeals  = deals.filter((d) => d.currency === "USD");

  const gridCls = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      {/* Page header — minimal */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Today&apos;s deals
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Fresh picks from Nigerian and international stores, updated daily.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search deals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 rounded-full text-sm text-white placeholder-slate-500 bg-white/[0.04] border border-white/10 focus:border-white/25 focus:bg-white/[0.06] outline-none transition-colors"
        />
        {search && (
          <button onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Sticky filter row */}
      <div className="sticky top-16 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-5 bg-navy-900/85 backdrop-blur-md">
        <CategoryNav active={category} onChange={setCategory} />
        <div className="mt-2.5">
          <DiscountFilter
            activeTier={tier}
            activeSort={sort}
            onTierChange={setTier}
            onSortChange={setSort}
            resultCount={localDeals.length + intlDeals.length}
          />
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className={gridCls}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton aspect-square w-full rounded-xl" />
              <div className="skeleton mt-2.5 h-3 w-1/3 rounded" />
              <div className="skeleton mt-1.5 h-3 w-full rounded" />
              <div className="skeleton mt-1.5 h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Local deals */}
      {!loading && localDeals.length > 0 && (
        <div className={gridCls}>
          {localDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {/* International deals */}
      {!loading && intlDeals.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={15} className="text-slate-400" />
            <h2 className="text-base font-semibold text-white tracking-tight">
              International
            </h2>
            <span className="text-xs text-slate-500">· {intlDeals.length}</span>
          </div>

          <p className="text-xs text-slate-500 mb-5 max-w-xl">
            Prices in USD. Shipping to Nigeria not included — use a forwarding service or check seller policy.
          </p>

          <div className={gridCls}>
            {intlDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search size={32} className="text-slate-600 mb-3" strokeWidth={1.5} />
          <h3 className="text-base font-medium text-white mb-1">No deals found</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-sm">
            Try adjusting your filters.
          </p>
          <button
            onClick={() => { setCategory("all"); setTier("all"); setSearch(""); }}
            className="text-sm text-slate-300 hover:text-white border border-white/15 hover:border-white/30 rounded-full px-4 py-2 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
