/* ──────────────────────────────────────────────────────────────────
   Country preference — pure data + client-safe helpers.

   Contract:
     - Country code is ISO 3166-1 alpha-2 lowercase (matches SerpAPI's
       `gl` param so ingestion + UI can share one identifier).
     - Stored in a first-party cookie `havlo-country` (set client-side
       by CountryProvider).
     - Default is "ng" — Havlo is Nigeria-first.

   Server-only helpers (cookie read on RSC) live in country-server.ts
   so this file stays importable from client components without
   poisoning the client bundle with next/headers.
   ────────────────────────────────────────────────────────────────── */

export const COUNTRY_COOKIE = "havlo-country";
export const DEFAULT_COUNTRY = "ng";

export interface Country {
  /** ISO 3166-1 alpha-2 lowercase — used everywhere as the canonical id */
  code:        string;
  /** Display name */
  name:        string;
  /** Emoji flag — cheap, no asset shipping */
  flag:        string;
  /** ISO 4217 — drives currency formatting */
  currency:    "NGN" | "USD" | "GBP" | "EUR" | "AED" | "INR" | "ZAR";
  /** Human currency symbol (for compact tile layouts that can't fit Intl) */
  symbol:      string;
  /** SerpAPI gl param — usually identical to code, kept explicit so we
      don't accidentally couple the public country code to the search-engine
      knob if they diverge later (e.g. uk vs gb). */
  serpGl:      string;
}

/* MVP roster — every country here either:
   1. Is where Nigerians actually shop (NG, US, UK, AE, DE, IN, ZA), OR
   2. Is on the SerpAPI ingest country list so live data flows for it.
   Easy to extend — add a row here and the selector picks it up.

   Ordered alphabetically by display name so the country switcher
   reads top-to-bottom in the order shoppers would scan it. The
   DEFAULT_COUNTRY ("ng") is still picked by code, not array
   position, so reordering doesn't change which country a fresh
   visitor lands on. */
export const COUNTRIES: Country[] = [
  { code: "de", name: "Germany",        flag: "🇩🇪", currency: "EUR", symbol: "€", serpGl: "de" },
  { code: "in", name: "India",          flag: "🇮🇳", currency: "INR", symbol: "₹", serpGl: "in" },
  { code: "ng", name: "Nigeria",        flag: "🇳🇬", currency: "NGN", symbol: "₦", serpGl: "ng" },
  { code: "za", name: "South Africa",   flag: "🇿🇦", currency: "ZAR", symbol: "R", serpGl: "za" },
  { code: "ae", name: "UAE",            flag: "🇦🇪", currency: "AED", symbol: "د.إ", serpGl: "ae" },
  /* UK is supported in the UI + data filter, but doesn't monetize yet
     (no Amazon UK Associates, no Awin, no UK-specific affiliate keys
     wired). Outbound clicks to UK retailers fall through /api/go's
     wrapper unchanged → user reaches the merchant, no commission. */
  { code: "uk", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£", serpGl: "uk" },
  { code: "us", name: "United States",  flag: "🇺🇸", currency: "USD", symbol: "$", serpGl: "us" },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string | undefined | null): Country {
  if (!code) return COUNTRY_BY_CODE.get(DEFAULT_COUNTRY)!;
  return COUNTRY_BY_CODE.get(code.toLowerCase()) ?? COUNTRY_BY_CODE.get(DEFAULT_COUNTRY)!;
}

/* ── Currency formatting ────────────────────────────────────────── */

/* Approximate FX → unit currency. Same as src/lib/utils.ts USD_TO_NGN
   pattern; refresh quarterly or wire a real FX feed later.
   Values are "1 USD = X local". */
export const USD_FX: Record<Country["currency"], number> = {
  USD: 1.00,
  NGN: 1600,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.67,
  INR: 83,
  ZAR: 18.5,
};

/** Convert a USD amount to the country's local currency. */
export function usdToLocal(usd: number, country: Country): number {
  return Math.round(usd * USD_FX[country.currency]);
}

/** Format a value already in the country's currency. */
export function formatLocal(amount: number, country: Country): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: country.currency,
    minimumFractionDigits: country.currency === "USD" ? 2 : 0,
    maximumFractionDigits: country.currency === "USD" ? 2 : 0,
  }).format(amount);
}

/* ── Per-country store filtering ────────────────────────────────────
   Goal: when a UK user lands on the homepage, they should see UK
   retailers (Amazon UK, ASOS, Argos, Currys…) and a few cross-border
   stores UK shoppers actually use (Shein, Temu, AliExpress) — NOT
   Konga / Jumia / 3C Hub which they can't buy from.

   The Deal.tags array carries `country:xx` for SerpAPI rows; native
   NG scraper rows are NGN-currency. Cross-border stores are matched
   by storeId fragments since they ingest under multiple country
   contexts (Shein.com surfaces under "us", "uk", "de" etc.). */

/* Default cross-border roster — stores that ship to most countries.
   Per-country overrides in COUNTRY_CROSS_BORDER for cases where this
   list is wrong for the local market (Shein is banned in India, etc.). */
const DEFAULT_CROSS_BORDER = [
  "aliexpress", "shein", "temu", "dhgate", "banggood", "lightinthebox", "geekbuying",
];

/* Per-country cross-border allowlist. Determines which "international"
   stores are appropriate for the country's audience.

   NG roster expanded: Nigerian buyers ship from far more US/UK retailers
   than the original short list captured (Walmart, Target, Best Buy,
   B&H, Newegg, Argos, Currys, John Lewis, Boots, Next, Macy's,
   Nordstrom, etc.). Before this expansion the /ng/deals page was
   limited to ~4 stores even though the DB had 236 stores worth of
   offers — most were getting filtered out as 'foreign-anchored'.

   Substring matching (matchesAny) — adding 'argos' here matches
   'argos-uk', 'argos-ae', etc. without needing every variant. */
const COUNTRY_CROSS_BORDER: Record<string, string[]> = {
  ng: [
    /* Globals that already shipped to NG long before this commit. */
    "amazon", "amazon.com", "amazon.co.uk", "aliexpress", "asos",
    "shein", "temu", "dhgate", "ebay", "apple.com", "banggood",
    /* US retailers commonly used by NG cross-border shoppers — most
       are already in the DB via SerpAPI ingest (see
       scripts/inspect-ng-deals.ts diagnostic). */
    "walmart", "target", "best buy", "best-buy", "bestbuy",
    "newegg", "b&h photo", "b-h-photo", "bhphoto", "bhphotovideo",
    "macy", "nordstrom", "sephora", "ulta", "wayfair", "kohl",
    "nike", "adidas", "puma", "old navy", "oldnavy", "gap",
    "fashion nova", "fashion-nova", "dick", "dell.com", "lenovo",
    "newegg", "etsy", "lowes", "lowe's", "home depot", "homedepot",
    "staples", "saks", "saks fifth", "carter's", "carters",
    /* UK retailers — Argos / Currys / John Lewis / Boots etc. all
       have established freight-forwarder workflows for NG buyers. */
    "argos", "currys", "john lewis", "john-lewis", "johnlewis",
    "next.co.uk", "marks-spencer", "marks and spencer", "boots",
    "selfridges", "harrods", "ao.com", "ao-com", "very",
    "river island", "river-island", "sports direct", "sportsdirect",
    "screwfix", "wickes", "halfords", "primark", "matalan",
    "house of fraser", "debenhams", "ebay.co.uk",
    /* v2 additions — same retailers added to COUNTRY_STORES.uk
       so NG cross-border buyers see them in the freight-forwarder
       set. */
    "b&q", "diy.com", "jd sports", "jdsports", "dunelm",
    "smyths", "smyths toys",
    /* Cross-region globals NG buyers also reach. */
    "wish.com", "alibaba.com", "lightinthebox", "geekbuying",
  ],
  uk: ["aliexpress", "shein", "temu", "dhgate", "banggood"],
  us: ["aliexpress", "shein", "temu", "dhgate"],
  de: ["aliexpress", "shein", "temu", "dhgate", "banggood"],
  ae: ["aliexpress", "shein", "temu", "amazon.com", "amazon.co.uk"],
  // Shein officially banned in India since 2020. Import duties make
  // most Western cross-border purchases impractical except Amazon Global.
  in: ["aliexpress"],
  za: ["aliexpress", "shein", "temu", "amazon.com"],
};

function crossBorderListFor(countryCode: string): string[] {
  return COUNTRY_CROSS_BORDER[countryCode] ?? DEFAULT_CROSS_BORDER;
}

/* Stores that are NG-anchored — never appropriate outside Nigeria.

   Substring matching, so each entry needs to be distinctive enough
   that it doesn't collide with global retailer names. We prefer
   '.com.ng' / '.ng' suffixes over bare brand tokens for newer
   additions (e.g. 'spar.com.ng' over 'spar' which could match
   'sparepart' or 'sparkfun'). Older entries kept as-is for
   back-compat with existing store_id strings in the DB. */
const NG_STORES = [
  /* Existing roster — the major online retailers most NG shoppers
     already know. Touched widely in production data. */
  "konga", "jumia", "3c-hub", "3chub", "3c hub",
  "slot", "pointek", "fouani", "zit-trading", "hayathub",
  "ajebomarket", "kara", "obiwezy", "pricepally", "payporte",

  /* Additions — well-known NG-anchored retailers across pharmacies,
     groceries, classifieds, and second-tier electronics. Each is
     vetted for an actual online channel in NG (mail-order or
     full-catalog e-commerce; brick-only chains skipped). */

  // Pharmacies + health — major online drug + wellness channels
  "healthplus", "health plus", "healthplus.com.ng",
  "medplus", "medplusnig", "medplus.com.ng",

  // Supermarkets / groceries with online channels
  "spar.com.ng", "spar nigeria",
  "supermart", "supermart.ng",
  "foodco", "foodco.ng",
  "parknshop", "park n shop",
  "addidemart",

  // Classifieds + marketplaces
  "jiji.ng", "jiji nigeria",

  // Second-tier electronics retailers (under Slot / 3C Hub in scale
  // but distinct catalogs that NG shoppers price-compare against)
  "yudala",
  "megaplaza", "megaplaza.com.ng",
  "tezza", "tezza.com.ng",
  "mobinex.ng", "mobinex nigeria",
  "carfax.com.ng",
  "switz electronics", "switzelectronics",

  // Books + media
  "okadabooks",
];

/* Per-country anchored stores. The filter doesn't strictly require
   these (untagged intl rows pass through too) but having them mapped
   lets future code prioritize "real" country stores in ranking +
   gives QA a clear list of who we expect to surface. Match is
   substring on storeId/storeName. */
export const COUNTRY_STORES: Record<string, string[]> = {
  uk: [
    "amazon.co.uk", "amazon-co-uk", "amazon uk", "amazon-uk",
    "argos", "currys", "john lewis", "johnlewis",
    "very", "asos", "boots", "next", "marks-spencer", "marks and spencer",
    "selfridges", "ao.com", "ao-com", "screwfix", "wickes", "halfords",
    "sports direct", "sportsdirect", "river island", "primark", "matalan",
    "house of fraser", "debenhams", "tesco", "sainsbury", "ebay.co.uk",
    /* v2 additions (May 2026): gap-fillers from the post-launch UK
       pool audit. Each entry must match the storeId or storeName
       substring SerpAPI returns. B&Q comes through as "b&q" or
       "diy.com"; JD Sports as "jd sports" / "jdsports"; Smyths as
       just "smyths". Dunelm is unambiguous. */
    "b&q", "b-q", "diy.com", "diy-com",
    "jd sports", "jd-sports", "jdsports",
    "dunelm",
    "smyths", "smyths toys",
  ],
  us: [
    "amazon.com", "walmart", "best buy", "bestbuy", "target", "newegg",
    "ebay", "home depot", "homedepot", "macy", "kohl", "costco", "bjs",
    "nordstrom", "sephora", "ulta", "wayfair", "etsy", "lowes", "lowe's",
    "staples", "gap", "old navy", "oldnavy", "nike", "adidas",
  ],
  de: [
    "amazon.de", "mediamarkt", "media-markt", "saturn", "otto", "zalando",
    "idealo", "notebooksbilliger", "alternate", "cyberport", "lidl",
    "kaufland", "real.de", "tchibo",
  ],
  ae: [
    "amazon.ae", "noon", "sharaf dg", "sharafdg", "carrefour.ae",
    "lulu hypermarket", "luluhypermarket", "first cry", "firstcry.ae",
    "centrepoint", "namshi", "ounass", "6thstreet",
  ],
  in: [
    "amazon.in", "flipkart", "myntra", "ajio", "tata cliq", "tatacliq",
    "snapdeal", "nykaa", "firstcry", "meesho", "croma", "reliance digital",
    "reliancedigital", "vijay sales", "vijaysales", "shopclues",
  ],
  za: [
    "takealot", "makro", "game", "loot.co.za", "loot", "wantitall",
    "yuppiechef", "superbalist", "zando", "everyshop", "incredible connection",
    "incredibleconnection", "checkers", "pick n pay", "picknpay",
  ],
};

interface DealLike {
  /** Optional. Used by dedupeCuratedAmazon to identify curated entries
      via their `amazon-{marketplace}-{slug}` id pattern. */
  id?:        string;
  storeId:    string;
  storeName:  string;
  currency:   string;
  tags:       string[];
}

/* Per-country preferred Amazon marketplace. Drives the dedupe step in
   filterDealsForCountry: the curated Amazon catalog generates one
   entry per marketplace (5 per product), and without dedupe a NG user
   sees the same iPhone listed 5x at the same USD price across US, UK,
   DE, AE, IN. We pick ONE marketplace per user country and drop the
   rest.

   Mapping logic:
     - NG / ZA: prefer US (most cross-border traffic from these markets
       routes to amazon.com per the affiliate.ts marketplace data)
     - All others: prefer their own marketplace */
const PREFERRED_AMAZON_MARKETPLACE: Record<string, string> = {
  ng: "us",
  us: "us",
  uk: "uk",
  de: "de",
  ae: "ae",
  in: "in",
  za: "us",
};

/* Collapse curated-Amazon duplicates to one entry per product.
   Curated catalog ids follow the pattern `amazon-{marketplace}-{slug}`
   (e.g. `amazon-us-iphone-15-pro-max`). Identifies entries by id
   pattern so non-curated Amazon deals (from scraper or future PAAPI
   ingest) pass through untouched. */
function dedupeCuratedAmazon<T extends DealLike>(
  deals: T[],
  country: Country,
): T[] {
  const preferred = PREFERRED_AMAZON_MARKETPLACE[country.code] ?? "us";
  const result: T[] = [];
  const seenSlugs = new Set<string>();

  /* Pass 1: emit non-curated-Amazon as-is, plus curated entries at the
     preferred marketplace. Tracks slugs we've already kept. */
  for (const d of deals) {
    const m = d.id?.match(/^amazon-(us|uk|de|ae|in)-(.+)$/);
    if (!m) {
      result.push(d);
      continue;
    }
    if (m[1] === preferred) {
      result.push(d);
      seenSlugs.add(m[2]);
    }
  }

  /* Pass 2: defensive fallback. If for any reason a product wasn't
     emitted in the preferred marketplace (shouldn't happen since the
     curated catalog has all 5), grab the first available marketplace
     so the product still appears once. */
  for (const d of deals) {
    const m = d.id?.match(/^amazon-(us|uk|de|ae|in)-(.+)$/);
    if (!m) continue;
    if (seenSlugs.has(m[2])) continue;
    result.push(d);
    seenSlugs.add(m[2]);
  }

  return result;
}

/* Smaller shape for StoreOffer (in /compare anchor + dupe pipelines).
   Tags + currency aren't reliable here (offer prices are normalised to
   NGN for display) — we lean on isInternational instead. */
export interface OfferLike {
  storeId:          string;
  storeName:        string;
  isInternational?: boolean;
}

function lc(s: string): string { return s.toLowerCase(); }

function matchesAny(haystackLc: string, needles: string[]): boolean {
  return needles.some((n) => haystackLc.includes(n));
}

/** True if the deal's store is one of the cross-border / global retailers
    appropriate for the given country audience. When countryCode is
    omitted, uses the union of all per-country lists. */
export function isCrossBorderStore(d: DealLike, countryCode?: string): boolean {
  const list = countryCode ? crossBorderListFor(countryCode) : DEFAULT_CROSS_BORDER;
  const id   = lc(d.storeId);
  const name = lc(d.storeName);
  return matchesAny(id, list) || matchesAny(name, list);
}

/** True if the deal originates from an NG-anchored retailer. */
export function isNigerianStore(d: DealLike): boolean {
  const id   = lc(d.storeId);
  const name = lc(d.storeName);
  if (matchesAny(id, NG_STORES) || matchesAny(name, NG_STORES)) return true;
  // NGN-priced offers are NG by definition
  if (d.currency === "NGN") return true;
  // Tag-based country:ng signal
  if (d.tags.some((t) => lc(t) === "country:ng")) return true;
  return false;
}

/** Extract the country tag from Deal.tags, or null if not present. */
export function dealCountryTag(d: DealLike): string | null {
  const tag = d.tags.find((t) => lc(t).startsWith("country:"));
  return tag ? lc(tag).slice("country:".length) : null;
}

/** True if the deal's store belongs to the country's known retail roster. */
export function isStoreInCountry<T extends DealLike | OfferLike>(d: T, countryCode: string): boolean {
  const list = COUNTRY_STORES[countryCode];
  if (!list) return false;
  const id   = lc(d.storeId);
  const name = lc(d.storeName);
  return matchesAny(id, list) || matchesAny(name, list);
}

/** Infer the country code (uppercase, ISO-3166-style) for a store
 *  based on its storeId/name matched against COUNTRY_STORES. Returns
 *  'NG' for NG-anchored retailers (Konga / Jumia / 3C Hub / Slot)
 *  and uppercase code (UK / US / DE / AE / IN / ZA) when the store
 *  matches a country roster. Returns null for truly cross-border
 *  stores with no native market (AliExpress, DHGate, Shein, Temu).
 *
 *  Used by ingestion.ts to tag stores.country at write time so
 *  per-country queries (chip pool, /deals filters) work without a
 *  separate backfill step. The single source of truth is
 *  NG_STORES + COUNTRY_STORES at the top of this file. */
export function inferStoreCountry(storeId: string, storeName: string): string | null {
  const id   = lc(storeId);
  const name = lc(storeName);

  /* NG-anchored retailers come first — these are explicit substring
     matches against the NG_STORES list and don't overlap with the
     COUNTRY_STORES rosters. */
  if (matchesAny(id, NG_STORES) || matchesAny(name, NG_STORES)) return "NG";

  /* Other countries — check each roster. First-match wins. The
     iteration order matches Object.keys(COUNTRY_STORES) which is
     insertion order from the literal — uk, us, de, ae, in, za —
     same as the rest of the codebase. */
  for (const code of Object.keys(COUNTRY_STORES)) {
    const list = COUNTRY_STORES[code];
    if (matchesAny(id, list) || matchesAny(name, list)) {
      return code.toUpperCase();
    }
  }

  return null;
}

/** Filter a deals list for the given country preference.
    - For NG: drop nothing locally, but still trim cross-border noise
      (Indian Flipkart shouldn't show on a Nigerian homepage)
    - For non-NG: drop NG-only stores; keep country-appropriate
      cross-border, country-tagged matches, and known country-roster
      stores (Amazon UK / ASOS / Argos for UK, etc.). */
export function filterDealsForCountry<T extends DealLike>(deals: T[], country: Country): T[] {
  const countryFiltered = deals.filter((d) => {
    /* NG path: keep all NG-anchored stores + only country-appropriate
       cross-border + Amazon. Drop foreign-country-anchored retailers
       that Nigerians can't actually use (Flipkart, Tata CLiQ, Walmart). */
    if (country.code === "ng") {
      if (isNigerianStore(d)) return true;
      if (isCrossBorderStore(d, "ng")) return true;
      const tag = dealCountryTag(d);
      // Untagged rows from the legacy intl pool — keep, broadly relevant
      if (tag === null) return true;
      // Tagged country:ng → keep (SerpAPI ingest)
      if (tag === "ng") return true;
      // Tagged for a foreign market — only keep if the store is known
      // cross-border-friendly for Nigerians (e.g. tagged country:us
      // but it's actually amazon.com which Nigerians use)
      return isCrossBorderStore(d, "ng");
    }

    /* Non-NG path. Order is intentional:
         1. Drop NG-anchored retailers outright.
         2. Accept stores explicitly on this country's cross-border
            allowlist (AliExpress / Shein / Temu for UK, etc.).
         3. Accept stores on this country's native retail roster
            (Argos / Currys / Amazon UK for UK).
         4. Accept rows tagged with this country (SerpAPI + curated).
         5. PREVIOUSLY: untagged rows passed unconditionally, which
            leaked Walmart US, Best Buy US, Target US into UK / DE /
            ZA pools because the intl scrapers (AliExpress / Shein /
            ASOS / DHgate) all currency-stamp as USD with no country
            tag. QA agent flagged "UK shows ~same intl count as NG"
            despite UK's cross-border allowlist being 5 stores vs NG's
            ~80. Now an untagged row only passes if its currency is
            this country's local currency, which is a strong "actually
            relevant here" signal. Curated USD rows are caught at
            step 4 via their explicit country: tag, so this doesn't
            regress the curated catalog. */
    if (isNigerianStore(d)) return false;
    if (isCrossBorderStore(d, country.code)) return true;
    if (isStoreInCountry(d, country.code)) return true;
    const tag = dealCountryTag(d);
    if (tag === country.code) return true;
    if (tag === null && d.currency === country.currency) return true;
    return false;
  });

  /* Final pass: collapse curated-Amazon entries to one per product
     based on the user's preferred marketplace. Without this the INTL
     tab shows the same item 5x at the same USD price (one per
     marketplace), which reads as duplicate junk. */
  return dedupeCuratedAmazon(countryFiltered, country);
}

/** Variant for StoreOffer-style rows (compare anchor + dupes pipeline).
    Same intent as filterDealsForCountry but reads isInternational
    instead of currency/tags. */
export function isOfferAllowedForCountry<T extends OfferLike>(o: T, country: Country): boolean {
  const idLc   = lc(o.storeId);
  const nameLc = lc(o.storeName);
  const xb     = crossBorderListFor(country.code);

  // NG: keep all NG retailers + country-appropriate cross-border
  if (country.code === "ng") {
    if (matchesAny(idLc, NG_STORES) || matchesAny(nameLc, NG_STORES)) return true;
    if (matchesAny(idLc, xb) || matchesAny(nameLc, xb)) return true;
    if (o.isInternational === false) return true;        // NGN-priced row
    return matchesAny(idLc, xb) || matchesAny(nameLc, xb);
  }

  // Non-NG: cross-border per country + country-anchored retailers
  if (matchesAny(idLc, xb) || matchesAny(nameLc, xb)) return true;
  if (isStoreInCountry(o, country.code)) return true;

  // NG-anchored stores never for non-NG
  if (matchesAny(idLc, NG_STORES) || matchesAny(nameLc, NG_STORES)) return false;
  if (o.isInternational === false) return false;

  /* Symmetric tightening with filterDealsForCountry. Was `return true`
     which meant any unmatched intl offer slipped into non-NG /compare
     pools. Now: an offer that didn't match cross-border, country
     roster, or country tag is rejected unless it has an explicit
     non-international flag. Removes Walmart-US / Best-Buy-US offers
     from /compare for UK / DE / ZA shoppers who can't realistically
     buy from those retailers. */
  return false;
}
