"use client";

/* InfoTip — small Info icon button that toggles a popover with
   explanatory text on click. Built to replace `title="..."` HTML
   tooltips, which don't render on mobile (no hover state).

   Used in:
     - MasonryCard / ListCard for the "≈ ₦X total ⓘ" landed-cost line
     - any spot where we want a discoverable "what does this mean?"
       affordance that works on touch.

   A11y:
     - <button aria-expanded aria-controls> drives a region with
       role="tooltip" so screen readers announce it.
     - Escape + outside-click both dismiss.

   Click handling note: the button calls stopPropagation() because
   it's typically nested inside a parent <a> (a deal card link).
   Without stopPropagation, tapping the icon would also trigger the
   parent click and send the user to the merchant. */

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

interface Props {
  /** Short explanatory body. Plain text only, kept under ~140 chars
      for legibility on a 280px popover. */
  text: string;
  /** Visually hidden label for the button — should describe what
      the icon explains, e.g. "What's included in the total?". */
  label?: string;
  /** Accent on the icon — defaults to the muted ink-3. Pass
      'amber-500' on cross-border surfaces to match the cross-border
      flag colour. */
  tone?: "muted" | "amber";
  /** Pixel size of the icon. Default 12. */
  size?: number;
}

export default function InfoTip({
  text,
  label = "More info",
  tone = "muted",
  size = 12,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  /* Outside-click + Escape close. Wired up only when open so we
     don't pay the listener cost on every page render. */
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const iconColor = tone === "amber" ? "text-amber-500" : "text-ink-3";

  return (
    <span ref={wrapRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          /* Card link wraps these usually — don't trigger the parent. */
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center justify-center rounded-full hover:bg-surface-2 active:bg-surface-2 transition-colors ${iconColor} cursor-pointer`}
        /* Min 24px hit target (WCAG 2.5.8 / Lighthouse target-size).
           A size=11 icon would render an 17px button otherwise — the
           Math.max floors it to 24 while the icon stays visually small;
           the extra padding is invisible (transparent) but tappable. */
        style={{ width: Math.max(24, size + 6), height: Math.max(24, size + 6) }}
      >
        <Info size={size} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          /* stopPropagation on the popover itself so tapping inside
             the text doesn't bubble up and follow the parent card link. */
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute z-30 bottom-full mb-1.5 left-1/2 -translate-x-1/2 w-[220px] sm:w-[260px] rounded-lg border border-border bg-surface shadow-card px-3 py-2 text-[11px] leading-snug text-ink-2"
        >
          {text}
          {/* Speech-bubble pointer */}
          <span
            aria-hidden="true"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-surface border-r border-b border-border"
          />
        </span>
      )}
    </span>
  );
}
