/* Merchant-specific search URL templates.

   Used by /api/go as a fallback when the SerpAPI Google-relay
   resolver can't return a direct product URL. Instead of bouncing
   the user back to havlo (the previous fallback) or to Google's
   consent gate (the round-4 fallback before this — which broke
   with a 400), we land them on the MERCHANT'S OWN search page with
   the product title pre-filled. Worst-case UX is "I clicked Currys,
   I landed on currys.co.uk with my product already searched" —
   which is fine.

   How the lookup works:
     1. Direct store_id match (case-insensitive, exact).
     2. Substring match on store_id (so "amazon-co-uk" hits the
        "amazon.co.uk" entry).
     3. Substring match on storeName (display name) for cases
        where the storeId is opaque.

   Add new merchants as they appear in the catalog. Empty value
   means "we know this merchant but don't have a search URL" — we
   then fall through to the merchant's homepage. Falsy values
   trigger the homepage fallback too. */

interface MerchantHandlers {
  /** Pretty merchant name for the user-facing message. */
  name: string;
  /** Build a search URL given a query string. Returns null when
      the merchant doesn't have a usable search endpoint and we
      should send the user to the homepage instead. */
  searchUrl: (query: string) => string | null;
  /** Homepage fallback when searchUrl returns null or fails. */
  homepage: string;
}

/* Ordered most-specific first so substring matching picks the
   right merchant. amazon.co.uk before amazon.com etc. */
const MERCHANTS: Record<string, MerchantHandlers> = {
  // ── NG retailers ───────────────────────────────────────────────
  "konga":          { name: "Konga",        searchUrl: (q) => `https://www.konga.com/search?search=${encodeURIComponent(q)}`,      homepage: "https://www.konga.com" },
  "jumia":          { name: "Jumia",        searchUrl: (q) => `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(q)}`,      homepage: "https://www.jumia.com.ng" },
  "slot":           { name: "Slot",         searchUrl: (q) => `https://www.slot.ng/?s=${encodeURIComponent(q)}&post_type=product`, homepage: "https://www.slot.ng" },
  "threechub":      { name: "3C Hub",       searchUrl: (q) => `https://www.3chub.com/search?q=${encodeURIComponent(q)}`,           homepage: "https://www.3chub.com" },
  "pointek":        { name: "Pointek",      searchUrl: (q) => `https://pointekonline.com/?s=${encodeURIComponent(q)}`,              homepage: "https://pointekonline.com" },
  "healthplus":     { name: "HealthPlus",   searchUrl: (q) => `https://healthplusnigeria.com/search?q=${encodeURIComponent(q)}`,   homepage: "https://healthplusnigeria.com" },
  "supermart":      { name: "Supermart",    searchUrl: (q) => `https://www.supermart.ng/search?q=${encodeURIComponent(q)}`,        homepage: "https://www.supermart.ng" },
  "medplus":        { name: "MedPlus",      searchUrl: (q) => `https://medplusnig.com/products?q=${encodeURIComponent(q)}`,        homepage: "https://medplusnig.com" },
  "essenza":        { name: "Essenza",      searchUrl: (q) => `https://www.essenza.ng/search?q=${encodeURIComponent(q)}`,          homepage: "https://www.essenza.ng" },
  "kara":           { name: "Kara",         searchUrl: (q) => `https://kara.com.ng/?s=${encodeURIComponent(q)}&post_type=product`, homepage: "https://kara.com.ng" },
  "obiwezy":        { name: "Obiwezy",      searchUrl: (q) => `https://obiwezy.com/?s=${encodeURIComponent(q)}`,                   homepage: "https://obiwezy.com" },
  "spar":           { name: "Spar Nigeria", searchUrl: (q) => `https://www.sparng.com/search?q=${encodeURIComponent(q)}`,          homepage: "https://www.sparng.com" },

  // ── UK retailers ───────────────────────────────────────────────
  "argos":          { name: "Argos",            searchUrl: (q) => `https://www.argos.co.uk/search/${encodeURIComponent(q)}/`,                                    homepage: "https://www.argos.co.uk" },
  "currys":         { name: "Currys",           searchUrl: (q) => `https://www.currys.co.uk/search?q=${encodeURIComponent(q)}`,                                 homepage: "https://www.currys.co.uk" },
  "john-lewis":     { name: "John Lewis",       searchUrl: (q) => `https://www.johnlewis.com/search?search-term=${encodeURIComponent(q)}`,                       homepage: "https://www.johnlewis.com" },
  "johnlewis":      { name: "John Lewis",       searchUrl: (q) => `https://www.johnlewis.com/search?search-term=${encodeURIComponent(q)}`,                       homepage: "https://www.johnlewis.com" },
  "very":           { name: "Very",             searchUrl: (q) => `https://www.very.co.uk/search?keyword=${encodeURIComponent(q)}`,                              homepage: "https://www.very.co.uk" },
  "ao":             { name: "AO.com",           searchUrl: (q) => `https://ao.com/search?q=${encodeURIComponent(q)}`,                                            homepage: "https://ao.com" },
  "boots":          { name: "Boots",            searchUrl: (q) => `https://www.boots.com/sitesearch?searchTerm=${encodeURIComponent(q)}`,                        homepage: "https://www.boots.com" },
  "marks-spencer":  { name: "Marks & Spencer",  searchUrl: (q) => `https://www.marksandspencer.com/s/q-${encodeURIComponent(q)}`,                                homepage: "https://www.marksandspencer.com" },
  "selfridges":     { name: "Selfridges",       searchUrl: (q) => `https://www.selfridges.com/GB/en/cat/?qz=${encodeURIComponent(q)}`,                           homepage: "https://www.selfridges.com" },
  "sports-direct":  { name: "Sports Direct",    searchUrl: (q) => `https://www.sportsdirect.com/searchresults.html?DescriptionFilter=${encodeURIComponent(q)}`, homepage: "https://www.sportsdirect.com" },
  "asos":           { name: "ASOS",             searchUrl: (q) => `https://www.asos.com/search/?q=${encodeURIComponent(q)}`,                                     homepage: "https://www.asos.com" },
  "matalan":        { name: "Matalan",          searchUrl: (q) => `https://www.matalan.co.uk/search?q=${encodeURIComponent(q)}`,                                 homepage: "https://www.matalan.co.uk" },

  // ── Amazon marketplaces ────────────────────────────────────────
  "amazon-co-uk":   { name: "Amazon UK",  searchUrl: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`, homepage: "https://www.amazon.co.uk" },
  "amazon-de":      { name: "Amazon DE",  searchUrl: (q) => `https://www.amazon.de/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.de" },
  "amazon-ae":      { name: "Amazon AE",  searchUrl: (q) => `https://www.amazon.ae/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.ae" },
  "amazon-in":      { name: "Amazon IN",  searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.in" },
  "amazon":         { name: "Amazon",     searchUrl: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,   homepage: "https://www.amazon.com" },

  // ── Other US retailers (commonly seen via SerpAPI) ─────────────
  "walmart":        { name: "Walmart",       searchUrl: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,                       homepage: "https://www.walmart.com" },
  "target":         { name: "Target",        searchUrl: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,                    homepage: "https://www.target.com" },
  "bestbuy":        { name: "Best Buy",      searchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,         homepage: "https://www.bestbuy.com" },
  "best-buy":       { name: "Best Buy",      searchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,         homepage: "https://www.bestbuy.com" },
  "newegg":         { name: "Newegg",        searchUrl: (q) => `https://www.newegg.com/p/pl?d=${encodeURIComponent(q)}`,                          homepage: "https://www.newegg.com" },
  "ebay":           { name: "eBay",          searchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,                   homepage: "https://www.ebay.com" },
  "ebay-co-uk":     { name: "eBay UK",       searchUrl: (q) => `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(q)}`,                 homepage: "https://www.ebay.co.uk" },
  "etsy":           { name: "Etsy",          searchUrl: (q) => `https://www.etsy.com/search?q=${encodeURIComponent(q)}`,                          homepage: "https://www.etsy.com" },
  "homedepot":      { name: "Home Depot",    searchUrl: (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}`,                            homepage: "https://www.homedepot.com" },
  "lowes":          { name: "Lowe's",        searchUrl: (q) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(q)}`,                homepage: "https://www.lowes.com" },
  "wayfair":        { name: "Wayfair",       searchUrl: (q) => `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(q)}`,            homepage: "https://www.wayfair.com" },
  "macy":           { name: "Macy's",        searchUrl: (q) => `https://www.macys.com/shop/search?keyword=${encodeURIComponent(q)}`,              homepage: "https://www.macys.com" },
  "nordstrom":      { name: "Nordstrom",     searchUrl: (q) => `https://www.nordstrom.com/sr?keyword=${encodeURIComponent(q)}`,                   homepage: "https://www.nordstrom.com" },
  "sephora":        { name: "Sephora",       searchUrl: (q) => `https://www.sephora.com/search?keyword=${encodeURIComponent(q)}`,                 homepage: "https://www.sephora.com" },
  "ulta":           { name: "Ulta",          searchUrl: (q) => `https://www.ulta.com/shop/?Ntt=${encodeURIComponent(q)}`,                         homepage: "https://www.ulta.com" },
  "nike":           { name: "Nike",          searchUrl: (q) => `https://www.nike.com/w?q=${encodeURIComponent(q)}`,                               homepage: "https://www.nike.com" },
  "adidas":         { name: "Adidas",        searchUrl: (q) => `https://www.adidas.com/us/search?q=${encodeURIComponent(q)}`,                     homepage: "https://www.adidas.com" },

  // ── DE / AE / IN / ZA / international ──────────────────────────
  "noon":           { name: "Noon",          searchUrl: (q) => `https://www.noon.com/uae-en/search/?q=${encodeURIComponent(q)}`,                  homepage: "https://www.noon.com" },
  "sharafdg":       { name: "Sharaf DG",     searchUrl: (q) => `https://uae.sharafdg.com/?s=${encodeURIComponent(q)}`,                            homepage: "https://uae.sharafdg.com" },
  "carrefour":      { name: "Carrefour UAE", searchUrl: (q) => `https://www.carrefouruae.com/mafuae/en/search?keyword=${encodeURIComponent(q)}`,  homepage: "https://www.carrefouruae.com" },
  "flipkart":       { name: "Flipkart",      searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,                      homepage: "https://www.flipkart.com" },
  "myntra":         { name: "Myntra",        searchUrl: (q) => `https://www.myntra.com/${encodeURIComponent(q)}`,                                 homepage: "https://www.myntra.com" },
  "ajio":           { name: "Ajio",          searchUrl: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,                      homepage: "https://www.ajio.com" },
  "tatacliq":       { name: "Tata CLiQ",     searchUrl: (q) => `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(q)}`, homepage: "https://www.tatacliq.com" },
  "takealot":       { name: "Takealot",      searchUrl: (q) => `https://www.takealot.com/all?qsearch=${encodeURIComponent(q)}`,                   homepage: "https://www.takealot.com" },
  "mediamarkt":     { name: "MediaMarkt",    searchUrl: (q) => `https://www.mediamarkt.de/de/search.html?query=${encodeURIComponent(q)}`,         homepage: "https://www.mediamarkt.de" },
  "saturn":         { name: "Saturn",        searchUrl: (q) => `https://www.saturn.de/de/search.html?query=${encodeURIComponent(q)}`,             homepage: "https://www.saturn.de" },
  "otto":           { name: "Otto",          searchUrl: (q) => `https://www.otto.de/suche/${encodeURIComponent(q)}/`,                             homepage: "https://www.otto.de" },
  "zalando":        { name: "Zalando",       searchUrl: (q) => `https://www.zalando.de/catalog/?q=${encodeURIComponent(q)}`,                      homepage: "https://www.zalando.de" },

  // ── Cross-border / global ──────────────────────────────────────
  "aliexpress":     { name: "AliExpress",    searchUrl: (q) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}`,        homepage: "https://www.aliexpress.com" },
  "shein":          { name: "Shein",         searchUrl: (q) => `https://www.shein.com/pdsearch/${encodeURIComponent(q)}/`,                        homepage: "https://www.shein.com" },
  "temu":           { name: "Temu",          searchUrl: (q) => `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(q)}`,     homepage: "https://www.temu.com" },
  "dhgate":         { name: "DHgate",        searchUrl: (q) => `https://www.dhgate.com/wholesale/search.do?searchkey=${encodeURIComponent(q)}`,   homepage: "https://www.dhgate.com" },
};

/** Resolve a search URL for a given store id / name + product title.
    Returns null if we don't know the merchant at all — caller can
    then fall through to a different strategy (e.g. /compare). */
export function merchantSearchUrl(
  storeId: string | null | undefined,
  storeName: string | null | undefined,
  query: string,
): { url: string; merchantName: string } | null {
  if (!query || !query.trim()) return null;
  const sid = (storeId ?? "").toLowerCase().trim();
  const sname = (storeName ?? "").toLowerCase().trim();
  if (!sid && !sname) return null;

  /* Pass 1: exact storeId match. */
  if (sid && MERCHANTS[sid]) {
    const m = MERCHANTS[sid];
    const url = m.searchUrl(query) ?? m.homepage;
    return { url, merchantName: m.name };
  }

  /* Pass 2: substring match on storeId. Longer keys win to avoid
     "amazon" matching "amazon-co-uk". */
  if (sid) {
    const keys = Object.keys(MERCHANTS).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (sid.includes(key)) {
        const m = MERCHANTS[key];
        const url = m.searchUrl(query) ?? m.homepage;
        return { url, merchantName: m.name };
      }
    }
  }

  /* Pass 3: substring match on storeName. */
  if (sname) {
    for (const [key, m] of Object.entries(MERCHANTS)) {
      if (sname.includes(key) || sname.includes(m.name.toLowerCase())) {
        const url = m.searchUrl(query) ?? m.homepage;
        return { url, merchantName: m.name };
      }
    }
  }

  return null;
}

/** Homepage URL for a known merchant. Useful when we have a store
    but no usable query to search with. */
export function merchantHomepage(
  storeId: string | null | undefined,
  storeName: string | null | undefined,
): { url: string; merchantName: string } | null {
  const sid = (storeId ?? "").toLowerCase().trim();
  const sname = (storeName ?? "").toLowerCase().trim();
  if (!sid && !sname) return null;
  if (sid && MERCHANTS[sid]) return { url: MERCHANTS[sid].homepage, merchantName: MERCHANTS[sid].name };
  const keys = Object.keys(MERCHANTS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (sid.includes(key) || sname.includes(key)) {
      return { url: MERCHANTS[key].homepage, merchantName: MERCHANTS[key].name };
    }
  }
  return null;
}
