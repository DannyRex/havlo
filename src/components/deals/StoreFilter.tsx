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
  /* Two refs because the panel renders in two different DOM
     positions:
       - Desktop popover: child of `rootRef` (the trigger's wrapper),
         so `rootRef.contains()` detects clicks inside it.
       - Mobile sheet:    portalled to document.body, OUTSIDE
         `rootRef`. Without `sheetPanelRef`, the outside-click
         handler fired setOpen(false) the moment a user tapped any
         store button inside the sheet — exactly the bug reported
         May 2026 ("selecting a store from the popup, no filter
         applied, popup just closes"). */
  const rootRef       = useRef<HTMLDivElement | null>(null);
  const sheetPanelRef = useRef<HTMLDivElement | null>(null);

  /* Close on outside click — popover pattern. Now treats BOTH the
     trigger's wrapper AND the portalled mobile sheet's panel as
     "inside", so multi-store selection works on every viewport. */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
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
     hit "Amazon UK" + "amazon-co-uk" alike). */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
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
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-ink text-bg text-[12px] font-semibold hover:opacity-90 transition-opacity"
        >
          Done
          <X size={11} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
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

      {/* Desktop popover — anchored absolutely beneath the trigger.
          Renders only at md+ so mobile gets the sheet instead. */}
      {open && (
        <div
          role="listbox"
          aria-label="Filter by store"
          className="hidden md:block absolute z-40 mt-1.5 right-0 w-72 rounded-2xl border border-border bg-bg shadow-2xl"
        >
          {panelBody}
        </div>
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
