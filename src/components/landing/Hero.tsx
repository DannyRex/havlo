"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowUp, Link2 } from "lucide-react";
import Link from "next/link";
import {
  PhoneIcon, LaptopIcon, SneakerIcon, EarbudsIcon, TvIcon,
  HomeIcon, FashionIcon, BeautyIcon, GamingIcon, FurnitureIcon,
} from "@/components/ui/CategoryIcons";
import { Coins } from "lucide-react";
import { useCountry } from "@/components/providers/CountryProvider";
import type { ComponentType } from "react";

type CatItem = { label: string; q: string; Icon: ComponentType<{ size?: number; className?: string }> };

const CATEGORIES: CatItem[] = [
  { label: "Phones",     q: "phone",       Icon: PhoneIcon },
  { label: "Laptops",    q: "laptop",      Icon: LaptopIcon },
  { label: "Sneakers",   q: "sneakers",    Icon: SneakerIcon },
  { label: "Earbuds",    q: "earbuds",     Icon: EarbudsIcon },
  { label: "TVs",        q: "tv",          Icon: TvIcon },
  { label: "Home",       q: "home",        Icon: HomeIcon },
  { label: "Fashion",    q: "fashion",     Icon: FashionIcon },
  { label: "Beauty",     q: "skincare",    Icon: BeautyIcon },
  { label: "Gaming",     q: "console",     Icon: GamingIcon },
  { label: "Furniture",  q: "furniture",   Icon: FurnitureIcon },
];

interface Props {
  /** Number of stores in the user's country marquee. Drives the trust
      pill copy so the displayed count matches the marquee below
      instead of being a hardcoded "12+" guess. */
  storeCount: number;
}

export default function Hero({ storeCount }: Props) {
  const router = useRouter();
  const { country } = useCountry();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/compare?q=${encodeURIComponent(q)}&mode=similar`);
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
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
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
          className="inline-flex items-center gap-2 mb-5 sm:mb-8 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs sm:text-sm text-ink-2 animate-fade-in"
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
            Konga / Amazon / Argos with their finger hovering) which
            the previous "Find similar products for less" framing
            didn't. The 'similar products' keyword is preserved in
            the bottom-section CTA + page metadata so the SEO
            footprint stays intact.

            Mobile typography (v3, May 2026 — second QA pass):
              v1 (clamp 1.95→8vw) wrapped to 4 lines on iPhone.
              v2 dropped clamp min to 1.65rem and added text-balance.
              QA retest reported v2 STILL wrapped to 4 lines —
              text-balance interacted weirdly with the block→inline
              span trick (it was reflowing the two text nodes into
              4 balanced micro-lines instead of using the explicit
              break at the span boundary).

              v3 abandons text-balance, drops the span, and uses a
              ch-unit max-width to constrain the H1 to a width that
              MUST wrap to 2 lines on mobile and 1 line on desktop:
                • max-w-[18ch]: at the mobile font size, 18 chars is
                  exactly the longer of the two clauses ('Before you
                  buy it,' = 18 chars). Browser wraps at the word
                  boundary, producing a clean 2-line layout regardless
                  of viewport width or font-rendering quirks.
                • clamp() lowered to (1.5rem, 7vw, 5rem) so even on
                  320px iPhone SE the first clause fits on one line.
                • leading bumped to 1.06 on mobile for breathing room
                  between the two lines; back to 0.98 from sm: where
                  the H1 returns to its single-line editorial form. */}
        <h1
          className="font-bold text-ink leading-[1.06] sm:leading-[0.98] tracking-[-0.04em] mb-5 sm:mb-6 animate-fade-up max-w-[18ch] mx-auto sm:max-w-none"
          style={{ fontSize: "clamp(1.5rem, 7vw, 5rem)" }}
        >
          Before you buy it, find it for less.
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
          <span className="sm:hidden">Paste a link or search any product. We find it cheaper.</span>
          <span className="hidden sm:inline">Paste a link or search any product. Havlo finds cheaper alternatives across the stores you already know.</span>
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
              placeholder="Paste a product link, or search anything…"
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
            Try &ldquo;iPhone 15 Pro&rdquo;, &ldquo;Adidas Samba&rdquo;, or paste any product link.
          </p>
        </div>

        {/* Cashback announcement strip — sits between composer and
            category chips. Visible on every Hero render so users
            discover the program even if they never click a card.
            Marked 'Coming soon' so we don't over-promise (Phase 2
            accounts + payouts ship in a follow-up). Links to the
            country-aware /[country]/cashback explainer page. */}
        <div
          className="mt-5 sm:mt-6 animate-fade-in"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            href={`/${country.code}/cashback`}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] bg-success/10 border border-success/30 text-ink hover:bg-success/15 transition-colors"
          >
            <Coins size={14} className="text-success" aria-hidden="true" />
            <span>
              <span className="font-semibold">Coming soon:</span>{" "}
              earn up to 5% cashback when you shop through Havlo
            </span>
            <span className="text-ink-3 hidden sm:inline" aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Category chips — full-bleed on mobile for proper edge fade */}
        <div
          className="mt-6 sm:mt-8 -mx-4 sm:mx-0 animate-fade-in"
          style={{ animationDelay: "280ms" }}
        >
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 sm:px-0 sm:justify-center sm:flex-wrap sm:gap-2.5">
            {CATEGORIES.map(({ label, q, Icon }) => (
              <button
                key={q}
                type="button"
                onClick={() => router.push(`/compare?q=${encodeURIComponent(q)}&mode=similar`)}
                className="cat-pill flex-shrink-0 active:scale-95"
              >
                <Icon size={16} className="text-ink-2 group-hover:text-ink shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
