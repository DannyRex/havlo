"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchX, Sparkles, ArrowDown, ExternalLink, Plane, CheckCircle, AlertCircle } from "lucide-react";
import SearchBar from "@/components/compare/SearchBar";
import Image from "next/image";
import PriceResults from "@/components/compare/PriceResults";
import DupeCard from "@/components/compare/DupeCard";
import { formatNaira } from "@/lib/utils";
import { trackClick } from "@/lib/trackClick";
import type { SearchOutput } from "@/lib/search";
import type { SniffResult } from "@/app/api/sniff/route";

/** Mirrors the check in url-parser.ts — avoids importing server code here. */
function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  return /^https?:\/\//i.test(t) || /^(www\.|[a-z]+\.(com|ng|co))/i.test(t);
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const initialKey   = searchParams.get("key") ?? "";

  const [query, setQuery]             = useState(initialQuery);
  const [result, setResult]           = useState<SearchOutput | null>(null);
  const [loading, setLoading]         = useState(false);
  const [sniffResult, setSniffResult] = useState<SniffResult | null>(null);
  const [sniffLoading, setSniffLoading] = useState(false);

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

  /* ── URL path: sniff → extract title → search ───────────────────────── */
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
      // Network error — proceed with slug fallback
    } finally {
      setSniffLoading(false);
    }

    // Use AI-extracted title if available, otherwise fall back to raw URL
    // which vectorFindSimilarByUrl will handle via slug parsing.
    const searchTerm = sniff?.ok && sniff.title ? sniff.title : rawUrl;

    setLoading(true);
    try {
      const endpoint = sniff?.ok && sniff.title
        ? `/api/compare?q=${encodeURIComponent(searchTerm)}&mode=similar`
        : `/api/compare?q=${encodeURIComponent(rawUrl)}&mode=similar`;
      const res = await fetch(endpoint);
      setResult(await res.json() as SearchOutput);
    } catch {
      setResult({ mode: "empty", query: searchTerm, suggestions: [] });
    } finally {
      setLoading(false);
    }
  }, [router]);

  /* ── Text search ────────────────────────────────────────────────────── */
  const handleSearch = useCallback(async (q: string) => {
    if (looksLikeUrl(q)) { handleUrlSearch(q); return; }

    setQuery(q);
    setSniffResult(null);
    const params = new URLSearchParams({ q, mode: "similar" });
    router.replace(`/compare?${params.toString()}`, { scroll: false });
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/compare?q=${encodeURIComponent(q)}&mode=similar`);
      setResult(await res.json() as SearchOutput);
    } catch {
      setResult({ mode: "empty", query: q, suggestions: [] });
    } finally {
      setLoading(false);
    }
  }, [router, handleUrlSearch]);

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
                        border border-white/[0.08] bg-white/[0.02]">
          <span className="w-4 h-4 rounded-full border-2 border-white/10 border-t-white/60 animate-spin shrink-0" />
          <p className="text-sm text-slate-400">Analysing link…</p>
        </div>
      )}

      {/* ── Sniff result card (kept visible above results as context) ── */}
      {sniffResult && !sniffLoading && (
        <div className={`mt-8 max-w-lg mx-auto flex items-center gap-4 px-5 py-4 rounded-2xl border ${
          sniffResult.ok
            ? "border-emerald-500/20 bg-emerald-500/[0.03]"
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
                <p className="text-[11px] text-emerald-400/70 mb-0.5">
                  Found on {sniffResult.store}
                </p>
                <p className="text-sm font-medium text-white line-clamp-2">
                  {sniffResult.title}
                </p>
                {sniffResult.price != null && sniffResult.currency && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {sniffResult.currency === "NGN"
                      ? formatNaira(sniffResult.price)
                      : `${sniffResult.currency} ${sniffResult.price.toLocaleString()}`}
                    {" "}on {sniffResult.store}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-amber-300/80">
                Could not read that page — searching by URL instead.
              </p>
            )}
          </div>
          {sniffResult.ok ? (
            <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
          )}
        </div>
      )}

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
        <div className="mt-10">
          {/* Anchor hero card */}
          <div className="relative max-w-3xl mx-auto mb-10">
            <div className="relative p-5 sm:p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01]
                          overflow-hidden">
              {/* Subtle glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-emerald-500/[0.06] blur-3xl pointer-events-none" />

              <div className="relative flex items-start gap-4 sm:gap-5">
                {/* Image */}
                {result.anchor.imageUrl ? (
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                    <img src={result.anchor.imageUrl} alt={result.anchor.title}
                         className="w-full h-full object-contain p-2" />
                  </div>
                ) : (
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                       style={{ background: result.anchor.imageGradient }}>
                    {result.anchor.imageEmoji}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded">
                      Your pick
                    </span>
                    {result.anchor.brand && (
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        {result.anchor.brand}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-white leading-snug line-clamp-2">
                    {result.anchor.title}
                  </h2>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-2">
                    <span className="text-lg sm:text-xl font-bold text-white">
                      {formatNaira(result.anchor.bestPrice)}
                    </span>
                  </div>

                  {/* Anchor store links */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {result.anchor.offers.slice(0, 4).map((offer, i) => (
                      <a
                        key={`${offer.storeId}-${offer.price}`}
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        onClick={() => trackClick(result.anchor.key, query, i, "similar-anchor")}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                                   border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-all text-slate-400 hover:text-white"
                      >
                        <div className="w-4 h-4 rounded overflow-hidden shrink-0 bg-white/[0.08]">
                          <Image src={offer.storeLogoUrl} alt={offer.storeName} width={16} height={16} className="object-contain"
                                 onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        {offer.storeName}
                        {offer.isInternational && offer.landedCostExtra > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-400/80">
                            <Plane size={8} />
                          </span>
                        )}
                        <ExternalLink size={9} className="text-slate-600" />
                      </a>
                    ))}
                  </div>

                  {result.dupes.length > 0 && result.dupes[0].savingsPercent > 0 && (
                    <p className="mt-3 text-xs text-emerald-400/80">
                      We found alternatives starting at {formatNaira(result.dupes.reduce((min, d) => Math.min(min, d.bestPrice), Infinity))}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Connector line */}
            {result.dupes.length > 0 && (
              <div className="flex flex-col items-center mt-5 mb-2">
                <div className="w-px h-6 bg-gradient-to-b from-white/10 to-emerald-500/30" />
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <ArrowDown size={12} className="text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    {result.dupes.length} alternative{result.dupes.length > 1 ? "s" : ""} found
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Dupes grid */}
          {result.dupes.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {result.dupes.map((dupe, i) => (
                <DupeCard key={dupe.key} dupe={dupe} rank={i} query={query} mode="similar" />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="max-w-sm mx-auto">
                <SearchX size={28} className="text-slate-600 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white font-medium mb-1">No alternatives found</p>
                <p className="text-xs text-slate-500">
                  We couldn&apos;t find similar products at a lower price. Try a different
                  product or a broader search like &quot;earbuds&quot; or &quot;laptop&quot;.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty / no results ── */}
      {!loading && result?.mode === "empty" && query && (
        <div className="mt-16">
          <div className="max-w-md mx-auto text-center mb-10">
            <SearchX size={28} className="text-slate-600 mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="text-base font-medium text-white mb-1">No matches for &ldquo;{query}&rdquo;</h3>
            <p className="text-sm text-slate-500">
              Try a broader or different search term — e.g. just the brand or category.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white animate-spin" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
