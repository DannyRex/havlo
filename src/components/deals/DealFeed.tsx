"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import CategoryNav from "./CategoryNav";
import OriginToggle from "./OriginToggle";
import ListCard from "./ListCard";
import MasonryCard from "./MasonryCard";
import StoreFilter, { type StoreOption } from "./StoreFilter";
import { MASONRY_ASPECTS } from "./masonry-layout";
import AnimateIn from "@/components/ui/AnimateIn";
import EmptySearchState from "@/components/empty/EmptySearchState";
import CategorySubscribe from "./CategorySubscribe";
import { useCountry } from "@/components/providers/CountryProvider";
import { cn } from "@/lib/utils";
import { categories } from "@/lib/data/categories";
import type { Deal, DiscountTier, OriginFilter, SortOption } from "@/types";

type ViewMode = "grid" | "list";
const VIEW_STORAGE_KEY = "havlo:deals:viewMode";

const PAGE_SIZE = 24;

const TIERS: { value: DiscountTier; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "10",  label: "10%+" },
  { value: "20",  label: "20%+" },
  { value: "50",  label: "50%+" },
];

/* Default = "relevance": a composite ranker that blends discount,
   recency, and a small monetization boost (Amazon + AliExpress nudged
   up because that's where commission flows from), then a one-pass
   store-spacer so no two consecutive cards share a storeId. Solves
   the "runs of one store" problem that pure 'newest' produced because
   ingestion writes timestamps per-store-batch. */
const SORTS: { value: SortOption; label: string }[] = [
  { value: "relevance",  label: "Relevance" },
  { value: "newest",     label: "Latest" },
  { value: "discount",   label: "Top discount" },
  /* Ranks by real 30d clicks from outbound_clicks + the
     popular_products() RPC (migration 0015). Ties on click count
     fall back to discount-desc, so the sort behaves sensibly even
     when traffic is sparse. */
  { value: "popular",    label: "Most popular" },
  { value: "price_asc",  label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
];

/* ── Skeleton tile rendered during initial load ────────────────── */
function SkeletonTile({ aspect }: { aspect: string }) {
  return (
    <div>
      <div className={`skeleton ${aspect} rounded-xl sm:rounded-2xl`} />
      <div className="pt-2.5 px-0.5 space-y-1.5">
        <div className="skeleton h-2.5 w-1/3 rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}

/* Whitelist of valid filter values from the URL — defends against
   junk params (e.g. /deals?tier=DROP%20TABLE) silently breaking state. */
const VALID_TIERS = new Set<DiscountTier>(["all", "10", "20", "30", "50"]);
const VALID_SORTS = new Set<SortOption>(["relevance", "newest", "discount", "popular", "price_asc", "price_desc"]);
const VALID_ORIGINS = new Set<OriginFilter>(["all", "local", "intl"]);

/* "iPhone" as the product-name example in the search-input
   placeholder. The placeholder used to suggest a country-local
   store name (Konga / Currys / MediaMarkt) but the search field is
   title-only now that the dedicated Store filter popup handles
   store-by-store selection — keeping a store example would
   mislead users into typing one and getting confusing partial
   matches. iPhone is universally recognised across all seven
   markets and reliably has stock to surface. */

/* Server-passed initial state — lets /deals/page.tsx do the FIRST
   /api/deals fetch on the server so the initial HTML carries
   real cards instead of a skeleton. The first paint shows content
   immediately; the skeleton only flashes on subsequent client-side
   filter changes. Big wall-clock UX win on poor networks. */
interface DealFeedProps {
  initialItems?:        Deal[];
  initialTotal?:        number;
  initialHasMore?:      boolean;
  initialOriginCounts?: { all: number; local: number; intl: number };
  /* Aggregate of stores in the current filter context, for the Stores
     dropdown. Renamed from `initialStores` to `initialStoreOptions`
     to avoid colliding with the local `initialStores` const that
     parses the URL ?stores=… into a Set<string> for the selected-
     stores state below. */
  initialStoreOptions?: Array<{ id: string; name: string; count: number }>;
}

export default function DealFeed({
  initialItems,
  initialTotal,
  initialHasMore,
  initialOriginCounts,
  initialStoreOptions,
}: DealFeedProps = {}) {
  /* Read initial filter state from URL params so /deals?category=phones
     (linked from homepage CategoryGrid tiles) lands on the correct
     filtered view instead of the default "all". */
  const searchParams = useSearchParams();

  /* Country lifted to the top of the component because the initial
     origin default is country-aware (see initialOrigin below). NG
     visitors default to "all" because cross-border buying is a big
     share of intent there; every other market defaults to "local"
     so the first scroll surfaces retailers the user recognises. */
  const { country } = useCountry();
  /* Validate category against the known list. An unknown slug
     (e.g. ?category=junkjunkjunk from a stale Slack/Twitter link)
     used to silently fall back to 'all' with no UI hint, leaving
     the user wondering why the filter pill they expected wasn't
     selected. We now keep the bad slug around in `invalidCategory`
     state and surface a dismissable info chip below the filter bar. */
  const requestedCategoryRaw = searchParams.get("category") ?? "all";
  const validCategorySlugs = new Set(categories.map((c) => c.slug));
  const initialCategory = validCategorySlugs.has(requestedCategoryRaw)
    ? requestedCategoryRaw
    : "all";
  const [invalidCategory, setInvalidCategory] = useState<string | null>(
    !validCategorySlugs.has(requestedCategoryRaw) && requestedCategoryRaw !== "all"
      ? requestedCategoryRaw
      : null,
  );
  const initialTierRaw = searchParams.get("minDiscount") ?? "all";
  const initialTier = VALID_TIERS.has(initialTierRaw as DiscountTier)
    ? (initialTierRaw as DiscountTier)
    : "all";
  const initialSortRaw = searchParams.get("sort") ?? "relevance";
  const initialSort = VALID_SORTS.has(initialSortRaw as SortOption)
    ? (initialSortRaw as SortOption)
    : "relevance";
  const initialSearch = searchParams.get("search") ?? "";

  /* Multi-store filter state. URL param ?stores=argos,currys is the
     source of truth so the filter survives reload + share. Parsed
     into a Set for O(1) toggle / has-check operations in the popover.
     Trimmed + lower-cased to match storeId conventions across the
     codebase. */
  const initialStoresRaw = searchParams.get("stores") ?? "";
  const initialStores = new Set(
    initialStoresRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  /* Default origin is "local" for every market (May 2026). Was
     country-aware: NG → "all", others → "local". Switched to one
     consistent default because:
       1. Most shoppers in any market start with stores they
          recognise — lowest-friction landing.
       2. The "All" mix tends to be AliExpress-heavy and reads as
          overwhelming on first scroll.
       3. The Intl tab is one tap away for users who want
          cross-border options; the URL state persists once
          chosen, so the user only switches once.

     The explicit ?origin= URL override always wins so deep-links
     from social / newsletters still resolve as authored. */
  const initialOriginRaw = searchParams.get("origin");
  const initialOrigin: OriginFilter =
    initialOriginRaw && VALID_ORIGINS.has(initialOriginRaw as OriginFilter)
      ? (initialOriginRaw as OriginFilter)
      : "local";

  /* Initial state seeded from props (when page.tsx pre-fetched on the
     server) so first paint shows real cards, not the skeleton. When
     props are absent (legacy callers, dev paths) we fall back to the
     old empty-array + loading=true behaviour. */
  const [items, setItems]       = useState<Deal[]>(initialItems ?? []);
  const [total, setTotal]       = useState(initialTotal ?? 0);
  const [hasMore, setHasMore]   = useState(initialHasMore ?? false);
  /* loading=false on first render IF we have server-passed items.
     The first useEffect would otherwise re-fetch immediately and
     show the skeleton anyway; we'll suppress that with a ref. */
  const [loading, setLoading]   = useState(!initialItems);
  const [loadingMore, setLoadingMore] = useState(false);
  /* Track whether we've consumed the SSR'd initial fetch yet. The
     filter-change effect below skips its first run when this is
     unset AND initialItems was provided — so the user doesn't see
     a content → skeleton → content flicker on first paint. */
  const hasConsumedInitialRef = useRef(!initialItems);

  const [category, setCategory] = useState(initialCategory);
  const [tier, setTier]         = useState<DiscountTier>(initialTier);
  const [sort, setSort]         = useState<SortOption>(initialSort);
  /* searchInput is bound to the input box and updates synchronously
     on every keystroke (so the user sees what they're typing).
     searchDebounced is the value that actually drives the /api/deals
     fetch and the URL sync — settles 300ms after typing stops, so
     fast typing doesn't fire a fetch per keystroke. The previous
     setup had no debounce; rapid typing produced N in-flight fetches
     and out-of-order responses overwrote each other, producing the
     "search/filter isn't working" symptom even though the server was
     answering each request correctly. */
  const [searchInput, setSearchInput]       = useState(initialSearch);
  const [searchDebounced, setSearchDebounced] = useState(initialSearch);
  const [origin, setOrigin]     = useState<OriginFilter>(initialOrigin);
  const [originCounts, setOriginCounts] =
    useState<{ all: number; local: number; intl: number } | undefined>(initialOriginCounts);
  /* Selected store IDs from the StoreFilter popover. Persists to URL
     via buildParams (?stores=argos,currys). */
  const [selectedStores, setSelectedStores] = useState<Set<string>>(initialStores);
  /* All stores currently available in the filtered pool. Comes back
     in the /api/deals response alongside items + counts. Empty until
     the first fetch lands. */
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>(initialStoreOptions ?? []);

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

  /* 300ms debounce — settle the search value used for fetching after
     the user stops typing. The input itself stays responsive because
     searchInput updates synchronously on every keystroke. */
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const offsetRef = useRef(0);
  /* Sequence counter for fetch-race defence. Every fetch effect run
     increments this; the .then() handler bails out if the counter
     has moved on. Belt-and-braces alongside the debounce: even with
     debouncing, a slow first fetch could land after a faster second
     fetch and clobber the result. */
  const fetchSeqRef = useRef(0);

  /* originCounts key — the set of filter inputs that ACTUALLY affect
     the All/Local/Intl badge values. Used to gate badge-refresh so
     they don't flicker on every origin tab click.

     Per src/app/api/deals/route.ts, originCounts is derived from
     `qualifyingCountryFiltered` which is invariant to `origin` and
     `selectedStores`. The same three counts come back regardless of
     which tab the user clicks. But in practice the badges DID drift
     between tab clicks because:

       1. POOL_CACHE has a 5-min TTL — if the cache miss falls
          between two clicks, the second click triggers a fresh DB
          fetch that may see slightly different rows (ingest churn).
       2. Different Vercel function instances hold separate
          POOL_CACHE Maps — consecutive clicks routed to different
          instances both miss-and-fill from their own DB hits.

     Client-side fix: only call setOriginCounts when one of the
     inputs that ACTUALLY drives the badge math has changed since
     the last refresh. Otherwise hold the previous values. The badges
     are now stable across origin tab clicks even when the backend
     returns slightly different numbers per request.

     User report May 2026: "switching tabs in the deals page changes
     the number count. should not be." */
  const computeOriginCountsKey = () => JSON.stringify({
    category, tier, sort, search: searchDebounced, country: country.code,
  });
  /* Initialise on mount with the current filter state so origin tab
     clicks AFTER the first authoritative client response stay stable.
     `hasReceivedClientCountsRef` separately tracks whether we've heard
     from the API at all — until we have, every response refreshes
     unconditionally (so a bad SSR snapshot doesn't lock us in).

     The SSR initial fetch in /[country]/deals/page.tsx can return:
       • null on network error → initialOriginCounts is undefined
         → badges render no count → first client fetch populates.
       • {all:0, local:0, intl:0} on RPC failure / curated fallback
         → badges render "0" → without this gate we'd lock in zero.
       • A correct snapshot → badges render correctly → first client
         fetch will likely return the same numbers (origin invariant)
         → visual no-op.

     User report May 2026: "sometimes the count is zero until the
     country is changed." Root cause was the previous fix's
     "initialise ref on mount" assuming SSR was always trustworthy.
     Now SSR is a placeholder; the first client response is the
     authority. */
  const hasReceivedClientCountsRef = useRef(false);
  const originCountsKeyRef = useRef<string>(computeOriginCountsKey());
  const router = useRouter();
  /* `country` is lifted to the top of the component (above
     initialOrigin) — see comment near the top of DealFeed. */

  /* Country goes into the URL so:
       1. The CDN cache key differs per country (s-maxage was caching
          the same response for every country before).
       2. The fetch effect re-runs on country change because country
          flows through buildParams. */
  const buildParams = useCallback((offset: number) => {
    const p = new URLSearchParams();
    if (category !== "all") p.set("category", category);
    if (tier !== "all")     p.set("minDiscount", tier);
    if (sort)               p.set("sort", sort);
    /* Use the debounced search so the fetch only fires after typing
       settles — see the searchDebounced comment above. */
    if (searchDebounced)    p.set("search", searchDebounced);
    /* Always set the origin param (even when "all") so the API
       request URL is unambiguous and the response cache keys cleanly.
       Was: only set when origin !== "all" — created an asymmetry
       where flipping back to "all" didn't change the API URL
       and could mask the toggle's effect (user report May 2026:
       "all deals isn't clickable for ng"). */
    p.set("origin", origin);
    /* Stores filter: comma-separated, sorted alphabetically so the
       URL is stable regardless of click order (better for browser
       cache + clean share-links). */
    if (selectedStores.size > 0) {
      p.set("stores", Array.from(selectedStores).sort().join(","));
    }
    p.set("country", country.code);
    p.set("limit",  String(PAGE_SIZE));
    p.set("offset", String(offset));
    return p.toString();
  }, [category, tier, sort, searchDebounced, origin, selectedStores, country.code]);

  // Reset + first page on filter change
  useEffect(() => {
    /* SSR'd-content optimisation: skip the very first effect run when
       page.tsx pre-fetched and passed initialItems. The state is
       already populated; re-fetching here would clear items + show
       the skeleton, defeating the SSR-prefetch entirely. From the
       SECOND run onward (any filter change) we behave as before. */
    if (!hasConsumedInitialRef.current) {
      hasConsumedInitialRef.current = true;
      offsetRef.current = PAGE_SIZE;
      return;
    }

    const mySeq = ++fetchSeqRef.current;
    setLoading(true);
    setItems([]);
    offsetRef.current = 0;

    fetch(`/api/deals?${buildParams(0)}`)
      .then((r) => r.json())
      .then(({ items, total, hasMore, originCounts, stores, error }) => {
        /* Bail if a newer fetch has started since we kicked off —
           prevents stale results from clobbering newer ones. */
        if (mySeq !== fetchSeqRef.current) return;
        if (error) return;
        setItems(items);
        setTotal(total);
        setHasMore(hasMore);
        /* Refresh badge counts on:
             1. The first ever client response (overrides bad SSR
                snapshots — e.g. all-zero counts from RPC failure).
             2. Any subsequent response where the badge-relevant
                filter inputs changed (origin and selectedStores
                don't, so origin tab clicks no longer flicker).
           See originCountsKeyRef comment for the full rationale. */
        const newKey = computeOriginCountsKey();
        const shouldRefresh =
          !hasReceivedClientCountsRef.current ||
          newKey !== originCountsKeyRef.current;
        if (originCounts && shouldRefresh) {
          setOriginCounts(originCounts);
          originCountsKeyRef.current = newKey;
          hasReceivedClientCountsRef.current = true;
        }
        if (Array.isArray(stores)) setStoreOptions(stores);
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
      .finally(() => {
        /* Only flip loading off if this is still the latest fetch.
           Otherwise a stale-fetch finally could clear the loading
           state mid-way through a newer one's render. */
        if (mySeq === fetchSeqRef.current) setLoading(false);
      });
  }, [buildParams]);

  /* Sync filter state back to URL so /deals?category=phones updates as
     the user changes filters → bookmarkable + shareable + back-button
     friendly. Skip the write when URL already matches the desired state
     (avoids history-flooding loops). */
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (tier !== "all")     params.set("minDiscount", tier);
    if (sort !== "relevance") params.set("sort", sort);
    /* URL syncs the DEBOUNCED search — keeping the URL in lockstep
       with every keystroke would flood router history and update
       the back-button stack per character. */
    if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
    /* Always set origin in the URL too — same reasoning as
       buildParams. The visible URL stays in lockstep with the
       toggle state, which avoids the visual "did anything
       happen?" ambiguity when flipping back to "all". */
    params.set("origin", origin);
    /* Mirror buildParams' alphabetical sort so the URL is stable
       regardless of selection order — keeps history clean and
       share-links predictable. */
    if (selectedStores.size > 0) {
      params.set("stores", Array.from(selectedStores).sort().join(","));
    }

    const desired = params.toString();
    const current = searchParams.toString();
    if (desired === current) return;

    /* Preserve the country prefix when writing the URL back. The
       bare /deals path triggers a middleware redirect to
       /{cookie-country}/deals on the next navigation — which used
       to silently route a visitor from /ng/deals (URL country)
       back to /us/deals (cookie country) every time they touched a
       filter. QA report May 2026: "navigating to /ng/deals while
       cookie=US rewrote the URL to /us/deals?origin=local". The
       fix is to keep the URL prefix the user actually navigated
       to — country.code reads URL-first via CountryProvider's
       useEffect, so this stays correct on country-scoped pages. */
    const prefix = `/${country.code}`;
    router.replace(desired ? `${prefix}/deals?${desired}` : `${prefix}/deals`, { scroll: false });
  }, [category, tier, sort, searchDebounced, origin, selectedStores, router, searchParams, country.code]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetch(`/api/deals?${buildParams(offsetRef.current)}`)
      .then((r) => r.json())
      .then(({ items: more, total: nextTotal, hasMore: hm, originCounts: nextOriginCounts, stores: nextStores, error }) => {
        if (error) return;
        setItems((prev) => [...prev, ...more]);
        setHasMore(hm);
        /* Refresh the metadata from every paginated response too.
           Without this, the user can land on /uk/deals with initial
           state carrying a different origin's total (SSR vs client
           default mismatch), pagination appends Local items but
           `total` still reads the "all" count, and the end-of-list
           message reads "That's all 1531 deals for now" while only
           551 cards have actually rendered (May 2026 bug). The
           backend now returns the same metadata on every page, so
           propagating it here keeps the UI consistent. */
        if (typeof nextTotal === "number") setTotal(nextTotal);
        /* Same gating as the first-page fetch — don't let load-more
           responses overwrite stable origin badge counts. The user's
           origin choice doesn't change during pagination, so the
           counts MUST stay stable here. Load-more still counts as a
           valid client response, so it flips hasReceivedClientCounts
           the same way (covers the "SSR bad, user paginated before
           any other filter change" edge case). */
        const newKey = computeOriginCountsKey();
        const shouldRefresh =
          !hasReceivedClientCountsRef.current ||
          newKey !== originCountsKeyRef.current;
        if (nextOriginCounts && shouldRefresh) {
          setOriginCounts(nextOriginCounts);
          originCountsKeyRef.current = newKey;
          hasReceivedClientCountsRef.current = true;
        }
        if (Array.isArray(nextStores)) setStoreOptions(nextStores);
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


  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">

      {/* Header — country-aware. Was hardcoded "Nigerians already
          shop" which read wrong on /uk/deals, /us/deals, etc. Now
          uses the country's name + a generic "shoppers" so the
          subhead localises automatically. */}
      <div className="mb-6 sm:mb-8 px-1 sm:px-0">
        <h1 className="text-[28px] sm:text-4xl font-bold text-ink tracking-[-0.03em] leading-tight">
          Deals worth checking today
        </h1>
        <p className="text-sm sm:text-base text-ink-2 mt-2 max-w-2xl">
          Fresh price drops and standout offers from the stores {country.name === "Nigeria" ? "Nigerians" : `${country.name} shoppers`} already shop. Filter fast, find the deals worth opening.
        </p>
      </div>

      {/* Search input + subtitle. Subtitle addresses Bucket 2#25 from
          QA audit: placeholder text disappears on focus, leaving the
          user without context for what Enter does (filter vs compare).
          Persistent micro-copy below the input keeps the rule visible
          while the user is typing.

          Placeholder is country-local: example store name picks from
          the visitor's market roster, not the launch-market Currys
          that didn't exist in NG/US/DE. Kept short (under ~30 chars)
          so it doesn't get clipped on iPhone-mini-class viewports. */}
      <div className="relative mb-1.5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" aria-hidden="true" />
        <label htmlFor="deals-search" className="sr-only">
          Search deals
        </label>
        <input
          id="deals-search"
          type="text"
          aria-label="Filter these deals by product name. Use the Stores button above to filter by store. Press Enter to search across all stores."
          placeholder="Search these deals, try 'iPhone'…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchInput.trim()) {
              router.push(`/compare?q=${encodeURIComponent(searchInput.trim())}&mode=similar`);
            }
          }}
          className="w-full pl-11 pr-10 py-3 rounded-full text-base text-ink placeholder:text-ink-3 bg-surface border border-border-strong focus:border-brand focus:shadow-input outline-none transition-all"
          style={{ fontSize: "16px" }}
        />
        {searchInput && (
          <button
            type="button"
            /* Clear both the input AND the debounced filter state
               so the list returns to "no filter" immediately rather
               than waiting 300ms. */
            onClick={() => { setSearchInput(""); setSearchDebounced(""); }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-3 hover:text-ink transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-3 mb-4 px-4">
        Type to filter the deals shown below. Press Enter to search across every store for a fresh comparison.
      </p>

      {/* Invalid-category info chip — addresses Bucket 2#17 from QA
          audit. When the URL ?category= param doesn't match any
          known slug, surface a dismissable explanation instead of
          silently swapping to All. */}
      {invalidCategory && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5"
        >
          <span className="text-[11px] sm:text-xs text-ink-2 leading-relaxed flex-1">
            We don&apos;t have a &ldquo;{invalidCategory}&rdquo; category. Showing all deals instead.
          </span>
          <button
            type="button"
            onClick={() => setInvalidCategory(null)}
            aria-label="Dismiss"
            className="shrink-0 -m-1 p-1 text-ink-3 hover:text-ink transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Origin toggle */}
      <div className="mb-4">
        <OriginToggle active={origin} onChange={setOrigin} counts={originCounts} />
        {origin === "intl" && (
          /* Copy reflects the May 2026 currency-localisation pass:
             cards now show the user's local currency as the PRIMARY
             price across every surface (MasonryCard, ListCard,
             LiveResults, PDP ProductHero). Original ingest currency
             (usually USD for SerpAPI rows) appears as a secondary
             "≈ $X.xx in USD" hint underneath. Delivery + duties
             reminder kept because cross-border shopping still
             carries real cost on top of the listed price. */
          <p className="mt-2 text-[11px] sm:text-xs text-ink-3 px-1">
            Prices in {country.code === "ng" ? "₦" : country.currency} from international stores. Delivery and duties may apply on top of the listed price.
          </p>
        )}
      </div>

      {/* Sticky filter bar — categories + discount tiers + sort.

          Mobile layout (Option A, May 2026):
            Row 1: CategoryNav (horizontal scroll)  · Sort dropdown
            Row 2: tier pills · Stores filter

          Sort moves to Row 1 on mobile so it stays visible without
          scrolling the secondary row — previously on phones with
          many tier pills the sort dropdown ended up off-screen at
          the right edge of the overflow container, easy to miss.

          Desktop layout unchanged: Sort + deal count stay on the
          right of Row 2 where there's plenty of horizontal space.

          The sort dropdown JSX is inlined twice rather than extracted
          to a helper — duplication is small (~10 lines), avoids the
          render overhead of a tiny client subcomponent. */}
      <div className="sticky top-16 z-30 -mx-3 px-3 sm:-mx-6 sm:px-6 py-3 mb-6 bg-bg/85 backdrop-blur-xl border-b border-border">
        {/* Row 1 — CategoryNav (always full-width). The previous
            attempt to inline the mobile sort here overlapped the
            rightmost chip even with `overflow-hidden` because
            CategoryNav has internal `-mx-1` for its scroll
            affordance. Moving sort to its own row (below) is the
            cleaner fix (user report May 2026: "put the sort
            dropdown on its own line in mobile"). */}
        <CategoryNav active={category} onChange={setCategory} />

        {/* Mobile filter row — tier pills cluster shrink-0 on the
            left, Stores filter button expands to fill remaining
            width (was a tight chip with awkward empty space to its
            right). The cluster as a whole has overflow-x-auto so
            many tier pills can still scroll horizontally if needed,
            but in practice 4 tier buttons + sliders icon fit. */}
        <div className="mt-3 flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto no-scrollbar">
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
          {/* Stores filter takes the remaining width on mobile so
              the button reads as a full action surface (was a
              tight pill with empty space to the right). On desktop
              it stays inline-flex / intrinsic width since the
              right cluster (deal count + sort) sits beside it. */}
          {storeOptions.length > 0 && (
            <div className="flex-1 sm:flex-none ml-1.5">
              <StoreFilter
                stores={storeOptions}
                selected={selectedStores}
                onChange={setSelectedStores}
                fillRow
              />
            </div>
          )}

          {/* Right cluster — desktop only. Mobile sort lives in the
              view-mode toggle row right above the grid (grid/list
              left, sort right). */}
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0 ml-auto">
            {!loading && (
              <span className="text-xs text-ink-3 tabular-nums">
                {total.toLocaleString()} deals
              </span>
            )}

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort deals"
                className="appearance-none bg-surface-2 border border-border rounded-full pl-3.5 pr-8 py-1.5 text-[13px] text-ink hover:border-border-strong outline-none cursor-pointer transition-colors"
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

      {/* Category subscribe widget — appears whenever the user has
          narrowed to a specific category. Captures the email +
          category combo so the daily-digest pipeline (Phase 2) can
          send only matching deals. Hidden on the catch-all view
          where the homepage NewsletterStrip already covers signup. */}
      {category !== "all" && (() => {
        const activeCat = categories.find((c) => c.slug === category);
        if (!activeCat) return null;
        return (
          <CategorySubscribe
            categorySlug={activeCat.slug}
            categoryName={activeCat.name}
            categoryColor={activeCat.color}
          />
        );
      })()}

      {/* Mobile-only row above the grid: view-mode toggle on the
          LEFT, Sort dropdown on the RIGHT. Grouped together because
          both control how the grid below looks — feels like one
          "shape this view" line. */}
      <div className="flex items-center justify-between gap-3 mb-3 sm:hidden">
        <div
          role="group"
          aria-label="View mode"
          className="flex items-center gap-0.5 rounded-full bg-surface-2 border border-border p-0.5"
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

        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            aria-label="Sort deals"
            className="appearance-none bg-surface-2 border border-border rounded-full pl-3.5 pr-8 py-1.5 text-xs text-ink hover:border-border-strong outline-none cursor-pointer transition-colors"
          >
            {SORTS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-[10px]">▾</span>
        </div>
      </div>

      {/* Initial skeletons — same single-render approach as the
          loaded grid. 12 placeholder tiles is enough to fill the
          fold across all viewport sizes. */}
      {loading && (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
              <SkeletonTile aspect={MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]} />
            </div>
          ))}
        </div>
      )}

      {/* Single CSS-columns render — addresses Bucket 1#24 from QA
          audit. Previously rendered three full DOM copies (mobile /
          tablet / desktop) CSS-hidden via media queries; each card's
          <img> still fetched even when the parent was display:none,
          so the tab made 3× the network requests. Now: one DOM tree
          with responsive `columns-2 sm:columns-3 lg:columns-4`.
          break-inside-avoid keeps each card intact across columns.
          Mobile list-view stays separate because a list is always
          one column with different per-row layout. */}
      {!loading && items.length > 0 && (
        <>
          {viewMode === "list" && (
            <div className="flex flex-col gap-2 sm:hidden">
              {items.map((d, i) => (
                <AnimateIn key={d.id} delay={Math.min(i, 8) * 40}>
                  <ListCard deal={d} />
                </AnimateIn>
              ))}
            </div>
          )}
          <div
            className={cn(
              "columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]",
              viewMode === "list" && "hidden sm:block",
            )}
          >
            {items.map((d, i) => (
              <div key={d.id} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
                <AnimateIn delay={Math.min(i, 6) * 50}>
                  <MasonryCard
                    deal={d}
                    aspect={MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]}
                  />
                </AnimateIn>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state — layered recovery (URL paste, notify-me, browse).
          When the user has an active search query, lean into the
          recovery options. When the empty result is purely from filter
          combos (no search, just filters), keep the lighter "reset
          filters" affordance — the recovery flow doesn't fit there. */}
      {!loading && items.length === 0 && (
        /* Use the debounced search for empty-state branching —
           reflects what the server actually filtered against. */
        searchDebounced.trim() ? (
          <EmptySearchState query={searchDebounced.trim()} source="deals" />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search size={32} className="text-ink-3 mb-3" strokeWidth={1.5} />
            <h3 className="text-base font-medium text-ink mb-1">No deals match those filters</h3>
            <p className="text-sm text-ink-3 mb-5 max-w-sm">
              Try fewer filters, or browse a different category.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory("all"); setTier("all");
                setSearchInput(""); setSearchDebounced("");
                setOrigin("all");
              }}
              className="btn-secondary"
            >
              Reset filters
            </button>
          </div>
        )
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
