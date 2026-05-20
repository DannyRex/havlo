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
    /* Globals that already shipped to NG long before this commit.
       Amazon marketplaces are listed EXPLICITLY (not the broad
       "amazon" substring) so we drop amazon-de and amazon-india —
       Nigerians don't realistically cross-border ship from those:
         - Amazon DE: language barrier + EU-focused logistics
         - Amazon IN: no direct shipping to NG, GST + customs
           friction at value thresholds NG buyers care about
       Kept: US (.com), UK (.co.uk), AE (Lagos↔Dubai freight route).
       May 2026 v3 fix per user observation. */
    "amazon.com", "amazon-com", "amazon-us",
    "amazon.co.uk", "amazon-co-uk", "amazon-uk",
    /* Amazon AE removed May 2026 v3 per user direction —
       Nigerians realistically buy from US + UK only. AE adds
       noise without a real freight-route. */
    "aliexpress", "asos",
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
  /* Non-NG cross-border lists expanded May 2026 to credit the full
     set of global retailers a shopper in each market can plausibly
     reach. The previous lists were tight (4-5 entries: AliExpress,
     SHEIN, Temu, DHgate, Banggood) which under-counted Wish /
     Alibaba / Lightinthebox / Geekbuying / Trendyol — globals that
     ship worldwide. The new entries also feed the Hero store-count
     pill via getCrossBorderStoreCountForCountry so non-NG markets
     show "local + intl" counts that match the user's actual reach,
     not just the country's marquee. NG list is unchanged — already
     comprehensive (UK retailers + US retailers via freight
     forwarders). */
  uk: ["aliexpress", "shein", "temu", "dhgate", "banggood", "wish.com", "alibaba.com", "lightinthebox", "geekbuying", "trendyol"],
  us: ["aliexpress", "shein", "temu", "dhgate", "wish.com", "alibaba.com", "lightinthebox", "geekbuying", "trendyol"],
  de: ["aliexpress", "shein", "temu", "dhgate", "banggood", "wish.com", "alibaba.com", "lightinthebox", "geekbuying", "trendyol"],
  ae: ["aliexpress", "shein", "temu", "amazon.com", "amazon.co.uk", "dhgate", "banggood", "wish.com", "alibaba.com", "trendyol"],
  // Shein officially banned in India since 2020. Import duties make
  // most Western cross-border purchases impractical.
  //
  // Tightened May 2026 v3 — removed amazon.com. Indian shoppers
  // access US Amazon inventory via Amazon India's 'Global Store'
  // feature (which surfaces in our catalog as amazon.in offers
  // anyway, since the storefront is amazon.in). Direct cross-border
  // to amazon.com isn't realistic: 18% GST + 30%+ customs + slow
  // shipping vs domestic Amazon Global Store at fraction of the
  // friction. So the cross-border list keeps only the truly global
  // marketplaces that DO clear Indian customs at low thresholds.
  in: ["aliexpress", "wish.com", "alibaba.com"],
  za: ["aliexpress", "shein", "temu", "amazon.com", "amazon.co.uk", "dhgate", "banggood", "wish.com", "alibaba.com", "trendyol"],
};

function crossBorderListFor(countryCode: string): string[] {
  return COUNTRY_CROSS_BORDER[countryCode] ?? DEFAULT_CROSS_BORDER;
}

/* Canonicalise a cross-border allowlist entry to a stable 8-char
   slug so retailer variants collapse:
     "best buy" / "best-buy" / "bestbuy"  → "bestbuy"
     "john lewis" / "john-lewis" / "johnlewis" → "johnlewi"
     "ao.com" / "ao-com" → "aocom"
   Used by both getCrossBorderStoreCountForCountry and the slug-set
   exporter that StoreLogos uses for its local+intl union count. */
function canonicaliseStoreSlug(entry: string): string {
  return entry.toLowerCase().replace(/[-.\s&_]/g, "").slice(0, 8);
}

/* Canonical set of cross-border retailer slugs reachable from a
   given market. Public because StoreLogos.tsx unions this with
   the ROSTERS local set to compute the "local + intl" Hero pill. */
export function crossBorderSlugsForCountry(countryCode: string): Set<string> {
  const list = COUNTRY_CROSS_BORDER[countryCode.toLowerCase()] ?? DEFAULT_CROSS_BORDER;
  const seen = new Set<string>();
  for (const entry of list) {
    const canon = canonicaliseStoreSlug(entry);
    if (canon.length >= 3) seen.add(canon);
  }
  return seen;
}

/* Approximate count of unique cross-border retailers a shopper in
   this country can reach via Havlo. Wraps crossBorderSlugsForCountry
   and returns just the size. May 2026 user request from the
   country-awareness audit follow-up. */
export function getCrossBorderStoreCountForCountry(countryCode: string): number {
  return crossBorderSlugsForCountry(countryCode).size;
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
  /* v3 NG addition: Bitmarte. */
  "bitmarte",

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

/* Stores that are NEVER local to any country — universal cross-border
   shippers. AliExpress, Shein, Temu, etc. ship globally and serve
   no single market as "local". The bucketing logic uses this list
   to short-circuit the currency-match fallback, which otherwise
   misclassifies AliExpress (USD-priced) as US-local for US shoppers,
   DHgate (USD-priced) as US-local, etc.

   Substring match on storeId/storeName. Each entry MUST be specific
   enough that it can't false-match a regional retailer (e.g.
   "aliexpress" rather than "express" which would catch American
   Eagle's "Express" brand). */
export const GLOBAL_INTL_STORES = [
  "aliexpress",
  "shein",
  "temu",
  "dhgate",
  "banggood",
  "wish.com",
  "alibaba",
  "lightinthebox",
  "geekbuying",
  "trendyol", // Turkish marketplace, ships globally
];

/** True if the store is a universal cross-border / global shipper
    that should NEVER be flagged as local to any specific country. */
export function isGlobalIntlStore(storeId: string, storeName: string): boolean {
  const id = lc(storeId);
  const name = lc(storeName);
  return matchesAny(id, GLOBAL_INTL_STORES) || matchesAny(name, GLOBAL_INTL_STORES);
}

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
    /* v3 additions: QVC UK leaks into US pool without an explicit
       UK entry (US bucketing was matching it via currency fallback).
       qvc-uk / qvc.co.uk are specific enough to avoid catching the
       US QVC parent. */
    "qvc-uk", "qvc.co.uk", "qvc uk",
    /* v4 additions (May 2026): user-reported INTL badge firing on
       every UK store on /compare. Root cause: substring-match
       roster missed the actual storeId/storeName SerpAPI + the UK
       retailer ingest write into Supabase. Two classes of fix:

       1. Ampersand-in-name retailers. The roster had "marks and
          spencer" but the actual storeName is "Marks & Spencer"
          (literal &), so neither id ("marks") nor name matched.
          Adding the & form catches the literal name; the bare
          "marks" catches the storeId from ingest-uk-retailers.ts
          (key: "marks"). Same shape for any future & retailer. */
    "marks & spencer", "marks ",
    /* 2. Common UK retailers that the SerpAPI pool surfaces in
          compare results but weren't in the v1-v3 roster. Each is
          UK-anchored enough that the cross-roster ambiguity is
          minimal — Waitrose / Ocado / Morrisons / Iceland / Aldi-
          UK / TK Maxx are unambiguous in the UK retail landscape;
          IKEA is multi-market but most SerpAPI UK results land
          here (acceptable trade-off — a DE user looking at an
          IKEA listing arguably IS cross-border to them anyway). */
    "ikea", "waitrose", "ocado", "morrisons", "iceland", "aldi",
    "wilko", "lakeland", "tk maxx", "tkmaxx", "tk-maxx",
    "hotel chocolat", "hotel-chocolat", "robert dyas", "robert-dyas",
    "the range", "the-range", "toolstation",
    /* eBay UK: the bare "ebay" entry in the US roster matches
       first under first-match-wins iteration (US iterates after
       UK, so UK gets first crack — but UK roster only had
       "ebay.co.uk", which fails to substring-match the storeName
       "eBay" SerpAPI returns for UK listings). Adding "ebay uk" /
       "ebay-uk" so UK-specific variants match before falling
       through to the bare US "ebay". */
    "ebay uk", "ebay-uk",
    /* v6 (May 2026 re-audit) — explicit UK-suffix variants so
       longest-match wins over bare brand entries in other rosters.
       Examples that were leaking before:
         - "acer-store-uk" → AE (AE roster had bare "ace" / "acer") */
    "acer-store-uk", "acer store uk", "acer.co.uk",
    "samsung.co.uk", "samsung-uk", "lg.co.uk", "lg uk",
    "sony.co.uk", "sony uk", "apple.co.uk", "apple uk",
    "nike.co.uk", "nike uk", "adidas.co.uk", "adidas uk",
    "puma.co.uk", "puma uk", "hm.co.uk", "h&m uk",
    /* v5 additions (May 2026 launch-readiness audit). EE
       (BT-owned UK mobile carrier) and Ubisoft Store UK called
       out specifically as untagged contaminators. EE is "ee" so
       we use ee.co.uk to avoid a 2-char substring collision with
       hundreds of store names containing "ee". Ubisoft has a
       global store; the UK variant uses ubisoft.com/en-gb path
       which SerpAPI tags as separate. */
    "ee.co.uk", "ee mobile", "ee-mobile",
    "ubisoft store uk", "ubisoft-store-uk", "ubisoft.com/en-gb",
    "store.ubisoft.com/uk",
    "currys business", "currys-business", "currys for business",
    /* UK gaming / electronics tail */
    "game.co.uk", "gameuk", "game-uk", "scan.co.uk", "scanuk",
    "overclockers", "overclockers.co.uk", "ebuyer", "ebuyer.com",
    /* UK supermarket clothing + general */
    "george.com", "george at asda", "fatface", "fat face",
    "white stuff", "whitestuff", "joules", "seasalt",
    "hobbs", "phase eight", "phaseeight", "monsoon",
    "accessorize", "the body shop", "thebodyshop", "lush",
    "molton brown", "moltonbrown",
    /* UK furniture / home tail */
    "dfs", "dfs.co.uk", "made.com", "loaf", "loaf.com",
    "graham and green", "grahamandgreen",
  ],
  us: [
    "amazon.com", "walmart", "best buy", "bestbuy", "target", "newegg",
    /* Bare "ebay" is intentionally ambiguous — eBay is a global
       marketplace. The UK roster has explicit "ebay.co.uk" /
       "ebay uk" / "ebay-uk" variants that match BEFORE this
       fallback under first-match-wins iteration. So a UK listing
       still resolves to UK; everything else lands here. */
    "ebay", "home depot", "homedepot", "macy", "kohl", "costco", "bjs",
    "nordstrom", "sephora", "ulta", "wayfair", "etsy", "lowes", "lowe's",
    "staples", "gap", "old navy", "oldnavy", "nike", "adidas",
    /* v3 additions: GameStop primarily ships US (occasionally
       cross-border but anchored in the US market). QVC parent is
       US-anchored — QVC UK has its own UK roster entry which
       takes precedence in inferStoreCountry's first-match-wins
       iteration. */
    "gamestop", "qvc.com", "qvc-com",
    "fashion nova", "fashion-nova",
    "dick's sporting", "dick-s-sporting", "dicks sporting",
    /* v4 additions (May 2026 launch-readiness audit). Each one
       was found contaminating non-US pools as untagged stores
       OR appearing on /us/deals via a non-roster path. Adding
       them here gives inferStoreCountry an explicit "US" answer
       so the new strict untagged-store filter doesn't drop them.

       boohoo USA — sibling to UK boohoo, anchored US via the .us
       subdomain (boohoo.com is UK). NFM — Nebraska Furniture Mart,
       Midwest US furniture chain. "Express" — US fashion brand
       (collision risk with "express checkout" etc. so we use the
       distinctive "express.com" form). "going-going-gone" / "ggg"
       — US clearance retailer. xbox.com / store.xbox.com / xbox
       — Microsoft's US gaming store (cross-region storefronts
       exist but the bare domain anchors US). bloomingdales,
       neiman marcus, saks (already in NG cross-border, adding to
       US roster too so inference works), bed bath beyond. */
    "boohoo-usa", "boohoo usa", "boohoo.us",
    "nfm", "nebraska furniture", "nebraskafurniture",
    "express.com", "express-com",
    "going-going-gone", "going going gone", "ggg",
    "xbox.com", "xbox-com", "store.xbox.com",
    "bloomingdales", "bloomingdale", "neiman marcus", "neiman-marcus",
    "saks", "bed bath beyond", "bedbathandbeyond", "bedbath",
    "ann taylor", "anntaylor", "loft", "j.crew", "jcrew",
    "michael kors", "michaelkors", "tory burch", "toryburch",
    "ralph lauren", "ralphlauren", "polo ralph lauren",
    /* US gaming / electronics tail commonly surfaced by SerpAPI */
    "best buy mobile", "newegg.com", "tigerdirect", "microcenter",
    /* US carrier sites — they sell phones direct, anchored US */
    "verizon", "verizon.com", "att.com", "at&t", "t-mobile", "tmobile",
    "boost mobile", "boostmobile", "cricket wireless", "cricketwireless",
    /* Sephora US — explicit .com form so the short "sephora" entry
       in this list doesn't substring-match sephora-uae / sephora-de
       under the new longest-match logic in inferStoreCountry. The
       per-market sephora variants are added to AE / DE rosters
       below for the same reason. */
    "sephora.com", "sephora-com", "sephora us", "sephora-us",
  ],
  de: [
    "amazon.de", "amazon-de", "amazon germany",
    "mediamarkt", "media-markt", "saturn", "otto", "zalando",
    "idealo", "notebooksbilliger", "alternate", "cyberport", "lidl",
    "kaufland", "real.de", "tchibo",
    /* v4 additions (May 2026 launch-readiness audit). Audit found
       DE local roster collapsed to 2 stores — Amazon DE + Amazon.de
       (duplicate). Adding the actual DE retailer set so /de/deals
       shows real local variety. */
    "mediamarkt.de", "saturn.de", "ottoversand", "otto.de",
    "conrad", "conrad.de", "computeruniverse", "voelkner",
    "alza.de", "smyths-toys.de", "rewe", "edeka",
    "myToys", "mytoys", "bonprix", "redcoon", "comtech",
    "douglas", "douglas.de", "rossmann", "dm.de", "deichmann",
    "thalia.de", "thalia", "weltbild", "hugendubel",
    "schiesser", "esprit.de", "h&m de", "h-m-de",
    /* Microsoft / Apple DE storefronts */
    "apple.de", "microsoft.de", "xbox.de",
    /* Country-variant collisions — explicit DE-specific forms so
       longest-match in inferStoreCountry routes these to DE instead
       of the parent brand's home market (e.g. Sephora US bare entry
       would substring-match sephora.de). Per the May 2026 launch-
       readiness re-audit. */
    "sephora.de", "sephora-de", "sephora deutschland",
    "carrefour.de", "ikea.de", "h&m.de",
  ],
  ae: [
    "amazon.ae", "amazon-ae", "amazon uae",
    "noon", "noon.com", "sharaf dg", "sharafdg", "sharaf-dg",
    "carrefour.ae", "carrefour uae",
    "lulu hypermarket", "luluhypermarket", "luluwebstore",
    "first cry", "firstcry.ae", "firstcry-ae",
    "centrepoint", "centrepointstores", "namshi", "ounass", "6thstreet",
    /* v4 additions (May 2026 launch-readiness audit) — AE local
       roster was too tight (12 → was showing 3 effective).
       v5 tightening (May 2026 re-audit): bare "ace" / "acer" /
       "desertcart" were substring-matching foreign stores
       (acer-store-uk, desertcart-in). Removed bare forms; kept
       only the .ae-specific variants. The longest-match logic
       in inferStoreCountry needs the more-specific entry to
       beat foreign rosters' bare forms. */
    "ace.ae", "acehardware.ae", "jumbo.ae", "jumbo electronics",
    "emax.ae", "plug-ins", "plugins.ae",
    "max fashion", "max-fashion", "maxfashion.ae",
    "splashfashions.com", "splash fashions",
    "babyshopstores", "mothercare.ae",
    "shukran.ae", "home centre uae", "homecentre.ae",
    "westelm.ae", "west elm uae", "pottery barn uae",
    "ubuy.ae", "desertcart.ae",
    "letstango.com", "menakart.com",
    /* Country-variant collisions — explicit AE-specific forms so
       longest-match in inferStoreCountry wins over a parent brand's
       short entry in another country roster. Per May 2026 launch-
       readiness re-audit ("Sephora UAE" landing in US local). */
    "sephora-uae", "sephora uae", "sephora.ae", "sephora-ae",
    "carrefour-uae", "carrefour uae", "ikea uae", "ikea.ae",
    "bath & body works uae", "bath-body-works-uae", "bathbodyworks.ae",
    "the body shop uae", "thebodyshop.ae",
  ],
  in: [
    "amazon.in", "amazon-in", "amazon india",
    "flipkart", "myntra", "ajio", "tata cliq", "tatacliq",
    "snapdeal", "nykaa", "firstcry", "meesho", "croma", "reliance digital",
    "reliancedigital", "vijay sales", "vijaysales", "shopclues",
    /* v4 additions (May 2026 launch-readiness audit). naaptol was
       specifically called out as contaminating the NG default tab —
       adding it to IN roster so inferStoreCountry resolves it
       correctly. */
    "naaptol", "naaptol.com",
    "indiamart", "purplle", "1mg", "tata 1mg", "tata-1mg",
    "lenskart", "boat-lifestyle", "boat lifestyle", "mamaearth",
    "swiggy", "zomato", "blinkit",
    "limeroad", "voonik", "abof", "yepme",
    "vivo india", "oneplus india", "samsung india",
    "smytten", "swiss-beauty", "hyugalife", "sangeetha-mobiles",
    /* v5 (May 2026 re-audit): country-variant overrides so the
       longest-match in inferStoreCountry routes the .co.in /
       India-tagged variants of global brands to IN rather than
       to whichever country's roster has the bare brand name.
       Examples that were leaking before:
         - "adidas.co.in" → US (US roster had bare "adidas")
         - "desertcart.in" → AE (AE roster had bare "desertcart")
         - other India-suffix brand storefronts likely affected. */
    "adidas.co.in", "adidas-co-in", "adidas india",
    "desertcart.in", "desertcart-in",
    "nike-co-in", "nike.co.in", "nike india",
    "puma.co.in", "puma-india", "puma india",
    "h&m.co.in", "h&m india", "hm-india",
    "zara india", "zara-india", "zara.in",
    "samsung.com/in", "samsung-india-com",
    "lg india", "sony india", "apple india", "apple-india",
  ],
  za: [
    /* v3: tightened "game" → "game.co.za" / "game stores" because the
       bare "game" substring matched "GameStop" (US), "Game Loot"
       (cross-border indie), "Games" generic — leaking those into the
       ZA local pool. The SA "Game" chain consistently appears as
       its domain or with " Stores" suffix in SerpAPI source strings. */
    "takealot", "makro", "game.co.za", "game stores", "loot.co.za", "wantitall",
    "yuppiechef", "superbalist", "zando", "everyshop", "incredible connection",
    "incredibleconnection", "checkers", "pick n pay", "picknpay",
    /* v4 additions (May 2026 launch-readiness audit). ZA showed
       2 deals from 1 store — Wellness Warehouse was leaking into
       NG instead of resolving here. */
    "wellness warehouse", "wellness-warehouse", "wellnesswarehouse",
    "clicks", "clicks.co.za", "dis-chem", "dischem",
    "woolworths sa", "woolworths.co.za", "woolworthsza",
    "raru", "raru.co.za", "evetech", "evetech.co.za",
    "bobshop", "bobshop.co.za", "spree", "spree.co.za",
    "mr price", "mrp.com", "mrprice", "edgars", "ackermans",
    "pep", "pepstores", "shoprite", "checkers hyper",
    "builders warehouse", "builders.co.za",
    "wantitall.co.za", "kalahari", "kalahari.com",
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

/* Per-country preferred Amazon marketplace(s). Drives the dedupe step
   in filterDealsForCountry: the curated Amazon catalog generates one
   entry per marketplace (5 per product), and without dedupe a NG user
   sees the same iPhone listed 5x at the same USD price across US, UK,
   DE, AE, IN. We pick which marketplaces survive per user country
   and drop the rest.

   Values are an ORDERED ARRAY — first entry is canonical, additional
   entries also pass through. For most markets we keep ONE
   (the local one — UK shoppers don't need to see the same iPhone at
   amazon.com when amazon.co.uk has it locally). For markets with
   active cross-border behaviour (NG, ZA), we keep MULTIPLE so the
   user can compare freight-route options:
     - NG: US + UK. Both have established NG freight-forwarder
       workflows. Same product priced differently across the two
       gives the buyer a real choice (often UK wins for non-bulky
       items, US for electronics).
     - ZA: US + UK. Same dynamic. */
const PREFERRED_AMAZON_MARKETPLACE: Record<string, string[]> = {
  ng: ["us", "uk"],
  us: ["us"],
  uk: ["uk"],
  de: ["de"],
  ae: ["ae"],
  in: ["in"],
  za: ["us", "uk"],
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
  const preferredList = PREFERRED_AMAZON_MARKETPLACE[country.code] ?? ["us"];
  const preferredSet = new Set(preferredList);
  const result: T[] = [];
  /* Track which (marketplace, slug) pairs we've kept so the defensive
     pass-2 fallback doesn't re-emit the same row. Slug-only tracking
     would block legit per-marketplace duplicates for multi-preferred
     countries (NG/ZA see both US + UK for the same iPhone — that's
     the whole point). */
  const seenPairs = new Set<string>();

  /* Pass 1: emit non-curated-Amazon as-is, plus curated entries whose
     marketplace is in the preferred set. */
  for (const d of deals) {
    const m = d.id?.match(/^amazon-(us|uk|de|ae|in)-(.+)$/);
    if (!m) {
      result.push(d);
      continue;
    }
    if (preferredSet.has(m[1])) {
      result.push(d);
      seenPairs.add(`${m[1]}|${m[2]}`);
    }
  }

  /* Pass 2: defensive fallback. If a product has NO preferred-
     marketplace entry (curated catalog usually has all 5, but if a
     SKU goes missing from one marketplace), grab the first available
     fallback so the product still appears at least once. Track by
     slug only here — we just want one copy. */
  const seenSlugs = new Set<string>();
  seenPairs.forEach((pair) => { seenSlugs.add(pair.split("|")[1]); });
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
  /** DB-authoritative anchor country (stores.country). Optional
      because legacy curated paths and AliExpress search results
      don't carry it. When present, isOfferAllowedForCountry uses
      it as the PRIMARY signal — preferred over the hardcoded JS
      COUNTRY_STORES roster check. Added May 2026 launch-readiness
      re-audit so /compare can correctly route offers for stores
      backfilled by migration 0037 (handysparkauf, refurbed-de,
      fonezone, bigbasket, istore-south-africa, etc.) that aren't
      in the JS roster but ARE country-tagged in the DB. */
  storeCountry?:    string | null;
}

function lc(s: string): string { return s.toLowerCase(); }

/* Strip every separator character (dot, hyphen, underscore, space)
   from a lowercased string. This lets roster entries authored as
   ".com" / "co.uk" / "marks & spencer" / "tata cliq" match storeIds
   that ingest writes as "amazon-co-uk-amazon-co-uk-seller",
   "marks-spencer", "tata-cliq-fashion", etc. Substring matching on
   the literal form fails because hyphens vs dots vs spaces split the
   string differently. The normalised form collapses all separator
   styles to a single canonical bag-of-characters.

   May 2026 retest fix: DE 0 local, AE 2 local, IN 6 local were all
   caused by this mismatch. Roster authored "amazon.ae"; storeIds
   ingested as "amazon-ae-seller" / "amazon-ae-retail" / etc. The
   literal `.includes("amazon.ae")` returned false because the dot
   isn't in the storeId. After normalisation, both sides become
   "amazonae..." and the substring match succeeds. */
function normalizeForMatch(s: string): string {
  return s.replace(/[.\-_\s&]+/g, "");
}

function matchesAny(haystackLc: string, needles: string[]): boolean {
  /* Pre-compute the normalised haystack once. Avoid recomputing in
     the loop. */
  const haystackNorm = normalizeForMatch(haystackLc);
  return needles.some((n) => {
    /* Try both forms so existing exact-style entries (whole word,
       no separators) keep working and new cross-separator matches
       also succeed. */
    const literalLc = n.toLowerCase();
    if (haystackLc.includes(literalLc)) return true;
    const needleNorm = normalizeForMatch(literalLc);
    if (!needleNorm) return false;
    return haystackNorm.includes(needleNorm);
  });
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

  /* For COUNTRY_STORES, find the LONGEST matching entry across all
     rosters (instead of first-match). Was first-match before May 2026
     launch-readiness re-audit which caught "sephora-uae" landing in
     US local because US roster had "sephora" (short substring) and
     iterated before AE in Object.keys order.

     Longest-match is the right behaviour: a more-specific roster
     entry should always win over a less-specific one. So if AE
     roster has "sephora-uae" (11 chars) and US has "sephora" (7
     chars), the AE entry wins for storeId "sephora-uae" because
     it's a more-precise signal of the store's anchor market.

     Adding the country-specific roster variants (sephora-uae,
     sephora-de, etc.) is a separate change — this longest-match
     logic is the GENERIC fix that prevents the whole class of
     substring-collision bugs going forward. */
  let bestCountry: string | null = null;
  let bestMatchLength = 0;
  for (const code of Object.keys(COUNTRY_STORES)) {
    const list = COUNTRY_STORES[code];
    for (const entry of list) {
      const entryLc = entry.toLowerCase();
      if ((id.includes(entryLc) || name.includes(entryLc)) && entry.length > bestMatchLength) {
        bestMatchLength = entry.length;
        bestCountry = code.toUpperCase();
      }
    }
  }
  return bestCountry;
}

/** Filter a deals list for the given country preference.
    - For NG: drop nothing locally, but still trim cross-border noise
      (Indian Flipkart shouldn't show on a Nigerian homepage)
    - For non-NG: drop NG-only stores; keep country-appropriate
      cross-border, country-tagged matches, and known country-roster
      stores (Amazon UK / ASOS / Argos for UK, etc.).

    Sibling: isOfferAllowedForCountry (StoreOffer shape, used by the
    /compare pipeline). The two functions share their rosters and
    cross-border allowlists but use different cross-border signals —
    Deal carries `currency` + `tags[]`, OfferLike carries the
    `isInternational` boolean. See isOfferAllowedForCountry's
    docstring for the full shape-contract notes. */
export function filterDealsForCountry<T extends DealLike>(deals: T[], country: Country): T[] {
  const countryFiltered = deals.filter((d) => {
    /* NG path: keep all NG-anchored stores + only country-appropriate
       cross-border + Amazon. Drop foreign-country-anchored retailers
       that Nigerians can't actually use (Flipkart, Tata CLiQ, Walmart). */
    if (country.code === "ng") {
      if (isNigerianStore(d)) return true;
      if (isCrossBorderStore(d, "ng")) return true;
      const tag = dealCountryTag(d);
      // Tagged country:ng → keep (SerpAPI ingest)
      if (tag === "ng") return true;
      /* Everything else: DROP. May 2026 launch-readiness re-tighten.
         The previous "inferred-US/UK → keep" fallback re-introduced
         leaks: any store I added to the US roster (LOFT, boohoo USA,
         NFM, Going Going Gone, etc.) would resolve `inferStoreCountry`
         to "US" and pass through to NG visitors — but those stores
         AREN'T cross-border-friendly for Nigerians (no freight route,
         no NG payment integration). Re-audit caught this:
           "NG default still pulls in non-NG stores (LOFT, QVC UK,
            boohoo USA)"
         The NG cross-border allowlist (COUNTRY_CROSS_BORDER.ng) is
         the authoritative source for what NG visitors can shop. A
         store the JS layer can place in some country roster but
         that's NOT in the NG cross-border list = NG buyers don't
         actually use it. Drop. To re-admit a store, add it
         explicitly to the NG cross-border list. */
      return false;
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
    if (tag === null && d.currency === country.currency) {
      /* Untagged + currency-match used to pass unconditionally. That
         leaked UK retailers (QVC UK, ASOS, John Lewis, Matalan) into
         the US INTL pool because every SerpAPI row is normalised to
         USD at ingest — so a UK retailer's row has currency=USD
         which matches a US visitor's currency=USD, no country tag,
         passes. QA report May 2026: "/us/deals?origin=intl shows UK
         retailers as if they were international US options."

         May 2026 launch-readiness pass: tightened further. Was:
         `if (inferred === null) return true` — truly-unknown stores
         got a free pass via currency-match. Audit caught Brown
         Thomas (IE), boohoo USA (?), Express, NFM, Going Going
         Gone, naaptol, Wellness Warehouse all landing in non-NG
         local pools because their storeIds weren't in any roster.

         New behaviour: untagged + inferred-null = DROP even when
         currency matches. Same trade-off as the NG path — losing
         legit-but-obscure stores in exchange for guaranteed-clean
         per-country pools. Expand the rosters in COUNTRY_STORES
         to re-admit stores that show up frequently in audits. */
      const inferred = inferStoreCountry(d.storeId, d.storeName);
      if (inferred === null) return false;          // was: return true (leak)
      return inferred.toLowerCase() === country.code.toLowerCase();
    }
    return false;
  });

  /* Final pass: collapse curated-Amazon entries to one per product
     based on the user's preferred marketplace. Without this the INTL
     tab shows the same item 5x at the same USD price (one per
     marketplace), which reads as duplicate junk. */
  return dedupeCuratedAmazon(countryFiltered, country);
}

/** Country relevance check for StoreOffer-style rows (compare anchor +
    dupes pipeline). Same intent as filterDealsForCountry — "should
    this row appear in the visitor's market?" — but the input shape
    is different so the function has to be a sibling rather than a
    wrapper.

    Shape contract:
      - filterDealsForCountry  takes Deal     (currency + tags[])
      - isOfferAllowedForCountry takes OfferLike (isInternational flag)

    The Deal type is /deals' surface object (covers SerpAPI, curated
    Amazon, native scrapers). It carries `currency` + `tags[]` —
    SerpAPI rows have explicit `country:xx` tags from the ingest
    parser. The OfferLike type is the pg-fts compare-pipeline shape:
    every offer has been normalised to NGN at ingest, the original
    currency is lost, and the only cross-border signal is the
    boolean `isInternational` set when the source currency was USD.

    Both functions converge on the same store-roster / cross-border
    allowlist logic (matchesAny, crossBorderListFor, NG_STORES,
    isStoreInCountry) so a store that's relevant on /deals stays
    relevant on /compare. The country tightening that landed in
    filterDealsForCountry on May 2026 (untagged-USD-from-foreign-
    retailer drop) has its parallel below — see the "Symmetric
    tightening" comment at the end of this function.

    If you change one, audit the other. A divergent rule will
    eventually show as "/deals has Currys but /compare doesn't". */
export function isOfferAllowedForCountry<T extends OfferLike>(o: T, country: Country): boolean {
  const idLc   = lc(o.storeId);
  const nameLc = lc(o.storeName);
  const xb     = crossBorderListFor(country.code);

  /* PRIMARY signal: DB-authoritative store_country when present.
     Covers the ~600 stores backfilled by migration 0037 from
     offer.source_query that aren't in the hardcoded JS
     COUNTRY_STORES roster (handysparkauf, refurbed-de, fonezone,
     bigbasket, istore-south-africa, etc.). Without this branch
     /compare returned mode:empty for DE/IN/ZA on flagship queries
     even though the iPhone 15 / Galaxy S24 / MacBook offers existed
     in those markets — they just weren't in the JS roster so the
     downstream string-match gates dropped them.

     Skip this short-circuit for NG: NG cross-border is the strongest
     signal there (a US-tagged Amazon row IS shoppable from NG via
     freight forwarders), and we handle that explicitly below. */
  if (o.storeCountry && country.code !== "ng") {
    if (o.storeCountry.toLowerCase() === country.code.toLowerCase()) return true;
    /* Foreign country anchor — still pass if explicitly cross-border
       (Amazon.com tagged country=US is cross-border-shoppable for
       UK/DE/etc. visitors via the cross-border allowlist). */
    if (matchesAny(idLc, xb) || matchesAny(nameLc, xb)) return true;
    return false;
  }

  // NG: keep all NG retailers + country-appropriate cross-border
  if (country.code === "ng") {
    if (matchesAny(idLc, NG_STORES) || matchesAny(nameLc, NG_STORES)) return true;
    if (matchesAny(idLc, xb) || matchesAny(nameLc, xb)) return true;
    /* NG-storeCountry rows pass the explicit NG path. */
    if (o.storeCountry && o.storeCountry.toLowerCase() === "ng") return true;
    if (o.isInternational === false) return true;        // NGN-priced row
    return matchesAny(idLc, xb) || matchesAny(nameLc, xb);
  }

  // Non-NG (storeCountry not set): cross-border per country + country-anchored retailers
  if (matchesAny(idLc, xb) || matchesAny(nameLc, xb)) return true;
  if (isStoreInCountry(o, country.code)) return true;

  // NG-anchored stores never for non-NG
  if (matchesAny(idLc, NG_STORES) || matchesAny(nameLc, NG_STORES)) return false;

  /* Local-currency-priced row (USD-priced for US visitor, GBP-priced
     for UK visitor — though SerpAPI normalises everything to USD so
     this mostly hits US in practice) where inferStoreCountry CAN
     resolve to this country's roster. Mirrors the symmetric path in
     filterDealsForCountry — without this, /compare returned mode:
     "empty" for the entire non-NG world because every offer was
     classified as `isInternational=true` (USD-priced) and the only
     pass-through was an explicit roster match.

     Audit May 2026 launch-readiness pass: "compare returns zero
     anchors for UK, US, AE, DE, IN, ZA — only NG works." Root
     cause was the missing-vs-filterDealsForCountry path; the
     filter was strict-roster-only, so any product whose only
     in-market offer came from a non-roster store became empty.

     Truly-unknown stores (inferStoreCountry === null) still drop
     here — same tightening as filterDealsForCountry's untagged-
     + currency-match path. Keeps the long tail of niche retailers
     out without re-introducing the contamination the audit found. */
  if (o.isInternational !== false) {
    const inferred = inferStoreCountry(o.storeId, o.storeName);
    if (inferred && inferred.toLowerCase() === country.code.toLowerCase()) return true;
  }

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
