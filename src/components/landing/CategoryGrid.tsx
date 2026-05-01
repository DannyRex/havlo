import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/lib/data/categories";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry } from "@/lib/country";
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
  /* Counts MUST match what /deals?category=X actually shows.

     Three filters /deals applies that we need to mirror:
       1. minDiscount=5 default (hide <5% off)
       2. effectiveOrigin="intl" for non-NG users (drop Konga/Jumia/etc.)
       3. filterDealsForCountry country gate

     PLUS the subtle one that bit us: the DB provider's fetchDeals has
     a .limit(500) cap. If we fetch ALL deals globally and bucket by
     category client-side, that 500-cap is split across all categories
     and undercounts each one. The /deals page doesn't have this
     problem because it always queries per-category, so the 500 cap
     applies per category not globally.

     Fix: fan out one fetch per browsable category in parallel, with
     the same filters /api/deals applies, then count each category's
     filtered length. Each fetch hits the 500 cap independently which
     is way above any realistic single-category inventory size, so
     counts now match what /deals returns as its `total` field.

     Cost: ~10 parallel Supabase queries. With revalidate=300 on the
     country home page, that's ~120 queries/hour worst case — trivial. */
  const country = getServerCountry();
  const isNG = country.code === "ng";
  const provider = await getActiveBrowseProvider();
  const origin = isNG ? "all" : "intl";

  const slugs = browsable.map((c) => c.slug);
  const perCategory = await Promise.all(
    slugs.map((slug) =>
      provider.fetchDeals({
        categorySlug: slug,
        minDiscount: 5,
        origin,
      }),
    ),
  );

  const counts: Record<string, number> = {};
  for (let i = 0; i < slugs.length; i++) {
    const visible = filterDealsForCountry(perCategory[i], country);
    counts[slugs[i]] = visible.length;
  }

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
            /* Real count from country-filtered fetch above. No fallback
               to the hardcoded categories.ts value — that value was
               fictional placeholder data and showing it caused the
               original mismatch (clicking through revealed real-but-
               smaller numbers). 0 is honest; the tile is still
               clickable and the deals page handles empty state. */
            const count = counts[cat.slug] ?? 0;
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
