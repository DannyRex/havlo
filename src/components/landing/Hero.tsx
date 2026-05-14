"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowUp, Link2 } from "lucide-react";
import Link from "next/link";
import {
  PhoneIcon, LaptopIcon, SneakerIcon, EarbudsIcon, TvIcon,
  HomeIcon, FashionIcon, BeautyIcon, GamingIcon, FurnitureIcon,
} from "@/components/ui/CategoryIcons";
import { useCountry } from "@/components/providers/CountryProvider";
import type { ComponentType } from "react";

/* Each pill maps to a real category slug from src/lib/data/categories.ts
   so /deals can apply its category filter directly (not a fuzzy text
   search). Sub-category pills (Sneakers, TVs, Furniture) carry an
   optional `search` so the deals page filters by category AND
   narrows to the specific product type within it. */
type CatItem = {
  label: string;
  slug:  string;
  /** Optional text-search override applied alongside the category
      filter when the pill is a sub-category of the slug it maps to. */
  search?: string;
  Icon:  ComponentType<{ size?: number; className?: string }>;
};

const CATEGORIES: CatItem[] = [
  { label: "Phones",     slug: "phones",                            Icon: PhoneIcon },
  { label: "Laptops",    slug: "computing",                         Icon: LaptopIcon },
  { label: "Sneakers",   slug: "fashion",      search: "sneakers",  Icon: SneakerIcon },
  { label: "Earbuds",    slug: "audio",                             Icon: EarbudsIcon },
  { label: "TVs",        slug: "electronics",  search: "tv",        Icon: TvIcon },
  { label: "Home",       slug: "home",                              Icon: HomeIcon },
  { label: "Fashion",    slug: "fashion",                           Icon: FashionIcon },
  { label: "Beauty",     slug: "beauty",                            Icon: BeautyIcon },
  { label: "Gaming",     slug: "gaming",                            Icon: GamingIcon },
  { label: "Furniture",  slug: "home",         search: "furniture", Icon: FurnitureIcon },
];

interface Props {
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

export default function Hero({ storeCount, countryCode, countryName }: Props) {
  const router = useRouter();
  const { country } = useCountry();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
    if (isPastedUrl) {
      router.push(`/${country.code}/compare?q=${encodeURIComponent(q)}&mode=similar`);
      return;
    }
    router.push(`/${country.code}/deals?search=${encodeURIComponent(q)}`);
  };

  /* Category pill click routes to /deals with the category SLUG
     pre-applied (not a fuzzy text search). Sub-category pills carry
     a search term so /deals shows the right narrow slice (e.g.
     Sneakers = category=fashion + search=sneakers). */
  const goToCategory = (cat: CatItem) => {
    const params = new URLSearchParams({ category: cat.slug });
    if (cat.search) params.set("search", cat.search);
    router.push(`/${country.code}/deals?${params.toString()}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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
      className="relative bg-bg pt-12 pb-10 sm:pt-24 sm:pb-16 overflow-hidden"
    >
      {/* Subtle radial wash — light enough to read non-AI */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, rgba(0,87,255,0.05) 0%, transparent 70%)",
        }}
      />

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
          <span className="sm:hidden">Paste a link or search any product. We find it cheaper in {countryPhrase(countryCode, countryName)}.</span>
          <span className="hidden sm:inline">Paste a link or search any product. Havlo finds cheaper alternatives across the stores you already know in {countryPhrase(countryCode, countryName)}.</span>
        </p>

        {/* Composer — mobile-optimised */}
        <div
          className="relative animate-fade-up text-left"
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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={1}
              /* Shortened in round-3 QA: original "Paste a product
                 link, or search anything…" wrapped to 2 lines on
                 iPhone 14 Pro and the second line was clipped
                 mid-comma. Compact form fits on one line at the
                 textarea's mobile width. */
              placeholder="Search or paste a product link…"
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
                  /* Subtle hint — replaces the disabled "Image search
                     · soon" button QA flagged. We don't ship UI for
                     features that don't exist; the "soon" tag also
                     read as marketing-fluff in the founder voice
                     review. When image search lands, restore here. */
                  <span className="text-ink-3">
                    Search anything, or paste a link.
                  </span>
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
