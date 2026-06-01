"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { ArrowUp, Link2, Search as SearchIcon, Store as StoreIcon } from "lucide-react";
import Link from "next/link";
import {
  PhoneIcon, LaptopIcon, EarbudsIcon, TvIcon, GamingIcon,
  HomeIcon, FashionIcon, BeautyIcon, SportsIcon, AppliancesIcon,
} from "@/components/ui/CategoryIcons";
import { useCountry } from "@/components/providers/CountryProvider";
import { logSearchEvent } from "@/lib/search/log-search";
import ImageSearchButton from "@/components/search/ImageSearchButton";
import type { ComponentType } from "react";

/* Autocomplete suggestion shape — matches /api/suggest's response.
   storeCount drives the "12 stores" badge so the user has a price-
   comparison expectation set before clicking. */
interface SuggestionItem {
  title: string;
  key:   string;
  storeCount: number;
}

/* Each pill maps 1:1 to a real category slug from
   src/lib/data/categories.ts and applies that category filter on
   /deals — a filter, never a text search. Earlier the sub-category
   pills (Sneakers/TVs/Furniture) also dropped a `search` term into
   the /deals search box, which read as a search rather than a
   filter and was inconsistent with the top-level pills. Removed
   May 2026 per founder direction: a pill is a filter. */
type CatItem = {
  label: string;
  slug:  string;
  Icon:  ComponentType<{ size?: number; className?: string }>;
};

const CATEGORIES: CatItem[] = [
  { label: "Phones",     slug: "phones",      Icon: PhoneIcon },
  { label: "Laptops",    slug: "computing",   Icon: LaptopIcon },
  { label: "Sports",     slug: "sports",      Icon: SportsIcon },
  { label: "Earbuds",    slug: "audio",       Icon: EarbudsIcon },
  { label: "TVs",        slug: "electronics", Icon: TvIcon },
  { label: "Home",       slug: "home",        Icon: HomeIcon },
  { label: "Fashion",    slug: "fashion",     Icon: FashionIcon },
  { label: "Beauty",     slug: "beauty",      Icon: BeautyIcon },
  { label: "Gaming",     slug: "gaming",      Icon: GamingIcon },
  /* "Appliances" merged into the Electronics category (May 2026). Kept
     as a concrete doorway chip — its own icon, but routes to the
     merged ?category=electronics filter. */
  { label: "Appliances", slug: "electronics", Icon: AppliancesIcon },
];

interface Props {
  /** Rotating placeholder examples for the search box. Sourced from
      the live catalog via getPopularPlaceholderExamples (one popular
      multi-store product per category, country-aware). Empty/missing
      falls back to a static gadgets-heavy default that we keep for
      pre-migration / DB-down resilience — see Hero's internal logic
      for the fallback list. Length 4-8 is typical. */
  placeholderExamples?: string[];
  /** Number of stores in the user's country marquee. Drives the trust
      pill copy so the displayed count matches the marquee below
      instead of being a hardcoded "12+" guess. */
  storeCount: number;
  /** ISO-2 country code from the URL param (e.g. "ng", "uk"). Passed
      from the server-rendered country page so the hero subhead
      mentions the right country during SSR — useCountry() doesn't
      resolve until after hydration, which would otherwise show
      "We find it cheaper in" with an empty trailer. */
  countryCode: string;
  /** Full display name ("Nigeria", "United Kingdom"). */
  countryName: string;
}

/* Country-with-article phrase. The UK / US / UAE read better with
   "the" prefix in prose; bare country names ("Nigeria", "Germany",
   "India", "South Africa") don't. Falls back to the full name when
   the code isn't in the map. */
function countryPhrase(code: string, fullName: string): string {
  switch (code) {
    case "uk": return "the UK";
    case "us": return "the US";
    case "ae": return "the UAE";
    default:   return fullName;
  }
}

export default function Hero({ storeCount, countryCode, countryName, placeholderExamples: placeholderExamplesProp }: Props) {
  const router = useRouter();
  const { country } = useCountry();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  /* Search-as-you-type state.
     Debounced fetch of /api/suggest at 200ms after the user stops
     typing. The endpoint wraps the search_products_fts RPC and
     returns title + product_id + storeCount per match — same data
     /compare's anchor card would land on, so the dropdown promise
     matches the destination. */
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  /* Hide-after-blur delay: 150ms gives the click handler time to
     register before the dropdown disappears on focus loss. */
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Track the latest debounce timer so a rapid keystroke cancels
     the pending fetch. */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Sequence counter so a stale slow response can't clobber a
     newer one — matches the deals page fetchSeq pattern. */
  const fetchSeqRef = useRef(0);

  /* Rotating placeholder examples.
     ────────────────────────────────────────────────────────────
     The subhead above the composer already says "Paste a link or
     search any product. Havlo finds it cheaper in <country>." —
     the placeholder used to say "Search or paste a product link…"
     which was an exact echo of the same instruction.

     The placeholder rotates through concrete example queries (3.5s
     each) so it doubles as an idea-spark instead of repeating the
     subhead.

     Primary source: placeholderExamplesProp — server-fetched from
     getPopularPlaceholderExamples (src/lib/popular-placeholder-
     examples.ts) which calls the suggest_diverse_popular_products
     RPC. One product per category from the LIVE catalog, biased
     for cross-store popularity. Stays fresh as the catalog grows;
     30-min edge cache so the homepage SSR cost is bounded.

     Fallback list (when the prop is empty / undefined / too thin):
     hardcoded per-country category-spanning examples so the
     rotation works pre-migration and during DB outages. Same
     intent as the dynamic list — span phones / fashion / beauty /
     home / appliances / health rather than gadgets-only.

     Hydration-safe: the index starts at 0 (so SSR + first client
     render show the same first example) and only rotates after
     mount via the useEffect below. Suspended while the user is
     focused/typing so the placeholder doesn't shift mid-input. */
  const fallbackExamples = (() => {
    switch (countryCode) {
      case "ng": return ["iPhone 15 Pro", "Air Force 1", "AFNAN perfume", "Stanley Quencher", "Dyson V12", "Accu-Chek glucose meter"];
      case "uk": return ["AirPods 4", "Dyson Airwrap", "Le Creuset Dutch oven", "Air Max 95", "Charlotte Tilbury", "Garmin Forerunner"];
      case "us": return ["Stanley Quencher", "Yeti Rambler", "Dyson Airwrap", "Air Force 1", "Owala FreeSip", "AirPods 4"];
      case "de": return ["Bose QuietComfort", "Adidas Samba", "Le Creuset", "Dyson V12", "Garmin Fenix", "AirPods 4"];
      case "in": return ["OnePlus Nord", "boAt earbuds", "Nike Air Max", "Lakme foundation", "Stanley Quencher", "Apple Watch SE"];
      case "ae": return ["iPhone 15 Pro", "AFNAN perfume", "Dyson Airwrap", "Air Max 95", "Apple Watch Ultra", "Le Creuset"];
      case "za": return ["Yeti Rambler", "Adidas Samba", "Garmin Forerunner", "AirPods 4", "Le Creuset", "Air Force 1"];
      default:   return ["AirPods 4", "Air Force 1", "Dyson Airwrap", "Stanley Quencher", "Le Creuset", "Garmin Forerunner"];
    }
  })();
  const placeholderExamples = (placeholderExamplesProp && placeholderExamplesProp.length >= 4)
    ? placeholderExamplesProp
    : fallbackExamples;
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    /* Suspend rotation when the user has the box focused or has typed
       anything — shifting the placeholder text under their cursor is
       distracting. Resumes on blur with an empty box. */
    if (focused || query.length > 0) return;
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % placeholderExamples.length), 3500);
    return () => clearInterval(t);
  }, [focused, query.length, placeholderExamples.length]);

  /* Search routing — fork on intent:
       URL paste → /compare. The user has a specific product link,
         sniff-to-anchor extracts the title + price + image and the
         compare page builds a "cheaper than this exact item" view.
       Text search → /deals. Browse intent. Search queries are
         usually ambiguous ("phones", "iPhone 15", "running shoes")
         and the deals grid is the right surface for choosing
         between candidate products. From any /deals card the user
         hits the PDP, which has a "Compare prices across N stores"
         CTA into /compare for the deeper price-comparison view.

     Why this is the right shape: routing every search through
     /compare forced a single-product frame onto every query, which
     broke down the moment the query was a category ("sneakers") or
     a brand ("Adidas"). And /compare doesn't have a path TO the PDP,
     so users who landed there with a vague query had nowhere to
     drill into. /deals → PDP → /compare is the complete chain. */
  const submit = () => {
    const q = query.trim();
    if (!q) return;
    const isPastedUrl = /^https?:\/\//i.test(q);
    /* Fire-and-forget log to search_query_log. Powers popular-search
       suggestions + zero-result reporting. sendBeacon-backed so the
       insert survives the route change firing right after this. */
    logSearchEvent({ query: q, surface: "hero", mode: isPastedUrl ? "url" : "text" });
    if (isPastedUrl) {
      router.push(`/${country.code}/compare?q=${encodeURIComponent(q)}&mode=similar`);
      return;
    }
    /* origin=all forces /deals to skip its default "local"-tab and
       open the full cross-border pool. Reason: a typed search like
       "iPhone 17" or "Adidas Samba" is an intent to FIND THE BEST
       PRICE, not an intent to browse the visitor's local market.
       Opening on the local tab hides AliExpress / Amazon / Shein /
       global retailers on the first paint and the user reads the
       count as "Havlo doesn't have it" — they shouldn't have to
       discover the tab switch to see what we already indexed.
       Category pills (goToCategory below) intentionally OMIT
       origin so they keep the default local-first tab, since a
       category click is closer to a browse intent. */
    router.push(`/${country.code}/deals?search=${encodeURIComponent(q)}&origin=all`);
  };

  /* Pick a specific autocomplete suggestion. Routes directly to
     /compare with the product_id as the pid backstop so the FTS
     ambiguity that can otherwise mis-anchor (e.g. "Hank Luxury Key
     Finder" anchoring on "Burgundy Luxury Shoe") never fires. The
     user has TOLD us which product they want. */
  const pickSuggestion = (s: SuggestionItem) => {
    /* Log the literal user query (not the picked title) as a "this
       query resolved" event. resultCount=1 represents the chosen
       suggestion — useful when training ranking later. */
    logSearchEvent({
      query: query.trim(),
      surface: "hero",
      mode: "text",
      resultCount: Math.max(1, s.storeCount),
    });
    const params = new URLSearchParams({
      q:    s.title,
      pid:  s.key,
      mode: "similar",
    });
    router.push(`/${country.code}/compare?${params.toString()}`);
  };

  /* Debounced suggestion fetch. Two stop conditions:
       1. Query is a URL — autocomplete isn't useful, the sniff
          will handle it on submit.
       2. Query is too short — under 2 chars we don't have enough
          signal to suggest sanely.
     Cleanup runs on every query change to cancel pending fetches
     before they land. */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2 || /^https?:\/\//i.test(q)) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionIndex(-1);
      return;
    }
    setSuggestionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const mySeq = ++fetchSeqRef.current;
      try {
        const res  = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
        const data = await res.json() as { items?: SuggestionItem[] };
        if (mySeq !== fetchSeqRef.current) return; // stale
        setSuggestions(Array.isArray(data.items) ? data.items : []);
        setSuggestionIndex(-1);
      } catch {
        if (mySeq === fetchSeqRef.current) setSuggestions([]);
      } finally {
        if (mySeq === fetchSeqRef.current) setSuggestionsLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /* Clean up the blur timer on unmount so a stale close-call
     can't fire against an unmounted component. */
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  /* Category pill click routes to /deals with the category SLUG
     pre-applied — a filter, never a text search. Pills used to be
     able to carry a `search` term too; removed May 2026 so every
     pill behaves consistently as a category filter. */
  const goToCategory = (cat: CatItem) => {
    router.push(`/${country.code}/deals?category=${encodeURIComponent(cat.slug)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dropdownOpen = focused && suggestions.length > 0;

    /* Arrow nav through dropdown suggestions. Wraps at the ends. */
    if (dropdownOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setSuggestionIndex((idx) => {
        const last = suggestions.length - 1;
        if (e.key === "ArrowDown") return idx >= last ? 0    : idx + 1;
        return                              idx <= 0    ? last : idx - 1;
      });
      return;
    }

    /* Escape closes the dropdown without submitting. */
    if (dropdownOpen && e.key === "Escape") {
      e.preventDefault();
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      /* If a suggestion is highlighted, pick it. Otherwise fall
         through to the freeform submit (text → /deals, url → /compare). */
      if (dropdownOpen && suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
        pickSuggestion(suggestions[suggestionIndex]);
        return;
      }
      submit();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    const ta = e.target;
    /* Wrap the layout read/write in rAF to avoid the synchronous
       forced reflow PSI flagged on the May 2026 audit. Reading
       scrollHeight after setting height="auto" forces the browser
       to synchronously recompute layout; doing it inside rAF lets
       the browser batch the read with the next paint instead of
       interrupting the React commit. Cosmetic timing only — the
       textarea still resizes within the same frame as the keystroke. */
    requestAnimationFrame(() => {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    });
  };

  const isUrl = /^https?:\/\//i.test(query.trim());
  const hasInput = query.trim().length > 0;

  return (
    <section
      aria-label="Search for products"
      className="relative bg-bg pt-12 pb-10 sm:pt-24 sm:pb-16"
    >
      {/* Hero sits on a FLAT bg-bg so it reads as one continuous
          white surface with the opaque white navbar above it. A faint
          blue radial wash used to live here (rgba(0,87,255,0.05)); at
          the top of the page it tinted the body a subtle grey-blue
          that broke the unity with the pure-white navbar — user report
          May 2026: "the navbar is white and the main body seems grey
          or with a gradient. unify it, make all white." Removed.

          The section deliberately keeps NO `overflow-hidden` so the
          composer's autocomplete dropdown can extend past the
          section's bottom padding without being clipped. */}
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">

        {/* Trust pill — copy splits short / long across breakpoints
            so the pill stays one line on iPhone-mini through XL. The
            QA second pass reported the long copy wrapping to 3 lines
            on 390x844, which combined with the H1 + subhead pushed
            the search box below the fold. Short form on mobile keeps
            the credibility signal but doesn't eat vertical space. */}
        <div
          className="inline-flex items-center gap-2 mb-5 sm:mb-8 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs sm:text-sm text-ink-2"
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="sm:hidden">Live · {storeCount.toLocaleString()} stores</span>
          <span className="hidden sm:inline">Live · scanning prices across {storeCount.toLocaleString()} stores</span>
        </div>

        {/* Headline — large, editorial, single tone.
            "Before you buy it / find it for less" anchors the action
            moment (the shopper standing at a checkout button on
            Konga / Amazon / Argos with their finger hovering).

            Sizing (chosen May 2026): clamp(1.95rem, 8vw, 5rem).
              • 1.95rem (31px) floor — bold, editorial size on every
                phone class. Picked over earlier shrink iterations
                (v2→v5 went down as far as 20px chasing a 2-lines-
                on-iPhone target) because the smaller sizes read
                like body copy at the top of the page.
              • 8vw slope — scales smoothly through tablet widths
                before the 5rem ceiling caps desktop.
              • 5rem (80px) ceiling — editorial cap on desktop.
              • leading-[1.05] mobile — breathing room between the
                two stacked clauses; tightens to 0.98 on sm+ where
                the H1 returns to a single line.
              • The block-on-mobile span forces a clean 2-line stack
                on mobile by breaking at the clause boundary. iPhone
                SE (320px) may bump the first clause to 2 lines for
                a 3-line total; accepted trade-off vs. shrinking the
                hero type. */}
        {/* No animate-fade-up here — the H1 is the LCP candidate on
            this page (PSI May 2026 audit). Fade animations push LCP
            registration to the end of the animation (browsers wait
            for opacity to settle before marking LCP complete),
            adding ~200-400ms to LCP for no visible benefit. Subhead
            below + search input keep their animations because they
            don't compete for LCP. */}
        <h1
          className="font-bold text-ink leading-[1.05] sm:leading-[0.98] tracking-[-0.04em] mb-5 sm:mb-6"
          style={{ fontSize: "clamp(1.95rem, 8vw, 5rem)" }}
        >
          Before you buy it,{" "}
          <span className="block sm:inline">find it for less.</span>
        </h1>

        {/* Subhead. QA second pass said this wrapped to 6 short lines
            on mobile because (a) the prior text was 100+ chars at
            15px in a px-4 container, and (b) the H1 mis-wrap above
            was still pushing it. Mobile copy now ~70 chars so it
            wraps to a clean 2 lines on iPhone. Desktop keeps the
            longer "stores you already know" framing for full SEO
            footprint of the founder line. */}
        <p
          className="text-ink-2 text-[15px] sm:text-lg leading-snug sm:leading-relaxed mb-6 sm:mb-10 max-w-xl mx-auto animate-fade-up px-2"
          style={{ animationDelay: "80ms" }}
        >
          {/* Country-aware subhead — "the UK" / "the US" / "the UAE"
              get the article, others stand on their own. Replaces
              the prior country-agnostic copy that caused /uk and
              /ng to look identical (QA P1-7). */}
          {/* Uses the server-passed country (not useCountry) so the
              phrase is present in SSR — useCountry wouldn't resolve
              until hydration. */}
          {/* Identical copy at every breakpoint. Audit-retest May
              2026 caught the mobile/desktop divergence even after
              the first unification attempt (mobile said "Havlo
              finds it cheaper", desktop kept the long "cheaper
              alternatives across the stores you already know"
              tail). One sentence everywhere — concise enough for
              mobile, honest about what Havlo does, mentions the
              country. The longer "stores you already know"
              variant is now the brand-consistency framing surfaced
              elsewhere on the page (StoreLogos section) so the
              hero stays compact. */}
          Paste a link or search any product. Havlo finds it cheaper in {countryPhrase(countryCode, countryName)}.
        </p>

        {/* Composer — mobile-optimised.

            z-30 elevates the entire composer subtree (including the
            absolute-positioned autocomplete dropdown below) above
            the category chip rail that follows in DOM order. The
            dropdown's own z-20 is LOCAL to this composer's stacking
            context — without an explicit z-index here, the composer
            sits at z-auto and the later-sibling chip rail (also
            z-auto) wins by document order. */}
        <div
          className="relative z-30 animate-fade-up text-left"
          style={{ animationDelay: "160ms" }}
        >
          <div
            className={`composer p-4 sm:p-5 ${focused ? "shadow-[0_8px_28px_rgba(0,87,255,0.10)]" : ""}`}
          >
            <textarea
              ref={taRef}
              value={query}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setFocused(true);
                if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              }}
              onBlur={() => {
                /* 150ms delay so a click on a suggestion row in the
                   dropdown registers BEFORE we close the dropdown.
                   Without this the click target unmounts on blur and
                   the navigation never fires. */
                blurTimerRef.current = setTimeout(() => setFocused(false), 150);
              }}
              rows={1}
              /* Rotating concrete examples — see placeholderExamples
                 + the useEffect that drives the rotation. Replaced
                 the static "Search or paste a product link…" which
                 echoed the subhead one-for-one. The "Try " prefix
                 reads naturally with any of the cycling product
                 names regardless of length. */
              placeholder={`Try ${placeholderExamples[placeholderIdx]}…`}
              className="w-full"
              style={{
                minHeight: "52px",
                maxHeight: "160px",
                fontSize: "16px",  // prevents iOS auto-zoom on focus
                lineHeight: "1.5",
              }}
              aria-label="Search products or paste link"
            />

            <div className="flex items-center justify-between mt-3 sm:mt-3 gap-3">
              <div className="flex items-center gap-3 text-xs min-w-0">
                {isUrl ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-brand truncate">
                    <Link2 size={14} className="shrink-0" />
                    Link detected
                  </span>
                ) : (
                  /* Image search (restored). Uploads match against the
                     local dHash perceptual-hash index built in Phase 2
                     — no paid vision API. This is the spot the prior
                     "Image search · soon" affordance was removed from;
                     the feature has now landed. */
                  <ImageSearchButton variant="hero" countryCode={country.code} />
                )}
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!hasInput}
                aria-label="Search"
                className={`shrink-0 inline-flex items-center justify-center gap-1.5 transition-all duration-200 rounded-full
                  h-11 w-11 sm:h-10 sm:w-auto sm:px-4 ${
                  hasInput
                    ? "bg-brand text-white hover:bg-brand-hover shadow-brand active:scale-95"
                    : "bg-ink/8 text-ink-3 cursor-not-allowed"
                }`}
              >
                <ArrowUp size={20} strokeWidth={2.5} className="sm:hidden" />
                <ArrowUp size={16} strokeWidth={2.5} className="hidden sm:inline" />
                {/* Visible label on desktop only — QA A6 follow-up:
                    the icon-only button on the homepage was the one
                    surface that didn't match the /compare button's
                    "Find cheaper" verbal label. Mobile stays icon-
                    only so the search box keeps its width. */}
                <span className="hidden sm:inline text-sm font-semibold">Search</span>
              </button>
            </div>
          </div>

          {/* Autocomplete dropdown — debounced 200ms after typing.
              Renders below the composer with absolute positioning.
              Each row shows the product title + 'N stores' badge so
              the user knows how broad the comparison will be before
              clicking. Click / Enter selects → /compare?pid=<id>.

              Visibility rules:
                • Visible when focused AND query >= 2 chars
                  AND (loading OR suggestions present).
                • Hidden for URL queries — sniff handles those on
                  submit, autocomplete isn't useful.
                • Hidden when the user blurs (150ms delay so clicks
                  register before the panel unmounts).

              z-index: 20 keeps it above the category-chip rail
              below but below any global modal. mt-2 leaves a small
              gap so the dropdown reads as a distinct surface, not
              part of the composer. */}
          {focused && query.trim().length >= 2 && !isUrl && (
            (suggestionsLoading || suggestions.length > 0) && (
              <div
                role="listbox"
                aria-label="Search suggestions"
                className="absolute left-0 right-0 mt-2 z-20 rounded-2xl border border-border bg-surface shadow-[0_12px_36px_rgba(0,0,0,0.12)] overflow-hidden animate-fade-in"
              >
                {suggestions.length === 0 && suggestionsLoading ? (
                  <div className="px-4 py-3 flex items-center gap-2 text-[13px] text-ink-3">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-border border-t-ink-2 animate-spin" />
                    Searching…
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {suggestions.map((s, idx) => {
                      const isActive = idx === suggestionIndex;
                      return (
                        <li key={s.key} role="option" aria-selected={isActive}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSuggestion(s)}
                            onMouseEnter={() => setSuggestionIndex(idx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isActive ? "bg-surface-2" : "hover:bg-surface-2"
                            }`}
                          >
                            <SearchIcon size={14} className="text-ink-3 shrink-0" aria-hidden="true" />
                            <span className="flex-1 min-w-0 text-[14px] text-ink truncate">
                              {s.title}
                            </span>
                            {s.storeCount > 0 && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-ink-3 tabular-nums">
                                <StoreIcon size={11} aria-hidden="true" />
                                {s.storeCount} {s.storeCount === 1 ? "store" : "stores"}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {/* Bottom row — explicit "Search for {query}" fallback
                        so the user can always escape to the full-feed
                        view from inside the dropdown. */}
                    <li className="border-t border-border">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={submit}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors ${
                          suggestionIndex === -1 ? "bg-surface-2" : "hover:bg-surface-2"
                        }`}
                      >
                        <SearchIcon size={14} className="text-ink-2 shrink-0" aria-hidden="true" />
                        <span className="text-ink-2">
                          See all results for <span className="font-semibold text-ink">{query.trim()}</span>
                        </span>
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )
          )}

          {/* Helper microcopy — desktop only, mobile is busy enough */}
          <p
            className="hidden sm:block text-xs text-ink-3 mt-3 animate-fade-in text-center"
            style={{ animationDelay: "220ms" }}
          >
            Try &ldquo;iPhone 17 Pro&rdquo;, &ldquo;Adidas Samba&rdquo;, or paste any product link.
          </p>
        </div>

        {/* Cashback announcement strip REMOVED in round-3 QA pass.
            QA flagged it as duplicating the Cashback nav link AND
            competing with the search composer for above-the-fold
            attention on mobile. The /[country]/cashback page is
            still reachable via the navbar link, so removing this
            doesn't lose the funnel — it just stops eating vertical
            space on the most important screen. */}

        {/* Category chips — horizontal scroll on mobile, flex-wrap
            on tablet+. Full-bleed via -mx-4 / px-4 so the strip
            extends edge-to-edge; users swipe through pills like an
            iOS app rail. no-scrollbar hides the native bar (custom
            utility in globals.css).

            A previous iteration switched mobile to a 2-col wrapped
            grid to expose long-tail categories without scrolling.
            Reverted per user direction — horizontal scroll is the
            preferred pattern for this surface.

            Tablet+ (sm:flex-wrap + sm:justify-center): pills sit at
            their natural width and wrap as needed because the wider
            container fits all 10 in 1-2 rows. */}
        <div
          className="mt-6 sm:mt-8 -mx-4 sm:mx-0 animate-fade-in"
          style={{ animationDelay: "280ms" }}
        >
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 sm:px-0 sm:justify-center sm:flex-wrap sm:gap-2.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => goToCategory(cat)}
                className="cat-pill flex-shrink-0 active:scale-95"
              >
                <cat.Icon size={16} className="text-ink-2 group-hover:text-ink shrink-0" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
