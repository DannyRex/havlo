"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchX, Sparkles } from "lucide-react";
import SearchBar from "@/components/compare/SearchBar";
import PriceResults from "@/components/compare/PriceResults";
import GroupCard from "@/components/compare/GroupCard";
import type { SearchOutput } from "@/lib/search";

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const initialKey   = searchParams.get("key") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchOutput | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchByKey = useCallback(async (key: string, displayQ: string) => {
    setQuery(displayQ);
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

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    // Plain text search clears any drilled-in key from the URL
    router.replace(`/compare?q=${encodeURIComponent(q)}`, { scroll: false });
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/compare?q=${encodeURIComponent(q)}`);
      setResult(await res.json() as SearchOutput);
    } catch {
      setResult({ mode: "empty", query: q, suggestions: [] });
    } finally {
      setLoading(false);
    }
  }, [router]);

  // React to URL changes — both initial load and clicks on group cards (which
  // change `?key=` while we stay on /compare) should trigger the right fetch.
  useEffect(() => {
    if (initialKey) fetchByKey(initialKey, initialQuery);
    else if (initialQuery) handleSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, initialQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <SearchBar initialQuery={query} onSearch={handleSearch} loading={loading} />

      {/* Loading skeletons */}
      {loading && (
        <div className="mt-10 max-w-3xl mx-auto space-y-3">
          <div className="skeleton h-28 rounded-2xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      )}

      {/* SINGLE — one product, many stores */}
      {!loading && result?.mode === "single" && (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <PriceResults group={result.group} />
          </div>
          {result.alternatives.length > 0 && (
            <aside>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={15} className="text-brand-400" />
                <h2 className="text-sm font-semibold text-white tracking-tight">Similar products</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">Other options in {result.group.category} you might want to compare.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {result.alternatives.map((g) => <GroupCard key={g.key} g={g} />)}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* LIST — vague query, show many product groups */}
      {!loading && result?.mode === "list" && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white tracking-tight">
              Found {result.total} products matching <span className="text-slate-400">&ldquo;{result.query}&rdquo;</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-6 max-w-2xl">
            Pick one to see its price across every store. Add more detail to your search (brand, model, storage) to jump straight to a comparison.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-5 sm:gap-y-7">
            {result.groups.map((g) => <GroupCard key={g.key} g={g} />)}
          </div>
        </div>
      )}

      {/* Empty / no results */}
      {!loading && result?.mode === "empty" && query && (
        <div className="mt-16">
          <div className="max-w-md mx-auto text-center mb-10">
            <SearchX size={28} className="text-slate-600 mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="text-base font-medium text-white mb-1">No matches for &ldquo;{query}&rdquo;</h3>
            <p className="text-sm text-slate-500">
              Try a broader or different search term — e.g. just the brand or category.
            </p>
          </div>

          {result.suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-5 max-w-7xl mx-auto">
                <Sparkles size={15} className="text-brand-400" />
                <h2 className="text-sm font-semibold text-white tracking-tight">You might be looking for</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-5 sm:gap-y-7">
                {result.suggestions.map((g) => <GroupCard key={g.key} g={g} />)}
              </div>
            </div>
          )}
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
