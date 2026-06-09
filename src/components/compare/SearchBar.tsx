"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, TrendingDown, Link2, ArrowUp } from "lucide-react";
import { useCountry } from "@/components/providers/CountryProvider";
import { track, extractDomain } from "@/lib/analytics";
import { trackClick, isTrackableProductId } from "@/lib/trackClick";
import { formatCount } from "@/lib/utils";

interface Suggestion { title: string; key: string; storeCount: number }

interface Props {
  initialQuery: string;
  /* pid — the product_id of a picked autocomplete suggestion. Passed
     through so the parent can anchor /compare on exactly that product
     instead of re-running a fuzzy FTS match that can mis-anchor. */
  onSearch: (query: string, pid?: string) => void;
  loading: boolean;
  /* When true, the "Try:" chip rail under the input is hidden.
     Set on /compare where the dedicated TrendingChipRail above
     already surfaces the same multi-store-backed suggestions
     with friendlified labels — two chip rails competing for the
     same attention was the round-4 user complaint. */
  hideTrendingChips?: boolean;
  /* Optional clear-callback. Fired when the user clicks the X
     in the input. Lets the parent (e.g. /compare) clear its own
     query state so dependent UI (chip rails, empty states) can
     re-render. Without this, the X only cleared SearchBar's
     internal value and the parent kept its stale query → the
     Popular comparisons chip rail wouldn't reappear. */
  onClear?: () => void;
}

/* Two recognisable local stores per country, used in the
   "Paste a {storeA}, Amazon, or AliExpress link" hint under the
   search bar. Before this fix the hint always said
   "Paste a Jumia, Amazon, or AliExpress link" — fine for NG users,
   immediately wrong-region for the UK / US / DE shopper landing
   on /uk/compare. The store the user sees here should be a brand
   they'd recognise from their own market. */
const HINT_STORES_BY_COUNTRY: Record<string, string> = {
  ng: "Konga, Amazon, or AliExpress",
  uk: "Argos, Amazon, or AliExpress",
  us: "Walmart, Amazon, or AliExpress",
  de: "Otto, Amazon, or AliExpress",
  ae: "Noon, Amazon, or AliExpress",
  in: "Flipkart, Amazon, or AliExpress",
  za: "Takealot, Amazon, or AliExpress",
};

function hintStores(countryCode: string): string {
  return HINT_STORES_BY_COUNTRY[countryCode] ?? "Amazon, eBay, or AliExpress";
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

export default function SearchBar({ initialQuery, onSearch, loading, hideTrendingChips = false, onClear }: Props) {
  const [value, setValue] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  /* Track whether the user has actively interacted with the input
     since mount. When the user lands on /compare?q=foo with a query
     already in the URL, the input gets autoFocus + onFocus → the
     suggestions panel was popping open unprompted on every page
     load, even though the user clearly already has a query.
     Now: suggestions only auto-open AFTER an onChange OR when the
     input is empty (the trending-chips case still wants to surface
     ideas). */
  const [hasInteracted, setHasInteracted] = useState(false);
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
  /* Pool of candidate chip strings. Starts with the hand-curated
     fallback (deterministic for SSR), then replaced after mount
     by a live list of products that have AT LEAST 2 distinct
     stores carrying them. That guarantees clicking a chip always
     leads to a real multi-store comparison rather than a single-
     listing page. Fetched from /api/popular-suggestions which is
     edge-cached for 10 min and falls back to [] if Supabase is
     down — in that case we keep using the hand-curated pool. */
  /* Chip shape: { title } for the static fallback (no pid available)
     and { title, key } for the dynamic pool from /api/popular-suggestions.
     The key — when present — is the product_id, which the click handler
     passes to submit() so the resulting /compare URL uses pid= instead
     of just q=. Direct pid lookup is GUARANTEED to find the anchor (it
     came from the same DB); a q= text search can miss because of FTS
     drift between the cleaned chip label and the indexed title. */
  type Chip = { title: string; key?: string };
  const STATIC_CHIPS: Chip[] = SUGGESTIONS_POOL.map((title) => ({ title }));
  const [chipPool, setChipPool] = useState<Chip[]>(STATIC_CHIPS);
  const [chips, setChips] = useState<Chip[]>(() => STATIC_CHIPS.slice(0, 6));
  const prevValue = useRef(initialQuery);

  const { country } = useCountry();

  /* Pull the live multi-store-backed pool on mount AND whenever the
     user switches country. The API filters to products with at least
     one store in the requested country, so a UK chip pool only shows
     items UK shoppers can actually compare locally. Replace the
     hand-curated pool only when we get >= 6 candidates so the
     rotation has variety; below that the thin live list would
     immediately repeat. Static pool stays as the no-Supabase fallback
     and the SSR/hydration baseline. */
  useEffect(() => {
    const cc = country?.code ?? "ng";
    fetch(`/api/popular-suggestions?country=${encodeURIComponent(cc)}`)
      .then((r) => r.json())
      .then((d) => {
        const items: Array<{ title: string; key?: string }> = Array.isArray(d?.items) ? d.items : [];
        /* Only keep items that carry a real pid (key) — those are the
           ones we can lookup directly and guarantee land on a multi-
           store anchor. Items without a key would fall back to text-
           search at click time and reintroduce the empty-result bug. */
        const withKeys: Chip[] = items
          .filter((i) => i.title && i.key)
          .map((i) => ({ title: i.title, key: i.key }));
        if (withKeys.length >= 6) setChipPool(withKeys);
        else setChipPool(STATIC_CHIPS);  // thin country pool → fall back
      })
      .catch(() => { /* keep current pool on failure */ });
  }, [country?.code]);

  /* Initial random pick from the active pool. Re-runs whenever the
     pool itself changes (i.e., when /api/popular-suggestions lands). */
  useEffect(() => {
    setChips(pickRandom(chipPool, 6));
  }, [chipPool]);

  /* Re-pick on transition non-empty → empty. */
  useEffect(() => {
    if (prevValue.current && !value) {
      setChips(pickRandom(chipPool, 6));
    }
    prevValue.current = value;
  }, [value, chipPool]);

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
      setChips(pickRandom(chipPool, 6));
    }, 5000);
    return () => clearInterval(id);
  }, [value, chipPool]);

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

  const submit = (q: string, pid?: string) => {
    setOpen(false);
    setHighlighted(-1);
    const trimmed = q.trim();
    if (!trimmed) return;
    /* Branch the analytics event by input shape — paste-link is a
       different funnel from a typed search and we want to read them
       separately in GA4. extractDomain returns 'unknown' if the URL
       doesn't parse, so the event still fires for malformed pastes. */
    if (/^https?:\/\//i.test(trimmed)) {
      track({
        name: "paste_link",
        props: { domain: extractDomain(trimmed), country: country?.code },
      });
    } else {
      track({
        name: "search_submit",
        props: { query: trimmed, source: "compare", country: country?.code },
      });
    }
    onSearch(trimmed, pid);
    /* Autocomplete pick on a specific product = intent to view it →
       feeds the same popularity/trending count as the compare rows.
       isTrackableProductId also covers the `if (pid)` truthiness check
       and additionally drops synthetic provider keys. */
    if (isTrackableProductId(pid)) trackClick(pid, trimmed, 0, "autocomplete");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      /* A highlighted suggestion is a specific product — pass its key
         as the pid backstop so /compare anchors on exactly that
         product instead of re-running a fuzzy title match. */
      const picked = highlighted >= 0 ? suggestions[highlighted] : null;
      if (picked) submit(picked.title, picked.key);
      else if (value.trim()) submit(value);
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
          One product, every store that sells it, lowest price first.
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
            onChange={(e) => {
              setValue(e.target.value);
              setHasInteracted(true);
              setOpen(true);
              setHighlighted(-1);
            }}
            onFocus={() => {
              /* Don't pop the suggestions on the initial autoFocus
                 when the URL already carried a query (e.g.
                 /compare?q=iPhone+15). User reported this surfaced
                 the dropdown on every navigation. Once they've
                 typed OR the input is empty (trending-chips intent),
                 the normal open-on-focus behaviour resumes. */
              if (hasInteracted || !value.trim()) setOpen(true);
            }}
            onKeyDown={onKey}
            placeholder="Search or paste a link…"
            className="flex-1 min-w-0 pl-11 pr-2 py-3.5 bg-transparent text-ink placeholder:text-ink-3 text-base outline-none"
            style={{ fontSize: "16px" }}
            autoFocus
          />

          {value && (
            <button
              type="button"
              /* Clearing the input fires onClear so the parent
                 page can drop its own query state (and the chip
                 rail re-renders). Previous results are left
                 untouched — user can scroll between fresh chips
                 above and prior results below. */
              onClick={() => { setValue(""); setSuggestions([]); onClear?.(); }}
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
            aria-label={isUrlInput ? "Smart switch" : "Find cheaper"}
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
                <span className="hidden sm:inline">Find this</span>
                <Link2 size={14} className="hidden sm:inline" />
              </>
            ) : (
              <>
                <ArrowUp size={16} className="sm:hidden" strokeWidth={2.5} />
                <span className="hidden sm:inline">Find cheaper</span>
                <TrendingDown size={14} className="hidden sm:inline" />
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
                onMouseDown={(e) => { e.preventDefault(); submit(s.title, s.key); }}
                /* No onMouseEnter→setHighlighted: `highlighted` stays
                   KEYBOARD-only (Arrow keys). Mouse hover gets its
                   visual from the `hover:` class below, not from
                   highlight state. Letting hover drive `highlighted`
                   meant the Enter handler would submit whatever
                   suggestion the cursor happened to rest over — so
                   typing a fresh query and pressing Enter could anchor
                   /compare on a sibling the mouse was incidentally
                   hovering (regression A5: "iPhone 15" mis-anchored to
                   "iPhone 15 Plus" when a prior search had left the
                   cursor over the dropdown). A deliberate click still
                   picks the suggestion via onMouseDown above. */
                /* Round-4 QA: round-3 horizontal flex (title + count
                   side-by-side) was still clipping titles to "Apple
                   i..." on mobile because the input itself was too
                   narrow for the storeCount badge AND a readable
                   title to coexist on one row. Vertical stack:
                   title on its own line (gets full row width),
                   storeCount badge below as small metadata. The
                   title wraps cleanly to up to 2 lines via line-
                   clamp-2 and the user sees enough to recognise the
                   product before tapping. */
                className={`w-full text-left px-4 py-2.5 flex flex-col items-start gap-1 text-sm transition-colors ${
                  highlighted === i ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span className="text-ink line-clamp-2 leading-snug w-full">{s.title}</span>
                <span className="text-[10px] text-ink-3 whitespace-nowrap">
                  {formatCount(s.storeCount)} store{s.storeCount > 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </form>

      <p className="mt-3 text-center text-[11px] sm:text-xs text-ink-3 px-4">
        {isUrlInput
          ? "We'll identify this product and find cheaper alternatives across stores."
          /* Country-aware hint. UK shoppers shouldn't be told to paste
             a Jumia link — they wouldn't know the brand and it
             undercuts trust. The HINT_STORES_BY_COUNTRY table picks
             two recognisable local stores per market.
             Phrased as "Paste a link to X" to sidestep the a/an
             grammar issue ("Paste a Argos" vs "Paste an Argos") that
             round-3 QA caught on /uk/compare. */
          : `Paste a link to ${hintStores(country.code)}, or search by name.`}
      </p>

      {/* Try-chips rail. Hidden when hideTrendingChips=true (set on
          /compare, where the dedicated TrendingChipRail above
          already surfaces multi-store-backed suggestions with
          friendlified labels — two chip rails was redundant per
          round-4 user feedback). */}
      {!hideTrendingChips && !value.trim() && suggestions.length === 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2 px-2">
          <span className="text-xs text-ink-3 self-center mr-1">Try:</span>
          {chips.map((c) => (
            <button
              /* keying on the chip text makes React mount a new node when
                 the value changes — which lets the fade-in CSS replay on
                 every rotation. animate-fade-in is defined globally. */
              key={c.title}
              type="button"
              /* When the chip carries a pid (dynamic chips from
                 /api/popular-suggestions), pass it to submit() so the
                 compare URL uses pid= and the anchor is found by
                 direct product_id lookup. Static chips with no key
                 fall back to text-search — they're SUGGESTIONS_POOL
                 entries which are hand-curated and match popular
                 catalog products by construction. */
              onClick={() => { setValue(c.title); submit(c.title, c.key); }}
              className="px-3 py-1.5 rounded-full text-xs text-ink-2 hover:text-ink bg-surface-2 hover:bg-surface border border-border hover:border-border-strong transition-colors animate-fade-in"
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
