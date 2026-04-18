"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";

interface Suggestion { title: string; key: string; storeCount: number }

interface Props {
  initialQuery: string;
  onSearch: (query: string) => void;
  loading: boolean;
}

const SUGGESTIONS = [
  "iPhone 15 Pro Max", "Galaxy A06", "Hisense 50 inch TV",
  "PlayStation 5", "Tecno Spark 30", "MacBook Pro M3", "AirPods Pro",
];

export default function SearchBar({ initialQuery, onSearch, loading }: Props) {
  const [value, setValue] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setValue(initialQuery); }, [initialQuery]);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.items ?? []))
        .catch(() => setSuggestions([]));
    }, 180);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (q: string) => {
    setOpen(false);
    setHighlighted(-1);
    if (q.trim()) onSearch(q.trim());
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const pick = highlighted >= 0 ? suggestions[highlighted]?.title : value;
      if (pick) submit(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto" ref={wrapRef}>
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-2">
          Compare prices across stores
        </h1>
        <p className="text-sm text-slate-500">
          Be specific — "iPhone 15 Pro Max 256GB" beats "phone".
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(value); }} className="relative">
        <div className="relative flex items-center bg-white/[0.04] border border-white/10 rounded-full focus-within:border-white/30 transition-colors">
          <Search size={16} className="absolute left-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true); setHighlighted(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder="Search any product…"
            className="flex-1 pl-11 pr-3 py-3.5 bg-transparent text-white placeholder-slate-500 text-sm sm:text-base outline-none"
            autoFocus
          />
          {value && (
            <button type="button" onClick={() => { setValue(""); setSuggestions([]); }}
                    className="p-2 text-slate-500 hover:text-white">
              <X size={15} />
            </button>
          )}
          <button type="submit" disabled={!value.trim() || loading}
                  className="m-1.5 px-4 py-2 rounded-full bg-white text-navy-900 text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-navy-900/30 border-t-navy-900 animate-spin" />
            ) : (
              <>Compare <ArrowRight size={14} /></>
            )}
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {open && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-navy-800 border border-white/10 rounded-2xl overflow-hidden shadow-xl z-50">
            {suggestions.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); submit(s.title); }}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-sm transition-colors ${
                  highlighted === i ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-white truncate">{s.title}</span>
                <span className="text-[11px] text-slate-500 shrink-0">{s.storeCount} store{s.storeCount > 1 ? "s" : ""}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {!initialQuery && suggestions.length === 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="text-xs text-slate-500 self-center mr-1">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => { setValue(s); submit(s); }}
                    className="px-3 py-1.5 rounded-full text-xs text-slate-300 border border-white/10 hover:border-white/25 hover:text-white transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
