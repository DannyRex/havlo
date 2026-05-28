"use client";

import { categories } from "@/lib/data/categories";
import { cn } from "@/lib/utils";
import { useCountry } from "@/components/providers/CountryProvider";
import { track } from "@/lib/analytics";
import {
  LayoutGrid, Smartphone, Cpu, Gamepad2, Shirt, Home, Sparkles,
  Dumbbell, Laptop, Headphones, HeartPulse, Refrigerator, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, Smartphone, Cpu, Gamepad2, Shirt, Home, Sparkles,
  Dumbbell, Laptop, Headphones, HeartPulse, Refrigerator,
};

interface Props {
  active: string;
  onChange: (slug: string) => void;
}

/* Mobile: single-row horizontal scroll (no-scrollbar + swipe).
   Desktop: wrap onto multiple rows so every category is reachable
   without horizontal scroll - which mouse-only desktop users can't
   easily trigger (no horizontal scroll-wheel gesture, hidden
   scrollbar). User report (May 2026): "on desktop in deals page,
   the categories pills are truncated and there's no way to scroll
   to reveal the ones at the right." The sm:flex-wrap +
   sm:overflow-visible pair disables the horizontal scroll container
   at sm+ and lets the pills naturally wrap. gap-y-2 gives the
   wrapped rows a sensible vertical rhythm. */
export default function CategoryNav({ active, onChange }: Props) {
  const { country } = useCountry();
  return (
    <div className="flex gap-1.5 sm:gap-y-2 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar -mx-1 px-1">
      {categories.map((cat, i) => {
        const isActive = active === cat.slug;
        const Icon = ICONS[cat.icon] ?? LayoutGrid;
        return (
          <button
            key={cat.slug}
            onClick={() => {
              /* Fire-and-forget GA4 event before the local state
                 change so the analytics call has the click context.
                 No-ops when consent isn't granted (handled inside
                 track()). */
              track({
                name: "category_click",
                props: {
                  category: cat.slug,
                  surface:  "deals_chip",
                  position: i,
                  country:  country.code,
                },
              });
              onChange(cat.slug);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0",
              "border transition-colors duration-150",
              isActive
                ? "bg-ink text-bg border-ink font-medium"
                : "text-ink-2 border-border hover:text-ink hover:border-border-strong bg-transparent",
            )}
          >
            <Icon size={14} strokeWidth={2} />
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
