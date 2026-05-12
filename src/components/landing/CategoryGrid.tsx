import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/lib/data/categories";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry, inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
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

const browsable = categories.filter((c) => c.slug !== "all");

export default async function CategoryGrid() {
  /* Counts MUST match what /deals?category=X actually shows.

     This component was last revised to fetch with `minDiscount: 5`
     and `origin: 'intl'` for non-NG, which DIDN'T match /api/deals.
     /api/deals defaults to `minDiscount: 0` (since the curated
     SerpAPI catalog ingests with discount_percent=0 by design) and
     uses an in-memory `inferStoreCountry`-based bucket for the
     local/intl split (not the DB-level `is_international` flag,
     which is a USD-currency proxy and treats UK retailers stored
     as USD as 'international' too).

     The combined mismatch undercounted every tile by hundreds to
     thousands of deals (worst: Beauty NG ~1600 short, Fashion NG
     ~1400 short). Verified May 2026 via
     scripts/diagnose-category-counts.ts.

     Fix: mirror /api/deals' exact pipeline:
       1. Fetch per category with minDiscount=0, origin=all.
       2. filterDealsForCountry (country gate).
       3. For non-NG: apply effectiveOrigin='intl' via inferStoreCountry
          (drop stores anchored in the user's own country, since the
          default /deals view shows cross-border for non-NG).
       4. For NG: use the full country-filtered count (effectiveOrigin
          stays 'all' for NG by default).

     Per-category fan-out (not single global) preserves the 8000-row
     page cap per category — important for high-inventory slugs like
     fashion / beauty / home. Cost is ~10 parallel queries; with
     revalidate=300 on the country home, ~120 q/hr worst case. */
  const country = getServerCountry();
  const isNG = country.code === "ng";
  const provider = await getActiveBrowseProvider();

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

  /* Same isLocalToUser logic as /api/deals — store-roster-based with
     currency fallback. Keep these two in sync; the next refactor
     should extract into a shared helper. */
  const isLocalToUser = (d: Deal): boolean => {
    const sc = inferStoreCountry(d.storeId, d.storeName);
    if (sc !== null) return sc.toLowerCase() === country.code.toLowerCase();
    /* Global cross-border stores (AliExpress, Shein, Temu, …) are
       NEVER local. Without this short-circuit AliExpress USD-priced
       rows misclassified as local for US visitors via the bare
       currency-match fallback below — same fix shape applied across
       /api/deals + all card components. */
    if (isGlobalIntlStore(d.storeId, d.storeName)) return false;
    return d.currency === country.currency;
  };

  const counts: Record<string, number> = {};
  for (let i = 0; i < slugs.length; i++) {
    const countryFiltered = filterDealsForCountry(perCategory[i], country);
    /* /api/deals computes effectiveOrigin = !isNG ? 'intl' : origin.
       For non-NG with default origin=all, that's 'intl' → only items
       NOT local to the user. For NG default origin=all → all items. */
    const finalCount = isNG
      ? countryFiltered.length
      : countryFiltered.filter((d) => !isLocalToUser(d)).length;
    counts[slugs[i]] = finalCount;
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
