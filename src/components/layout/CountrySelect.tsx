"use client";

/* Country selector — compact dropdown showing flag + currency code.
   Lives in the header right cluster on desktop, and in the drawer on
   mobile (CountrySelectMobile below).

   No portal / no popover lib — small absolute-positioned panel that
   handles outside-click + Escape close. Keyboard-accessible via the
   <button> trigger; arrow-key list traversal can come later. */

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useCountry } from "@/components/providers/CountryProvider";
import { COUNTRIES } from "@/lib/country";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

/* Pull the path WITHOUT the country prefix.
   /uk/deals → /deals · /us → / · /contact → /contact (no country in URL) */
function stripCountryPrefix(pathname: string): string {
  const segs = pathname.split("/");
  if (segs.length >= 2 && COUNTRY_CODES.has(segs[1]?.toLowerCase())) {
    const rest = "/" + segs.slice(2).join("/");
    return rest === "/" ? "" : rest;
  }
  return pathname === "/" ? "" : pathname;
}

interface Props {
  /** Open the menu upward instead of downward — for footer placements
      where the menu would otherwise extend off the viewport bottom. */
  dropUp?: boolean;
}

export default function CountrySelect({ dropUp = false }: Props = {}) {
  const { country, countries, setCountry } = useCountry();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${country.name}. Change.`}
        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full text-sm font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
      >
        <span
          aria-hidden="true"
          className="text-base leading-none flag-emoji"
          suppressHydrationWarning
        >
          {country.flag}
        </span>
        <span
          className="hidden sm:inline text-[12px] tracking-wider"
          suppressHydrationWarning
        >
          {country.code.toUpperCase()}
        </span>
        <ChevronDown size={14} className="text-ink-3" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose country"
          className={cn(
            "absolute right-0 w-56 rounded-xl bg-bg border border-border shadow-2xl z-50 overflow-hidden",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
            <Globe size={14} className="text-ink-3" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
              Shopping from
            </span>
          </div>
          <ul className="py-1 max-h-80 overflow-y-auto">
            {countries.map((c) => {
              const active = c.code === country.code;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOpen(false);
                      /* Update context immediately for snappy UI feedback;
                         then navigate to the new country URL. Middleware
                         picks up the prefix and writes the cookie so the
                         next request renders with the right country. */
                      setCountry(c.code);
                      const rest = stripCountryPrefix(pathname);
                      router.push(`/${c.code}${rest}`);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors",
                      active
                        ? "bg-surface-2 text-ink"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <span aria-hidden="true" className="text-lg leading-none flag-emoji">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-[11px] text-ink-3 tabular-nums">{c.currency}</span>
                    {/* Use text-ink so the check adapts to both themes —
                        text-brand (#0057FF) was nearly invisible against
                        the dark dropdown surface in dark mode. */}
                    {active && <Check size={14} className="text-ink" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
