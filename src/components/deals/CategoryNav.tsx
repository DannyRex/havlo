"use client";

import { categories } from "@/lib/data/categories";
import { cn } from "@/lib/utils";

interface Props {
  active: string;
  onChange: (slug: string) => void;
}

export default function CategoryNav({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {categories.map((cat) => {
        const isActive = active === cat.slug;
        return (
          <button
            key={cat.slug}
            onClick={() => onChange(cat.slug)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap",
              "border transition-all duration-150 flex-shrink-0",
              isActive
                ? "text-white border-transparent"
                : "text-slate-400 border-white/[0.06] hover:text-white hover:border-white/[0.12] bg-transparent"
            )}
            style={
              isActive
                ? {
                    background: `${cat.color}20`,
                    borderColor: `${cat.color}50`,
                    color: cat.color,
                    boxShadow: `0 0 16px ${cat.color}20`,
                  }
                : undefined
            }
          >
            <span>{cat.icon}</span>
            {cat.name}
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-md font-semibold",
              isActive ? "bg-white/20" : "bg-white/[0.05] text-slate-600"
            )}>
              {cat.dealCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
