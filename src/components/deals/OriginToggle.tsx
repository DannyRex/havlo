"use client";

import { Globe, LayoutGrid, MapPin } from "lucide-react";
import { cn, formatCount } from "@/lib/utils";
import type { OriginFilter } from "@/types";

interface Props {
  active: OriginFilter;
  onChange: (origin: OriginFilter) => void;
  counts?: {
    all: number; local: number; intl: number;
    allDeals?: number; localDeals?: number; intlDeals?: number;
  };
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
      className="flex items-stretch w-full rounded-full border border-border bg-surface-2 p-0.5"
    >
      {OPTIONS.map(({ value, label, short, icon: Icon }) => {
        const isActive = active === value;
        const count =
          counts?.[value === "all" ? "all" : value === "local" ? "local" : "intl"];
        /* Deal-only sub-count for the parenthetical. Undefined when
           the is_deal migration hasn't been applied — the UI then
           just shows the total. */
        const dealCount =
          counts?.[value === "all" ? "allDeals" : value === "local" ? "localDeals" : "intlDeals"];
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
                  ? "bg-amber-400 text-amber-950 font-semibold"
                  : "bg-ink text-bg font-semibold"
                : "text-ink-2 hover:text-ink",
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
                    ? "bg-bg/20 text-bg"
                    : "bg-surface-2 text-ink-2",
                )}
                /* Title shows the discount sub-count on hover/tap
                   ONLY when it's a real subset — strictly less than
                   total AND > 0. Same May 2026 audit reason as the
                   DealFeed header copy: the underlying head-count
                   used is_deal=true which was redefined to mean
                   "valid catalog row", making (deals == total) a
                   normal browse state rather than a meaningful
                   "everything is on sale" signal. The post-fix
                   count uses discount_percent > 0 so the subset is
                   now real; we still gate the framing in the UI as
                   defence-in-depth against future schema drift. */
                title={
                  typeof dealCount === "number" && dealCount > 0 && dealCount < count
                    ? `${formatCount(count)} products · ${formatCount(dealCount)} on sale`
                    : `${formatCount(count)} products`
                }
              >
                {formatCount(count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
