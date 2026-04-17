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
  const [showFilters, setShowFilters] = useState(false);

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

  const featuredDeals = localDeals.filter((d) => d.isFeatured);
  const regularDeals  = localDeals.filter((d) => !d.isFeatured);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-1">
          🔥 Today&apos;s Best Deals
        </h1>
        <p className="text-slate-500">
          Fresh deals from Nigeria&apos;s top stores + international sites, updated daily.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search deals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10 pr-10"
        />
        {search && (
          <button onClick={() => setSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 py-4 -mx-4 px-4 sm:-mx-6 sm:px-6 mb-6"
           style={{ background: "rgba(5,11,24,0.92)", backdropFilter: "blur(16px)" }}>

        {/* Category nav */}
        <CategoryNav active={category} onChange={setCategory} />

        {/* Filter toggle (mobile) + inline discount filters */}
        <div className="mt-3">
          <DiscountFilter
            activeTier={tier}
            activeSort={sort}
            onTierChange={setTier}
            onSortChange={setSort}
            resultCount={localDeals.length}
          />
        </div>
      </div>

      {/* Active filters summary */}
      {(search || tier !== "all" || category !== "all") && (
        <div className="flex flex-wrap gap-2 mb-6">
          {search && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             bg-brand-600/20 text-brand-400 border border-brand-600/30">
              &ldquo;{search}&rdquo;
              <button onClick={() => setSearch("")}><X size={10} /></button>
            </span>
          )}
          {category !== "all" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             bg-white/[0.06] text-slate-400 border border-white/[0.08]">
              {category}
              <button onClick={() => setCategory("all")}><X size={10} /></button>
            </span>
          )}
          {tier !== "all" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             bg-deal-red/20 text-red-400 border border-red-500/30">
              {tier}%+ off
              <button onClick={() => setTier("all")}><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden glass border border-white/[0.05]">
              <div className="skeleton h-44 w-full" />
              <div className="p-4 space-y-3">
                <div className="skeleton h-3 w-20 rounded-full" />
                <div className="skeleton h-4 w-full rounded-full" />
                <div className="skeleton h-4 w-3/4 rounded-full" />
                <div className="skeleton h-8 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Featured deals */}
      {!loading && featuredDeals.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base font-bold text-white">⭐ Featured Deals</span>
            <span className="text-xs px-2 py-0.5 rounded-full text-brand-400 bg-brand-600/20 border border-brand-600/30 font-semibold">
              {featuredDeals.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {featuredDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} featured />
            ))}
          </div>
        </div>
      )}

      {/* Regular deals */}
      {!loading && regularDeals.length > 0 && (
        <div>
          {featuredDeals.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-bold text-white">All Deals</span>
              <span className="text-xs px-2 py-0.5 rounded-full text-slate-400 bg-white/[0.06] border border-white/[0.08] font-semibold">
                {regularDeals.length}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {regularDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      )}

      {/* International Deals */}
      {!loading && intlDeals.length > 0 && (
        <div className="mt-12">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-brand-400" />
              <span className="text-base font-bold text-white">International Deals</span>
              <span className="text-xs px-2 py-0.5 rounded-full text-brand-400 bg-brand-600/20 border border-brand-600/30 font-semibold">
                {intlDeals.length}
              </span>
            </div>
          </div>

          {/* Disclaimer banner */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-5 border"
               style={{
                 background: "rgba(255,153,0,0.07)",
                 borderColor: "rgba(255,153,0,0.2)",
               }}>
            <Globe size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              <span className="font-semibold text-amber-300">Prices shown in USD.</span>{" "}
              Shipping to Nigeria is not included and varies by seller. Use a forwarding
              service (e.g. Courier Plus, Shop&Ship) or check if the seller ships directly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {intlDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-4">🔍</span>
          <h3 className="text-xl font-bold text-white mb-2">No deals found</h3>
          <p className="text-slate-500 mb-6 max-w-sm">
            Try adjusting your filters or searching for something different.
          </p>
          <button
            onClick={() => { setCategory("all"); setTier("all"); setSearch(""); }}
            className="btn-primary text-sm py-2.5"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
