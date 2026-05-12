"use client";

/* Multi-select store filter for /deals.
   Inspired by spoken.io's store sidebar — checkbox list, search-
   within-list, count badge per store.

   Adaptive shell:
     - Desktop (md+): right-anchored absolute popover beneath the
       trigger button.
     - Mobile (<md):  full-width sheet that slides up from the bottom
       of the viewport.

   Why the split: on mobile the parent filter bar uses overflow-x-
   auto (for the horizontal scroll of tier pills), which CLIPS any
   absolute-positioned children. A fixed-position bottom sheet
   escapes the clipping context AND is a more native mobile pattern
   (matches the Radix Drawer / iOS action sheet shape users expect).

   Both shells share the same body — search input, checkbox list,
   footer with Clear / Done — so the desktop popover and mobile
   sheet stay visually consistent. */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Store as StoreIcon, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StoreOption {
  id:    string;
  name:  string;
  count: number;
}

interface Props {
  stores:   StoreOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function StoreFilter({ stores, selected, onChange }: Props) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  /* Both panel surfaces are portalled to document.body so they
     escape the parent filter bar's overflow-x-auto clipping
     context (which would otherwise crop the popover's lower half
     on desktop AND the entire sheet on mobile).

     Three refs:
       - rootRef:        wraps the trigger button. Outside-click
                         treats clicks inside as "inside" so tapping
                         the trigger again toggles closed normally.
       - desktopPanelRef on the desktop popover.
       - sheetPanelRef   on the mobile bottom-sheet panel.
     The mousedown listener treats all three as "inside" so taps
     on store rows inside either panel never bubble out and
     close the surface prematurely. */
  const rootRef          = useRef<HTMLDivElement | null>(null);
  const triggerRef       = useRef<HTMLButtonElement | null>(null);
  const desktopPanelRef  = useRef<HTMLDivElement | null>(null);
  const sheetPanelRef    = useRef<HTMLDivElement | null>(null);

  /* Trigger's viewport rect. Computed when the popover opens so the
     portalled desktop panel can position itself directly under the
     trigger button. Recomputed on scroll/resize so the panel tracks
     the button if either moves. */
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setTriggerRect(r);
    };
    updateRect();
    /* Track scroll + resize so the popover doesn't drift away from
       the trigger if the user scrolls the page (rare but possible
       since the filter bar is sticky). */
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  /* Close on outside click. Treats the trigger wrapper, the
     desktop popover panel, and the mobile sheet panel as "inside"
     so taps inside any of them don't bubble out and close the
     surface before the inner onClick handlers fire. */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (desktopPanelRef.current?.contains(t)) return;
      if (sheetPanelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* Filter the visible list by the search input. Case-insensitive,
     matches store name OR store id (so a user can type "amazon" and
     hit "Amazon UK" + "amazon-co-uk" alike). The result is sorted
     alphabetically by display name — was sorted by deal count in
     the API response, but visitors expect alphabetical when
     scanning a checklist (user feedback May 2026). localeCompare
     handles diacritics correctly for non-Latin display names. */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? stores.filter(
          (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
        )
      : stores;
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [stores, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  const selectedCount = selected.size;

  /* Body of the panel — shared between desktop popover and mobile
     sheet. Pulled out so the two shells stay visually identical
     and bug fixes in one apply to both. */
  const panelBody = (
    <>
      {/* Search */}
      <div className="p-3 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stores…"
          aria-label="Search stores"
          className="w-full px-3 py-1.5 rounded-full text-[13px] bg-surface border border-border focus:border-brand focus:shadow-input outline-none transition-all"
          style={{ fontSize: "16px" }}
        />
      </div>

      {/* List — taller cap on mobile sheet (more vertical real estate
          available since we're filling the bottom of the viewport).
          Capped at max-h-72 on desktop popover to keep the popover
          fitting beneath the trigger. */}
      <ul className="max-h-[60vh] md:max-h-72 overflow-y-auto py-1.5">
        {visible.length === 0 ? (
          <li className="px-4 py-3 text-[13px] text-ink-3 text-center">
            No stores match &ldquo;{search}&rdquo;
          </li>
        ) : (
          visible.map((s) => {
            const isSelected = selected.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors",
                    isSelected
                      ? "bg-ink/5 text-ink"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-ink border-ink text-bg"
                          : "border-border-strong",
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-3 tabular-nums">
                    {s.count}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border flex items-center justify-between">
        <button
          type="button"
          onClick={clearAll}
          disabled={selectedCount === 0}
          className="text-[12px] text-ink-3 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-1 rounded-full bg-ink text-bg text-[12px] font-semibold hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </>
  );

  /* Desktop popover position — anchored to the trigger's right edge,
     drops below the trigger by 6px. Falls back to (0,0) until the
     first measurement lands; CSS visibility-hidden could replace
     the brief mispositioned flash but the simpler approach is to
     skip render until rect exists. */
  const PANEL_W = 288; // matches w-72
  const desktopStyle: React.CSSProperties | undefined = triggerRect
    ? {
        position: "fixed",
        top:  triggerRect.bottom + 6,
        /* Keep the panel inside the viewport when the trigger sits
           near the right edge. Clamp the left coord between 8 (safe
           margin) and (viewportWidth - PANEL_W - 8). */
        left: Math.max(
          8,
          Math.min(
            (typeof window !== "undefined" ? window.innerWidth : PANEL_W + 32) - PANEL_W - 8,
            triggerRect.right - PANEL_W,
          ),
        ),
        width: PANEL_W,
      }
    : undefined;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] sm:text-xs whitespace-nowrap transition-colors border",
          selectedCount > 0
            ? "bg-ink text-bg border-ink font-semibold"
            : "bg-surface-2 text-ink-2 border-border hover:text-ink",
        )}
      >
        <StoreIcon size={12} strokeWidth={2.25} aria-hidden="true" />
        <span>Stores</span>
        {selectedCount > 0 && (
          <span className="tabular-nums">({selectedCount})</span>
        )}
      </button>

      {/* Desktop popover — portalled to document.body with fixed
          positioning so the parent filter bar's overflow-x-auto
          doesn't clip the lower half of the panel. The previous
          inline absolute-positioned version rendered correctly but
          the clipped portion made the store list visually present
          yet non-interactive (user report: "stores not clickable
          on desktop"). md:block keeps it hidden below the md
          breakpoint where the mobile sheet handles things. */}
      {open && desktopStyle && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={desktopPanelRef}
            role="listbox"
            aria-label="Filter by store"
            style={desktopStyle}
            className="hidden md:block z-50 rounded-2xl border border-border bg-bg shadow-2xl"
          >
            {panelBody}
          </div>,
          document.body,
        )}

      {/* Mobile bottom sheet — portalled to document.body so it
          escapes the parent's overflow-x-auto clipping context.
          Backdrop + slide-from-bottom panel matches the iOS / Radix
          action-sheet pattern users expect. typeof document guard
          keeps SSR safe. */}
      {open && typeof document !== "undefined" &&
        createPortal(
          <div className="md:hidden fixed inset-0 z-50">
            {/* Backdrop — closes on click */}
            <div
              onClick={() => setOpen(false)}
              aria-hidden="true"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            {/* Sheet — sheetPanelRef anchors the outside-click
                check so taps inside this panel don't bubble out and
                close the sheet via the document-level listener. The
                backdrop above has its own onClick={close} so tapping
                outside the panel still dismisses correctly. */}
            <div
              ref={sheetPanelRef}
              role="listbox"
              aria-label="Filter by store"
              className="absolute left-0 right-0 bottom-0 rounded-t-2xl border-t border-border bg-bg shadow-2xl max-h-[85vh] flex flex-col"
            >
              {/* Drag-handle visual cue at the top of the sheet —
                  signals 'this is a dismissable sheet, swipe down'
                  even though we don't wire actual swipe gestures (a
                  tap on the backdrop is the documented close). */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-ink-3/40" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <p className="text-sm font-semibold text-ink">Filter by store</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="-mr-1 p-1 text-ink-3 hover:text-ink transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              {panelBody}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
