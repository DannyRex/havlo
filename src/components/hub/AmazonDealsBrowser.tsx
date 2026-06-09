"use client";

/* AmazonDealsBrowser — client-side filter/sort over the full Amazon
   markdown set (~350 offers, all marketplaces) that the /[country]/amazon
   page hands down as props.

   Everything runs in-memory: the corpus is small and bounded, so
   filtering by category + marketplace country and re-sorting is instant
   with no round-trips. Cards reveal in pages of REVEAL_STEP to keep the
   DOM light; "Show more" grows the window.

   Prices are all USD upstream, so sorting on the raw salePrice is a
   consistent order regardless of the per-visitor display currency
   MasonryCard converts to. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Globe, ArrowUpDown } from "lucide-react";
import MasonryCard from "@/components/deals/MasonryCard";
import { pdpUrlForDeal } from "@/lib/pdp-url";
import { categories as ALL_CATEGORIES } from "@/lib/data/categories";
import { cn, formatCount } from "@/lib/utils";
import { useHideOnScrollDown } from "@/lib/use-hide-on-scroll";
import type { Deal } from "@/types";

type SortKey = "recommended" | "discount" | "price-asc" | "price-desc" | "newest";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "discount",    label: "Biggest discount" },
  { value: "price-asc",   label: "Price: low to high" },
  { value: "price-desc",  label: "Price: high to low" },
  { value: "newest",      label: "Newest" },
];

/* In-place Fisher-Yates with a seeded RNG (mulberry32) — deterministic
   for a given seed so re-renders are stable, but a fresh per-visit seed
   reshuffles the "Recommended" order each visit. */
function seededShuffle<T>(arr: T[], seed: number): void {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* Amazon marketplace code → display name. Keyed on store_country, which
   the data carries for every Amazon row. Falls back to the raw code for
   any marketplace not listed here. */
const MARKET_LABEL: Record<string, string> = {
  UK: "United Kingdom",
  US: "United States",
  AE: "UAE",
  IN: "India",
  DE: "Germany",
  ZA: "South Africa",
  NG: "Nigeria",
};

const REVEAL_STEP = 48;

export default function AmazonDealsBrowser({
  deals,
  countryCode,
}: {
  deals: Deal[];
  countryCode: string;
}) {
  const [cat, setCat] = useState("all");
  const [market, setMarket] = useState("all");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [reveal, setReveal] = useState(REVEAL_STEP);
  /* Per-visit shuffle seed for "Recommended". Null on the server + first
     client paint (so SSR and hydration both use the deterministic prop
     order), then set once post-mount so the order reshuffles each visit
     without a hydration mismatch. */
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  useEffect(() => {
    setShuffleSeed(Math.floor(Math.random() * 2 ** 31));
  }, []);

  /* Mobile headroom: hide the sticky filter bar on scroll-down, reveal on
     scroll-up (same as the /deals feed). Desktop stays pinned. */
  const filterBarRef = useRef<HTMLDivElement>(null);
  const filtersHidden = useHideOnScrollDown(filterBarRef);

  /* Category chips: the canonical list, narrowed to those actually
     present in the Amazon set (keeps order + display names). */
  const catOptions = useMemo(() => {
    const present = new Set(deals.map((d) => d.categorySlug));
    return ALL_CATEGORIES.filter((c) => c.slug === "all" || present.has(c.slug));
  }, [deals]);

  /* Country options: distinct marketplaces present, alphabetised by
     display name. */
  const marketOptions = useMemo(() => {
    const codes = Array.from(
      new Set(deals.map((d) => d.storeCountry).filter(Boolean) as string[]),
    );
    codes.sort((a, b) =>
      (MARKET_LABEL[a] ?? a).localeCompare(MARKET_LABEL[b] ?? b),
    );
    return codes;
  }, [deals]);

  const filtered = useMemo(() => {
    let out = deals;
    if (cat !== "all") out = out.filter((d) => d.categorySlug === cat);
    if (market !== "all") out = out.filter((d) => d.storeCountry === market);
    const arr = [...out];
    switch (sort) {
      case "discount":
        arr.sort((a, b) => b.discountPercent - a.discountPercent);
        break;
      case "price-asc":
        arr.sort((a, b) => a.salePrice - b.salePrice);
        break;
      case "price-desc":
        arr.sort((a, b) => b.salePrice - a.salePrice);
        break;
      case "newest":
        arr.sort(
          (a, b) =>
            new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
        );
        break;
      default:
        /* "recommended" — keep the server's discount-ranked order until
           the client seed lands, then shuffle per visit so repeat
           visitors see a fresh mix (the strongest deals still seeded the
           list, they're just no longer always top-to-bottom). */
        if (shuffleSeed !== null) seededShuffle(arr, shuffleSeed);
    }
    return arr;
  }, [deals, cat, market, sort, shuffleSeed]);

  /* Reset the reveal window whenever the result SET changes (category
     or country). Re-sorting keeps the window — same items, new order. */
  useEffect(() => {
    setReveal(REVEAL_STEP);
  }, [cat, market]);

  const visible = filtered.slice(0, reveal);
  const hasMore = filtered.length > visible.length;

  /* Infinite scroll: a sentinel near the bottom auto-grows the reveal
     window when it nears the viewport, instead of a "Show more" button.
     Callback ref disconnects the prior observer when the node changes or
     unmounts (e.g. once everything's revealed). Cheap + in-memory: the
     Amazon corpus is bounded (~350), so revealing more never fetches. */
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setReveal((r) => r + REVEAL_STEP); },
      { rootMargin: "600px" },
    );
    observerRef.current.observe(node);
  }, []);

  const clearFilters = () => {
    setCat("all");
    setMarket("all");
  };

  return (
    <div>
      {/* Sticky filter bar with mobile HEADROOM (parity with /deals):
          category chips + count/sort controls. position:sticky pins it
          under the navbar once scrolled to the top; on mobile it slides up
          behind the navbar on scroll-DOWN (-translate-y-full, no overshoot)
          and reappears on scroll-UP. Desktop stays pinned. Full-bleed
          negates the page's px-4/6/8 gutters. */}
      <div
        ref={filterBarRef}
        className={cn(
          "sticky top-16 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pt-3 pb-3 mb-4 bg-bg border-b border-border",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          filtersHidden ? "-translate-y-full sm:translate-y-0" : "translate-y-0",
        )}
      >
      {/* Category chips */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {catOptions.map((c) => {
          const active = cat === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCat(c.slug)}
              aria-pressed={active}
              className={cn(
                "shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium border whitespace-nowrap transition-colors",
                active
                  ? "bg-ink text-bg border-ink"
                  : "bg-surface-2 text-ink-2 border-border hover:text-ink",
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Count + country/sort controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-3 tabular-nums">
          {formatCount(filtered.length)} {filtered.length === 1 ? "deal" : "deals"}
        </p>
        <div className="flex items-center gap-2">
          {marketOptions.length > 1 && (
            <FilterSelect
              icon={Globe}
              ariaLabel="Filter by country"
              value={market}
              onChange={setMarket}
              options={[
                { value: "all", label: "All countries" },
                ...marketOptions.map((m) => ({
                  value: m,
                  label: MARKET_LABEL[m] ?? m,
                })),
              ]}
            />
          )}
          <FilterSelect
            icon={ArrowUpDown}
            ariaLabel="Sort deals"
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={SORTS}
          />
        </div>
      </div>
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {visible.map((deal, i) => (
            <MasonryCard
              key={deal.id}
              deal={deal}
              aspect="aspect-[4/5]"
              priority={i < 4}
              linkHref={pdpUrlForDeal(countryCode, deal)}
              /* Every item on this page is an Amazon offer and all qualify
                 for the 2% cashback, so the page-level banner covers it.
                 Suppress the per-card "Earn N% soon" badge to avoid
                 repeating it on every tile. */
              showCashback={false}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <p className="text-ink-2 text-sm">
            No Amazon deals match these filters.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-[13px] text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Infinite-scroll sentinel — auto-loads the next page as it nears
          the viewport, replacing the old "Show more" button. */}
      {hasMore && <div ref={sentinelRef} className="h-10 mt-6" aria-hidden="true" />}
    </div>
  );
}

/* Compact native-select pill — leading purpose icon, trailing chevron.
   Native <select> keeps it accessible + mobile-friendly (opens the OS
   picker, no iOS focus-zoom the way text inputs have) with zero popover
   code. */
function FilterSelect<T extends string>({
  icon: Icon,
  ariaLabel,
  value,
  onChange,
  options,
}: {
  icon: typeof Globe;
  ariaLabel: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="relative inline-flex items-center">
      <Icon
        size={13}
        strokeWidth={2.25}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 text-ink-3"
      />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none rounded-full border border-border bg-surface-2 text-ink-2 hover:text-ink text-xs font-medium pl-7 pr-7 py-1.5 outline-none focus:border-brand cursor-pointer transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 text-ink-3"
      />
    </div>
  );
}
