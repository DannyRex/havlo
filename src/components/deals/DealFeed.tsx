"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import CategoryNav from "./CategoryNav";
import DiscountFilter from "./DiscountFilter";
import DealCard from "./DealCard";
import OriginToggle from "./OriginToggle";
import AnimateIn from "@/components/ui/AnimateIn";
import type { Deal, DiscountTier, OriginFilter, SortOption } from "@/types";

const PAGE_SIZE = 20;

export default function DealFeed() {
  const [deals, setDeals]       = useState<Deal[]>([]);
  const [total, setTotal]       = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [category, setCategory] = useState("all");
  const [tier, setTier]         = useState<DiscountTier>("all");
  const [sort, setSort]         = useState<SortOption>("newest");
  const [search, setSearch]     = useState("");
  const [origin, setOrigin]     = useState<OriginFilter>("all");
  const [originCounts, setOriginCounts] = useState<{ all: number; local: number; intl: number }>();

  const offsetRef = useRef(0);
  const router = useRouter();

  const buildParams = useCallback((offset: number) => {
    const p = new URLSearchParams();
    if (category !== "all") p.set("category", category);
    if (tier !== "all")     p.set("minDiscount", tier);
    if (sort)               p.set("sort", sort);
    if (search)             p.set("search", search);
    if (origin !== "all")   p.set("origin", origin);
    p.set("limit",  String(PAGE_SIZE));
    p.set("offset", String(offset));
    return p.toString();
  }, [category, tier, sort, search, origin]);

  // Reset + first page whenever filters change
  useEffect(() => {
    setLoading(true);
    setDeals([]);
    offsetRef.current = 0;

    fetch(`/api/deals?${buildParams(0)}`)
      .then((r) => r.json())
      .then(({ items, total, hasMore, originCounts }) => {
        setDeals(items);
        setTotal(total);
        setHasMore(hasMore);
        if (originCounts) setOriginCounts(originCounts);
        offsetRef.current = PAGE_SIZE;
      })
      .finally(() => setLoading(false));
  }, [buildParams]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    fetch(`/api/deals?${buildParams(offsetRef.current)}`)
      .then((r) => r.json())
      .then(({ items, hasMore: more }) => {
        setDeals((prev) => [...prev, ...items]);
        setHasMore(more);
        offsetRef.current += PAGE_SIZE;
      })
      .finally(() => setLoadingMore(false));
  }, [buildParams, hasMore, loadingMore]);

  // Sentinel observer
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const gridCls = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-5 sm:gap-y-8";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Deals worth checking today
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Fresh price drops and standout offers from stores Nigerians already shop.
        </p>
      </div>

      {/* Origin toggle — prominent at the top so international stock is
          discoverable without scrolling past the feed. */}
      <div className="mb-4">
        <OriginToggle
          active={origin}
          onChange={setOrigin}
          counts={originCounts}
        />
        {origin === "intl" && (
          <p className="mt-2 text-[11px] sm:text-xs text-slate-500">
            Prices shown in USD with a ₦ estimate. Delivery and duties may apply.
          </p>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search a product to compare prices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && search.trim()) {
              router.push(`/compare?q=${encodeURIComponent(search.trim())}`);
            }
          }}
          className="w-full pl-9 pr-9 py-2.5 rounded-full text-base sm:text-sm text-white placeholder-slate-500 bg-white/[0.04] border border-white/10 focus:border-white/25 focus:bg-white/[0.06] outline-none transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Sticky filters */}
      <div className="sticky top-16 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-5 bg-navy-900/85 backdrop-blur-md">
        <CategoryNav active={category} onChange={setCategory} />
        <div className="mt-2.5">
          <DiscountFilter
            activeTier={tier}
            activeSort={sort}
            onTierChange={setTier}
            onSortChange={setSort}
            resultCount={total}
          />
        </div>
      </div>

      {/* Initial skeletons */}
      {loading && (
        <div className={gridCls}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="flex flex-row sm:flex-col gap-3 sm:gap-0">
              <div className="skeleton w-28 h-28 shrink-0 sm:w-full sm:h-auto sm:aspect-square rounded-xl" />
              <div className="flex-1 sm:flex-none sm:pt-2.5 flex flex-col justify-center sm:justify-start gap-1.5">
                <div className="skeleton h-2.5 w-1/3 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded mt-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deal grid */}
      {!loading && deals.length > 0 && (
        <div className={gridCls}>
          {deals.map((deal, i) => (
            <AnimateIn
              key={deal.id}
              variant="fade-up"
              delay={Math.min(i % PAGE_SIZE, 7) * 40}
              threshold={0.05}
            >
              <DealCard deal={deal} />
            </AnimateIn>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search size={32} className="text-slate-600 mb-3" strokeWidth={1.5} />
          <h3 className="text-base font-medium text-white mb-1">No deals are available yet</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-sm">
            Try a broader keyword or reset your filters to bring more offers back.
          </p>
          <button
            onClick={() => { setCategory("all"); setTier("all"); setSearch(""); setOrigin("all"); }}
            className="text-sm text-slate-300 hover:text-white border border-white/15 hover:border-white/30 rounded-full px-4 py-2 transition-colors"
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {!loading && hasMore && (
        <div ref={sentinelRef} className="mt-10" />
      )}

      {/* Load-more spinner */}
      {loadingMore && (
        <div className="flex justify-center mt-8">
          <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
        </div>
      )}

      {/* End of results */}
      {!loading && !hasMore && deals.length > 0 && (
        <p className="text-center text-xs text-slate-600 mt-10">
          You've seen all {total} deals for now
        </p>
      )}
    </div>
  );
}
