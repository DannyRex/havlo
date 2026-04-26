import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/lib/data/categories";
import { getActiveBrowseProvider } from "@/lib/providers";
import {
  PhoneIcon, LaptopIcon, GamingIcon, FashionIcon, HomeIcon,
  BeautyIcon, SportsIcon, EarbudsIcon, AppliancesIcon, ElectronicsIcon,
} from "@/components/ui/CategoryIcons";
import type { ComponentType } from "react";

type IconComp = ComponentType<{ size?: number; className?: string }>;

const ICON_FOR: Record<string, IconComp> = {
  phones:      PhoneIcon,
  electronics: ElectronicsIcon,
  gaming:      GamingIcon,
  fashion:     FashionIcon,
  home:        HomeIcon,
  beauty:      BeautyIcon,
  sports:      SportsIcon,
  computing:   LaptopIcon,
  audio:       EarbudsIcon,
  appliances:  AppliancesIcon,
};

const browsable = categories.filter((c) => c.slug !== "all");

export default async function CategoryGrid() {
  /* Live counts from the active browse provider. Falls back to the
     hardcoded value in categories.ts if the count is zero (e.g. category
     hasn't been ingested yet) so empty cards don't read as broken. */
  const provider = await getActiveBrowseProvider();
  const counts = await provider.getCategoryCounts();

  return (
    <section className="py-12 sm:py-20 bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-end justify-between mb-6 sm:mb-10 gap-4">
          <div>
            <h2 className="text-[26px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
              Deals by category
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

        {/* Editorial monochrome tiles — type-led, no color tints.
            On hover: border tightens, icon lifts, arrow reveals.
            No two-zone split — single unified card surface. */}
        <nav
          aria-label="Browse by category"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
        >
          {browsable.map((cat) => {
            const Icon = ICON_FOR[cat.slug];
            const count = counts[cat.slug] ?? cat.dealCount;
            return (
              <Link
                key={cat.id}
                href={`/deals?category=${cat.slug}`}
                className="group relative block aspect-[4/5] sm:aspect-[5/6] overflow-hidden rounded-2xl border border-border bg-surface hover:border-ink/40 hover:bg-surface-2 transition-all duration-300"
              >
                {/* Subtle hover-revealed corner arrow */}
                <ArrowUpRight
                  size={16}
                  className="absolute top-4 right-4 text-ink-3 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-300"
                  aria-hidden="true"
                />

                <div className="absolute inset-0 flex flex-col p-5">
                  {/* Big icon — centered horizontally, sits in upper portion */}
                  <div className="flex-1 flex items-center justify-center">
                    {Icon ? (
                      <span className="text-ink-2 group-hover:text-ink transition-all duration-300 group-hover:-translate-y-1">
                        <Icon size={64} />
                      </span>
                    ) : null}
                  </div>

                  {/* Type at bottom — magazine-cover style */}
                  <div>
                    <p className="text-[15px] sm:text-[17px] font-bold text-ink tracking-[-0.02em] leading-tight">
                      {cat.name}
                    </p>
                    <p className="text-[11px] sm:text-xs text-ink-3 mt-0.5 tabular-nums">
                      {count.toLocaleString()} deals
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

      </div>
    </section>
  );
}
