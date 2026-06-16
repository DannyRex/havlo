"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import CategoryNav from "./CategoryNav";
import OriginToggle from "./OriginToggle";
import ListCard from "./ListCard";
import MasonryCard from "./MasonryCard";
import StoreFilter, { type StoreOption } from "./StoreFilter";
import AnimateIn from "@/components/ui/AnimateIn";
import EmptySearchState from "@/components/empty/EmptySearchState";
import CategorySubscribe from "./CategorySubscribe";
import LiveResults from "@/components/compare/LiveResults";
import CompareAnchorCard from "@/components/compare/CompareAnchorCard";
import { useCountry } from "@/components/providers/CountryProvider";
import { cn, formatCount } from "@/lib/utils";
import { useHideOnScrollDown } from "@/lib/use-hide-on-scroll";
import { categories } from "@/lib/data/categories";
import { logSearchEvent } from "@/lib/search/log-search";
import type { Deal, DiscountTier, OriginFilter, SortOption } from "@/types";
import type { ProductGroup } from "@/lib/search";

type ViewMode = "grid" | "list";
const VIEW_STORAGE_KEY = "havlo:deals:viewMode";

const PAGE_SIZE = 24;

/* When a text search returns fewer than this many catalog results,
   DealFeed fans out to the live shopping providers. Founder direction
   May 2026: /deals triggers live search when the catalog is thin. */
const LIVE_SEARCH_THRESHOLD = 5;

/* The page is called Deals, so it LEADS with deals: the default tier is
   "10" (genuine markdowns, >=10% off), not "all". "All" is one tap away
   for browsing the full catalogue, and "Latest" (the newest sort) is the
   honest home for fresh, full-price arrivals. Keeping full-price items
   under a flat "Deals" header was the same quiet discount-theater the
   rest of the site avoids. DEFAULT_TIER is the single source of truth;
   it must agree with the server prefetch in deals/page.tsx and the
   isDefaultView check below or the SSR seed mismatches. */
/* "Deals" = any genuine markdown (discount > 0, sent as minDiscount=1
   since discount_percent is an integer so >=1 equals >0). This is the
   SAME definition the rest of the site uses for a deal (the all_deals
   precomputed column + the origin pills), so the homepage "Deals by
   category" tile count and this page's default view show the exact same
   number. Leading with the full catalogue under a Deals header was the
   quiet discount-theater the rest of the site avoids. "All products" is
   one tap to browse everything (full-price included); it sits LAST, away
   from "Deals", so it never reads as "all deals". DEFAULT_TIER is the
   single source of truth and must agree with the server prefetch in
   deals/page.tsx and isDefaultView below or the SSR seed mismatches. */
const DEFAULT_TIER: DiscountTier = "1";
const TIERS: { value: DiscountTier; label: string }[] = [
  { value: "1",   label: "Deals" },
  { value: "20",  label: "20%+" },
  { value: "50",  label: "50%+" },
  { value: "all", label: "All products" },
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
const VALID_TIERS = new Set<DiscountTier>(["all", "1", "10", "20", "30", "50"]);
const VALID_SORTS = new Set<SortOption>(["relevance", "newest", "discount", "popular", "price_asc", "price_desc"]);
const VALID_ORIGINS = new Set<OriginFilter>(["all", "local", "intl"]);

/* Confidence gate for the best-price comparison header.

   A search lands on /deals?search=… (Hero freeform search or in-page
   typing); we only want the "Best price across stores" card when the
   query clearly denotes ONE product, not a bare category or brand
   ("sneakers", "laptops", "adidas"). Two cheap, deterministic signals:
     1. >= 2 meaningful tokens. Single-token queries at this surface are
        overwhelmingly categories/brands — too broad for a single-product
        price claim. This is also the cheap pre-gate that skips the
        /api/compare call entirely for those (the common case).
     2. The anchor title contains a strong majority of the query tokens,
        i.e. the FTS top hit actually IS what they searched — guards
        against FTS latching onto a tangential product via one shared
        word.

   Moved client-side (was deals/page.tsx) when /deals became static — the
   header is now fetched on demand from /api/compare inside DealFeed. */
const COMPARE_STOPWORDS = new Set([
  "the", "a", "an", "for", "with", "and", "of", "in", "on", "new",
  "best", "cheap", "cheapest", "price", "prices", "deal", "deals", "buy", "sale",
]);
function tokenizeQuery(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
function meaningfulQueryTokens(s: string): string[] {
  return tokenizeQuery(s).filter((t) => !COMPARE_STOPWORDS.has(t));
}
function isConfidentProductQuery(search: string, anchorTitle: string, distinctStores: number): boolean {
  const qTokens = meaningfulQueryTokens(search);
  if (qTokens.length < 2) return false;
  const titleTokens = new Set(tokenizeQuery(anchorTitle));
  const hits = qTokens.filter((t) => titleTokens.has(t)).length;
  /* Tier the overlap requirement by corroboration. 2+ distinct stores
     carrying the SAME matched product is itself evidence the anchor is
     correct, so 60% token overlap is enough. A SINGLE-store anchor has
     no such corroboration, so require EVERY meaningful query token in the
     title — otherwise a generic-category match would headline a DIFFERENT
     brand as "best price we found". */
  const need = distinctStores >= 2 ? Math.ceil(qTokens.length * 0.6) : qTokens.length;
  return hits >= need;
}

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
  /* Stable rotation seed from the SSR page, reused for every load-more so
     the relevance order stays fixed for the whole scroll session and
     offsets never re-serve already-seen products (recycling fix). */
  initialSeed?:         string;
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
  /* True when the SSR /api/deals prefetch returned the degraded
     curated-Amazon fallback (a transient pool failure). Forces a client
     refetch on mount instead of seeding the bogus pool — see
     hasUsableInitial below. */
  initialDegraded?: boolean;
}

export default function DealFeed({
  initialSeed,
  initialItems,
  initialTotal,
  initialHasMore,
  initialOriginCounts,
  initialStoreOptions,
  initialDegraded,
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
  const initialTierRaw = searchParams.get("minDiscount") ?? DEFAULT_TIER;
  const initialTier = VALID_TIERS.has(initialTierRaw as DiscountTier)
    ? (initialTierRaw as DiscountTier)
    : DEFAULT_TIER;
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
  /* Default origin is "local" for every market.

     History:
       v1 — country-aware: NG → "all", others → "local".
       v2 — "local" everywhere. Anchored visitors in stores they
            already trust on first paint.
       v3 — "all" everywhere. Made thin-native markets look richer.
       v4 (current) — back to "local". Founder direction May 2026:
            "revert default selection to local." Trust + same-day
            stores beat catalogue-breadth perception for first
            impression. "All" tab is one tap away.

     The explicit ?origin= URL override always wins so deep-links
     from social / newsletters resolve as authored. */
  const initialOriginRaw = searchParams.get("origin");
  const initialOrigin: OriginFilter =
    initialOriginRaw && VALID_ORIGINS.has(initialOriginRaw as OriginFilter)
      ? (initialOriginRaw as OriginFilter)
      : "local";

  /* Initial state seeded from props. The page is now STATIC/ISR and
     always prefetches the DEFAULT deals view (origin=local, no
     category/tier/sort/search/stores) — searchParams don't exist at
     prerender time. So the seed is the DEFAULT view, baked into the
     statically-SSR'd fallback grid, and:
       • when the URL is ALSO the default view, the seed is authoritative
         for this URL → keep it + skip the mount fetch (no flicker), and
       • when the URL is filtered/searched (a deep link like
         /uk/deals?category=phones, or a Hero "?search=" landing), the
         seed is the wrong set for this URL → start in the skeleton and
         run the mount fetch to load the filtered set (skeleton → results).
     Legacy callers with no props fall back to empty + loading=true. */
  const seedProvided   = Array.isArray(initialItems);
  const seedItems      = initialItems ?? [];
  const seedHasContent = seedItems.length > 0;
  /* The default seed is usable when the prefetch responded with real
     content and wasn't the degraded curated-Amazon fallback. A degraded
     or empty seed forces the mount fetch (client-side recovery) so a
     transient pool blip never strands the page on an empty grid. */
  const seedIsTrustworthy = seedProvided && !initialDegraded && seedHasContent;
  /* True when the URL carries NO filters — the same default view the
     server prefetched. Only then is the seed authoritative for this URL. */
  const isDefaultView =
    initialCategory === "all" &&
    initialTier === DEFAULT_TIER &&
    initialSort === "relevance" &&
    initialSearch.trim() === "" &&
    initialStores.size === 0 &&
    initialOrigin === "local";
  const skipMountFetch = isDefaultView && seedIsTrustworthy;

  /* Seed items/total/hasMore from the server seed ALWAYS, so the client's
     first render equals the SSR fallback HTML — no flash on the default
     view, and no hydration mismatch if the page is ever served
     dynamically. On a filtered/searched URL the mount fetch runs
     immediately and `loading` starts true, so the skeleton (not the
     default seed) is what the user actually sees before the filtered set
     lands. */
  const [items, setItems]       = useState<Deal[]>(seedItems);
  const [total, setTotal]       = useState(initialTotal ?? 0);
  const [hasMore, setHasMore]   = useState(initialHasMore ?? false);
  /* loading=false only when we keep the default seed (default URL + good
     seed). Filtered/searched URLs and a bad seed start in the skeleton
     and let the mount fetch repopulate. */
  const [loading, setLoading]   = useState(!skipMountFetch);
  const [loadingMore, setLoadingMore] = useState(false);
  /* Track whether we've consumed the SSR'd initial fetch yet. The
     filter-change effect below skips its first run only when
     skipMountFetch is set (default URL + trustworthy seed) — so the user
     doesn't see a content → skeleton → content flicker on the default
     view. Any other URL leaves this true, so the mount fetch runs. */
  const hasConsumedInitialRef = useRef(!skipMountFetch);

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
    useState<{
      all: number; local: number; intl: number;
      allDeals?: number; localDeals?: number; intlDeals?: number;
    } | undefined>(skipMountFetch ? initialOriginCounts : undefined);
  /* Did-you-mean suggestions returned by /api/deals when the result
     list is empty AND a search query is present. Populates the
     pills on EmptySearchState. Empty array = no pills, falls back
     to the bare "Nothing found" heading. */
  const [suggestions, setSuggestions] = useState<Array<{ title: string; key: string }>>([]);
  /* Live-search fallback state. When a catalog search returns fewer
     than LIVE_SEARCH_THRESHOLD results, DealFeed fans out to the live
     shopping providers (/api/live-search) — both to show the user
     options and so the route persists those results into the catalog
     for the next search. Rendered below the grid via <LiveResults>. */
  const [liveItems, setLiveItems]         = useState<Deal[]>([]);
  const [liveLoading, setLiveLoading]     = useState(false);
  const [liveProviders, setLiveProviders] = useState<string[]>([]);
  /* Best-price comparison header, fetched client-side from /api/compare
     for the active search (was an SSR prop before /deals went static).
     null = no header. The fetch is gated by isConfidentProductQuery so a
     bare category/brand search never headlines a single-product price
     card; the >=2-token pre-check also skips the network call entirely
     for single-word searches (the common case). */
  const [comparison, setComparison] =
    useState<{ anchor: ProductGroup; query: string } | null>(null);
  /* Race guard for the comparison fetch — a newer search bumps this so
     stale responses bail instead of clobbering a fresher result. */
  const compareSeqRef = useRef(0);
  /* Selected store IDs from the StoreFilter popover. Persists to URL
     via buildParams (?stores=argos,currys). */
  const [selectedStores, setSelectedStores] = useState<Set<string>>(initialStores);
  /* Country-switch state re-sync. The page.tsx server component
     already passes a fresh `key={country.code}` so DealFeed
     SHOULD re-mount on country change — but in practice Suspense
     can keep the old instance mounted while the new server
     render fetches, so the key change doesn't always trigger
     re-mount. Belt-and-braces: explicitly re-read URL params
     and reset filter state when country.code changes. Skip the
     first run (initial mount uses useState(initial...) values
     which are already correct).

     Audit May 2026: switching from /uk/deals?category=phones to
     NG via the dropdown landed at /ng/deals?origin=local —
     ?category=phones was silently dropped because the OLD
     DealFeed instance kept its state (category="phones" was
     wiped to "all" on the URL-sync write back to the new
     country's URL). With this re-sync, switching country
     re-reads the URL params (which CountryProvider preserved)
     and state stays correct. */
  const countryRef = useRef(country.code);
  useEffect(() => {
    if (countryRef.current === country.code) return;
    countryRef.current = country.code;
    /* Re-read every filter from the live URL. CountryProvider
       preserves search params on country switch, so any
       category / tier / sort / search / origin / stores in the
       URL survives and we just sync state to it. */
    const newCategoryRaw = searchParams.get("category") ?? "all";
    const newCategory    = validCategorySlugs.has(newCategoryRaw) ? newCategoryRaw : "all";
    setCategory(newCategory);
    const newTierRaw = searchParams.get("minDiscount") ?? DEFAULT_TIER;
    setTier(VALID_TIERS.has(newTierRaw as DiscountTier) ? (newTierRaw as DiscountTier) : DEFAULT_TIER);
    const newSortRaw = searchParams.get("sort") ?? "relevance";
    setSort(VALID_SORTS.has(newSortRaw as SortOption) ? (newSortRaw as SortOption) : "relevance");
    const newSearch = searchParams.get("search") ?? "";
    setSearchInput(newSearch);
    setSearchDebounced(newSearch);
    const newOriginRaw = searchParams.get("origin");
    const newOrigin: OriginFilter =
      newOriginRaw && VALID_ORIGINS.has(newOriginRaw as OriginFilter)
        ? (newOriginRaw as OriginFilter)
        : "local";
    setOrigin(newOrigin);
    const newStoresRaw = searchParams.get("stores") ?? "";
    setSelectedStores(new Set(
      newStoresRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    ));
    /* Force a re-fetch by un-consuming the initial guard. The
       useEffect on buildParams will see new values and run
       /api/deals against the new country. */
    hasConsumedInitialRef.current = true;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [country.code]);

  /* All stores currently available in the filtered pool. Comes back
     in the /api/deals response alongside items + counts. Empty until
     the first fetch lands. */
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>(skipMountFetch ? (initialStoreOptions ?? []) : []);

  /* Mobile-only view-mode toggle (grid masonry vs list rows). Tablet +
     desktop always show masonry — toggle UI is hidden via sm:hidden.
     Default: grid. Persisted in localStorage so the user's choice
     sticks across sessions. */
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  /* Mobile headroom: the sticky filter bar slides up behind the navbar on
     scroll-DOWN and reappears on scroll-UP; desktop stays pinned. The ref
     lets the hook hide it only once it's actually pinned, so translating
     it up never leaves a gap above the grid. */
  const filterBarRef = useRef<HTMLDivElement>(null);
  const filtersHidden = useHideOnScrollDown(filterBarRef);

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

  /* Resolve the best-price comparison header for the active search. Fires
     on the DEBOUNCED search so it tracks both a Hero "?search=" deep-link
     (initialSearch seeds searchDebounced) and in-page typing. Cheap
     pre-gate: skip the /api/compare call unless the query has >=2
     meaningful tokens (single-word searches are categories/brands the
     confidence gate would reject anyway). The seq guard drops stale
     responses when the search moves on, and the call reuses /api/compare's
     1h edge cache. */
  useEffect(() => {
    const q = searchDebounced.trim();
    if (!q || meaningfulQueryTokens(q).length < 2) {
      setComparison(null);
      return;
    }
    const seq = ++compareSeqRef.current;
    fetch(`/api/compare?q=${encodeURIComponent(q)}&country=${country.code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (seq !== compareSeqRef.current) return;
        if (!data || data.mode !== "similar" || !data.anchor) {
          setComparison(null);
          return;
        }
        const anchor = data.anchor as ProductGroup;
        const distinctStores = new Set((anchor.offers ?? []).map((o) => o.storeId)).size;
        /* single-store OK (the header reads "Best price we found"); the
           confidence gate stops a tangential FTS match from headlining. */
        if (distinctStores < 1 || !isConfidentProductQuery(q, anchor.title, distinctStores)) {
          setComparison(null);
          return;
        }
        setComparison({ anchor, query: q });
      })
      .catch(() => {
        if (seq === compareSeqRef.current) setComparison(null);
      });
  }, [searchDebounced, country.code]);

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
    /* API fetch: "all" means no discount filter; every other tier
       (including the default "10"/Deals) sends minDiscount so the fetch
       and the load-more pages stay scoped to the selected view. */
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
    /* Pin the relevance rotation to the SSR-captured seed so every page
       of this session shares one order — no recycling across offsets. */
    if (initialSeed) p.set("seed", initialSeed);
    return p.toString();
  }, [category, tier, sort, searchDebounced, origin, selectedStores, country.code, initialSeed]);

  /* Sparse-search live fallback — fired from the main fetch effect
     when a text search returns a thin catalog (< LIVE_SEARCH_THRESHOLD
     rows). /api/live-search returns live provider results AND persists
     them so the next search resolves from the DB. `seq` is the
     fetchSeqRef value of the triggering fetch; a newer search bumps
     fetchSeqRef and the handlers below bail so stale live results
     never clobber a fresher search. */
  const fetchLiveDeals = useCallback((q: string, seq: number) => {
    setLiveLoading(true);
    setLiveItems([]);
    setLiveProviders([]);
    fetch(`/api/live-search?q=${encodeURIComponent(q)}&country=${country.code}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then(({ items: live, providers }) => {
        if (seq !== fetchSeqRef.current) return;
        setLiveItems(Array.isArray(live) ? (live as Deal[]) : []);
        setLiveProviders(Array.isArray(providers) ? (providers as string[]) : []);
      })
      .catch(() => { if (seq === fetchSeqRef.current) setLiveItems([]); })
      .finally(() => { if (seq === fetchSeqRef.current) setLiveLoading(false); });
  }, [country.code]);

  // Reset + first page on filter change
  useEffect(() => {
    /* SSR'd-content optimisation: skip the very first effect run when
       page.tsx pre-fetched and passed initialItems. The state is
       already populated; re-fetching here would clear items + show
       the skeleton, defeating the SSR-prefetch entirely. From the
       SECOND run onward (any filter change) we behave as before. */
    if (!hasConsumedInitialRef.current) {
      hasConsumedInitialRef.current = true;
      /* Sync offsetRef to the ACTUAL initialItems length, not the
         hardcoded PAGE_SIZE. SSR may seed more (or fewer) than
         PAGE_SIZE — re-audit May 2026 bumped SSR fetch to 60 for
         crawler/audit visibility while keeping client PAGE_SIZE at
         24 for subsequent scrolls. Without this sync, next loadMore
         would re-fetch items already on screen. */
      offsetRef.current = initialItems?.length ?? PAGE_SIZE;
      /* SSR-prefetch path: page.tsx already fetched the catalog, so
         the client re-fetch is skipped. But a search deep-link, a
         shared /deals?search=... URL, and the homepage / compare
         "freeform text -> /deals" navigations all land here too — and
         if the SSR'd catalog came back thin, the live fallback must
         still fire, or the user sees a bare empty grid. fetchSeqRef
         is still 0 here; a later real search bumps it and the stale
         guard inside fetchLiveDeals drops this result. */
      /* All-origins catalog count (initialOriginCounts.all), not the
         origin-filtered initialItems length — see the fetch effect
         below for why a common product must not trigger live search. */
      const ssrCatalogCount = initialOriginCounts?.all ?? (initialItems?.length ?? 0);
      if (searchDebounced.trim() && ssrCatalogCount < LIVE_SEARCH_THRESHOLD) {
        fetchLiveDeals(searchDebounced.trim(), fetchSeqRef.current);
      }
      return;
    }

    const mySeq = ++fetchSeqRef.current;
    setLoading(true);
    setItems([]);
    /* Clear any live-search results from the previous query so they
       don't linger under a fresh search's catalog grid. */
    setLiveItems([]);
    offsetRef.current = 0;

    fetch(`/api/deals?${buildParams(0)}`)
      .then((r) => r.json())
      .then(({ items, total, hasMore, originCounts, stores, suggestions, error }) => {
        /* Bail if a newer fetch has started since we kicked off —
           prevents stale results from clobbering newer ones. */
        if (mySeq !== fetchSeqRef.current) return;
        if (error) return;
        setItems(items);
        setTotal(total);
        setHasMore(hasMore);
        /* Did-you-mean pills — populated by /api/deals when the
           displayed list is empty AND a search query is present.
           Empty otherwise so the EmptySearchState falls back to its
           non-suggestion variant cleanly. */
        setSuggestions(Array.isArray(suggestions) ? suggestions : []);
        /* Log this search to search_query_log when a search query
           is present. Captures both zero-result misses (catalog gap
           signal) and successful resolutions (popularity signal).
           Skipped for pure filter-browse (no search query) since
           that's not a search event. */
        if (searchDebounced.trim()) {
          logSearchEvent({
            query: searchDebounced.trim(),
            surface: "deals",
            mode: "text",
            resultCount: typeof total === "number" ? total : 0,
          });
        }
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
        /* Sparse-search live fallback — when a text search is a genuine
           catalog gap, fan out to the live providers. /api/live-search
           also persists the results so the next search resolves from
           the DB. mySeq guards against a newer search clobbering.

           Gate on the ALL-origins catalog count (originCounts.all), NOT
           items.length — items is origin-filtered, so a common product
           like "iphone" looks thin on the Local tab while the catalog
           holds dozens. Firing a live search there would burn a SerpAPI
           credit re-finding products we already have. Only a real gap
           (few results across every origin) should trigger it. */
        const catalogCount = originCounts?.all ?? (Array.isArray(items) ? items.length : 0);
        if (searchDebounced.trim() && catalogCount < LIVE_SEARCH_THRESHOLD) {
          fetchLiveDeals(searchDebounced.trim(), mySeq);
        } else {
          setLiveItems([]);
          setLiveLoading(false);
          setLiveProviders([]);
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
    /* Default tier (Deals) stays OUT of the URL so the default view keeps
       a clean, cacheable, shareable URL; "All" and the deeper tiers are
       written. The API fetch above still scopes to minDiscount=10. */
    if (tier !== DEFAULT_TIER) params.set("minDiscount", tier);
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
        /* Dedup appended items against what's already shown — belt-and-
           suspenders so the feed can NEVER visibly recycle even if the pool
           order ever shifts under us (e.g. a stale edge-cache entry built
           with a different seed). The stable session seed is the real fix;
           this guarantees the user never sees a card twice. */
        setItems((prev) => {
          const seen = new Set(prev.map((d) => d.id));
          const fresh = (more as Deal[] | undefined ?? []).filter((d) => !seen.has(d.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
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

  /* Counts for the ACTIVE origin tab. originCounts carries all three
     origin slices (all / local / intl, each with an optional on-sale
     sub-count) in one payload, and its STATE is gated-stable across
     origin tab clicks (see originCountsKeyRef). Indexing it by the
     active origin gives the header + toolbar a figure that matches
     the highlighted tab without the per-request flicker that made the
     all-origins number the prior choice. */
  const activeCounts: { total: number; deals?: number } | undefined =
    !originCounts
      ? undefined
      : origin === "local"
        ? { total: originCounts.local, deals: originCounts.localDeals }
        : origin === "intl"
          ? { total: originCounts.intl, deals: originCounts.intlDeals }
          : { total: originCounts.all, deals: originCounts.allDeals };

  /* Show the comparison header only while the on-page search box still
     holds the query the fetched comparison resolved from. Editing or
     clearing the search drops the now-stale card (the effect above
     clears or replaces `comparison` as searchDebounced changes). Trimmed
     + lower-cased so trivial differences don't flicker the card. */
  const showComparisonHeader =
    !!comparison &&
    searchDebounced.trim().toLowerCase() === comparison.query.trim().toLowerCase();

  /* Distinct stores behind the comparison anchor. Drives the header
     copy: a single-store anchor reads "Best price we found" rather than
     falsely implying a cross-store comparison. (The card's own rows
     already say "Available at" vs "Across N stores", and hide the
     "Save up to X" spread when there's only one store.) */
  const comparisonStoreCount = comparison
    ? new Set((comparison.anchor.offers ?? []).map((o) => o.storeId)).size
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">

      {/* Header — country-aware. Was hardcoded "Nigerians already
          shop" which read wrong on /uk/deals, /us/deals, etc. Now
          uses the country's name + a generic "shoppers" so the
          subhead localises automatically. */}
      <div className="mb-6 sm:mb-8 px-1 sm:px-0">
        <h1 className="text-[28px] sm:text-4xl font-bold text-ink tracking-[-0.03em] leading-tight">
          Browse deals & new arrivals
        </h1>
        <p className="text-sm sm:text-base text-ink-2 mt-2 max-w-2xl">
          The newest deals first, then everything else.
        </p>
        {activeCounts?.deals !== undefined && activeCounts.total > 0 && (
          /* Deal-count summary on its own line — separate paragraph
             so the metric breathes instead of crowding the subhead.
             Origin-scoped (activeCounts) so it agrees with the active
             tab and the toolbar count — see the B1 regression fix.

             Copy fix (May 2026): old phrasing was "X on sale of Y
             total" which implied all Y items were part of a sale.
             They aren't — Y is the whole browsable catalog (includes
             pharmacy / grocery / Shopify feeds at retail price);
             X is the subset with a real discount. Reframed as two
             facts joined by an interpunct so neither claims the
             other: total catalog size, then "of which N are
             discounted". Handles the degenerate edge cases (deals=0
             and deals=total) so the copy never lies. */
          /* Copy semantics (May 2026 audit):
               - Lead with the total. The page is "Browse deals +
                 new arrivals" — total reflects the full catalog
                 the user is browsing, including non-discounted feeds.
               - Mention the discounted subset only when it's a real
                 subset (strictly less than total AND > 0). The
                 "all on sale" branch was overclaiming because the
                 prior count used is_deal=true, which the May 2026
                 audit relaxed to mean "valid catalog row" — making
                 deals == total a normal browse state, not a
                 "today's a great day" signal.
               - When the subset isn't meaningful (0 or equal to
                 total), just show the total without an
                 interpretation. Honest framing over filler claims. */
          <p className="text-xs sm:text-sm text-ink-3 mt-2 tabular-nums">
            {activeCounts.deals === undefined || activeCounts.deals === 0 || activeCounts.deals >= activeCounts.total
              ? `Browsing ${formatCount(activeCounts.total)} products today.`
              : <>Browsing {formatCount(activeCounts.total)} products · {formatCount(activeCounts.deals)} on sale right now.</>}
          </p>
        )}
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
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" aria-hidden="true" />
        <label htmlFor="deals-search" className="sr-only">
          Search deals
        </label>
        <input
          id="deals-search"
          type="text"
          aria-label="Filter these deals by product name. Use the Stores button above to filter by store."
          placeholder="Search these deals, try 'iPhone'…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            /* Enter now commits the current filter and dismisses the
               keyboard (mobile) instead of teleporting the user to
               /compare. Previous behaviour: pressing Enter routed
               to /compare?q={input}&mode=similar — which contradicted
               the visual model (input filters this page as you type)
               and surprised users who expected Enter to mean "I'm
               done typing". User report May 2026: "search for a
               product on deals page, it filters the results on that
               page, but when I hit enter, it takes me to compare
               page. could that be confusing?"

               Cross-store comparison is still reachable via any
               product card → PDP → "Compare prices across N stores"
               CTA, which is the canonical drill-down. */
            if (e.key === "Enter") {
              e.preventDefault();
              /* Bypass the 300ms debounce so the filter snaps
                 immediately (no perceptible delay if the user types
                 then hits Enter quickly). Blurring also closes the
                 on-screen keyboard on mobile. */
              setSearchDebounced(searchInput.trim());
              (e.target as HTMLInputElement).blur();
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
      {/* Filter microcopy removed June 2026: redundant noise; the input
          placeholder + behaviour are self-evident. */}

      {/* Best-price-across-stores header. Appears when the active search
          (a Hero freeform "?search=" landing or in-page typing) resolves
          to a confident single product via the client /api/compare fetch
          above, and the filter box still holds that query. Reuses the
          /compare anchor card; dupes are [] here because the grid below
          already IS the "more matches" surface, so the card stays a
          pure price-comparison header rather than sprouting its own
          alternatives connector. */}
      {showComparisonHeader && comparison && (
        <div className="mb-2">
          <p className="max-w-3xl mx-auto text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3 mb-3 px-1">
            {comparisonStoreCount >= 2 ? "Best price across stores" : "Best price we found"}
          </p>
          <CompareAnchorCard
            anchor={comparison.anchor}
            dupes={[]}
            country={country}
            query={comparison.query}
          />
        </div>
      )}

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

      {/* Origin toggle. onChange also clears selectedStores because
          the store dropdown is now origin-scoped (migration 0044) —
          a local-tab selection like "Konga" doesn't apply on the
          cross-border tab, and silently keeping it would leave the
          items grid filtered to a non-existent intersection. */}
      <div className="mb-4">
        <OriginToggle
          active={origin}
          onChange={(next) => { setOrigin(next); setSelectedStores(new Set()); }}
          counts={originCounts}
        />
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
      {/* Sticky filter row with mobile HEADROOM: position:sticky pins it
          under the navbar once scrolled to the top; on mobile it then
          slides up behind the navbar on scroll-DOWN (-translate-y-full,
          which tucks under the opaque z-40 navbar, no overshoot) and
          reappears on scroll-UP. Desktop (sm+) stays pinned. */}
      <div
        ref={filterBarRef}
        className={cn(
          "sticky top-16 z-30 -mx-3 px-3 sm:-mx-6 sm:px-6 py-3 mb-6 bg-bg border-b border-border",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          filtersHidden ? "-translate-y-full sm:translate-y-0" : "translate-y-0",
        )}
      >
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
        <div className="mt-3 flex items-center gap-1 sm:gap-3">
          {/* Mobile: this pill cluster is the flexible element (flex-1 +
              min-w-0) so it absorbs all the leftover row width and lets its
              own overflow-x-auto scroll the pills when they don't fit — the
              Stores button beside it then keeps its natural, legible width.
              (Was flex-shrink-0, which forced the cluster to full content
              width and shoved Stores ≈26px off the right edge on a 375px
              viewport.) Desktop reverts to intrinsic width (sm:flex-none) so
              it stays compact-left with the count+sort cluster on the right.
              Pills stay flex-shrink-0 so they keep their labels and the row
              scrolls cleanly instead of squishing. */}
          <div className="flex items-center gap-0.5 min-w-0 flex-1 sm:flex-none overflow-x-auto no-scrollbar">
            <SlidersHorizontal size={13} className="text-ink-3 mr-1 flex-shrink-0" />
            {TIERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTier(value)}
                className={`px-2 py-1 flex-shrink-0 rounded-full text-[12px] sm:text-xs whitespace-nowrap transition-colors ${
                  tier === value
                    ? "bg-ink text-bg font-semibold"
                    : "text-ink-2 hover:text-ink hover:bg-surface-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Stores filter holds its natural width (flex-none) on both
              mobile and desktop; the tier-pill cluster to its left is the
              flexible element that fills the row, so "Stores ▾" never gets
              squeezed narrow enough to clip its chevron. */}
          {storeOptions.length > 0 && (
            <div className="flex-none">
              <StoreFilter
                stores={storeOptions}
                selected={selectedStores}
                onChange={setSelectedStores}
                fillRow
              />
            </div>
          )}

          {/* Right cluster — desktop only. Mobile sort lives in the
              view-mode toggle row below (still inside this sticky bar,
              grid/list left, sort right). */}
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0 ml-auto">
            {!loading && (
              <span className="text-xs text-ink-3 tabular-nums">
                {/* Origin-scoped count — reflects the active
                    All/Local/Intl tab so the toolbar agrees with the
                    highlighted tab. Regression B1: on the Local tab
                    this read the all-origins 8,125 while the tab
                    itself showed 2,673.

                    This does NOT bring back the per-tab-click flicker
                    the all-origins figure once dodged: originCounts
                    STATE is gated-stable across origin clicks (see
                    originCountsKeyRef) — it refreshes only when
                    category/tier/sort/search/country change, never on
                    an origin click. Switching tabs re-indexes an
                    already-stable slice rather than chasing a
                    per-request number. Falls back to `total` before
                    originCounts populates. */}
                {formatCount(activeCounts?.total ?? total)} deals
              </span>
            )}

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort deals"
                className="appearance-none border border-border bg-surface-2 rounded-full pl-3.5 pr-8 py-1.5 text-[13px] text-ink hover:border-border-strong outline-none cursor-pointer transition-colors"
              >
                {SORTS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-[10px]">▾</span>
            </div>
          </div>
        </div>

        {/* Mobile-only "shape this view" row — view-mode toggle (left)
            + Sort (right). Lives INSIDE the sticky bar so the sort stays
            pinned while scrolling, matching the CategoryNav above (June
            2026 fix: it was a separate non-sticky row that scrolled away).
            Desktop's sort sits in the row above, so this is sm:hidden. */}
        <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
          <div
            role="group"
            aria-label="View mode"
            className="flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5"
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
              className="appearance-none border border-border bg-surface-2 rounded-full pl-3.5 pr-8 py-1.5 text-xs text-ink hover:border-border-strong outline-none cursor-pointer transition-colors"
            >
              {SORTS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-[10px]">▾</span>
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
          />
        );
      })()}

      {/* Initial skeletons — match the loaded grid shape exactly so
          there's zero layout shift when items resolve. CSS Grid at
          every breakpoint (NOT CSS columns) so the visible fill is
          row-major: tile 0 col-1 row-1, tile 1 col-2 row-1, tile 2
          col-1 row-2, etc. Uniform aspect-[4/5] keeps every row's
          height predictable, eliminating the whitespace-gap visual
          that earlier multi-column masonry produced on mobile. */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <SkeletonTile aspect="aspect-[4/5]" />
            </div>
          ))}
        </div>
      )}

      {/* Row-major CSS Grid at every breakpoint.
          May 2026 user report: "on mobile, the deals grid is split
          in two but the sort is column 1 vertically and then column 2
          sorted vertically. The results should come row by row."
          Cause: previous layout used `sm:columns-N` (CSS multi-column,
          column-major fill — items 0,1,2 go down col 1, then 3,4,5
          down col 2). Variable aspect ratios across MASONRY_ASPECTS
          also produced whitespace gaps below shorter cards on mobile
          `grid grid-cols-2`, which read as column-major to users.
          Fix: switch to CSS Grid at every breakpoint AND force a
          uniform aspect ratio on every card so each row's height is
          predictable. Trade-off: loses the masonry pack-tightly
          visual, but row-major sortability matters more for catalog
          browsing than visual variance.
          Homepage TrendingDealsGrid still uses multi-column masonry —
          variance there is part of the brand visual, not a sort-
          ability concern. */}
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
              "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4",
              viewMode === "list" && "hidden sm:grid",
            )}
          >
            {items.map((d, i) => (
              <div key={d.id}>
                <AnimateIn delay={Math.min(i, 6) * 50}>
                  <MasonryCard
                    deal={d}
                    aspect="aspect-[4/5]"
                    /* First 4 cards are the LCP candidates on every
                       viewport — single column mobile (1 above-fold),
                       2 col tablet, 4 col desktop. Mark them priority
                       so the browser fetches with `fetchPriority="high"`
                       and `loading="eager"`. Remaining cards stay
                       lazy. Real PSI lift: shifts LCP from "first card"
                       to "page header" on cold loads, ~300-600ms
                       improvement on slow networks. */
                    priority={i < 4}
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
           reflects what the server actually filtered against.
           Did-you-mean suggestions come from /api/deals via the
           trigram-similarity RPC and are rendered as the headline
           recovery path when present. */
        searchDebounced.trim() ? (
          /* Hold the empty state while the live-search fallback is
             still running or has results — otherwise it flashes
             "nothing found" before the live section paints below. */
          (!liveLoading && liveItems.length === 0) ? (
            <EmptySearchState
              query={searchDebounced.trim()}
              source="deals"
              suggestions={suggestions}
            />
          ) : null
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
                setSelectedStores(new Set());
              }}
              className="btn-secondary"
            >
              Reset filters
            </button>
          </div>
        )
      )}

      {/* Sparse-search live results — rendered below the catalog grid
          when a thin search triggered the live fallback. Reuses the
          /compare LiveResults component; its cards route through
          pdpUrlForDeal so live rows get a synthetic /p/live PDP and
          never dead-link. */}
      {searchDebounced.trim() && (liveLoading || liveItems.length > 0) && (
        <LiveResults items={liveItems} loading={liveLoading} providers={liveProviders} />
      )}

      {/* Sentinel */}
      {!loading && hasMore && <div ref={sentinelRef} className="mt-10" />}

      {/* Load-more spinner */}
      {loadingMore && (
        <div className="flex justify-center mt-8">
          <div className="w-6 h-6 rounded-full border-2 border-border border-t-brand animate-spin" />
        </div>
      )}

      {/* End of feed. The active pill (activeCounts.total) is the accurate
          reachable count (precomputed); the grid renders the top-by-discount
          band of the shallow display pool. For a few mega categories the
          count exceeds the rendered cards, so disclose that honestly instead
          of claiming "that's all" — the numbers must never contradict the
          pill above. */}
      {!loading && !hasMore && items.length > 0 && liveItems.length === 0 && !liveLoading && (
        <p className="text-center text-xs text-ink-3 mt-12">
          {activeCounts && activeCounts.total > total + 24
            ? `Showing the top ${formatCount(total)} of ${formatCount(activeCounts.total)}. Filter by category or store to surface more.`
            : `That's all ${formatCount(activeCounts?.total ?? total)} deals for now.`}
        </p>
      )}
    </div>
  );
}
