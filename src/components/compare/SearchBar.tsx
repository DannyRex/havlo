"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Sparkles, Link2, ArrowUp } from "lucide-react";

interface Suggestion { title: string; key: string; storeCount: number }

interface Props {
  initialQuery: string;
  onSearch: (query: string) => void;
  loading: boolean;
}

/* Pool of recognizable, high-intent search terms across every
   category Havlo covers. Random 6 picked per page load → users
   see fresh chips between visits, same chips while they're on
   the page. */
const SUGGESTIONS_POOL = [
  // Phones — Apple
  "iPhone 16 Pro Max", "iPhone 15", "iPhone 15 Pro Max", "iPad Pro M4", "iPad Air",
  // Phones — Android
  "Galaxy S24 Ultra", "Galaxy A15", "Pixel 9 Pro", "Tecno Camon 30",
  "Infinix Hot 50", "Redmi Note 14",
  // Computing
  "MacBook Pro M4", "MacBook Air M3", "HP Pavilion 15", "Dell XPS 13",
  "Lenovo IdeaPad 3", "ASUS ROG laptop",
  // TVs + Electronics
  "Hisense 50 inch TV", "Samsung 55 inch TV", "LG OLED TV", "Sony Bravia",
  "Smart projector",
  // Audio
  "AirPods Pro 2", "AirPods Max", "Sony WH-1000XM5", "Bose QuietComfort",
  "JBL Charge 5", "Marshall Stanmore", "Beats Studio Pro",
  // Gaming
  "PlayStation 5", "Xbox Series X", "Nintendo Switch OLED", "Steam Deck",
  // Appliances
  "Hisense fridge", "LG washing machine", "Air fryer", "Microwave oven",
  // Beauty + lifestyle
  "Apple Watch Series 10", "Garmin Forerunner", "Hair dryer", "Electric trimmer",
  // Fashion
  "Nike Air Force 1", "Adidas Samba", "Yeezy Slides",
];

/* Fisher–Yates shuffle, returns first N. Pure function so the lazy
   useState initializer below can call it safely. */
function pickRandom<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  return /^https?:\/\//i.test(t) || /^(www\.|[a-z]+\.(com|ng|co))/i.test(t);
}

export default function SearchBar({ initialQuery, onSearch, loading }: Props) {
  const [value, setValue] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Randomized chip set with three refresh triggers:
       1. Initial pick on first client render (post-hydration)
       2. Re-pick on every empty-input transition (clear/backspace-all)
       3. Auto-rotate every 5s while chips are visible (input empty)

     IMPORTANT: initial state is the deterministic first-6 of the pool,
     NOT a random pick. A lazy initializer with Math.random() runs both
     on the server (during SSR) and on the client (during hydration),
     producing different chips on each side → hydration mismatch error.
     We render the deterministic 6 for SSR + first hydration paint,
     then swap to random in the post-mount effect below. */
  const [chips, setChips] = useState<string[]>(() => SUGGESTIONS_POOL.slice(0, 6));
  const prevValue = useRef(initialQuery);

  /* Initial random pick — runs only on client, after hydration. */
  useEffect(() => {
    setChips(pickRandom(SUGGESTIONS_POOL, 6));
  }, []);

  /* Re-pick on transition non-empty → empty. */
  useEffect(() => {
    if (prevValue.current && !value) {
      setChips(pickRandom(SUGGESTIONS_POOL, 6));
    }
    prevValue.current = value;
  }, [value]);

  /* Auto-rotate while chips are visible. 5s. Runs unconditionally —
     the prefers-reduced-motion guard was overzealous (that media
     query targets vestibular-issue animations like spin/parallax,
     not periodic content swaps). The fade-in CSS on each chip is
     gentle enough; users who really want zero animation can disable
     it via the chip's own animate-fade-in class which respects
     motion-reduce: at the Tailwind level. */
  useEffect(() => {
    if (value.trim()) return;
    const id = setInterval(() => {
      setChips(pickRandom(SUGGESTIONS_POOL, 6));
    }, 5000);
    return () => clearInterval(id);
  }, [value]);

  useEffect(() => { setValue(initialQuery); }, [initialQuery]);

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

  const isUrlInput = looksLikeUrl(value);
  const canSubmit = value.trim().length > 0 && !loading;

  return (
    <div className="max-w-2xl mx-auto px-1 sm:px-0" ref={wrapRef}>
      {/* Heading */}
      <div className="text-center mb-5 sm:mb-6 px-2">
        <h1 className="text-[24px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight mb-2">
          Find similar products for less
        </h1>
        <p className="text-[13px] sm:text-sm text-ink-2">
          Search a product or paste a link. We&apos;ll find cheaper alternatives.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(value); }}
        className="relative"
      >
        <div
          className={`relative flex items-center bg-surface border rounded-full transition-all ${
            isUrlInput
              ? "border-brand/40 focus-within:border-brand focus-within:shadow-input"
              : "border-border-strong focus-within:border-brand focus-within:shadow-input"
          }`}
        >
          {/* Left icon */}
          <div className="absolute left-4 pointer-events-none">
            {isUrlInput ? (
              <Link2 size={16} className="text-brand" />
            ) : (
              <Search size={16} className="text-ink-3" />
            )}
          </div>

          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true); setHighlighted(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder="Search or paste a link…"
            className="flex-1 min-w-0 pl-11 pr-2 py-3.5 bg-transparent text-ink placeholder:text-ink-3 text-base outline-none"
            style={{ fontSize: "16px" }}
            autoFocus
          />

          {value && (
            <button
              type="button"
              onClick={() => { setValue(""); setSuggestions([]); }}
              aria-label="Clear search"
              className="p-2 text-ink-3 hover:text-ink shrink-0"
            >
              <X size={16} />
            </button>
          )}

          {/* Submit button — icon-only on mobile, label on sm+ */}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={isUrlInput ? "Smart switch" : "Find dupes"}
            className={`m-1.5 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-all
              h-10 w-10 sm:h-10 sm:w-auto sm:px-4
              ${canSubmit
                ? isUrlInput
                  ? "bg-brand text-white hover:bg-brand-hover active:scale-95"
                  : "bg-ink text-bg hover:opacity-90 active:scale-95"
                : "bg-ink/10 text-ink-3 cursor-not-allowed"}`}
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : isUrlInput ? (
              <>
                <Link2 size={14} className="sm:hidden" />
                <span className="hidden sm:inline">Smart switch</span>
                <Link2 size={14} className="hidden sm:inline" />
              </>
            ) : (
              <>
                <ArrowUp size={16} className="sm:hidden" strokeWidth={2.5} />
                <span className="hidden sm:inline">Find dupes</span>
                <Sparkles size={14} className="hidden sm:inline" />
              </>
            )}
          </button>
        </div>

        {open && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-surface border border-border rounded-2xl overflow-hidden shadow-xl z-50">
            {suggestions.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); submit(s.title); }}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-sm transition-colors ${
                  highlighted === i ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span className="text-ink truncate">{s.title}</span>
                <span className="text-[11px] text-ink-3 shrink-0">
                  {s.storeCount} store{s.storeCount > 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </form>

      <p className="mt-3 text-center text-[11px] sm:text-xs text-ink-3 px-4">
        {isUrlInput
          ? "We'll identify this product and find cheaper alternatives across stores."
          : "Paste a Jumia, Amazon, or AliExpress link, or search by name."}
      </p>

      {/* Show chips whenever the live input is empty, regardless of
          whether initialQuery was set. Clearing the field returns the
          chips. (Old condition checked initialQuery, which stays set
          even after clear, so chips never came back.) */}
      {!value.trim() && suggestions.length === 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2 px-2">
          <span className="text-xs text-ink-3 self-center mr-1">Try:</span>
          {chips.map((s) => (
            <button
              /* keying on the chip text makes React mount a new node when
                 the value changes — which lets the fade-in CSS replay on
                 every rotation. animate-fade-in is defined globally. */
              key={s}
              type="button"
              onClick={() => { setValue(s); submit(s); }}
              className="px-3 py-1.5 rounded-full text-xs text-ink-2 hover:text-ink bg-surface-2 hover:bg-surface border border-border hover:border-border-strong transition-colors animate-fade-in"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
