"use client";

/* Country selector — compact dropdown showing flag + currency code.
   Lives in the header right cluster on desktop, and in the drawer on
   mobile (CountrySelectMobile below).

   No portal / no popover lib — small absolute-positioned panel that
   handles outside-click + Escape close. Keyboard-accessible via the
   <button> trigger; arrow-key list traversal can come later. */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useCountry } from "@/components/providers/CountryProvider";
import { cn } from "@/lib/utils";
import CountryFlag from "@/components/ui/CountryFlag";

interface Props {
  /** Open the menu upward instead of downward — for footer placements
      where the menu would otherwise extend off the viewport bottom. */
  dropUp?: boolean;
}

export default function CountrySelect({ dropUp = false }: Props = {}) {
  const { country, countries, setCountry } = useCountry();
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
        /* suppressHydrationWarning at the button level covers both
           the flag <img> src and the country code label. The SSR
           emits DEFAULT_COUNTRY (NG) because the root layout's
           CountryProvider has no initialCode and the layout can't
           read cookies without breaking ISR. On the client, the
           useState initialiser inside CountryProvider reads
           window.location.pathname during the first render, so
           hydration produces the right flag without a post-paint
           swap. The mismatch warning is the price; the user-
           visible flash is gone. */
        suppressHydrationWarning
      >
        {/* SVG flag — renders identically on Windows / Linux /
            macOS / headless. Replaces the regional-indicator emoji
            that Windows Chrome shows as a bare country code in a
            box. See CountryFlag for rationale. */}
        <CountryFlag code={country.code} size={20} />
        <span
          className="hidden sm:inline text-[12px] tracking-wider"
        >
          {country.code.toUpperCase()}
        </span>
        <ChevronDown size={14} className="text-ink-3" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose country"
          /* w-64 (256px) up from w-56 (224px). The narrower width
             clipped "United Kingdom" on mobile inside the drawer
             where the available width is constrained. 32px extra
             absorbs the longest country name with breathing room
             and the dropdown still fits inside the mobile drawer
             (w-72 = 288px). User report May 2026: "on mobile,
             United Kindom is truncated. Fix that." */
          className={cn(
            "absolute right-0 w-64 rounded-xl bg-bg border border-border shadow-2xl z-50 overflow-hidden",
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
                      /* setCountry owns the switch: it writes the cookie,
                         fires the analytics event, and navigates to the
                         new country URL with the current query string
                         preserved. A second router.push here used to
                         clobber that with a query-stripped path, which
                         404'd the synthetic /p/live PDP whose entire
                         offer payload lives in the query string. */
                      setCountry(c.code);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors",
                      active
                        ? "bg-surface-2 text-ink"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <CountryFlag code={c.code} size={22} />
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
