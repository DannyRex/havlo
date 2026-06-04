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
  electronics: 15_000,
  appliances:  15_000,  // split back out of electronics (June 2026); same floor
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

   SINGLE SOURCE OF TRUTH. pg-fts.ts (the /compare anchor + dupe
   engine) and /api/live-search both import the helpers below from
   this module, so a flagship line added here is enforced on every
   read surface at once — there is no second map to keep in sync.

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
  // Apple — wearables. Most-specific line first so "Apple Watch
  // Series 11" matches "apple watch series" cleanly. Real retail:
  // Ultra ~$799, Series ~$399, SE ~$249. Floors sit ~25-40% of
  // retail to block the ~$18 DHgate fakes while still allowing
  // genuine refurb / steep sales.
  ["apple watch ultra",     300_000],
  ["apple watch series",    150_000],
  ["apple watch se",         80_000],
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
  ["wh-1000xm6",            180_000],
  ["wh-1000xm5",            150_000],
  ["wh-1000xm4",            100_000],
  ["bose quietcomfort ultra",150_000],
  ["bose quietcomfort 45",  120_000],
  // Gaming — current consoles
  ["playstation 5 slim",    400_000],
  ["playstation 5",         350_000],
  ["xbox series x",         400_000],
  ["xbox series s",         200_000],
  ["nintendo switch 2",     250_000],
  ["nintendo switch oled",  250_000],
  // Home + personal care — Dyson (cordless vacuums + hair care).
  // High-counterfeit lines: genuine V15 ~$650, Airwrap ~$600,
  // Supersonic ~$430. The $15-60 "Dyson V15" listings on
  // AliExpress / DHgate are fakes. Floors ~30% of retail. Version
  // substrings are disjoint, so match order among them is moot.
  ["dyson v15",             200_000],
  ["dyson v12",             150_000],
  ["dyson v11",             130_000],
  ["dyson v8",              100_000],
  ["dyson airwrap",         200_000],
  ["dyson supersonic",      150_000],
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

import { FX_GENERATED } from "@/lib/fx-rates.generated";
/* Live-deal variant: live-search rows store prices in USD even for
   non-NG markets (SerpAPI normalises). Convert to NGN before
   applying the floor. The flagship floor map is in NGN so this is
   the conversion cost we pay once per row.

   Single-sourced from the build-time FX mirror (fx-rates.generated.ts is a
   leaf constant -- no imports, so no dep cycle) so this floor reads the same
   USD->NGN rate as country.USD_FX and utils.USD_TO_NGN, never a stale one. */
const USD_TO_NGN = FX_GENERATED.NGN ?? 1_600;

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
/* Fitment connector across the marketplaces we ingest: English "for",
   German "für"/"fuer", French "pour", Spanish/Portuguese "para". Only
   consulted AFTER ACCESSORY_SOFT_NOUN matches, so the non-English words
   can't misfire on unrelated titles (and \b-anchoring means "para"
   never touches "parachute"/"paracord"). Catches "Hülle für Sony
   WH-1000XM5", "Coque pour iPhone 15" — fitment items the English-only
   gate used to wave through into a real product's price pool. */
const FITMENT_FOR = /\b(?:for|für|fuer|pour|para)\b\s+\S/;

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

/* ── Counterfeit / trademark-mimicry suppression ───────────────────
   Finding #10 (May 2026 QA): the catalog surfaced listings that
   imitate luxury houses to move counterfeits — "GG Exclusive men's
   Ace sneaker with Interlocking G" (Gucci monogram), "Medusa Logo
   Clip Sandals" (Versace), "Luxury Patekes Philipely ... Super Clone
   Watch" (Patek), unbranded "AAA ... Date Just MIYOTA" (Rolex),
   "Mirror Quality Hobo Bag", plus 7A/10A/12A-graded replica handbags.

   Unlike isUsedListing — a genuine product we DISCLOSE with a chip —
   a counterfeit is a legal-liability item callers SUPPRESS outright
   (drop the row rather than label it). A brand's legal team
   screenshotting a Havlo page full of fakes is the failure mode.

   CRITICAL precision constraints. Havlo's value prop legitimately
   INCLUDES dupes / "inspired by" alternatives (legal fragrance dupes,
   generic look-for-less items in DupeCard), so this targets TRADEMARK
   MIMICRY and replica-grade slang ONLY — never the words "dupe",
   "inspired by", "alternative", or "similar to". Two real false-
   positive traps the rules are tuned around:
     • "replica" is LEGITIMATE for licensed sports merch ("NBA
       All-Star Replica Basketball", replica jerseys / kits) — so bare
       "replica" is NOT a signal; only explicit "<luxury> replica"
       phrasings or the grade-slang below.
     • "10A / 12A grade" is a LEGITIMATE human-hair quality grade
       ("12A Burmese Curly Human Hair Wig") — so the grade-code rule
       fires only on bag/shoe listings and is vetoed by any hair term.

   Verified against the live catalog (15,197 titles): suppresses 21
   confirmed counterfeits, 0 false positives. Deliberately favours
   false negatives — a grade-only watch with no "super clone" / "date
   just" tell slips through rather than risk a legitimate listing. */
const COUNTERFEIT_TERMS: RegExp[] = [
  /\bsuper\s*clone\b/i,                 // "Super Clone" / "Superclone" replica-watch slang
  /\bclone\s+watch(?:es)?\b/i,
  /\bmirror\s+(?:quality|image)\b/i,    // 1:1 "mirror" bags/watches
  /\b(?:first|1st|master)\s+cop(?:y|ies)\b/i,
  /\b1\s*:\s*1\s+(?:replica|copy|clone)\b/i,
  /\baaa\b[^.]{0,25}\bdate\s*just\b/i,  // unbranded "AAA ... Date Just" = fake Rolex Datejust
];

/* Monogram / logo references that evoke a luxury house, usually while
   hiding the real brand behind initials to slip past name filters. */
const MONOGRAM_MIMICRY: RegExp[] = [
  /\binterlock(?:ing)?\s*g\b/i,                                   // Gucci interlocking-G
  /\b(?:double\s*g|gg)\s+(?:monogram|logo|pattern|exclusive)\b/i, // Gucci GG
  /\blv\s+(?:monogram|logo|pattern|print)\b/i,                    // Louis Vuitton
  /\bcc\s+(?:logo|monogram|quilted)\b/i,                          // Chanel
  /\bmedusa\s+(?:head|logo|print)\b/i,                            // Versace
  /\bv[-\s]?logo\s+(?:bag|handbag|leather|crossbody|tote)\b/i,    // Valentino V-logo
  /\bred\s+bottoms?\b/i,                                          // Louboutin (resale slang)
];

/* Replica grade-codes (7A/10A/12A) only signal counterfeit on a
   bag/shoe listing in a designer/luxury context, and NEVER when a
   human-hair term is present (those grades are a legit hair scale). */
const CF_GRADE_CODE   = /\b(?:7a|10a|12a)\b/i;
const CF_LUXE_CONTEXT = /\b(?:designer|luxury|quality)\b/i;
const CF_BAGSHOE_NOUN = /\b(?:bag|tote|handbag|crossbody|purse|wallet|clutch|sneakers?|trainers?|shoes?|loafers?)\b/i;
const CF_HAIR_VETO    = /\b(?:wig|wigs|hair|lace|drawn|density|closure|frontal|bundles?|remy|weave|bob)\b/i;

export function looksCounterfeit(title?: string | null): boolean {
  if (!title) return false;
  if (COUNTERFEIT_TERMS.some((re) => re.test(title))) return true;
  if (MONOGRAM_MIMICRY.some((re) => re.test(title))) return true;
  if (CF_GRADE_CODE.test(title) && CF_BAGSHOE_NOUN.test(title)
      && CF_LUXE_CONTEXT.test(title) && !CF_HAIR_VETO.test(title)) return true;
  return false;
}
