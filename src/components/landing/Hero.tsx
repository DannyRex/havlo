"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowUp, Camera, Link2 } from "lucide-react";
import {
  PhoneIcon, LaptopIcon, SneakerIcon, EarbudsIcon, TvIcon,
  HomeIcon, FashionIcon, BeautyIcon, GamingIcon, FurnitureIcon,
} from "@/components/ui/CategoryIcons";
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

        {/* Trust pill */}
        <div
          className="inline-flex items-center gap-2 mb-7 sm:mb-8 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs sm:text-sm text-ink-2 animate-fade-in"
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span>Live · scanning prices across {storeCount} stores</span>
        </div>

        {/* Headline — large, editorial, single tone.
            Note: literal whitespace between "similar" and "products" so
            screen readers don't merge them via the line-break.
            clamp() min lowered to 1.95rem so "products" doesn't clip at 320px. */}
        <h1
          className="font-bold text-ink leading-[0.98] tracking-[-0.04em] mb-5 sm:mb-6 animate-fade-up"
          style={{ fontSize: "clamp(1.95rem, 8vw, 5rem)" }}
        >
          Find similar products{" "}
          <span className="block sm:inline">for less.</span>
        </h1>

        <p
          className="text-ink-2 text-[15px] sm:text-lg leading-relaxed mb-8 sm:mb-10 max-w-xl mx-auto animate-fade-up px-2"
          style={{ animationDelay: "80ms" }}
        >
          Paste any product link or search anything. We surface cheaper alternatives across the world&apos;s biggest stores.
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
                  <button
                    type="button"
                    title="Image search (coming soon)"
                    disabled
                    className="inline-flex items-center gap-1.5 text-ink-3 disabled:cursor-not-allowed"
                  >
                    <Camera size={14} />
                    <span className="hidden xs:inline sm:inline">Image search</span>
                    <span className="text-[10px] text-ink-3 border border-border-strong rounded px-1 py-0.5">
                      soon
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!hasInput}
                aria-label="Search"
                className={`shrink-0 h-11 w-11 sm:h-10 sm:w-10 rounded-full inline-flex items-center justify-center transition-all duration-200 ${
                  hasInput
                    ? "bg-brand text-white hover:bg-brand-hover shadow-brand active:scale-95"
                    : "bg-ink/8 text-ink-3 cursor-not-allowed"
                }`}
              >
                <ArrowUp size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Helper microcopy — desktop only, mobile is busy enough */}
          <p
            className="hidden sm:block text-xs text-ink-3 mt-3 animate-fade-in text-center"
            style={{ animationDelay: "220ms" }}
          >
            Try “iPhone 15 Pro”, “Adidas Samba”, or paste a Jumia / Amazon link
          </p>
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
