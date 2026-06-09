"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchX, CheckCircle, AlertCircle, Coins } from "lucide-react";
import Link from "next/link";
import SearchBar from "@/components/compare/SearchBar";
import PriceResults from "@/components/compare/PriceResults";
import CompareAnchorCard from "@/components/compare/CompareAnchorCard";
import ImageSearchButton from "@/components/search/ImageSearchButton";
import DupeMasonry from "@/components/compare/DupeMasonry";
import LiveResults from "@/components/compare/LiveResults";
import EmptySearchState from "@/components/empty/EmptySearchState";
import TrendingChipRail from "@/components/compare/TrendingChipRail";
import { formatNaira } from "@/lib/utils";
import { sniffToAnchor } from "@/lib/sniff-to-anchor";
import { getCashbackForUrl } from "@/lib/cashback";
import { logSearchEvent } from "@/lib/search/log-search";
import { useCountry } from "@/components/providers/CountryProvider";
import type { SearchOutput, DupeResult } from "@/lib/search";
import type { SniffResult } from "@/app/api/sniff/route";
import type { Deal } from "@/types";

/** Mirrors the check in url-parser.ts — avoids importing server code here. */
function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  return /^https?:\/\//i.test(t) || /^(www\.|[a-z]+\.(com|ng|co))/i.test(t);
}

/* Paid-live gate (June 2026). The free AliExpress teaser always runs,
   but the PAID Google Shopping (SerpAPI) lane only fires when our own
   catalog couldn't already assemble a useful cross-store comparison.
   dbAltCount() reports how many alternative offers /api/compare found;
   at/above this many, the DB answers the query for free and we skip the
   credit. Below it (long-tail products, or blocked-store pastes the
   catalog doesn't cover yet) the paid lane runs, and its persist step
   back-fills the catalog so the NEXT search resolves for free. */
const MIN_DB_ALTERNATIVES = 3;
function dbAltCount(out: SearchOutput | null | undefined): number {
  if (!out) return 0;
  /* Count the store options the user already sees for free: the anchor
     product's own cross-store offers PLUS any alternative products
     (dupes). A well-deduped flagship often has 0 dupes but many anchor
     offers — that's still a real comparison, so it must count or we'd
     pay SerpAPI for a product the catalog already covers. */
  if (out.mode === "similar") return (out.anchor?.offers.length ?? 0) + out.dupes.length;
  if (out.mode === "single")  return out.group.offers.length;
  return 0;
}

export default function CompareContent({
  initialResult,
}: {
  /* Server-seeded internal comparison result for a deep-linked
     key=/q=/oid= URL (see ./page.tsx). null → the client runs its own
     mount fetch, exactly as before. */
  initialResult?: SearchOutput | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { country } = useCountry();
  const initialQuery = searchParams.get("q") ?? "";
  const initialKey   = searchParams.get("key") ?? "";
  /* Chip click backstop. When the user clicks a homepage / compare
     chip, the URL carries both q= (for shareability + display) and
     pid= (the product_id direct-lookup fallback). Forwarded to
     /api/compare so the API can short-circuit empty FTS results. */
  const initialPid   = searchParams.get("pid") ?? "";
  /* oid= — offer-id backstop. PDP "Compare prices" CTA passes this
     so /api/compare can synthesise an anchor from the offer when
     pid + FTS both miss (synthetic-id products, unusual titles,
     etc.). See /api/compare/route.ts oid-fallback for details. */
  const initialOid   = searchParams.get("oid") ?? "";

  const [query, setQuery]             = useState(initialQuery);
  const [result, setResult]           = useState<SearchOutput | null>(initialResult ?? null);
  const [loading, setLoading]         = useState(false);
  const [sniffResult, setSniffResult] = useState<SniffResult | null>(null);
  const [sniffLoading, setSniffLoading] = useState(false);
  const [liveResults, setLiveResults]   = useState<Deal[]>([]);
  const [liveLoading, setLiveLoading]   = useState(false);
  const [liveProviders, setLiveProviders] = useState<string[]>([]);
  /* Guards fetchLive against the StrictMode double-invoke and rapid
     re-search firing the same live query twice. A duplicate live
     search also spawns a duplicate server-side persist run — the
     concurrency that orphaned products in the catalog. */
  const lastLiveQueryRef = useRef<string>("");
  /* Guards the two-phase live fetch: once the FULL (authoritative)
     response lands for a query, a late-arriving free-tier teaser must
     not overwrite it. Reset at the start of each fetchLive. */
  const fullDoneRef = useRef<boolean>(false);

  /* True only on the very first mount when the server SSR-seeded
     `result`. Flipped off in the URL-load effect after we skip the
     redundant client refetch. Mirrors DealFeed's hasConsumedInitialRef. */
  const hasInitialResultRef = useRef<boolean>(initialResult != null);

  /* ── Fetch live results alongside the internal (DB) search ──
     `dbAltsPromise` resolves to the number of cross-store alternatives
     /api/compare found for this query. The PAID Google Shopping lane is
     gated on it: when the catalog already answers (>= MIN_DB_ALTERNATIVES),
     we skip the SerpAPI credit and let the free teaser + DB comparison
     stand. Omit it (or a thin/failed DB result) to force the paid lane. */
  const fetchLive = useCallback(async (q: string, dbAltsPromise?: Promise<number>) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    /* Skip a back-to-back identical live query (the double-fire). A
       genuinely new query always differs from the immediately
       previous one, so this only collapses true duplicates. */
    if (lastLiveQueryRef.current === trimmed) return;
    lastLiveQueryRef.current = trimmed;
    fullDoneRef.current = false;
    setLiveLoading(true);
    setLiveResults([]);
    setLiveProviders([]);

    const enc = encodeURIComponent(trimmed);
    const stillCurrent = () => lastLiveQueryRef.current === trimmed;

    /* Phase 1 (tier=free) — AliExpress only, no SerpAPI, no persist.
       Spends no credit, returns in ~0.5s, paints the section fast.
       ALWAYS runs. */
    const teaser = fetch(`/api/live-search?q=${enc}&limit=12&tier=free&trusted=1`)
      .then((r) => r.json())
      .then((data) => {
        /* Apply the teaser only if it's still the active query AND the
           full result hasn't already landed (full always wins). */
        if (!stillCurrent() || fullDoneRef.current) return;
        if (Array.isArray(data.items) && data.items.length > 0) {
          setLiveResults(data.items as Deal[]);
        }
      })
      .catch(() => { /* best-effort; phase 2 below is authoritative */ });

    /* Phase 2 (full) — the PAID pipeline (SerpAPI + DB write-back).
       Only fire it when our own catalog couldn't already answer: a
       thin/empty DB result (alts < MIN_DB_ALTERNATIVES) or no DB context
       at all. When the DB already covers the product we never spend the
       credit — the free teaser + the DB comparison rows are enough. */
    let runPaid = true;
    if (dbAltsPromise) {
      try { runPaid = (await dbAltsPromise) < MIN_DB_ALTERNATIVES; }
      catch { runPaid = true; }
    }
    if (!stillCurrent()) return; // superseded while awaiting the DB count

    const full = runPaid
      ? fetch(`/api/live-search?q=${enc}&limit=12&trusted=1`)
          .then((r) => r.json())
          .then((data) => {
            if (!stillCurrent()) return;
            fullDoneRef.current = true;
            setLiveResults(Array.isArray(data.items) ? (data.items as Deal[]) : []);
            setLiveProviders(Array.isArray(data.providers) ? (data.providers as string[]) : []);
          })
          /* If the full request fails, KEEP whatever the teaser already
             painted rather than wiping it — graceful degradation. */
          .catch(() => { /* keep teaser results if any */ })
      : Promise.resolve();

    await Promise.allSettled([teaser, full]);
    if (stillCurrent()) setLiveLoading(false);
  }, []);

  /* ── key-based direct lookup (from homepage cards) ─────────────────── */
  const fetchByKey = useCallback(async (key: string, displayQ: string) => {
    setQuery(displayQ);
    setSniffResult(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/compare?key=${encodeURIComponent(key)}`);
      setResult(await res.json() as SearchOutput);
    } catch {
      setResult({ mode: "empty", query: displayQ, suggestions: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── URL path: sniff → use sniffed product as the literal anchor ─────
     Old flow: sniffed title → /api/compare → pg-fts picks a *similar*
     product as anchor. Bug: anchor often a different model than what
     the user pasted (Pro Max shown for base iPhone 15, etc.).
     New flow: sniff → build anchor from sniff data itself → fetch
     dupes that are CHEAPER than the sniffed price. The user's actual
     pasted product is the centerpiece. */
  const handleUrlSearch = useCallback(async (rawUrl: string) => {
    setQuery(rawUrl);
    setSniffResult(null);
    setResult(null);
    setSniffLoading(true);

    /* Preserve country prefix — bare /compare triggers middleware
       redirect to /{cookie-country}/compare, which would route a
       /uk visitor back to /us if their cookie is stale. Same fix
       shape as DealFeed.tsx (May 2026). */
    router.replace(
      `/${country.code}/compare?q=${encodeURIComponent(rawUrl)}&mode=similar`,
      { scroll: false },
    );

    let sniff: SniffResult | null = null;
    try {
      const res = await fetch(`/api/sniff?url=${encodeURIComponent(rawUrl)}`);
      sniff = await res.json() as SniffResult;
      setSniffResult(sniff);
    } catch {
      /* Network error reaching /api/sniff — sniff stays null, so the
         branches below find no title and settle into the empty state
         (nothing to search with). No raw-URL search either way. */
    } finally {
      setSniffLoading(false);
    }

    /* The only usable search signal from a paste is the sniffed product
       TITLE. A failed/blocked sniff (ok:false) or one with no title
       leaves just the raw URL — and a URL can't FTS-match a product or
       seed a shopping-engine query, so feeding it to either search
       returns a guaranteed zero AND wastes a SerpAPI credit on the live
       call. So we only search when we actually parsed a title. */
    const sniffedTitle = sniff?.ok && sniff.title ? sniff.title : null;

    setLoading(true);

    /* Sniff produced a usable product (title + price)? Build the anchor
       client-side from the sniff itself; ask the server only for dupes
       that undercut the sniffed price. */
    /* Gate on sniff.ok — a failed/degraded sniff (dead URL, blocked
       page) must NOT build a "Your Pick" anchor from a placeholder
       title. ok:false falls through below to the honest empty state
       (robustness report M8). */
    const sniffedAnchor = sniff?.ok ? sniffToAnchor(sniff) : null;

    if (sniffedAnchor) {
      const dupesFor = async (term: string): Promise<DupeResult[]> => {
        const res = await fetch(`/api/compare/dupes?q=${encodeURIComponent(term)}&maxPriceNgn=${sniffedAnchor.bestPrice}`);
        const data = await res.json() as { dupes: DupeResult[] };
        return data.dupes ?? [];
      };
      /* Resolve the catalog alternatives (with the broaden-on-miss
         retry) as a single promise so the live call can gate its paid
         lane on the FINAL count. */
      const dupesPromise = (async () => {
        let dupes = await dupesFor(sniffedAnchor.title);
        /* Broaden on a miss: the exact sniffed title ("Air Jordan 1 Low SE
           Craft Men's Shoes") can be too specific to FTS-match our catalog
           even when we carry the model ("Air Jordan 1 Low"). Retry once with
           the first few significant words so a near-match still surfaces
           instead of leaving the paste with nothing to compare. */
        if (dupes.length === 0) {
          const DROP = new Set(["the","and","for","with","mens","men's","womens","women's","unisex","shoes","shoe","sneakers","trainers","size"]);
          const broad = sniffedAnchor.title.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/).filter((w) => w && !DROP.has(w)).slice(0, 4).join(" ");
          if (broad && broad !== sniffedAnchor.title.toLowerCase()) {
            dupes = await dupesFor(broad);
          }
        }
        return dupes;
      })();
      /* Live search uses the sniffed title — best signal for SerpAPI.
         Paid lane only if the catalog can't already compare it. */
      fetchLive(sniffedAnchor.title, dupesPromise.then((d) => d.length).catch(() => 0));
      try {
        const dupes = await dupesPromise;
        setResult({ mode: "similar", query: sniffedAnchor.title, anchor: sniffedAnchor, dupes });
      } catch {
        // Dupes call failed — still show the sniffed anchor on its own
        setResult({
          mode:   "similar",
          query:  sniffedAnchor.title,
          anchor: sniffedAnchor,
          dupes:  [],
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    /* No price-bearing anchor, but the sniff DID read a title (parsed
       the name but no usable price) → a real title-search is still
       worthwhile, so search on the title (never the raw URL). */
    if (sniffedTitle) {
      const comparePromise = fetch(`/api/compare?q=${encodeURIComponent(sniffedTitle)}&mode=similar`)
        .then((r) => r.json() as Promise<SearchOutput>);
      fetchLive(sniffedTitle, comparePromise.then(dbAltCount).catch(() => 0));
      try {
        setResult(await comparePromise);
      } catch {
        setResult({ mode: "empty", query: sniffedTitle, suggestions: [] });
      } finally {
        setLoading(false);
      }
      return;
    }

    /* Sniff failed (dead/blocked URL) — nothing to search WITH. The
       honest amber "couldn't read this page, search by name" card is
       already shown above from sniffResult.ok === false; we just settle
       into the empty state. Deliberately NO fetchLive / FTS on the raw
       URL: both return zero, and the live call would waste a SerpAPI
       credit on a query that can never resolve. */
    setResult({ mode: "empty", query: rawUrl, suggestions: [] });
    setLoading(false);
  }, [router, fetchLive]);

  /* ── Text search ────────────────────────────────────────────────────── */
  const handleSearch = useCallback(async (q: string, pid?: string, oid?: string) => {
    if (looksLikeUrl(q)) { handleUrlSearch(q); return; }

    setQuery(q);
    setSniffResult(null);
    const params = new URLSearchParams({ q, mode: "similar" });
    if (pid) params.set("pid", pid);
    if (oid) params.set("oid", oid);
    /* Country-prefixed — see comment on line 104. */
    router.replace(`/${country.code}/compare?${params.toString()}`, { scroll: false });
    setLoading(true);
    setResult(null);

    /* Build the catalog query up front so the live call can gate its
       paid lane on the DB result — only spend a SerpAPI credit when the
       catalog comes back thin. pid is the primary backstop (chip clicks,
       PDP CTA); oid is the ultimate fallback for when pid + FTS both
       miss — /api/compare synthesises an anchor from the offer-row
       directly so the user always sees their product. */
    const apiParams = new URLSearchParams({ q, mode: "similar" });
    if (pid) apiParams.set("pid", pid);
    if (oid) apiParams.set("oid", oid);
    const comparePromise = fetch(`/api/compare?${apiParams.toString()}`)
      .then((r) => r.json() as Promise<SearchOutput>);

    // Live search gated on the catalog result (paid lane only when thin).
    fetchLive(q, comparePromise.then(dbAltCount).catch(() => 0));

    try {
      const data = await comparePromise;
      setResult(data);
      /* Log to search_query_log. resultCount is approximate — we
         use anchor.offers.length + dupes.length when similar mode,
         or 0 when empty. Good enough for popularity / zero-result
         signals. */
      const count = data.mode === "similar"
        ? (data.anchor?.offers.length ?? 0) + data.dupes.length
        : data.mode === "single"
          ? data.group.offers.length
          : 0;
      logSearchEvent({ query: q, surface: "compare", mode: "text", resultCount: count });
    } catch {
      setResult({ mode: "empty", query: q, suggestions: [] });
      logSearchEvent({ query: q, surface: "compare", mode: "text", resultCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [router, handleUrlSearch, fetchLive]);

  /* ── SearchBar submit handler ─────────────────────────────────────────
     Every search from the /compare bar resolves ON /compare: a pasted
     URL goes through handleUrlSearch (sniff + anchor); everything else
     goes through handleSearch (a text search on /compare), with a
     picked autocomplete suggestion also passing its pid for an exact
     anchor.

     A freeform typed query used to be forked out to the /deals grid on
     the theory it was "ambiguous", but that bounced specific product
     names too, mismatched the bar's own "Find cheaper" promise, and
     disagreed with the page's URL-load path, where /compare?q=...
     already resolves here via handleSearch. */
  const onSearchSubmit = useCallback((q: string, pid?: string) => {
    if (looksLikeUrl(q)) { handleUrlSearch(q); return; }
    handleSearch(q, pid);
  }, [handleUrlSearch, handleSearch]);

  /* ── React to URL changes (initial load, back/forward) ─────────────── */
  useEffect(() => {
    /* Seed-and-skip. When the server SSR-fetched the internal result
       for this exact URL, `result` was already initialised from it and
       the anchor + dupes are on screen in the first paint — so don't
       refetch /api/compare on mount. We still mirror the OTHER side-
       effects of the path that produced it: a text/oid query kicks off
       the supplementary live search and logs the search event (a key=
       lookup did neither). fetchLive no-ops on an empty query. */
    if (hasInitialResultRef.current) {
      hasInitialResultRef.current = false;
      if (!initialKey) {
        /* The DB comparison is already on screen (SSR-seeded), so gate
           the paid lane on its alternatives count — a well-covered deep
           link shouldn't spend a SerpAPI credit on mount. */
        fetchLive(initialQuery, Promise.resolve(dbAltCount(initialResult ?? null)));
        const count = initialResult?.mode === "similar"
          ? (initialResult.anchor?.offers.length ?? 0) + initialResult.dupes.length
          : initialResult?.mode === "single"
            ? initialResult.group.offers.length
            : 0;
        logSearchEvent({ query: initialQuery, surface: "compare", mode: "text", resultCount: count });
      }
      return;
    }
    if (initialKey) fetchByKey(initialKey, initialQuery);
    else if (initialQuery || initialOid) {
      if (initialQuery && looksLikeUrl(initialQuery)) {
        handleUrlSearch(initialQuery);
      } else {
        handleSearch(initialQuery, initialPid || undefined, initialOid || undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, initialQuery, initialPid, initialOid]);

  /* PDP back-link breadcrumb. PdpBackLink reads sessionStorage to
     route "Back to results" → the originating compare URL when the
     user arrived via a client-side <Link> click (document.referrer
     doesn't update for App Router internal navigations). Write our
     full URL on every relevant change so the most recent compare
     view is always the back-target. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        "havlo:lastCompareUrl",
        JSON.stringify({ url: window.location.href, ts: Date.now() }),
      );
    } catch { /* private mode or quota exceeded — silent no-op */ }
  }, [initialQuery, initialPid, initialKey]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <SearchBar
        initialQuery={query}
        onSearch={onSearchSubmit}
        loading={loading || sniffLoading}
        /* /compare renders TrendingChipRail below — Popular
           comparisons section serves the same role as the SearchBar
           "Try:" chips. Suppress the inline chip rail to avoid two
           competing suggestion lists for the same task. */
        hideTrendingChips
        /* When the user clicks X to clear the input, drop the query
           state so the chip rail reappears. The URL is cleaned up
           too so back/forward doesn't surface a stale query. Prior
           results are deliberately NOT cleared — user can still see
           them below the chip rail until they pick a new comparison. */
        /* Full reset on X click — previous behaviour preserved the
           anchor card "below the chip rail" but that left users
           confused: the input was empty yet a stale anchor product
           still hung around. QA flagged this as P1-3. */
        onClear={() => {
          setQuery("");
          setSniffResult(null);
          setResult(null);
          setLiveResults([]);
          setLiveProviders([]);
          router.replace(`/${country.code}/compare`, { scroll: false });
        }}
      />

      {/* Search-by-image — a second doorway to the same comparison.
          The upload is matched against the local dHash perceptual-hash
          index (no paid vision API); a confident match routes to
          /compare?pid= for that product. */}
      <div className="mt-3 flex justify-center">
        <ImageSearchButton variant="compare" countryCode={country.code} />
      </div>

      {/* Popular comparisons chip rail. Visible ONLY in the empty
          state (no query yet) so it doesn't compete with active
          search results below. Moved here from the homepage in
          round-4 QA — chips work better as a "try a comparison"
          shortcut on the page where users are about to search than
          as a standalone homepage section that competed with
          TrendingDeals + CategoryGrid. */}
      {!query.trim() && !sniffLoading && !loading && (
        <div className="max-w-2xl mx-auto">
          <TrendingChipRail countryCode={country.code} limit={10} />
        </div>
      )}

      {/* ── Sniff loading ── */}
      {sniffLoading && (
        <div className="mt-8 max-w-lg mx-auto flex items-center gap-3 px-5 py-4 rounded-2xl
                         bg-surface-2">
          <span className="w-4 h-4 rounded-full border-2 border-border border-t-brand animate-spin shrink-0" />
          <p className="text-sm text-ink-2">Analysing link…</p>
        </div>
      )}

      {/* ── Sniff result card (kept visible above results as context) ── */}
      {sniffResult && !sniffLoading && (
        <div className={`mt-8 max-w-lg mx-auto flex items-center gap-4 px-5 py-4 rounded-2xl border ${
          sniffResult.ok
            ? "border-success/20 bg-success/[0.03]"
            : "border-amber-500/20 bg-amber-500/[0.02]"
        }`}>
          {sniffResult.ok && sniffResult.imageUrl && (
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-white shrink-0">
              <img
                src={sniffResult.imageUrl}
                alt=""
                className="w-full h-full object-contain p-1"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {sniffResult.ok ? (
              <>
                <p className="text-[11px] text-success/70 mb-0.5">
                  Found on {sniffResult.store}
                </p>
                <p className="text-sm font-medium text-ink line-clamp-2">
                  {sniffResult.title}
                </p>
                {sniffResult.price != null && sniffResult.currency && (
                  <p className="text-xs text-ink-2 mt-0.5">
                    {sniffResult.currency === "NGN"
                      ? formatNaira(sniffResult.price)
                      : `${sniffResult.currency} ${sniffResult.price.toLocaleString()}`}
                    {" "}on {sniffResult.store}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                We couldn&apos;t read this page. Try searching by product name instead.
              </p>
            )}
          </div>
          {sniffResult.ok ? (
            <CheckCircle size={18} className="text-success shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
          )}
        </div>
      )}

      {/* Cashback chip for sniffed URLs from cashback-eligible stores.
          Surfaces the earning the user gets if they buy through Havlo
          ("Earn 2% cashback on this through Havlo. Coming soon.") so
          the link they pasted has visible monetary upside attached.
          Only renders when the sniff succeeded AND the URL maps to a
          store in the cashback rate map. Click routes to the country-
          aware cashback page. */}
      {sniffResult?.ok && (() => {
        const cashback = getCashbackForUrl(sniffResult.url);
        if (!cashback) return null;
        return (
          <div className="mt-3 max-w-lg mx-auto px-1">
            <Link
              href={`/${country.code}/cashback`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-success/10 border border-success/30 hover:bg-success/15 transition-colors text-sm"
            >
              <Coins size={15} className="text-success shrink-0" aria-hidden="true" />
              <span className="text-ink flex-1">
                Earn <strong>{cashback.percent}% cashback</strong> on this through Havlo
                <span className="text-ink-3 font-normal"> (coming soon)</span>
              </span>
              <span className="text-ink-3 text-xs hidden sm:inline" aria-hidden="true">→</span>
            </Link>
          </div>
        );
      })()}

      {/* ── Loading skeletons ── */}
      {/* Mirrors the real "similar" mode layout so the transition
          from skeleton → content doesn't reflow the page (anchor
          hero card with image + text + price + nested store rows,
          then a cheaper-alternatives grid below). Previous skeleton
          was a flat list of bare rectangles that didn't match the
          anchor card's structure or the dupes grid that appears
          underneath, so the page jumped when content loaded.

          User report May 2026: "compare page skeleton not in line
          with page content." */}
      {loading && (
        <div className="mt-8 sm:mt-10" aria-hidden="true">
          {/* Anchor hero card — same outer shell as the real one
              (max-w-3xl, rounded-2xl, p-4 sm:p-6) so the bounding
              box stays put when real content takes over. */}
          <div className="max-w-3xl mx-auto mb-8 sm:mb-10">
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                {/* Product image placeholder — w-full on mobile (h-40),
                    fixed 112×112 on sm+ to match the real image cell. */}
                <div className="skeleton w-full sm:w-28 h-40 sm:h-28 rounded-xl flex-shrink-0" />
                <div className="flex-1 w-full space-y-2.5">
                  {/* Eyebrow row ("Your pick" + brand). */}
                  <div className="flex items-center gap-2">
                    <div className="skeleton h-3.5 w-16 rounded" />
                    <div className="skeleton h-3 w-12 rounded" />
                  </div>
                  {/* Title — 2 lines. */}
                  <div className="skeleton h-4 sm:h-5 w-full rounded" />
                  <div className="skeleton h-4 sm:h-5 w-2/3 rounded" />
                  {/* Price + savings line. */}
                  <div className="flex items-baseline gap-3 pt-1">
                    <div className="skeleton h-6 w-24 rounded" />
                    <div className="skeleton h-3 w-32 rounded" />
                  </div>
                  {/* Alternatives savings caption. */}
                  <div className="skeleton h-3 w-40 rounded" />
                </div>
              </div>
              {/* Store rows section inside the anchor card. */}
              <div className="mt-5 pt-5 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="skeleton h-3 w-28 rounded" />
                  <div className="skeleton h-3 w-24 rounded hidden sm:block" />
                </div>
                <div className="space-y-1.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                      <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="skeleton h-3.5 w-28 rounded" />
                        <div className="skeleton h-3 w-40 rounded" />
                      </div>
                      <div className="skeleton h-5 w-16 rounded shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Cheaper-alternatives grid placeholder — matches the
              dupes section below the anchor card. */}
          <div className="max-w-5xl mx-auto">
            <div className="skeleton h-5 w-44 rounded mb-2" />
            <div className="skeleton h-3 w-64 rounded mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="skeleton aspect-[4/5] sm:aspect-[5/6] rounded-2xl" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SINGLE — key-based price comparison across stores ── */}
      {!loading && result?.mode === "single" && (
        <div className="mt-10 max-w-3xl mx-auto">
          <PriceResults group={result.group} query={query} mode="single" />
        </div>
      )}

      {/* ── SIMILAR — anchor product + cheaper alternatives ── */}
      {!loading && result?.mode === "similar" && (
        <div className="mt-8 sm:mt-10">
          {/* Anchor hero card (extracted May 2026, phase 3 refactor).
              Owns the image + title + price-summary + store-rows
              + cross-border / affiliate disclosures + the connector
              chip that bridges into the dupes grid. ~290 LoC of JSX
              + two IIFEs pulled out of this file. See
              components/compare/CompareAnchorCard.tsx for the
              dedup pipeline (mirrors lib/pdp-stats.computeAnchorStats
              so the PDP's "Compare prices across N stores" CTA
              count equals what shows here). */}
          <CompareAnchorCard
            anchor={result.anchor}
            dupes={result.dupes}
            country={country}
            query={query}
            canCompare={result.dupes.length > 0 || liveResults.length > 0 || liveLoading}
          />

          {/* Dupes grid */}
          {result.dupes.length > 0 ? (
            <>
              <div className="max-w-3xl mx-auto mb-5 sm:mb-6 px-1">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-ink tracking-[-0.02em]">
                      Cheaper alternatives
                    </h3>
                    <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
                      Sorted by best value, ranked across {result.dupes.reduce((acc, d) => acc + d.offers.length, 0)} offers.
                    </p>
                  </div>
                </div>
              </div>
              {/* Varying-height masonry — same pattern as homepage / deals */}
              <DupeMasonry dupes={result.dupes} query={query} />

              {/* Live results — fresh from Google Shopping */}
              <LiveResults
                items={liveResults}
                loading={liveLoading}
                providers={liveProviders}
              />
            </>
          ) : (liveLoading || liveResults.length > 0) ? (
            /* No internal dupes, but live has (or is loading) results. */
            <LiveResults
              items={liveResults}
              loading={liveLoading}
              providers={liveProviders}
            />
          ) : !liveLoading && liveProviders.length === 0 ? (
            /* Live providers misconfigured — distinct from "nothing matches" */
            <div className="text-center py-12">
              <div className="max-w-sm mx-auto">
                <AlertCircle size={28} className="text-amber-500 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-ink font-medium mb-1">
                  Live search unavailable
                </p>
                <p className="text-xs text-ink-3">
                  We couldn&apos;t reach the live shopping providers. Only your local catalog was searched.
                </p>
              </div>
            </div>
          ) : (
            /* Both internal and live came back empty for real */
            <div className="text-center py-12">
              <div className="max-w-sm mx-auto">
                <SearchX size={28} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-ink font-medium mb-1">
                  No alternatives found anywhere
                </p>
                <p className="text-xs text-ink-3">
                  Try a different product or a broader search like &quot;earbuds&quot; or &quot;laptop&quot;.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty / no results ──
           Sub-states:
           A) live is loading → show LiveResults skeletons, suppress empty copy
           B) live has items   → show LiveResults with a context note
           C) live providers misconfigured → distinct "service unavailable" message
           D) both genuinely empty → "no matches" guidance */}
      {!loading && result?.mode === "empty" && query && (() => {
        // Prefer the sniffed product title over the raw URL when present
        const displayQuery =
          sniffResult?.ok && sniffResult.title ? sniffResult.title : query;

        // Live providers configured but returned 0? vs not configured at all?
        const liveAvailable = liveLoading || liveResults.length > 0;
        const liveMisconfigured = !liveLoading && liveProviders.length === 0;

        return (
          <div className="mt-12">
            {liveAvailable ? (
              <>
                {/* Compact 3-option recovery panel above the live
                    results. Re-uses the same EmptySearchState the
                    "true empty" branch shows, so the user always
                    gets the same three forward-options regardless
                    of whether anything live came back. Did-you-mean
                    pills (trigram-similarity matches) render inside
                    EmptySearchState when present. */}
                <EmptySearchState
                  query={displayQuery}
                  source="compare"
                  suggestions={
                    result?.mode === "empty"
                      ? result.suggestions.map((s) => ({ title: s.title, key: s.key }))
                      : []
                  }
                />
                {/* Drop the wrapping "Or browse what's live online
                    for {query}" header — EmptySearchState above
                    already renders a "Or browse trending deals"
                    CTA, and the two adjacent "Or browse…" labels
                    read as duplicated cruft (audit May 2026
                    flagged the duplication).

                    LiveResults below has its OWN heading internal
                    to the component, which keeps the section
                    boundary clear without the extra wrapping
                    label. */}
                <div className="mt-8">
                  <LiveResults
                    items={liveResults}
                    loading={liveLoading}
                    providers={liveProviders}
                  />
                </div>
              </>
            ) : liveMisconfigured ? (
              <div className="max-w-md mx-auto text-center py-12">
                <AlertCircle size={28} className="text-amber-500 mx-auto mb-3" strokeWidth={1.5} />
                <h3 className="text-base font-medium text-ink mb-1">
                  Live search unavailable
                </h3>
                <p className="text-sm text-ink-3">
                  We don&apos;t have &ldquo;{displayQuery}&rdquo; in our index yet, and live
                  shopping providers aren&apos;t reachable right now. Try again in a moment, or browse{" "}
                  {/* Country-prefixed: a bare /deals bounces through
                      middleware and resolves via cookie, which can be
                      stale across visits and drop the user on the
                      wrong country. */}
                  <a href={`/${country.code}/deals`} className="text-ink underline underline-offset-2">deals</a>.
                </p>
              </div>
            ) : (
              /* Layered recovery: did-you-mean pills (when trigram
                 similarity finds anything close) + URL paste / notify-
                 me / browse. Same component used on /deals so the
                 empty UX is consistent across surfaces. */
              <EmptySearchState
                query={displayQuery}
                source="compare"
                suggestions={
                  result?.mode === "empty"
                    ? result.suggestions.map((s) => ({ title: s.title, key: s.key }))
                    : []
                }
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}
