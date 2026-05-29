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

/* ── Listing classification ────────────────────────────────────────
   Two predicates that stop NON-EQUIVALENT listings from contaminating
   a product's price-comparison pool. Caught by the May 2026 PDP-trust
   audit ("hows the cheapest 49 when its 50?"): for a meaningful slice
   of multi-store products the "cheapest" was a different/inferior item
   pooled in by a loose signature / FTS-title match.

     isAccessoryListing — the row is an accessory / spare PART, not the
       product itself ("Replacement Earpads for Bose QC Ultra",
       "Silicone Cover for Sony WH-1000XM5", "Water Bottle Pouch for
       Stanley Quencher"). When such a row shares a pool with the
       parent it sinks to the bottom and falsely becomes the cheapest.

     isUsedListing — the row is used / refurbished / open-box. A real,
       genuinely-cheaper datapoint, but it must be DISCLOSED, never
       silently shown as the cheapest NEW price.

   Both are deliberately HIGH-PRECISION title/store heuristics — they
   favour false negatives over false positives so a legitimate product
   is never dropped from (or mislabelled within) its own pool. The
   accessory guard is also applied ASYMMETRICALLY by callers (only
   filter a candidate when the ANCHOR itself isn't an accessory) so an
   all-earpads pool still compares earpad prices normally. */

/* Unambiguous accessory / part phrases — these classify a row on their
   own, regardless of surrounding context. */
const ACCESSORY_HARD: RegExp[] = [
  /\bear\s?pads?\b/, /\bear\s?cushions?\b/, /\bear\s?cups?\b/,
  /\bheadband\b/, /\bhead\s?beam\b/,
  /\breplacement\b/, /\bspare\s?parts?\b/,
  /\bscreen\s?protectors?\b/, /\btempered\s?glass\b/,
  /\bpouch\b/, /\blanyard\b/, /\bdecals?\b/, /\bskin\s?stickers?\b/,
  /\baccessor(?:y|ies)\s?kit\b/, /\bkit\s+for\b/,
];
/* Softer accessory nouns — classify ONLY when the title also carries a
   "for <something>" fitment phrase (the "<accessory> for <Product>"
   shape that marks a fitment item, not the product). Keeps "iPhone 15
   ... Cover Screen" and "Charging Case" (parts of the actual product)
   out of the net while catching "Case for iPhone 15". */
const ACCESSORY_SOFT_NOUN = /\b(?:case|cover|sleeve|strap|holder|stand|mount|grip|bumper|shell|guard|dock|cushion|protector)\b/;
const FITMENT_FOR = /\bfor\b\s+\S/;

export function isAccessoryListing(title?: string | null): boolean {
  if (!title) return false;
  const lc = title.toLowerCase();
  if (ACCESSORY_HARD.some((re) => re.test(lc))) return true;
  if (ACCESSORY_SOFT_NOUN.test(lc) && FITMENT_FOR.test(lc)) return true;
  return false;
}

/* Title condition words that mark a used / refurbished / open-box
   listing. Note: deliberately NO "grade a/b/c" rule — it collides with
   appliance energy ratings ("Grade A++ Fridge"). */
const USED_TITLE =
  /\b(?:refurb(?:ished)?|renewed|pre[-\s]?owned|preowned|open[-\s]?box|ex[-\s]?display|second[-\s]?hand|certified\s+pre[-\s]?owned)\b|\bused\b/;
/* Stores whose inventory is predominantly refurbished / used — a
   store-level signal for rows whose titles omit the condition word.
   Kept tight (refurb-dedicated retailers only). Open marketplaces
   like eBay / Bonanza are NOT listed: they sell new too, so a blanket
   "used" label there would be a false positive. Catching unlabelled
   used on those needs ingest-time condition capture (follow-up). */
const REFURB_STORES = [
  "back market", "backmarket", "refurbed", "obiwezy", "music magpie", "musicmagpie",
];

export function isUsedListing(storeName?: string | null, title?: string | null): boolean {
  if (title && USED_TITLE.test(title.toLowerCase())) return true;
  if (storeName) {
    const s = storeName.toLowerCase();
    if (REFURB_STORES.some((r) => s.includes(r))) return true;
  }
  return false;
}
