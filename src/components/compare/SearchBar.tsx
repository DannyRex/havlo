"use client";

import { useState } from "react";
import { Search, ArrowRight, X } from "lucide-react";
import { popularSearches } from "@/lib/data/compare";

interface Props {
  initialQuery: string;
  onSearch: (query: string) => void;
  loading: boolean;
}

export default function SearchBar({ initialQuery, onSearch, loading }: Props) {
  const [value, setValue] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">
          Price comparison
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-[-0.04em] mb-3">
          Check who's selling it for{" "}
          <span style={{
            background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            less
          </span>
        </h1>
        <p className="text-slate-500 text-sm sm:text-base max-w-lg mx-auto">
          One search. Every price. No more tab-hopping.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
             style={{ background: "rgba(0,87,255,0.15)" }} />
        <div className="relative flex items-center glass rounded-2xl border border-white/[0.08]
                        hover:border-brand-600/40 focus-within:border-brand-600 transition-all duration-200">
          <Search size={18} className="ml-4 sm:ml-5 text-slate-500 flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search for a phone, TV, console, sneaker..."
            className="flex-1 px-3 sm:px-4 py-4 bg-transparent text-white placeholder-slate-500 text-base outline-none min-w-0"
          />
          {value && (
            <button type="button" onClick={() => setValue("")}
                    className="p-2 text-slate-500 hover:text-white transition-colors flex-shrink-0">
              <X size={16} />
            </button>
          )}
          <button type="submit" disabled={!value.trim() || loading}
                  className="m-1.5 sm:m-2 btn-primary rounded-xl px-4 sm:px-5 py-2.5 text-sm gap-2 flex-shrink-0
                             disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline">Check prices</span>
                <span className="sm:hidden">Go</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Popular searches */}
      {!initialQuery && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="text-xs text-slate-600 self-center mr-1">Try:</span>
          {popularSearches.map((s) => (
            <button key={s}
                    onClick={() => { setValue(s); onSearch(s); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-400
                               border border-white/[0.06] hover:border-white/[0.15]
                               hover:text-white hover:bg-white/[0.05] transition-all">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
