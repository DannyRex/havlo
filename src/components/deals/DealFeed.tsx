"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import CategoryNav from "./CategoryNav";
import OriginToggle from "./OriginToggle";
import ListCard from "./ListCard";
import MasonryCard from "./MasonryCard";
import { MASONRY_ASPECTS, chunkLeftToRight } from "./masonry-layout";
import AnimateIn from "@/components/ui/AnimateIn";
import type { Deal, DiscountTier, OriginFilter, SortOption } from "@/types";

type ViewMode = "grid" | "list";
const VIEW_STORAGE_KEY = "havlo:deals:viewMode";

const PAGE_SIZE = 24;

const TIERS: { value: DiscountTier; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "10",  label: "10%+" },
  { value: "20",  label: "20%+" },
  { value: "30",  label: "30%+" },
  { value: "50",  label: "50%+" },
];

const SORTS: { value: SortOption; label: string }[] = [
  { value: "newest",     label: "Newest" },
  { value: "discount",   label: "Top discount" },
  { value: "popular",    label: "Most popular" },
  { value: "price_asc",  label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
];

/* ── Single masonry column ─────────────────────────────────────── */
function Column({ items, gapClass, startIndex }: { items: Deal[]; gapClass: string; startIndex: number }) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {items.map((d, i) => (
        <AnimateIn key={d.id} delay={Math.min(i, 6) * 50}>
          <MasonryCard
            deal={d}
            aspect={MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]}
          />
        </AnimateIn>
      ))}
    </div>
  );
}

/* ── Skeleton column for first-load ────────────────────────────── */
function SkeletonColumn({ count, gapClass, startIndex }: { count: number; gapClass: string; startIndex: number }) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className={`skeleton ${MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]} rounded-xl sm:rounded-2xl`} />
          <div className="pt-2.5 px-0.5 space-y-1.5">
            <div className="skeleton h-2.5 w-1/3 rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Whitelist of valid filter values from the URL — defends against
   junk params (e.g. /deals?tier=DROP%20TABLE) silently breaking state. */
const VALID_TIERS = new Set<DiscountTier>(["all", "10", "20", "30", "50"]);
const VALID_SORTS = new Set<SortOption>(["newest", "discount", "popular", "price_asc", "price_desc"]);
const VALID_ORIGINS = new Set<OriginFilter>(["all", "local", "intl"]);

export default function DealFeed() {
  /* Read initial filter state from URL params so /deals?category=phones
     (linked from homepage CategoryGrid tiles) lands on the correct
     filtered view instead of the default "all". */
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "all";
  const initialTierRaw = searchParams.get("minDiscount") ?? "all";
  const initialTier = VALID_TIERS.has(initialTierRaw as DiscountTier)
    ? (initialTierRaw as DiscountTier)
    : "all";
  const initialSortRaw = searchParams.get("sort") ?? "newest";
  const initialSort = VALID_SORTS.has(initialSortRaw as SortOption)
    ? (initialSortRaw as SortOption)
    : "newest";
  const initialSearch = searchParams.get("search") ?? "";
  const initialOriginRaw = searchParams.get("origin") ?? "all";
  const initialOrigin = VALID_ORIGINS.has(initialOriginRaw as OriginFilter)
    ? (initialOriginRaw as OriginFilter)
    : "all";

  const [items, setItems]       = useState<Deal[]>([]);
  const [total, setTotal]       = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [category, setCategory] = useState(initialCategory);
  const [tier, setTier]         = useState<DiscountTier>(initialTier);
  const [sort, setSort]         = useState<SortOption>(initialSort);
  const [search, setSearch]     = useState(initialSearch);
  const [origin, setOrigin]     = useState<OriginFilter>(initialOrigin);
  const [originCounts, setOriginCounts] =
    useState<{ all: number; local: number; intl: number }>();

  /* Mobile-only view-mode toggle (grid masonry vs list rows). Tablet +
     desktop always show masonry — toggle UI is hidden via sm:hidden.
     Default: grid. Persisted in localStorage so the user's choice
     sticks across sessions. */
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "list" || saved === "grid") setViewMode(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

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

  // Reset + first page on filter change
  useEffect(() => {
    setLoading(true);
    setItems([]);
    offsetRef.current = 0;

    fetch(`/api/deals?${buildParams(0)}`)
      .then((r) => r.json())
      .then(({ items, total, hasMore, originCounts, error }) => {
        if (error) return;
        setItems(items);
        setTotal(total);
        setHasMore(hasMore);
        if (originCounts) setOriginCounts(originCounts);
        offsetRef.current = PAGE_SIZE;
        /* Scroll AFTER items have rendered. Doing it synchronously in the
           effect lands the user mid-page if the previous (longer) list
           causes the browser to clamp scroll to the visible content height
           before the new (shorter) page paints. requestAnimationFrame
           waits for the next paint cycle, then we scroll. */
        if (typeof window !== "undefined") {
          requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "instant" });
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [buildParams]);

  /* Sync filter state back to URL so /deals?category=phones updates as
     the user changes filters → bookmarkable + shareable + back-button
     friendly. Skip the write when URL already matches the desired state
     (avoids history-flooding loops). */
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (tier !== "all")     params.set("minDiscount", tier);
    if (sort !== "newest")  params.set("sort", sort);
    if (search.trim())      params.set("search", search.trim());
    if (origin !== "all")   params.set("origin", origin);

    const desired = params.toString();
    const current = searchParams.toString();
    if (desired === current) return;

    router.replace(desired ? `/deals?${desired}` : "/deals", { scroll: false });
  }, [category, tier, sort, search, origin, router, searchParams]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetch(`/api/deals?${buildParams(offsetRef.current)}`)
      .then((r) => r.json())
      .then(({ items: more, hasMore: hm, error }) => {
        if (error) return;
        setItems((prev) => [...prev, ...more]);
        setHasMore(hm);
        offsetRef.current += PAGE_SIZE;
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [buildParams, hasMore, loadingMore]);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  /* ── L→R column splits ── */
  const mobileCols  = useMemo(() => chunkLeftToRight(items, 2), [items]);
  const tabletCols  = useMemo(() => chunkLeftToRight(items, 3), [items]);
  const desktopCols = useMemo(() => chunkLeftToRight(items, 4), [items]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">

      {/* Header */}
      <div className="mb-6 sm:mb-8 px-1 sm:px-0">
        <h1 className="text-[28px] sm:text-4xl font-bold text-ink tracking-[-0.03em] leading-tight">
          Deals worth checking today
        </h1>
        <p className="text-sm sm:text-base text-ink-2 mt-2 max-w-2xl">
          Fresh price drops and standout offers from the stores Nigerians already shop. Filter fast, find the deals worth opening.
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search deals or jump to compare…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && search.trim()) {
              router.push(`/compare?q=${encodeURIComponent(search.trim())}&mode=similar`);
            }
          }}
          className="w-full pl-11 pr-10 py-3 rounded-full text-base text-ink placeholder:text-ink-3 bg-surface border border-border-strong focus:border-brand focus:shadow-input outline-none transition-all"
          style={{ fontSize: "16px" }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-3 hover:text-ink transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Origin toggle */}
      <div className="mb-4">
        <OriginToggle active={origin} onChange={setOrigin} counts={originCounts} />
        {origin === "intl" && (
          <p className="mt-2 text-[11px] sm:text-xs text-ink-3 px-1">
            Prices shown in USD with a ₦ estimate. Delivery and duties may apply.
          </p>
        )}
      </div>

      {/* Sticky filter bar — categories + discount tiers + sort */}
      <div className="sticky top-16 z-30 -mx-3 px-3 sm:-mx-6 sm:px-6 py-3 mb-6 bg-bg/85 backdrop-blur-xl border-b border-border">
        <CategoryNav active={category} onChange={setCategory} />

        <div className="mt-3 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 flex-shrink-0">
            <SlidersHorizontal size={13} className="text-ink-3 mr-1.5" />
            {TIERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTier(value)}
                className={`px-2.5 py-1 rounded-full text-[12px] sm:text-xs whitespace-nowrap transition-colors ${
                  tier === value
                    ? "bg-ink text-bg font-semibold"
                    : "text-ink-2 hover:text-ink hover:bg-surface-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {!loading && (
              <span className="hidden sm:inline text-xs text-ink-3 tabular-nums">
                {total.toLocaleString()} deals
              </span>
            )}

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort deals"
                className="appearance-none bg-surface-2 border border-border rounded-full pl-3.5 pr-8 py-1.5 text-xs sm:text-[13px] text-ink hover:border-border-strong outline-none cursor-pointer transition-colors"
              >
                {SORTS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-[10px]">▾</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only view-mode toggle — its own row, right-aligned, just
          above the items grid. Keeps the sticky filter bar uncluttered
          (sort dropdown was getting pushed off-screen on narrow mobile
          when the toggle lived inside the filter row). */}
      <div className="flex items-center justify-between mb-3 sm:hidden">
        {!loading && (
          <span className="text-xs text-ink-3 tabular-nums">
            {total.toLocaleString()} deals
          </span>
        )}
        <div
          role="group"
          aria-label="View mode"
          className="flex items-center gap-0.5 rounded-full bg-surface-2 border border-border p-0.5 ml-auto"
        >
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            className={`p-1.5 rounded-full transition-colors ${
              viewMode === "grid"
                ? "bg-bg text-ink shadow-card"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            <LayoutGrid size={14} strokeWidth={viewMode === "grid" ? 2.5 : 2} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            className={`p-1.5 rounded-full transition-colors ${
              viewMode === "list"
                ? "bg-bg text-ink shadow-card"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            <List size={14} strokeWidth={viewMode === "list" ? 2.5 : 2} />
          </button>
        </div>
      </div>

      {/* Initial skeletons */}
      {loading && (
        <>
          <div className="flex gap-2 sm:hidden">
            <SkeletonColumn count={6} gapClass="gap-2" startIndex={0} />
            <SkeletonColumn count={6} gapClass="gap-2" startIndex={100} />
          </div>
          <div className="hidden sm:flex lg:hidden gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonColumn key={i} count={4} gapClass="gap-3" startIndex={i * 100} />
            ))}
          </div>
          <div className="hidden lg:flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonColumn key={i} count={3} gapClass="gap-4" startIndex={i * 100} />
            ))}
          </div>
        </>
      )}

      {/* Masonry grid (tablet + desktop always; mobile when viewMode=grid)
          OR list view on mobile when user toggled it. */}
      {!loading && items.length > 0 && (
        <>
          {/* Mobile — list OR masonry depending on user preference */}
          {viewMode === "list" ? (
            <div className="flex flex-col gap-2 sm:hidden">
              {items.map((d, i) => (
                <AnimateIn key={d.id} delay={Math.min(i, 8) * 40}>
                  <ListCard deal={d} />
                </AnimateIn>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 sm:hidden">
              {mobileCols.map((col, i) => (
                <Column key={i} items={col} gapClass="gap-2" startIndex={i * 100} />
              ))}
            </div>
          )}
          <div className="hidden sm:flex lg:hidden gap-3">
            {tabletCols.map((col, i) => (
              <Column key={i} items={col} gapClass="gap-3" startIndex={i * 100} />
            ))}
          </div>
          <div className="hidden lg:flex gap-4">
            {desktopCols.map((col, i) => (
              <Column key={i} items={col} gapClass="gap-4" startIndex={i * 100} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search size={32} className="text-ink-3 mb-3" strokeWidth={1.5} />
          <h3 className="text-base font-medium text-ink mb-1">No deals match those filters</h3>
          <p className="text-sm text-ink-3 mb-5 max-w-sm">
            Try a broader keyword or reset your filters to bring more offers back.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory("all"); setTier("all"); setSearch(""); setOrigin("all");
            }}
            className="btn-secondary"
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Sentinel */}
      {!loading && hasMore && <div ref={sentinelRef} className="mt-10" />}

      {/* Load-more spinner */}
      {loadingMore && (
        <div className="flex justify-center mt-8">
          <div className="w-6 h-6 rounded-full border-2 border-border border-t-brand animate-spin" />
        </div>
      )}

      {/* End of feed */}
      {!loading && !hasMore && items.length > 0 && (
        <p className="text-center text-xs text-ink-3 mt-12">
          That&apos;s all {total.toLocaleString()} deals for now.
        </p>
      )}
    </div>
  );
}
