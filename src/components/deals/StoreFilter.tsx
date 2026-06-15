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
  /** When true, the trigger button stretches to fill its parent's
      width and aligns its content with `justify-between` (label
      left, optional count right). Used on mobile /deals where the
      button gets `flex-1` from its parent to fill the empty space
      that was sitting to the right of the tier pills. */
  fillRow?: boolean;
}

export default function StoreFilter({ stores, selected, onChange, fillRow = false }: Props) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  /* Mobile on-screen-keyboard handling (visualViewport effect below):
     kbInset = px the keyboard covers at the bottom; vvHeight = visible
     viewport height. Used to float the bottom sheet above the keypad. */
  const [kbInset, setKbInset]   = useState(0);
  const [vvHeight, setVvHeight] = useState<number | null>(null);

  /* Mobile-sheet swipe-to-dismiss. The grabber bar at the top of
     the sheet was previously a visual signifier only — the user
     could see it, expected it to be draggable, and tapping/dragging
     it did nothing (a tap on the backdrop was the documented
     close). This wires the actual gesture: pointer-down on the
     handle/header area starts a drag, the panel follows the
     vertical delta downward, and releasing past DISMISS_THRESHOLD
     closes the sheet. Pointer events cover touch + mouse + pen
     without separate handler sets. */
  const DISMISS_THRESHOLD = 100;
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    /* Don't hijack pointer-down that lands on an interactive child
       (close button, etc.) — let the click flow normally. */
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    dragStartY.current = e.clientY;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    /* Only follow downward drags — pulling the sheet up past its
       resting position would feel wrong. */
    setDragY(delta > 0 ? delta : 0);
  };
  const onDragPointerEnd = () => {
    if (dragStartY.current === null) return;
    if (dragY > DISMISS_THRESHOLD) setOpen(false);
    setDragY(0);
    setIsDragging(false);
    dragStartY.current = null;
  };
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
  /* Pins the desktop autofocus (see the focus effect below) to one
     shot per open, so the scroll/resize re-measures that also update
     triggerRect don't keep yanking focus back into the search box. */
  const hasFocusedRef    = useRef(false);

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

  /* Autofocus the store-search input when the panel opens — on BOTH
     desktop (popover) and mobile (bottom sheet). Mobile autofocus used
     to be suppressed to keep the keyboard down, but the sheet now floats
     above the keyboard (visualViewport effect below) so dropping the
     cursor straight into the field is what users expect (June 2026) and
     a long roster (UK ~27 stores) is filterable by typing immediately.

     Scoped to the MOUNTED panel's ref because panelBody renders in both
     shells — a shared input query would resolve to whichever mounted
     last. Desktop waits for triggerRect (its panel only mounts once the
     rect is measured); the mobile sheet mounts on open. hasFocusedRef
     pins this to one focus per open so the scroll/resize re-measures
     don't yank focus back mid-scroll. */
  useEffect(() => {
    if (!open) {
      hasFocusedRef.current = false;
      return;
    }
    if (hasFocusedRef.current) return;
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop && !triggerRect) return; // desktop panel not mounted yet
    const panel = isDesktop ? desktopPanelRef.current : sheetPanelRef.current;
    const input = panel?.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) return;
    input.focus();
    hasFocusedRef.current = true;
  }, [open, triggerRect]);

  /* Mobile keyboard inset. The bottom sheet is anchored to the LAYOUT
     viewport's bottom, which does NOT shrink when the on-screen keyboard
     opens — so as the user typed and the list shrank, the sheet (and its
     search box) slid behind the keypad. Track window.visualViewport to
     learn how much the keyboard covers, then float the sheet above it and
     cap its height to the visible band (both applied in the sheet style
     below). Recomputes on resize + scroll (iOS fires both as the keyboard
     animates). */
  useEffect(() => {
    if (!open || typeof window === "undefined") { setKbInset(0); setVvHeight(null); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKbInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
      setVvHeight(Math.round(vv.height));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
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
      {/* Search + count indicator. The count makes it explicit how
          many stores are available so users understand the list
          scrolls when the visible portion doesn't show all of them. */}
      <div className="shrink-0 p-3 border-b border-border space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stores…"
          aria-label="Search stores"
          className="w-full px-3 py-1.5 rounded-full text-[13px] bg-surface border border-border focus:border-brand focus:shadow-input outline-none transition-all"
          style={{ fontSize: "16px" }}
        />
        <p className="text-[11px] text-ink-3 px-1 tabular-nums">
          {search.trim()
            ? `${visible.length} of ${stores.length} stores`
            : `${stores.length} stores · scroll for more`}
        </p>
      </div>

      {/* List height. The previous max-h-72 (288px ≈ 8 rows) was too
          short on desktop — UK has ~27 stores in the pool and only
          the first 8 fit, with no obvious scroll affordance, so users
          reported "not displaying all stores" even though the
          scroll technically worked. max-h-96 (384px ≈ 10-11 rows)
          balances "see more at a glance" against "don't overflow
          the viewport on shorter screens." */}
      <ul className="flex-1 min-h-0 md:flex-none md:max-h-96 overflow-y-auto py-1.5">
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
      <div className="shrink-0 px-3 py-2 border-t border-border flex items-center justify-between">
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
    <div ref={rootRef} className={fillRow ? "relative w-full" : "relative"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "items-center gap-1.5 px-3 py-1 rounded-full text-[12px] sm:text-xs whitespace-nowrap transition-colors border",
          fillRow
            /* `w-full justify-between` makes the pill stretch to the
                parent's width with label hugging the left and the
                count badge (when present) on the right. ChevronDown
                cap on the right edge signals it's a dropdown control,
                not just a static label. */
            /* px-2 (overrides the base px-3 via tailwind-merge) trims the
                trigger in the deals filter row so the tier-pill cluster to
                its left has room to show "All products" without truncating. */
            ? "flex w-full justify-between px-2"
            : "inline-flex",
          selectedCount > 0
            ? "bg-ink text-bg border-ink font-semibold"
            : "bg-surface-2 text-ink-2 border-border hover:text-ink",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <StoreIcon size={12} strokeWidth={2.25} aria-hidden="true" />
          <span>Stores</span>
          {selectedCount > 0 && (
            <span className="tabular-nums">({selectedCount})</span>
          )}
        </span>
        {fillRow && (
          <span aria-hidden="true" className="text-[10px] opacity-70">▾</span>
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
              style={{
                transform: `translateY(${dragY}px)`,
                /* Snap back smoothly on release, but follow the
                   finger 1:1 while actively dragging. */
                transition: isDragging ? "none" : "transform 0.2s ease-out",
                /* Float above the on-screen keyboard: bottom sits on top
                   of the keypad (kbInset), and the sheet is capped to the
                   visible viewport so its search box + list never hide
                   behind the keyboard. Falls back to the bottom-0 /
                   max-h-[85vh] classes when visualViewport is absent. */
                bottom: kbInset,
                maxHeight: vvHeight ? Math.round(vvHeight * 0.92) : undefined,
              }}
            >
              {/* Drag area — handle + title bar. The pointer-event
                  handlers below implement swipe-to-dismiss (delta
                  > DISMISS_THRESHOLD closes the sheet); the close
                  button still functions because onDragPointerDown
                  bails when the target is interactive.

                  touch-action: none lets us own the gesture on this
                  strip — without it the browser's default vertical-
                  scroll handling competes and the drag stutters. The
                  panelBody below keeps default touch-action so its
                  internal scroll list still works. */}
              <div
                className="shrink-0"
                onPointerDown={onDragPointerDown}
                onPointerMove={onDragPointerMove}
                onPointerUp={onDragPointerEnd}
                onPointerCancel={onDragPointerEnd}
                style={{ touchAction: "none" }}
              >
                {/* Drag-handle visual cue — now backed by the actual
                    swipe-to-dismiss gesture wrapping this row. */}
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
              </div>
              {panelBody}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
