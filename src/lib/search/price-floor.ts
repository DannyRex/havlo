/* Price-plausibility helpers — shared between /compare (pgFts) and
   /api/live-search so counterfeits can't sneak in through one
   surface and skip filtering on the other.

   The QA agent caught counterfeits on three surfaces:
     1. /compare anchor selection (now caught by priceLooksPlausible
        with title)
     2. /compare alternatives + dupes (same)
     3. /compare "Live, on sale now" section — was UNFILTERED.
        DHgate iPhone 17 Pro $27.55, AliExpress Yeezy fakes $89,
        Konga Z Fold 7 ₦45K all surfaced here.
     4. Homepage "Real comparisons" chip pool — separately
        filtered via looksLikeChipJunk in trending-multi-store.ts

   This module exports the same flagship floor + the live-deal
   variant that converts USD prices to NGN before applying the
   floor, since live-search rows are USD-priced. */

const CATEGORY_PRICE_FLOOR_NGN: Record<string, number> = {
  phones:      40_000,
  computing:   80_000,
  electronics: 15_000,  // includes former "appliances" (merged May 2026)
  audio:        5_000,
  gaming:      15_000,
  fashion:      3_000,
  beauty:       1_500,
  home:         3_000,
  sports:       2_500,
};

/* Per-flagship-line price floors. Catches counterfeit listings that
   pass the category floor but are way below the legitimate retail
   range for that specific product. Each entry is a lowercase
   substring → minimum NGN price.

   Mirror of the FLAGSHIP_PRICE_FLOOR_NGN map in pg-fts.ts. Kept in
   sync — when adding a new flagship, add to BOTH (or pull pg-fts
   to import from here, but that's a bigger refactor for later).

   Match on substring of the LOWERCASED title. First-match-wins by
   declaration order (longer / more specific keys first). */
export const FLAGSHIP_PRICE_FLOOR_NGN: Array<[string, number]> = [
  // Apple — flagship phones
  ["iphone 17 pro max",   1_500_000],
  ["iphone 17 pro",       1_300_000],
  ["iphone 17",             900_000],
  ["iphone 16 pro max",   1_200_000],
  ["iphone 16 pro",       1_000_000],
  ["iphone 16",             750_000],
  ["iphone 15 pro max",     900_000],
  ["iphone 15 pro",         750_000],
  ["iphone 15",             600_000],
  // Apple — audio
  ["airpods max",           300_000],
  ["airpods pro 2",         150_000],
  ["airpods pro",           120_000],
  ["airpods 4",             100_000],
  ["airpods 3",              80_000],
  // Apple — laptops
  ["macbook pro m4",      1_500_000],
  ["macbook pro m3",      1_200_000],
  ["macbook air m3",        900_000],
  ["macbook air m2",        700_000],
  ["ipad pro m4",         1_000_000],
  ["ipad air m2",           600_000],
  // Samsung — flagship phones
  ["galaxy z fold 7",     1_500_000],
  ["galaxy z fold 6",     1_300_000],
  ["galaxy z flip 7",       900_000],
  ["galaxy z flip 6",       800_000],
  ["galaxy s26 ultra",      900_000],
  ["galaxy s26",            600_000],
  ["galaxy s25 ultra",      700_000],
  ["galaxy s24 ultra",      600_000],
  // Pixel
  ["pixel 10 pro",          700_000],
  ["pixel 10",              500_000],
  ["pixel 9 pro",           500_000],
  // Audio — premium headphones
  ["wh-1000xm5",            150_000],
  ["wh-1000xm4",            100_000],
  ["bose quietcomfort ultra",150_000],
  ["bose quietcomfort 45",  120_000],
  // Gaming — current consoles
  ["playstation 5 slim",    400_000],
  ["playstation 5",         350_000],
  ["xbox series x",         400_000],
  ["xbox series s",         200_000],
  ["nintendo switch oled",  250_000],
  // Footwear flagships — real Nike retail
  ["air jordan 1",           80_000],
  ["nike dunk low",          70_000],
  ["air force 1",            45_000],
  ["adidas samba",           80_000],
  ["yeezy",                 100_000],
];

export function flagshipFloorFor(title: string): number | null {
  const lc = title.toLowerCase();
  for (const [key, floor] of FLAGSHIP_PRICE_FLOOR_NGN) {
    if (lc.includes(key)) return floor;
  }
  return null;
}

/* Same shape as pg-fts's priceLooksPlausible — flagship floor wins
   when present, falls back to category floor, falls back to a
   conservative ₦1,000 floor. */
export function priceLooksPlausible(
  priceNgn: number,
  categorySlug: string | null,
  title?: string,
): boolean {
  if (title) {
    const flagshipFloor = flagshipFloorFor(title);
    if (flagshipFloor !== null) return priceNgn >= flagshipFloor;
  }
  const floor = categorySlug ? (CATEGORY_PRICE_FLOOR_NGN[categorySlug] ?? 1_000) : 1_000;
  return priceNgn >= floor;
}

/* Live-deal variant: live-search rows store prices in USD even for
   non-NG markets (SerpAPI normalises). Convert to NGN before
   applying the floor. The flagship floor map is in NGN so this is
   the conversion cost we pay once per row.

   Approximate FX (matches the Country.USD_FX table). Could pull
   from there but importing creates a cross-module dep cycle —
   inline is fine for a constant we update quarterly anyway. */
const USD_TO_NGN = 1_600;

export function priceLooksPlausibleForLiveDeal(
  priceUsd: number,
  title: string,
): boolean {
  const priceNgn = Math.round(priceUsd * USD_TO_NGN);
  /* Live-search rows have categorySlug "all" by default — the
     flagship floor is the meaningful gate here. Falls back to the
     conservative ₦1,000 floor when the title doesn't match a known
     flagship line, which is permissive (doesn't reject niche brands). */
  return priceLooksPlausible(priceNgn, "all", title);
}
