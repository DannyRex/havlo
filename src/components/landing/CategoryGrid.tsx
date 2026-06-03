import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/lib/data/categories";
import CategoryTileLink from "./CategoryTileLink";
import CategoryCount from "./CategoryCount";
import { type Country } from "@/lib/country";
import { SITE_URL } from "@/lib/seo";
import {
  PhoneIcon, LaptopIcon, GamingIcon, FashionIcon, HomeIcon,
  BeautyIcon, SportsIcon, EarbudsIcon, ElectronicsIcon, HealthIcon,
  AppliancesIcon,
} from "@/components/ui/CategoryIcons";
import type { ComponentType } from "react";

type IconComp = ComponentType<{ size?: number; className?: string }>;

const ICON_FOR: Record<string, IconComp> = {
  phones:      PhoneIcon,
  electronics: ElectronicsIcon,
  appliances:  AppliancesIcon,
  gaming:      GamingIcon,
  fashion:     FashionIcon,
  home:        HomeIcon,
  beauty:      BeautyIcon,
  sports:      SportsIcon,
  computing:   LaptopIcon,
  audio:       EarbudsIcon,
  health:      HealthIcon,
};

/* Browsable on the homepage = everything except "all" AND anything
   marked `hidden: true`. The hidden flag lets us add taxonomies to
   the data layer + /deals CategoryNav chips without disturbing the
   homepage grid's count/layout.

   Grid balance: 10 browsable tiles keep the 2- and 5-col breakpoints
   even (an 11th orphans a tile). June 2026 split Appliances back OUT of
   Electronics (it had grown well past the thin inventory that drove the
   May merge), so Appliances retakes a tile and Health goes back to
   `hidden` — restoring the clean 10-tile grid. Health stays a /deals
   CategoryNav chip + hub (CategoryNav doesn't honour `hidden`), so it
   loses only its homepage tile. */
const browsable = categories.filter((c) => c.slug !== "all" && !c.hidden);

/* Per-category counts, cached by country.

   Evolution:
     v1: provider.fetchDeals per category → ~7.88 MB/render (audit
         flagged as #1 egress hog).
     v2: lightweight SELECT pulling only filter-relevant columns
         → ~1.31 MB/render (85% cut). But .limit(2000) was silently
         capped by PostgREST's db-max-rows=1000, so any category
         with > 1000 offers reported exactly "1,000 deals" on the
         tile — a hard cap the user caught (May 2026 audit).
     v3: HEAD COUNT with SQL-side `is_international = true OR
         stores.country ILIKE '<cc>'`. Transferred zero rows, but the
         is_international predicate turned out to be a near-useless
         relevance signal: ingest stamps it on 98% of stores (983/1000),
         INCLUDING country-anchored retailers (UK Argos, US Walmart).
         So the OR collapsed to "is_international = true" for every
         non-NG market — every country counted the same ~3,250-offer
         intl pool and the `country.ilike` clause added nothing (those
         anchored stores were already is_international=true). Result:
         byte-for-byte identical counts across UK/US/IN/ZA/AE — a tell
         a pre-launch QA pass correctly flagged as "looks hardcoded".
         NG differed only because its 10 stores are is_international=false.

     v4: HEAD COUNT on the `offers` table keyed on country-anchored OR a
         per-market isCrossBorderStore allowlist. Distinct per country,
         but it counted a DIFFERENT thing than /deals: `offers` rows
         (multiple per product) with an allowlist intl set — whereas the
         /deals all-tab pill counts `product_best_offers` (ONE row per
         product) with intl = is_international AND store_country IS NULL.
         So a tile's "N deals" never matched the count the visitor saw
         after clicking through (user report June 2026: "count on the
         deals-by-category card is different from the all tab count").

     v5: call getOriginCounts (the product_best_offers head count). Closer,
         but STILL a different source than the grid: /deals derives its
         All-tab pill AND its displayed cards from provider.fetchDeals +
         filterDealsForCountry, whose broader cross-border set the tight
         head count under-counted (NG appliances tile 79 vs 192 shown).

   v6: compute the count locally the EXACT way /deals does (provider.fetchDeals
       + filterDealsForCountry). Correct, but a SEPARATE in-process cache on a
       SEPARATE ISR cycle from /deals, so the tile and the pill could still
       drift by their cache windows after a data change.

   v7 (now): read the count straight from the SAME /api/deals endpoint /deals
       reads — `originCounts.all` from that exact response. The tile isn't just
       computed the same way, it's the SAME NUMBER from the SAME source, so it
       cannot diverge from the All-tab pill. That endpoint is edge-cached (~60s)
       + POOL_CACHE (5min) and shared with real /deals traffic, so these N reads
       are cheap cache hits — which is what lets the homepage ISR stay short
       (fast refresh) without extra DB load. On a (rare) fetch failure we fall
       back to 0; the tile stays clickable and /deals handles the empty state. */
async function fetchCategoryCounts(country: Country): Promise<Record<string, number>> {
  const slugs = browsable.map((c) => c.slug);
  const entries = await Promise.all(
    slugs.map(async (slug): Promise<[string, number]> => {
      try {
        const res = await fetch(
          `${SITE_URL}/api/deals?country=${country.code}&category=${encodeURIComponent(slug)}&origin=all`,
          { next: { revalidate: 120 } },
        );
        if (!res.ok) return [slug, 0];
        const data = await res.json();
        const all = data?.originCounts?.all;
        return [slug, typeof all === "number" ? all : 0];
      } catch {
        return [slug, 0];
      }
    }),
  );
  return Object.fromEntries(entries);
}

/* `country` arrives as a prop from the page so this component stays
   statically renderable per /[country]/. The cookies() read here
   was the biggest single source of dynamic-SSR pressure — 60 RPCs
   per visit on a route that should be ISR-cached. */
export default async function CategoryGrid({ country }: { country: Country }) {
  const counts = await fetchCategoryCounts(country);

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
            href={`/${country.code}/deals`}
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
                /* origin=all forces the deals page to skip its
                   default "local"-tab initialOrigin so the user
                   lands on the SAME count we showed on the tile.
                   Without this the tile's all-pool count would
                   contradict the post-click local-tab count and
                   reproduce the "ZA homepage says 600 Electronics
                   but /za/deals shows 21" mismatch. */
                href={`/${country.code}/deals?category=${cat.slug}&origin=all`}
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
                      {/* SSR `count` paints first (drives the count-sorted
                          order above + no-flash); CategoryCount then
                          refreshes it from the live /api/deals the All-tab
                          reads, so the tile can't drift from the All-tab
                          count after a data change. */}
                      <CategoryCount countryCode={country.code} slug={cat.slug} initial={count} />
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
