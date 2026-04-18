"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import SearchBar from "@/components/compare/SearchBar";
import PriceResults from "@/components/compare/PriceResults";
import AlternativeCard from "@/components/compare/AlternativeCard";
import { ShieldCheck, Zap, Banknote } from "lucide-react";
import type { SearchResult } from "@/types";

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    router.replace(`/compare?q=${encodeURIComponent(q)}`, { scroll: false });
    setLoading(true);
    setResult(null);

    // Simulate API latency for realism
    await new Promise((r) => setTimeout(r, 600));

    const res = await fetch(`/api/compare?q=${encodeURIComponent(q)}`);
    const data: SearchResult = await res.json();
    setResult(data);
    setLoading(false);
  }, [router]);

  // Auto-search if query in URL
  useEffect(() => {
    if (initialQuery) handleSearch(initialQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Search */}
      <SearchBar initialQuery={query} onSearch={handleSearch} loading={loading} />

      {/* Loading state */}
      {loading && (
        <div className="mt-12 max-w-3xl mx-auto">
          <div className="glass rounded-2xl p-5 border border-white/[0.06] mb-4 flex items-center gap-5">
            <div className="skeleton w-20 h-20 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-3 w-24 rounded-full" />
              <div className="skeleton h-5 w-64 rounded-full" />
              <div className="skeleton h-4 w-48 rounded-full" />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl mb-3" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Price comparison (left, 2/3) */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-lg font-bold text-white">Store prices</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 border border-white/[0.08]">
                {result.prices.length} retailers
              </span>
            </div>
            <PriceResults result={result} />
          </div>

          {/* Alternatives (right, 1/3) */}
          {result.alternatives.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-lg font-bold text-white">Better-value picks</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 border border-white/[0.08]">
                  {result.alternatives.length}
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                If the exact item feels overpriced, these are similar options worth a look.
              </p>
              <div className="space-y-4">
                {result.alternatives.map((alt) => (
                  <AlternativeCard key={alt.id} alt={alt} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty / intro state */}
      {!result && !loading && (
        <div className="mt-16 sm:mt-20">
          {/* How it works */}
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h3 className="text-xl font-bold text-white mb-2">
              Search any product. See every price.
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Type what you want to buy and we'll check major Nigerian retailers so you don't have to open a pile of tabs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                icon: <Zap size={20} className="text-deal-cyan" />,
                title: "Instant comparison",
                desc: "Prices from multiple stores in one view — ranked lowest to highest.",
              },
              {
                icon: <ShieldCheck size={20} className="text-deal-green" />,
                title: "Unbiased results",
                desc: "We don't take commissions. The cheapest option always wins.",
              },
              {
                icon: <Banknote size={20} className="text-deal-orange" />,
                title: "Naira pricing",
                desc: "Every price in NGN. No currency surprises at checkout.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="glass rounded-2xl p-5 border border-white/[0.05] text-center">
                <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-3 bg-white/[0.04]">
                  {icon}
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
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
        <div className="w-6 h-6 rounded-full border-2 border-brand-600/30 border-t-brand-600 animate-spin" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
