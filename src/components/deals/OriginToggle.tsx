"use client";

import { Globe, LayoutGrid, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OriginFilter } from "@/types";

interface Props {
  active: OriginFilter;
  onChange: (origin: OriginFilter) => void;
  counts?: { all: number; local: number; intl: number };
}

const OPTIONS: { value: OriginFilter; label: string; short: string; icon: typeof Globe }[] = [
  { value: "all",   label: "All deals",     short: "All",   icon: LayoutGrid },
  { value: "local", label: "Local stores",  short: "Local", icon: MapPin },
  { value: "intl",  label: "International", short: "Intl",  icon: Globe },
];

export default function OriginToggle({ active, onChange, counts }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Deal origin"
      className="flex items-stretch w-full rounded-full border border-white/10 bg-white/[0.04] p-0.5"
    >
      {OPTIONS.map(({ value, label, short, icon: Icon }) => {
        const isActive = active === value;
        const count =
          counts?.[value === "all" ? "all" : value === "local" ? "local" : "intl"];
        const isIntl = value === "intl";
        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm whitespace-nowrap transition-colors",
              isActive
                ? isIntl
                  ? "bg-amber-400/90 text-navy-900 font-semibold"
                  : "bg-white text-navy-900 font-semibold"
                : "text-slate-300 hover:text-white",
            )}
          >
            <Icon size={14} strokeWidth={2.25} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
            {typeof count === "number" && (
              <span
                className={cn(
                  "tabular-nums text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full",
                  isActive
                    ? "bg-navy-900/15 text-navy-900/80"
                    : "bg-white/[0.06] text-slate-400",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
