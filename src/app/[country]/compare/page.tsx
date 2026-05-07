"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchX, Sparkles, ArrowDown, ExternalLink, Plane, CheckCircle, AlertCircle, Coins, ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import SearchBar from "@/components/compare/SearchBar";
import Image from "next/image";
import PriceResults from "@/components/compare/PriceResults";
import DupeCard from "@/components/compare/DupeCard";
import LiveResults from "@/components/compare/LiveResults";
import EmptySearchState from "@/components/empty/EmptySearchState";
import { MASONRY_ASPECTS, chunkLeftToRight } from "@/components/deals/masonry-layout";
import AnimateIn from "@/components/ui/AnimateIn";
import { formatNaira, getClickThroughUrl } from "@/lib/utils";
import { trackClick } from "@/lib/trackClick";
import { sniffToAnchor } from "@/lib/sniff-to-anchor";
import { getCashbackForUrl } from "@/lib/cashback";
import { useCountry } from "@/components/providers/CountryProvider";
import type { SearchOutput, DupeResult } from "@/lib/search";
import type { SniffResult } from "@/app/api/sniff/route";
import type { Deal } from "@/types";

/** Mirrors the check in url-parser.ts — avoids importing server code here. */
function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  return /^https?:\/\//i.test(t) || /^(www\.|[a-z]+\.(com|ng|co))/i.test(t);
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { country } = useCountry();
  const initialQuery = searchParams.get("q") ?? "";
  const initialKey   = searchParams.get("key") ?? "";

  const [query, setQuery]             = useState(initialQuery);
  const [result, setResult]           = useState<SearchOutput | null>(null);
  const [loading, setLoading]         = useState(false);
  const [sniffResult, setSniffResult] = useState<SniffResult | null>(null);
  const [sniffLoading, setSniffLoading] = useState(false);
  const [liveResults, setLiveResults]   = useState<Deal[]>([]);
  const [liveLoading, setLiveLoading]   = useState(false);
  const [liveProviders, setLiveProviders] = useState<string[]>([]);

  /* ── Fetch live SerpAPI results in parallel with the internal search ── */
  const fetchLive = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLiveLoading(true);
    setLiveResults([]);
    setLiveProviders([]);
    try {
      const res = await fetch(`/api/live-search?q=${encodeURIComponent(q)}&limit=12`);
      const data = await res.json();
      setLiveResults(Array.isArray(data.items) ? (data.items as Deal[]) : []);
      setLiveProviders(Array.isArray(data.providers) ? (data.providers as string[]) : []);
    } catch {
      setLiveResults([]);
    } finally {
      setLiveLoading(false);
    }
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

    router.replace(
      `/compare?q=${encodeURIComponent(rawUrl)}&mode=similar`,
      { scroll: false },
    );

    let sniff: SniffResult | null = null;
    try {
      const res = await fetch(`/api/sniff?url=${encodeURIComponent(rawUrl)}`);
      sniff = await res.json() as SniffResult;
      setSniffResult(sniff);
    } catch {
      // Network error — fall through to slug fallback
    } finally {
      setSniffLoading(false);
    }

    const searchTerm = sniff?.ok && sniff.title ? sniff.title : rawUrl;

    setLoading(true);
    // Live search uses the sniffed title — best signal for SerpAPI
    fetchLive(searchTerm);

    /* Sniff produced a usable product (title + price)? Build the anchor
       client-side from the sniff itself; ask the server only for dupes
       that undercut the sniffed price. */
    const sniffedAnchor = sniff ? sniffToAnchor(sniff) : null;

    if (sniffedAnchor) {
      try {
        const url = `/api/compare/dupes?q=${encodeURIComponent(sniffedAnchor.title)}&maxPriceNgn=${sniffedAnchor.bestPrice}`;
        const res = await fetch(url);
        const data = await res.json() as { dupes: DupeResult[] };
        setResult({
          mode:   "similar",
          query:  searchTerm,
          anchor: sniffedAnchor,
          dupes:  data.dupes ?? [],
        });
      } catch {
        // Dupes call failed — still show the sniffed anchor on its own
        setResult({
          mode:   "similar",
          query:  searchTerm,
          anchor: sniffedAnchor,
          dupes:  [],
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    /* Sniff failed or returned no usable price → fall back to the legacy
       title-search path so the page still renders something useful. */
    try {
      const res = await fetch(`/api/compare?q=${encodeURIComponent(searchTerm)}&mode=similar`);
      setResult(await res.json() as SearchOutput);
    } catch {
      setResult({ mode: "empty", query: searchTerm, suggestions: [] });
    } finally {
      setLoading(false);
    }
  }, [router, fetchLive]);

  /* ── Text search ────────────────────────────────────────────────────── */
  const handleSearch = useCallback(async (q: string) => {
    if (looksLikeUrl(q)) { handleUrlSearch(q); return; }

    setQuery(q);
    setSniffResult(null);
    const params = new URLSearchParams({ q, mode: "similar" });
    router.replace(`/compare?${params.toString()}`, { scroll: false });
    setLoading(true);
    setResult(null);

    // Fire both calls in parallel
    fetchLive(q);

    try {
      const res = await fetch(`/api/compare?q=${encodeURIComponent(q)}&mode=similar`);
      setResult(await res.json() as SearchOutput);
    } catch {
      setResult({ mode: "empty", query: q, suggestions: [] });
    } finally {
      setLoading(false);
    }
  }, [router, handleUrlSearch, fetchLive]);

  /* ── React to URL changes (initial load, back/forward) ─────────────── */
  useEffect(() => {
    if (initialKey) fetchByKey(initialKey, initialQuery);
    else if (initialQuery) {
      if (looksLikeUrl(initialQuery)) handleUrlSearch(initialQuery);
      else handleSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, initialQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <SearchBar
        initialQuery={query}
        onSearch={handleSearch}
        loading={loading || sniffLoading}
      />

      {/* ── Sniff loading ── */}
      {sniffLoading && (
        <div className="mt-8 max-w-lg mx-auto flex items-center gap-3 px-5 py-4 rounded-2xl
                        border border-border bg-surface-2">
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
              <p className="text-sm text-amber-300/80">
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
      {loading && (
        <div className="mt-10 max-w-3xl mx-auto space-y-3">
          <div className="skeleton h-28 rounded-2xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
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
          {/* Anchor hero card */}
          <div className="relative max-w-3xl mx-auto mb-8 sm:mb-10">
            <div className="relative rounded-2xl border border-border bg-surface p-4 sm:p-6 overflow-hidden">

              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                {/* Image — full-width on mobile, square on sm+ */}
                {result.anchor.imageUrl ? (
                  <div className="w-full sm:w-28 h-40 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                    <img
                      src={result.anchor.imageUrl}
                      alt={result.anchor.title}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                ) : (
                  <div
                    className="w-full sm:w-28 h-40 sm:h-28 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                    style={{ background: result.anchor.imageGradient }}
                  >
                    {result.anchor.imageEmoji}
                  </div>
                )}

                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-2 bg-surface-2 px-2 py-0.5 rounded">
                      Your pick
                    </span>
                    {result.anchor.brand && (
                      <span className="text-[10px] uppercase tracking-wider text-ink-3">
                        {result.anchor.brand}
                      </span>
                    )}
                  </div>
                  <h2 className="text-[15px] sm:text-lg font-semibold text-ink leading-snug line-clamp-2">
                    {result.anchor.title}
                  </h2>
                  {/* Show price summary line: cheapest store's price as
                      headline, savings span vs the most expensive store
                      across the offer set. Both numbers are real to the
                      user since they come from real offers below. */}
                  {result.anchor.offers.length > 0 && result.anchor.bestPrice > 0 && (() => {
                    const sorted = [...result.anchor.offers]
                      .filter((o) => o.landedPrice > 0)
                      .sort((a, b) => a.landedPrice - b.landedPrice);
                    const cheapest = sorted[0];
                    const dearest  = sorted[sorted.length - 1];
                    const spread   = dearest && cheapest && dearest.landedPrice > cheapest.landedPrice
                      ? dearest.landedPrice - cheapest.landedPrice
                      : 0;
                    return (
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
                        <span className="text-lg sm:text-xl font-bold text-ink">
                          {formatNaira(cheapest?.landedPrice ?? result.anchor.bestPrice)}
                        </span>
                        {spread > 0 && (
                          <span className="text-xs text-ink-3">
                            Save up to <span className="text-success font-semibold">{formatNaira(spread)}</span> across stores
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {result.dupes.length > 0 && result.dupes[0].savingsPercent > 0 && (
                    <p className="mt-2 text-xs text-success font-medium">
                      Alternatives from {formatNaira(result.dupes.reduce((min, d) => Math.min(min, d.bestPrice), Infinity))}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Price comparison rows ──────────────────────────
                  Only render when there's actually a comparison to
                  show (>=2 offers). Each offer becomes a row with the
                  store logo, price, delivery info, and a real 'View'
                  CTA — replacing the old emoji-pill chips that didn't
                  show prices and weren't useful for comparison.

                  Deduped by (storeId, landedPrice rounded to nearest
                  ₦100): when the query-time signature pool gathers
                  the same listing from multiple ingest cycles, six
                  identical AliExpress rows at ₦1,078,896 quietly
                  surface — visible noise that isn't a comparison.
                  Same-store + same-price = same listing for UX
                  purposes; keep the first, drop the rest. Different
                  prices from the same store DO stay (a retailer
                  often lists multiple variants — 256GB vs 512GB —
                  at different prices, and those are real choices).

                  Sorted by landedPrice ascending (cheapest first);
                  the top row gets a 'Best price' badge. */}
              {result.anchor.offers.length > 1 && (() => {
                /* Dedup pass first: collapse same-store + same-price
                   rows. Round to nearest ₦100 so trivial FX-rounding
                   differences don't leak through as separate rows. */
                const seen = new Set<string>();
                const deduped = result.anchor.offers
                  .filter((o) => o.landedPrice > 0)
                  .filter((o) => {
                    const key = `${o.storeId}|${Math.round(o.landedPrice / 100) * 100}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                const sorted = deduped.sort((a, b) => a.landedPrice - b.landedPrice);
                if (sorted.length < 2) return null;
                const cheapest = sorted[0].landedPrice;
                return (
                  <div className="mt-5 pt-5 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
                        Across {sorted.length} {sorted.length === 1 ? "store" : "stores"}
                      </p>
                      <p className="text-[11px] text-ink-3">
                        Sorted cheapest first
                      </p>
                    </div>
                    <ul className="space-y-1.5">
                      {sorted.map((offer, i) => {
                        const isBest   = i === 0;
                        const savings  = offer.landedPrice - cheapest;
                        const subtitle = (offer.productTitle && offer.productTitle !== result.anchor.title)
                          ? offer.productTitle
                          : null;
                        return (
                          <li key={`${offer.storeId}-${offer.price}-${i}`}>
                            {/* Whole row is the click target — Spoken pattern.
                                Visual chevron at the end implies 'go to this
                                store'. Less chrome than a separate button,
                                bigger tap area on mobile. */}
                            <a
                              href={getClickThroughUrl({ url: offer.url, id: `${result.anchor.key}-${offer.storeId}` })}
                              target="_blank"
                              rel="noopener noreferrer sponsored"
                              onClick={() => trackClick(result.anchor.key, query, i, "anchor-comparison")}
                              className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                isBest
                                  ? "border-success/40 bg-success/5 hover:bg-success/10"
                                  : "border-border bg-bg/50 hover:border-border-strong hover:bg-surface-2/50"
                              }`}
                            >
                              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white flex items-center justify-center">
                                <Image
                                  src={offer.storeLogoUrl}
                                  alt={offer.storeName}
                                  width={36}
                                  height={36}
                                  className="object-contain"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Star icon for best price — Spoken pattern.
                                      Inline with the store name rather than a
                                      separate badge, less visual noise. */}
                                  {isBest && (
                                    <Star
                                      size={13}
                                      strokeWidth={2}
                                      className="text-success fill-success shrink-0"
                                      aria-label="Best price"
                                    />
                                  )}
                                  <span className="text-sm font-semibold text-ink truncate">
                                    {offer.storeName}
                                  </span>
                                  {offer.isInternational && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 shrink-0">
                                      <Plane size={10} /> Cross-border
                                    </span>
                                  )}
                                </div>
                                {/* Subtitle: how the product is titled at this
                                    store. Surfaces the proof that pooled
                                    offers really are the same item. Falls
                                    back to delivery info when the per-store
                                    title matches the anchor. */}
                                {subtitle ? (
                                  <p className="text-[11px] text-ink-3 mt-0.5 truncate">
                                    {subtitle}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-ink-3 mt-0.5">
                                    {offer.deliveryDays
                                      ? `${offer.deliveryDays} ${offer.deliveryDays === 1 ? "day" : "days"} delivery`
                                      : "Delivery varies"}
                                  </p>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <p className={`text-base font-bold tabular-nums ${isBest ? "text-success" : "text-ink"}`}>
                                  {formatNaira(offer.landedPrice)}
                                </p>
                                {savings > 0 && (
                                  <p className="text-[11px] text-ink-3 tabular-nums">
                                    +{formatNaira(savings)}
                                  </p>
                                )}
                              </div>

                              <ChevronRight
                                size={16}
                                strokeWidth={2}
                                className="shrink-0 text-ink-3 group-hover:text-ink-2 transition-colors"
                                aria-hidden="true"
                              />
                            </a>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Always-visible landed-cost disclosure — replaces
                        the per-row tooltip that didn't work on mobile.
                        Single line, plain English, mobile-safe. Renders
                        only when at least one row in the table is
                        cross-border (otherwise it's irrelevant copy). */}
                    {sorted.some((o) => o.isInternational && o.landedCostExtra > 0) && (
                      <p className="mt-3 text-[11px] text-ink-3 leading-relaxed">
                        <span className="text-amber-500">⚑</span>{" "}
                        Cross-border prices include a ~30% landed estimate (shipping + customs).
                        Final total varies by carrier and customs assessment.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Connector */}
            {result.dupes.length > 0 && (
              <div className="flex flex-col items-center mt-5 mb-2">
                <div className="w-px h-6 bg-border" />
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-success/10 border border-success/20">
                  <ArrowDown size={12} className="text-success" />
                  <span className="text-xs font-semibold text-success">
                    {result.dupes.length} alternative{result.dupes.length > 1 ? "s" : ""} found
                  </span>
                </div>
              </div>
            )}
          </div>

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
                <div className="max-w-3xl mx-auto mb-5 px-1 text-center sm:text-left">
                  <p className="text-[13px] text-ink-2">
                    Nothing in our local index for &ldquo;{displayQuery}&rdquo; yet.
                    Here&apos;s what&apos;s live online:
                  </p>
                </div>
                <LiveResults
                  items={liveResults}
                  loading={liveLoading}
                  providers={liveProviders}
                />
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
                  <a href="/deals" className="text-ink underline underline-offset-2">deals</a>.
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

/* ── Masonry layout for dupes ─────────────────────────────────────
   Renders three column-distributed layouts (mobile/tablet/desktop)
   so cards flow left-to-right with varied heights from cycled aspects. */
function DupeColumn({
  items, gapClass, startIndex, query,
}: { items: DupeResult[]; gapClass: string; startIndex: number; query: string }) {
  return (
    <div className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
      {items.map((dupe, i) => (
        <AnimateIn key={dupe.key} delay={Math.min(i, 6) * 60}>
          <DupeCard
            dupe={dupe}
            rank={startIndex + i}
            query={query}
            mode="similar"
            aspect={MASONRY_ASPECTS[(startIndex + i) % MASONRY_ASPECTS.length]}
          />
        </AnimateIn>
      ))}
    </div>
  );
}

function DupeMasonry({ dupes, query }: { dupes: DupeResult[]; query: string }) {
  const mobileCols  = chunkLeftToRight(dupes, 2);
  const tabletCols  = chunkLeftToRight(dupes, 3);
  const desktopCols = chunkLeftToRight(dupes, 4);
  return (
    <>
      <div className="flex gap-3 sm:hidden">
        {mobileCols.map((col, i) => (
          <DupeColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} query={query} />
        ))}
      </div>
      <div className="hidden sm:flex lg:hidden gap-3">
        {tabletCols.map((col, i) => (
          <DupeColumn key={i} items={col} gapClass="gap-3" startIndex={i * 100} query={query} />
        ))}
      </div>
      <div className="hidden lg:flex gap-4">
        {desktopCols.map((col, i) => (
          <DupeColumn key={i} items={col} gapClass="gap-4" startIndex={i * 100} query={query} />
        ))}
      </div>
    </>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-border border-t-brand animate-spin" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
