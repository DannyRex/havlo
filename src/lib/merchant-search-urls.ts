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

  // ── Long-tail merchants the slug guess gets wrong ──────────────
  // Each was caught by the live-curl audit. Pattern: storeName
  // doesn't map cleanly to brand+.com — these need explicit entries.
  "american-eagle-outfitters":  { name: "American Eagle", searchUrl: (q) => `https://www.ae.com/us/en/search/${encodeURIComponent(q)}`,             homepage: "https://www.ae.com" },
  "ae":                         { name: "American Eagle", searchUrl: (q) => `https://www.ae.com/us/en/search/${encodeURIComponent(q)}`,             homepage: "https://www.ae.com" },
  "oppo":                       { name: "OPPO",           searchUrl: (q) => `https://www.oppo.com/en/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.oppo.com" },
  "ulefone":                    { name: "Ulefone",        searchUrl: (q) => `https://www.ulefone.com/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.ulefone.com" },
  "mango":                      { name: "Mango",          searchUrl: (q) => `https://shop.mango.com/gb/search?kw=${encodeURIComponent(q)}`,         homepage: "https://shop.mango.com" },
  "wallis":                     { name: "Wallis",         searchUrl: (q) => `https://www.wallis.co.uk/search?text=${encodeURIComponent(q)}`,        homepage: "https://www.wallis.co.uk" },
  "simply-be":                  { name: "Simply Be",      searchUrl: (q) => `https://www.simplybe.co.uk/search?q=${encodeURIComponent(q)}`,         homepage: "https://www.simplybe.co.uk" },
  "peacocks":                   { name: "Peacocks",       searchUrl: (q) => `https://www.peacocks.co.uk/search?q=${encodeURIComponent(q)}`,         homepage: "https://www.peacocks.co.uk" },
  "torrid":                     { name: "Torrid",         searchUrl: (q) => `https://www.torrid.com/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.torrid.com" },
  "mobile-phones-direct":       { name: "Mobile Phones Direct", searchUrl: (q) => `https://www.mobilephonesdirect.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.mobilephonesdirect.co.uk" },
  "sony-store-online":          { name: "Sony Store",     searchUrl: (q) => `https://www.sony.co.uk/electronics/search?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.sony.co.uk" },
  "sony-store":                 { name: "Sony Store",     searchUrl: (q) => `https://www.sony.co.uk/electronics/search?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.sony.co.uk" },
  "cashify":                    { name: "Cashify",        searchUrl: (q) => `https://www.cashify.in/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.cashify.in" },
  /* SerpAPI lists this as "EMI Snapmint" (EMI = installment-payment
     option). Slug → "emisnapmint.com" 404s; canonical brand domain
     is snapmint.com. Both id forms keyed so the lookup works
     whether ingest stored "emi-snapmint" (current) or normalised
     it later. */
  "emi-snapmint":               { name: "Snapmint",       searchUrl: (q) => `https://snapmint.com/search?q=${encodeURIComponent(q)}`,                homepage: "https://snapmint.com" },
  "snapmint":                   { name: "Snapmint",       searchUrl: (q) => `https://snapmint.com/search?q=${encodeURIComponent(q)}`,                homepage: "https://snapmint.com" },
  /* Long-tail audit (May 2026) — these all fell through to /compare
     because smart-fallback couldn't reach a valid domain (4-char
     names or special chars in storeId). Adding explicit entries
     so the clickthrough lands on the merchant. */
  /* (eBay already in the table above; user just wanted the LOGO sourced.) */
  "poshmark":                   { name: "Poshmark",            searchUrl: (q) => `https://poshmark.com/search?query=${encodeURIComponent(q)}`,        homepage: "https://poshmark.com" },
  "dell":                       { name: "Dell",                searchUrl: (q) => `https://www.dell.com/en-us/search/${encodeURIComponent(q)}`,        homepage: "https://www.dell.com" },
  "qvc":                        { name: "QVC",                 searchUrl: (q) => `https://www.qvc.com/keywordsearch.html?keyword=${encodeURIComponent(q)}`, homepage: "https://www.qvc.com" },
  "nfm":                        { name: "NFM",                 searchUrl: (q) => `https://www.nfm.com/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.nfm.com" },
  "dick-s-sporting-goods":      { name: "DICK'S Sporting Goods", searchUrl: (q) => `https://www.dickssportinggoods.com/search/SearchDisplay?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.dickssportinggoods.com" },
  "b-h-photo-video-audio":      { name: "B&H Photo",           searchUrl: (q) => `https://www.bhphotovideo.com/c/search?Ntt=${encodeURIComponent(q)}`, homepage: "https://www.bhphotovideo.com" },
  "ubuy":                       { name: "Ubuy",                searchUrl: (q) => `https://www.ubuy.com/en/search/?ref=${encodeURIComponent(q)}`,     homepage: "https://www.ubuy.com" },
  /* User-reported: storeName "Marks Electrical" was slugifying to
     markselectrical.com (404). Correct brand domain is
     markselectrical.co.uk. */
  "marks-electrical":           { name: "Marks Electrical",    searchUrl: (q) => `https://www.markselectrical.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.markselectrical.co.uk" },
  /* Currys business storefront — same brand, same search path as
     consumer Currys. Curated alias so the search URL works
     identically. */
  "currys-business":            { name: "Currys for Business", searchUrl: (q) => `https://www.currys.co.uk/search?q=${encodeURIComponent(q)}`,        homepage: "https://www.currys.co.uk" },
  /* 93mobiles — Indian electronics aggregator. Starts with a digit
     so the smart-fallback's looksLikeSimpleBrand check rejects it. */
  "93mobiles":                  { name: "93mobiles",           searchUrl: (q) => `https://www.93mobiles.com/search?q=${encodeURIComponent(q)}`,        homepage: "https://www.93mobiles.com" },
  "snapklik":                   { name: "Snapklik",       searchUrl: (q) => `https://uae.snapklik.com/en-AE/search?q=${encodeURIComponent(q)}`,     homepage: "https://uae.snapklik.com" },
  "wonderprice":                { name: "WonderPrice",    searchUrl: (q) => `https://wonderprice.co.uk/search?q=${encodeURIComponent(q)}`,          homepage: "https://wonderprice.co.uk" },
  "verizon":                    { name: "Verizon",        searchUrl: (q) => `https://www.verizon.com/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.verizon.com" },
  "at-t":                       { name: "AT&T",           searchUrl: (q) => `https://www.att.com/search/?q=${encodeURIComponent(q)}`,               homepage: "https://www.att.com" },
  "t-mobile":                   { name: "T-Mobile",       searchUrl: (q) => `https://www.t-mobile.com/search?q=${encodeURIComponent(q)}`,           homepage: "https://www.t-mobile.com" },
  "boost-mobile":               { name: "Boost Mobile",   searchUrl: (q) => `https://www.boostmobile.com/cell-phones.html?q=${encodeURIComponent(q)}`, homepage: "https://www.boostmobile.com" },
  "cricket-wireless":           { name: "Cricket Wireless", searchUrl: (q) => `https://www.cricketwireless.com/shop/all-phones`,                    homepage: "https://www.cricketwireless.com" },
  "kaufland":                   { name: "Kaufland",       searchUrl: (q) => `https://www.kaufland.de/s/?search_value=${encodeURIComponent(q)}`,    homepage: "https://www.kaufland.de" },
  "mr-price":                   { name: "Mr Price",       searchUrl: (q) => `https://www.mrp.com/en_za/search/?q=${encodeURIComponent(q)}`,         homepage: "https://www.mrp.com" },
  "cash-crusaders":             { name: "Cash Crusaders", searchUrl: (q) => `https://www.cashcrusaders.co.za/search?q=${encodeURIComponent(q)}`,    homepage: "https://www.cashcrusaders.co.za" },
  "ikea":                       { name: "IKEA",           searchUrl: (q) => `https://www.ikea.com/gb/en/search/?q=${encodeURIComponent(q)}`,        homepage: "https://www.ikea.com" },
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

/* Smart fallback for merchants NOT in the curated MERCHANTS table.
   The catalog has hundreds of long-tail SerpAPI-ingested stores
   ("Big Apple Buddy", "Cricket Wireless", "x-kom.de", "wmf.com/de",
   "Sony Store Online UK", etc.).

   Strategy (user feedback: "i prefer it to go to the merchant
   website ... rather than google, because what then is the point
   of havlo since a user can go directly to google"):

     1. storeName / storeId looks like a domain → merchant homepage.
        ("x-kom.de" → "https://x-kom.de", "wmf.com/de" → that path).
     2. storeName looks like a plausible brand slug (letters +
        spaces only, no special chars) → try the slugified domain.
        "Cricket Wireless" → "https://cricketwireless.com". This is
        a best-effort guess; the merchant might not own that exact
        domain. Better than nothing because (a) a 404 still leaves
        the user with a recognisable URL bar and (b) most real
        retailers DO own their obvious brand domain.

   Returns null when neither strategy fires. Caller then falls
   through to /compare for alternatives — staying inside Havlo
   instead of bouncing to Google (which would undermine Havlo's
   value prop entirely). */
function looksLikeDomain(s: string): boolean {
  return /^[a-z0-9][a-z0-9\-.]*\.[a-z]{2,}(\/[a-z0-9/_-]*)?$/i.test(s.trim());
}

/* Plausible brand slug: letters + spaces only, no special chars.
   Catches "Verizon", "Cricket Wireless", "Cellucity", "Unihertz",
   "Justmylook" — all real retailers that own their obvious .com
   domain. Rejects "AT&T", "Juvia's Place", "Kaufland.de - Red-
   Tech-" (the special chars produce a wrong slug or a confusing
   URL). Min 5 chars so 2-3 letter inputs ("EE", "BT") don't
   generate noisy guesses. */
function looksLikeSimpleBrand(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 5) return false;
  // Letters + spaces only (single or multi-word both fine)
  return /^[a-z][a-z\s]+[a-z]$/i.test(trimmed);
}

function brandSlug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/* Country-suffix → TLD map. Lots of SerpAPI source names follow
   the "<brand> <country>" pattern (e.g. "Sony Store Online UK",
   "Mango UK", "Wallis UK", "Dell South Africa"). The brand
   typically owns the country-specific TLD ("wonderprice.co.uk",
   "wallis.co.uk", "mango.com/gb") rather than the "xuk.com"
   slug my old code produced.

   Rule: when the storeName ends with one of these markers, strip
   the marker before slugifying and use the matched TLD instead
   of ".com". Matches the user-reported failure case
   (WonderPriceUK → wonderprice.co.uk). */
const COUNTRY_SUFFIX_TLDS: Array<[RegExp, string]> = [
  [/\s+(uk|united\s*kingdom)\s*$/i,         "co.uk"],
  [/\s+(usa|us|united\s*states)\s*$/i,      "com"],
  [/\s+(de|germany|deutschland)\s*$/i,      "de"],
  [/\s+(ae|uae|emirates)\s*$/i,             "ae"],
  [/\s+(in|india)\s*$/i,                    "in"],
  [/\s+(sa|south\s*africa|za)\s*$/i,        "co.za"],
  [/\s+(ng|nigeria)\s*$/i,                  "com.ng"],
  [/\s+(au|australia)\s*$/i,                "com.au"],
  [/\s+(ca|canada)\s*$/i,                   "ca"],
  /* Also handle the no-space "WonderPriceUK" pattern — country
     marker glued to the end of the brand. Same TLDs. */
  [/(uk|gb)\s*$/i,                          "co.uk"],
];

/** Strip generic SerpAPI-source suffixes that aren't part of the
    brand domain. "OPPO Official Store" → "OPPO" (oppo.com),
    "Ulefone Global" → "Ulefone" (ulefone.com), "Microsoft Store
    Online" → "Microsoft" (microsoft.com). Returns the cleaned
    brand name, or the input unchanged when no suffix matches. */
function stripGenericSuffix(s: string): string {
  return s
    .replace(/\s+(official\s+store|online\s+store|store\s+online|web\s+store|brand\s+store|outlet\s+store|flagship\s+store)\s*$/i, "")
    .replace(/\s+(official|outlet|flagship|store|online|web|shop|direct|global|international|hq)\s*$/i, "")
    .trim();
}

/* Strip SerpAPI-style metadata PREFIXES that aren't part of the brand
   domain. User-reported case (May 2026): "EMI Snapmint" was being
   slugified to "emisnapmint" → emisnapmint.com (404). EMI is a
   payment-option marker SerpAPI prepends to Indian-retail listings,
   not a brand name. Same pattern for BNPL ("Buy Now Pay Later"),
   "Pay Later", and the COD (cash-on-delivery) prefix that sometimes
   leaks through. */
function stripGenericPrefix(s: string): string {
  return s
    .replace(/^(emi|bnpl|cod|prime)\s+/i, "")
    .replace(/^(pay\s+later|buy\s+now\s+pay\s+later)\s+/i, "")
    .trim();
}

/** Given "Sony Store Online UK", return
    { slug: "sonystoreonline", tld: "co.uk" }.
    For names without a country marker, returns null so the
    caller falls back to the generic .com guess. */
function stripCountrySuffix(s: string): { slug: string; tld: string } | null {
  const trimmed = s.trim();
  for (const [re, tld] of COUNTRY_SUFFIX_TLDS) {
    const m = trimmed.match(re);
    if (!m) continue;
    /* Cut at the COUNTRY suffix, then ALSO strip any generic
       suffix from what remains. "Sony Store Online UK" → strip
       country → "Sony Store Online" → strip generic → "Sony". */
    const stripped = stripGenericSuffix(trimmed.slice(0, m.index).trim());
    if (stripped.length < 4) continue;
    if (!/^[a-z][a-z\s]+[a-z]$/i.test(stripped)) continue;
    return { slug: brandSlug(stripped), tld };
  }
  return null;
}

export function smartFallbackUrl(
  storeId: string | null | undefined,
  storeName: string | null | undefined,
  _query: string,
): { url: string; merchantName: string } | null {
  const sid = (storeId ?? "").trim();
  const sname = (storeName ?? "").trim();
  if (!sid && !sname) return null;

  /* Strategy 1: storeName / storeId IS a domain. Use directly. */
  if (sname && looksLikeDomain(sname)) {
    const url = sname.startsWith("http") ? sname : `https://${sname}`;
    return { url, merchantName: sname };
  }
  if (sid && looksLikeDomain(sid)) {
    const url = sid.startsWith("http") ? sid : `https://${sid}`;
    return { url, merchantName: sid };
  }

  /* Strategy 2a: storeName ends with a country marker (UK / SA /
     DE / etc.). Strip the marker and use the matching country
     TLD. "Sony Store Online UK" → sonystoreonline.co.uk,
     "Dell South Africa" → dell.co.za, "WonderPriceUK" →
     wonderprice.co.uk. Catches the user-reported case where
     "wonderpriceuk.com" was wrong. */
  if (sname) {
    const c = stripCountrySuffix(sname);
    if (c) {
      return { url: `https://${c.slug}.${c.tld}`, merchantName: sname };
    }
  }

  /* Strategy 2b: storeName looks like a plain brand (no country
     marker). Strip generic suffixes ("Official Store", "Global",
     etc.) AND generic prefixes ("EMI", "BNPL", "Pay Later") so
     "OPPO Official Store" → oppo.com, "EMI Snapmint" → snapmint.com,
     "Ulefone Global" → ulefone.com. Then try "<slug>.com". */
  if (sname) {
    const cleaned = stripGenericPrefix(stripGenericSuffix(sname));
    if (looksLikeSimpleBrand(cleaned)) {
      const url = `https://${brandSlug(cleaned)}.com`;
      return { url, merchantName: sname };
    }
  }

  return null;
}
