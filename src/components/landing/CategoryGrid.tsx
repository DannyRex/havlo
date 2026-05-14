import { unstable_cache } from "next/cache";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/lib/data/categories";
import CategoryTileLink from "./CategoryTileLink";
import { getActiveBrowseProvider } from "@/lib/providers";
import { filterDealsForCountry, inferStoreCountry, isGlobalIntlStore, type Country } from "@/lib/country";
import type { Deal } from "@/types";
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

/* Browsable on the homepage = everything except "all" AND anything
   marked `hidden: true`. The hidden flag lets us add taxonomies to
   the data layer + /deals CategoryNav chips without disturbing the
   homepage grid's count/layout. Add a `health` category at the
   data layer, but skip its homepage tile until the grid earns a row
   swap and can absorb an extra column. */
const browsable = categories.filter((c) => c.slug !== "all" && !c.hidden);

/* Per-category counts, cached by country.

   Why unstable_cache: the per-category fan-out fires
   `provider.fetchDeals` once for every browsable slug (10 today)
   and each fetchDeals does the dual-pass (4 + 2 = 6 Supabase
   queries) — that's 60 RPCs per render. Wrapping in
   unstable_cache collapses repeat calls within the TTL window into
   ONE compute pass per country.

   Cache key includes the country code so /uk and /ng don't collide.
   Cache tag `category-counts` lets a future cron call
   revalidateTag('category-counts') after each ingest run if we want
   sub-5min freshness — but the 5-min TTL is already tighter than
   the 30-min ISR window for the page itself, so the counts can't
   be more than 5 minutes stale.

   Tags this as part of the May 2026 perf fix that unlocked ISR for
   /[country] (see [country]/page.tsx for the full story). */
const fetchCategoryCounts = (country: Country) =>
  unstable_cache(
    async (): Promise<Record<string, number>> => {
      const provider = await getActiveBrowseProvider();
      const isNG = country.code === "ng";
      const slugs = browsable.map((c) => c.slug);

      const perCategory = await Promise.all(
        slugs.map((slug) =>
          provider.fetchDeals({
            categorySlug: slug,
            minDiscount:  0,
            origin:       "all",
          }),
        ),
      );

      const isLocalToUser = (d: Deal): boolean => {
        const sc = inferStoreCountry(d.storeId, d.storeName);
        if (sc !== null) return sc.toLowerCase() === country.code.toLowerCase();
        if (isGlobalIntlStore(d.storeId, d.storeName)) return false;
        return d.currency === country.currency;
      };

      const counts: Record<string, number> = {};
      for (let i = 0; i < slugs.length; i++) {
        const countryFiltered = filterDealsForCountry(perCategory[i], country);
        const finalCount = isNG
          ? countryFiltered.length
          : countryFiltered.filter((d) => !isLocalToUser(d)).length;
        counts[slugs[i]] = finalCount;
      }
      return counts;
    },
    /* Cache key parts — must include country.code for per-country
       isolation. Including the slug list prevents stale results if
       categories.ts changes (rare but worth defending against). */
    ["category-counts", country.code, browsable.map((c) => c.slug).join(",")],
    {
      revalidate: 300, // 5 min — tighter than the page's 30-min ISR
      tags:       ["category-counts"],
    },
  );

/* `country` arrives as a prop from the page so this component stays
   statically renderable per /[country]/. The cookies() read here
   was the biggest single source of dynamic-SSR pressure — 60 RPCs
   per visit on a route that should be ISR-cached. */
export default async function CategoryGrid({ country }: { country: Country }) {
  const counts = await fetchCategoryCounts(country)();

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
        {/* Sort tiles by deal count DESC so the highest-inventory
            categories (most opportunity for the visitor) sit at the
            top-left. Categories with zero deals fall to the bottom
            of the grid but stay visible — the user can still click
            through and see the empty-state guidance.

            User feedback May 2026: "category chips on the homepage
            should be sorted based on popularity from left to right."
            Deal count is the best proxy we have for popularity until
            we wire actual click data through. The numbers already
            drive the count badge each tile displays, so this just
            promotes the same signal to the layout order. */}
        <nav
          aria-label="Browse by category"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
        >
          {[...browsable]
            .sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0))
            .map((cat, idx) => {
            const Icon = ICON_FOR[cat.slug];
            /* Real count from country-filtered fetch above. No fallback
               to the hardcoded categories.ts value — that value was
               fictional placeholder data and showing it caused the
               original mismatch (clicking through revealed real-but-
               smaller numbers). 0 is honest; the tile is still
               clickable and the deals page handles empty state. */
            const count = counts[cat.slug] ?? 0;
            return (
              <CategoryTileLink
                key={cat.id}
                href={`/deals?category=${cat.slug}`}
                category={cat.slug}
                position={idx}
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
              </CategoryTileLink>
            );
          })}
        </nav>

      </div>
    </section>
  );
}
