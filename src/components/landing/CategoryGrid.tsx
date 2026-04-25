import Link from "next/link";
import { categories } from "@/lib/data/categories";
import {
  Smartphone, Cpu, Gamepad2, Shirt, Home, Sparkles,
  Dumbbell, Laptop, Headphones, Refrigerator, Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Smartphone, Cpu, Gamepad2, Shirt, Home, Sparkles,
  Dumbbell, Laptop, Headphones, Refrigerator,
};

const browsable = categories.filter((c) => c.slug !== "all");

function resolveIcon(name: string): LucideIcon {
  return iconMap[name] ?? Package;
}

export default function CategoryGrid() {
  return (
    <section className="py-12 sm:py-20 bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-end justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h2 className="text-[26px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
              Shop by category
            </h2>
            <p className="text-sm sm:text-base text-ink-2 mt-1.5">
              Browse what&apos;s on sale across every department.
            </p>
          </div>
          <Link
            href="/deals"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink transition-colors shrink-0"
          >
            See all →
          </Link>
        </div>

        {/* Modern flat tiles — no gradients, no blobs. Color shows up only as
            a small dot accent + on the icon glyph itself. */}
        <nav
          aria-label="Browse by category"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3"
        >
          {browsable.map((cat) => {
            const Icon = resolveIcon(cat.icon);
            return (
              <Link
                key={cat.id}
                href={`/deals?category=${cat.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-border hover:border-ink/20 bg-surface px-4 py-5 sm:px-5 sm:py-6 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon
                    size={26}
                    strokeWidth={1.6}
                    className="text-ink-2 group-hover:text-ink transition-colors shrink-0"
                    aria-hidden="true"
                  />
                  {/* Tiny color dot keeps the brand distinction without painting the whole tile */}
                  <span
                    className="block w-2 h-2 rounded-full opacity-70 group-hover:opacity-100 transition-opacity mt-1.5"
                    style={{ background: cat.color }}
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-5 sm:mt-7">
                  <p className="text-[15px] sm:text-base font-semibold text-ink tracking-[-0.01em] leading-tight">
                    {cat.name}
                  </p>
                  <p className="text-[11px] sm:text-xs text-ink-3 mt-1">
                    {cat.dealCount} deals
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>

      </div>
    </section>
  );
}
