"use client";

/* Multi-select store filter for /deals.
   Inspired by spoken.io's store sidebar — checkbox list, search-
   within-list, count badge per store. Compact for the deals page
   filter bar: opens as a popover on click, closes on outside-click
   or Escape.

   State model:
     - selected: Set<string> of store IDs the user has ticked
     - search:   string for filtering the visible list
     - open:     boolean for popover visibility

   Selection persists in URL via the parent's ?stores= param so deep-
   links work (e.g. /uk/deals?stores=argos,currys). */

import { useEffect, useMemo, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* Close on outside click — popover pattern. */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

      {open && (
        /* Popover panel — anchored to the button, drops down on
           larger viewports, slides up from below on small ones via
           bottom-positioning fallback when there isn't enough room
           below. Kept lightweight; no portal because the parent's
           sticky filter bar is z-30 and the panel needs to render
           in-context. */
        <div
          role="listbox"
          aria-label="Filter by store"
          className="absolute z-40 mt-1.5 right-0 w-72 rounded-2xl border border-border bg-bg shadow-2xl"
        >
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

          {/* List */}
          <ul className="max-h-72 overflow-y-auto py-1.5">
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
        </div>
      )}
    </div>
  );
}
