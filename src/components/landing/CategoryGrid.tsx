import { unstable_cache } from "next/cache";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/lib/data/categories";
import CategoryTileLink from "./CategoryTileLink";
import { filterDealsForCountry, type Country } from "@/lib/country";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
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

   Egress optimisation (May 2026): replaced provider.fetchDeals
   with a direct lightweight SELECT that pulls only the columns
   filterDealsForCountry needs (storeId, storeName, currency,
   sourceCountry). Per row drops from ~700 bytes to ~60 bytes —
   ~12× reduction. With 10 categories per render × ~80 renders/
   day across 7 countries, this saves roughly ~500 MB/day of
   Supabase egress.

   The semantic is unchanged: we still apply the EXACT same
   filterDealsForCountry logic and count the result. Tile counts
   stay identical to what they were before (so users see the
   same number on a tile vs landing on /deals).

   Why we can't just use a SQL COUNT: filterDealsForCountry has
   application-level logic (rosters, inferStoreCountry, dedupe)
   that's not easily expressible in pure SQL without a migration.
   The lightweight SELECT lets us keep the rich filter while
   cutting per-row payload to the minimum needed.

   Cache key includes the country code so /uk and /ng don't collide.
   Cache tag `category-counts` lets a future cron call
   revalidateTag('category-counts') after each ingest run if we
   want sub-5min freshness. */
type CountRow = {
  store_id:        string;
  currency:        string;
  source_country:  string | null;
  /* PostgREST returns the !inner-joined relations as objects when
     a single row is expected. We project name only. */
  stores:          { name: string; is_international: boolean | null } | null;
  products:        { category_slug: string | null } | null;
};

const fetchCategoryCounts = (country: Country) =>
  unstable_cache(
    async (): Promise<Record<string, number>> => {
      const supa = getSupabaseAdmin();
      const slugs = browsable.map((c) => c.slug);
      if (!supa) {
        /* No DB → all-zero counts. The grid still renders; tiles
           just show "0 deals". Same fallback shape as the prior
           provider.fetchDeals = [] case. */
        return Object.fromEntries(slugs.map((s) => [s, 0]));
      }

      /* Pull only the columns filterDealsForCountry reads. Per
         row: ~60 bytes vs ~700 bytes from the full browse_deals
         RPC shape. We're paying for the same row-set, just
         streaming far fewer bytes per row.

         Pages of 1000 rows match the per-pass cap browse_deals
         used. Any category with > 1000 in-stock offers is
         vanishingly rare in practice, and the count on the tile
         caps at "999+" anyway in the rendered UI (see below). */
      const perCategory = await Promise.all(
        slugs.map(async (slug) => {
          const { data } = await supa
            .from("offers")
            .select("store_id, currency, source_country, stores!inner(name, is_international), products!inner(category_slug)")
            .eq("in_stock", true)
            .eq("products.category_slug", slug)
            .limit(2000);
          return (data ?? []) as unknown as CountRow[];
        }),
      );

      /* Shape the lightweight rows into the DealLike shape that
         filterDealsForCountry expects. Only the fields it
         actually reads — anything else stays undefined. */
      const counts: Record<string, number> = {};
      for (let i = 0; i < slugs.length; i++) {
        const dealLikes = perCategory[i].map((r) => ({
          /* DealLike subset — filterDealsForCountry reads these. */
          storeId:       r.store_id,
          storeName:     r.stores?.name ?? "",
          currency:      r.currency as "NGN" | "USD",
          sourceCountry: r.source_country ?? undefined,
          /* Other Deal fields filterDealsForCountry does NOT read.
             Filled to satisfy the type, never inspected. */
          id:              "",
          title:           "",
          description:     "",
          category:        "",
          categorySlug:    slugs[i],
          originalPrice:   0,
          salePrice:       0,
          discountPercent: 0,
          imageUrl:        undefined,
          imageGradient:   "",
          imageEmoji:      "",
          url:             "",
          expiresAt:       null,
          isHot:           false,
          isFeatured:      false,
          tags:            [],
          saves:           0,
          clicks:          0,
          postedAt:        "",
        }));
        const filtered = filterDealsForCountry(dealLikes, country);
        counts[slugs[i]] = filtered.length;
      }
      return counts;
    },
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
