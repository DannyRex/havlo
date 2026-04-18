"use client";

import { categories } from "@/lib/data/categories";
import { cn } from "@/lib/utils";
import {
  LayoutGrid, Smartphone, Cpu, Gamepad2, Shirt, Home, Sparkles,
  Dumbbell, Laptop, Headphones, Refrigerator, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, Smartphone, Cpu, Gamepad2, Shirt, Home, Sparkles,
  Dumbbell, Laptop, Headphones, Refrigerator,
};

interface Props {
  active: string;
  onChange: (slug: string) => void;
}

export default function CategoryNav({ active, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
      {categories.map((cat) => {
        const isActive = active === cat.slug;
        const Icon = ICONS[cat.icon] ?? LayoutGrid;
        return (
          <button
            key={cat.slug}
            onClick={() => onChange(cat.slug)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0",
              "border transition-colors duration-150",
              isActive
                ? "bg-white text-navy-900 border-white font-medium"
                : "text-slate-300 border-white/10 hover:text-white hover:border-white/25 bg-transparent",
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
