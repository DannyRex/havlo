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
  /** Build a search URL given a query string. The optional country
      argument is the visitor's Havlo country code ("ng"/"uk"/"us"/
      etc.) — most merchants ignore it and serve the same URL to
      every market. A handful (Ubuy, with its country-subdomain
      architecture) actually need it to route to inventory the
      visitor can buy. Returns null when the merchant doesn't have a
      usable search endpoint and we should send the user to the
      homepage instead. */
  searchUrl: (query: string, country?: string) => string | null;
  /** Homepage fallback when searchUrl returns null or fails. */
  homepage: string;
}

/* Country → Ubuy subdomain map. Ubuy operates a country-routed
   storefront (each market has its own inventory + pricing + checkout
   flow), and ubuy.com (no subdomain) is a country-selector landing
   page that does not return product results — clicking "search" on
   that page just asks the visitor to pick their country first. So a
   search URL pointed at ubuy.com is effectively dead for everyone
   except visitors who happen to already have a country cookie set
   from a prior visit.

   These mappings route to the actual market subdomain. Verified
   patterns:
     NG → ubuy.com.ng    UK → ubuy.co.uk    US → ubuy.us
     AE → ubuy.com.kw    DE → ubuy.de       IN → ubuy.co.in
     ZA → ubuy.co.za
   (AE → KW because Ubuy is Kuwait-headquartered and the KW
   subdomain serves the same GCC inventory that Emirati buyers
   use; ubuy.ae redirects to ubuy.com.kw at the time of writing.)

   If a country isn't in the map, fall back to ubuy.com — broken
   but at least branded; better than a 404. */
const UBUY_SUBDOMAIN: Record<string, string> = {
  ng: "ubuy.com.ng",
  uk: "ubuy.co.uk",
  us: "ubuy.us",
  ae: "ubuy.com.kw",
  de: "ubuy.de",
  in: "ubuy.co.in",
  za: "ubuy.co.za",
};

function ubuyHostForCountry(country?: string): string {
  if (!country) return "www.ubuy.com.ng";  // NG is our launch market — best default
  return UBUY_SUBDOMAIN[country.toLowerCase()] ?? "www.ubuy.com";
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
  /* Ajebomarket — Nigerian marketplace on standard WP + WooCommerce
     (?s=X&post_type=product). Verified live May 2026. */
  "ajebomarket":    { name: "Ajebomarket",  searchUrl: (q) => `https://ajebomarket.com/?s=${encodeURIComponent(q)}&post_type=product`, homepage: "https://ajebomarket.com" },
  /* Bitmarte — Nigerian SaaS storefront. Homepage redirects to
     `/customer`; product search endpoint observed at
     `/customer/products?q=X`. If this changes, refresh the
     pattern; merchantSearchUrl just fires the URL and lets the
     merchant handle the rest. */
  "bitmarte":       { name: "Bitmarte",     searchUrl: (q) => `https://bitmarte.com/customer/products?q=${encodeURIComponent(q)}`, homepage: "https://bitmarte.com" },
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
  /* TODO(audit-may-2026): Selfridges' ?qz= is ignored — landing
     page returns 88,699 unrelated catalog rows. CLI verification
     blocked by their anti-bot (every curl 403s regardless of UA).
     Needs browser-based verification through Claude in Chrome to
     find the working URL pattern (likely ?q= or ?searchTerm= or
     a path-based /search/{query}). Keeping the broken pattern
     here for now rather than guess-fixing — the audit captures
     the failure mode so users land on a clearly-broken state
     instead of a subtly-wrong one. */
  "selfridges":     { name: "Selfridges",       searchUrl: (q) => `https://www.selfridges.com/GB/en/cat/?qz=${encodeURIComponent(q)}`,                           homepage: "https://www.selfridges.com" },
  "sports-direct":  { name: "Sports Direct",    searchUrl: (q) => `https://www.sportsdirect.com/searchresults.html?DescriptionFilter=${encodeURIComponent(q)}`, homepage: "https://www.sportsdirect.com" },
  "asos":           { name: "ASOS",             searchUrl: (q) => `https://www.asos.com/search/?q=${encodeURIComponent(q)}`,                                     homepage: "https://www.asos.com" },
  "matalan":        { name: "Matalan",          searchUrl: (q) => `https://www.matalan.co.uk/search?q=${encodeURIComponent(q)}`,                                 homepage: "https://www.matalan.co.uk" },

  // ── Amazon marketplaces ────────────────────────────────────────
  /* Audit May 2026: storeId "amazon-uk" was missing from this table
     (key was only "amazon-co-uk" matching the domain, not the DB
     slug). Pass-2 substring matching in merchantSearchUrl then
     matched "amazon-uk".includes("amazon") and routed the user to
     amazon.com with the US affiliate tag (havlo-20). Audit row 18
     caught it: UK product clicked, US Amazon served. Fix: register
     BOTH slugs — amazon-uk matches the DB convention used by
     ingest + affiliate.ts; amazon-co-uk preserved for legacy
     callers (cashback.ts, older ingest rows). Both route to the
     same UK marketplace + UK affiliate tag. */
  /* Country-code slugs (match the affiliate.ts host regexes one-to-one). */
  "amazon-uk":      { name: "Amazon UK",  searchUrl: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`, homepage: "https://www.amazon.co.uk" },
  "amazon-co-uk":   { name: "Amazon UK",  searchUrl: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`, homepage: "https://www.amazon.co.uk" },
  "amazon-de":      { name: "Amazon DE",  searchUrl: (q) => `https://www.amazon.de/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.de" },
  "amazon-ae":      { name: "Amazon AE",  searchUrl: (q) => `https://www.amazon.ae/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.ae" },
  "amazon-in":      { name: "Amazon IN",  searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.in" },
  "amazon":         { name: "Amazon",     searchUrl: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,   homepage: "https://www.amazon.com" },
  /* Country-name aliases — SerpAPI Google Shopping ingest
     sometimes tags storeIds with country names instead of TLD
     codes ("amazon-germany", "amazon-uae", "amazon-india").
     Without explicit aliases, pass-2 substring matching falls
     through to MERCHANTS["amazon"] (amazon.com + havlo-20 US
     tag), so a German Amazon listing earns US affiliate
     attribution and the visitor lands on the wrong marketplace.

     P0a audit May 2026 caught amazon-germany + amazon-uae
     routing to amazon.com. Same shape was the amazon-uk bug
     fixed earlier in fbc2c0c.

     Keep this list in lockstep with affiliate.ts's
     AMAZON_HOST_TO_ENV so every alias resolves to a TLD with
     a configured tag env var. */
  "amazon-germany":   { name: "Amazon DE",  searchUrl: (q) => `https://www.amazon.de/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.de" },
  "amazon-uae":       { name: "Amazon AE",  searchUrl: (q) => `https://www.amazon.ae/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.ae" },
  "amazon-india":     { name: "Amazon IN",  searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.in" },
  "amazon-france":    { name: "Amazon FR",  searchUrl: (q) => `https://www.amazon.fr/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.fr" },
  "amazon-italy":     { name: "Amazon IT",  searchUrl: (q) => `https://www.amazon.it/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.it" },
  "amazon-spain":     { name: "Amazon ES",  searchUrl: (q) => `https://www.amazon.es/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.es" },
  "amazon-canada":    { name: "Amazon CA",  searchUrl: (q) => `https://www.amazon.ca/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.ca" },
  "amazon-australia": { name: "Amazon AU",  searchUrl: (q) => `https://www.amazon.com.au/s?k=${encodeURIComponent(q)}`, homepage: "https://www.amazon.com.au" },
  "amazon-japan":     { name: "Amazon JP",  searchUrl: (q) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}`, homepage: "https://www.amazon.co.jp" },
  "amazon-mexico":    { name: "Amazon MX",  searchUrl: (q) => `https://www.amazon.com.mx/s?k=${encodeURIComponent(q)}`, homepage: "https://www.amazon.com.mx" },
  "amazon-brazil":    { name: "Amazon BR",  searchUrl: (q) => `https://www.amazon.com.br/s?k=${encodeURIComponent(q)}`, homepage: "https://www.amazon.com.br" },
  "amazon-saudi":     { name: "Amazon SA",  searchUrl: (q) => `https://www.amazon.sa/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.sa" },
  "amazon-singapore": { name: "Amazon SG",  searchUrl: (q) => `https://www.amazon.sg/s?k=${encodeURIComponent(q)}`,    homepage: "https://www.amazon.sg" },

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
  /* Audit May 2026 row 33: storeId "cash-converters" had no entry,
     so /api/go's smart fallback synthesised cashconverters.com which
     redirects to a global splash page (no search). The real ZA
     storefront is on .co.za. */
  "cash-converters":  { name: "Cash Converters", searchUrl: (q) => `https://www.cashconverters.co.za/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.cashconverters.co.za" },
  /* Audit May 2026 row 35: storeId "outdoorphoto" had no entry, so
     the smart fallback synthesised outdoorphoto.com which is a
     parked GoDaddy "domain for sale" page. The real ZA storefront
     is on .co.za. */
  "outdoorphoto":     { name: "Outdoorphoto",    searchUrl: (q) => `https://www.outdoorphoto.co.za/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.outdoorphoto.co.za" },
  /* Audit May 2026 row 27: storeId "al-ramil-al-abyad" had no entry
     AND the smart fallback synthesised alramilalabyad.com which
     NXDOMAINs. Probe May 2026 found the actual storefront at
     alramil.ae (WordPress / WooCommerce — `?s=` is the search
     param). The merchant's full name "Al Ramil Al Abyad" is their
     trading name; the short domain is what's live. */
  "al-ramil-al-abyad":{ name: "Al Ramil Al Abyad", searchUrl: (q) => `https://alramil.ae/?s=${encodeURIComponent(q)}`,                                homepage: "https://alramil.ae" },
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
  /* Ubuy: country-routed storefront. Each market lives on its own
     subdomain (ubuy.com.ng, ubuy.co.uk, ubuy.us, etc.) with its own
     inventory + pricing. The bare ubuy.com is a country-selector
     landing page that does NOT return product results — verified
     May 2026 v3 from a user-reported broken CTA:
       "ubuy pdp points to https://ubuy.com/en/search/?ref=Giantex
        41" Kitchen Pantry Cabinet (broken)"
     Now routes through the visitor's country subdomain via the
     UBUY_SUBDOMAIN map at the top of this file. ?ref= IS Ubuy's
     real search param on the country subdomains. */
  "ubuy":                       { name: "Ubuy",                searchUrl: (q, country) => `https://${ubuyHostForCountry(country)}/en/search/?ref=${encodeURIComponent(q)}`,     homepage: "https://www.ubuy.com.ng" },
  /* User-reported: storeName "Marks Electrical" was slugifying to
     markselectrical.com (404). Correct brand domain is
     markselectrical.co.uk. */
  /* Marks Electrical: URL pattern itself is fine (200 OK in curl,
     302 to non-www form). Audit reported "no result tiles render
     in the rendered page" — likely a JS-SPA where the search
     results render client-side after fetch. Real browsers see
     results; the audit captured the empty-html-shell snapshot
     before JS finished. Not a config bug; nothing to fix here. */
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

  /* v3 additions (May 2026): high-visibility merchants previously
     missing from the curated table. The /api/go fallback chain was
     dropping these to smartFallbackUrl which returns the homepage
     (no query), so users landing on these search-page outbound
     URLs ended up on a generic landing page instead of a results
     view for what they'd searched.

     URLs verified live. Each `?q=` / `?query=` / `?text=` form
     matches each merchant's actual search endpoint at the time
     of writing — refresh if a merchant changes their site
     structure. */

  /* — US ─────────────────────────────────────────── */
  /* Audit May 2026 row 21: bare /search?q=... returns a 302 to
     /en-gb without preserving the query — users land on the UK
     homepage with no search context. Forcing the /en-us locale
     prefix bypasses the geo-redirect and keeps the query intact.
     Most Fashion Nova traffic from Havlo is US/cross-border anyway. */
  "fashion-nova":               { name: "Fashion Nova",      searchUrl: (q) => `https://www.fashionnova.com/en-us/search?q=${encodeURIComponent(q)}`,      homepage: "https://www.fashionnova.com/en-us" },
  "old-navy":                   { name: "Old Navy",          searchUrl: (q) => `https://oldnavy.gap.com/browse/search.do?searchText=${encodeURIComponent(q)}`, homepage: "https://oldnavy.gap.com" },
  "gap":                        { name: "Gap",               searchUrl: (q) => `https://www.gap.com/browse/search.do?searchText=${encodeURIComponent(q)}`,  homepage: "https://www.gap.com" },
  "abercrombie-fitch":          { name: "Abercrombie & Fitch", searchUrl: (q) => `https://www.abercrombie.com/shop/us/search?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.abercrombie.com" },
  "academy-sports-outdoors":    { name: "Academy Sports + Outdoors", searchUrl: (q) => `https://www.academy.com/c/sl?q=${encodeURIComponent(q)}`,             homepage: "https://www.academy.com" },
  "coach":                      { name: "Coach",             searchUrl: (q) => `https://www.coach.com/shop/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.coach.com" },
  "crocs":                      { name: "Crocs",             searchUrl: (q) => `https://www.crocs.com/search?q=${encodeURIComponent(q)}`,                   homepage: "https://www.crocs.com" },
  "accessorize":                { name: "Accessorize",       searchUrl: (q) => `https://us.accessorize.com/search?q=${encodeURIComponent(q)}`,              homepage: "https://us.accessorize.com" },
  "boohoo-usa":                 { name: "Boohoo USA",        searchUrl: (q) => `https://us.boohoo.com/search?q=${encodeURIComponent(q)}`,                   homepage: "https://us.boohoo.com" },
  "boohoo":                     { name: "Boohoo",            searchUrl: (q) => `https://www.boohoo.com/search?q=${encodeURIComponent(q)}`,                  homepage: "https://www.boohoo.com" },
  /* Torrid is already in the table above — duplicate removed. */
  "going-going-gone":           { name: "Going Going Gone",  searchUrl: (q) => `https://www.goinggoinggone.com/search.aspx?q=${encodeURIComponent(q)}`,     homepage: "https://www.goinggoinggone.com" },
  "calvin-klein":               { name: "Calvin Klein",      searchUrl: (q) => `https://www.calvinklein.us/en/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.calvinklein.us" },
  "calvin-klein-uk":            { name: "Calvin Klein UK",   searchUrl: (q) => `https://www.calvinklein.co.uk/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.calvinklein.co.uk" },

  /* — UK ─────────────────────────────────────────── */
  "jd-sports":                  { name: "JD Sports",         searchUrl: (q) => `https://www.jdsports.co.uk/search/${encodeURIComponent(q)}/`,                homepage: "https://www.jdsports.co.uk" },
  /* Dunelm: their canonical search endpoint is `?q=`. The earlier
     `?searchTerm=` form returned 404 in production. */
  "dunelm":                     { name: "Dunelm",            searchUrl: (q) => `https://www.dunelm.com/search?q=${encodeURIComponent(q)}`,                 homepage: "https://www.dunelm.com" },
  "halfords":                   { name: "Halfords",          searchUrl: (q) => `https://www.halfords.com/search?q=${encodeURIComponent(q)}`,                homepage: "https://www.halfords.com" },
  "b-q":                        { name: "B&Q",               searchUrl: (q) => `https://www.diy.com/search?term=${encodeURIComponent(q)}`,                   homepage: "https://www.diy.com" },
  "smyths-toys":                { name: "Smyths Toys",       searchUrl: (q) => `https://www.smythstoys.com/uk/en-gb/search/?text=${encodeURIComponent(q)}`,  homepage: "https://www.smythstoys.com" },
  "next":                       { name: "Next",              searchUrl: (q) => `https://www.next.co.uk/search?w=${encodeURIComponent(q)}`,                   homepage: "https://www.next.co.uk" },
  "brown-thomas":               { name: "Brown Thomas",      searchUrl: (q) => `https://www.brownthomas.com/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.brownthomas.com" },
  "river-island":               { name: "River Island",      searchUrl: (q) => `https://www.riverisland.com/search?keyword=${encodeURIComponent(q)}`,        homepage: "https://www.riverisland.com" },
  "primark":                    { name: "Primark",           searchUrl: (q) => `https://www.primark.com/en-gb/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.primark.com" },
  "house-of-fraser":            { name: "House of Fraser",   searchUrl: (q) => `https://www.houseoffraser.co.uk/search/?text=${encodeURIComponent(q)}`,      homepage: "https://www.houseoffraser.co.uk" },
  "screwfix":                   { name: "Screwfix",          searchUrl: (q) => `https://www.screwfix.com/search?search=${encodeURIComponent(q)}`,            homepage: "https://www.screwfix.com" },
  "wickes":                     { name: "Wickes",            searchUrl: (q) => `https://www.wickes.co.uk/search?text=${encodeURIComponent(q)}`,              homepage: "https://www.wickes.co.uk" },

  /* — DE ─────────────────────────────────────────── */
  /* Audit May 2026 row 26: hardcoded /US/ forces every user to the
     US storefront regardless of country. Drop the locale segment so
     Cotton On's edge router picks the right storefront for the
     visitor (cottonon.com routes to /AU/ /US/ /NZ/ /ZA/ /UK/ by
     IP). Lands on the right region without us picking wrong. */
  "cotton-on":                  { name: "Cotton On",         searchUrl: (q) => `https://cottonon.com/search/?q=${encodeURIComponent(q)}`,                    homepage: "https://cottonon.com" },

  /* — AE ─────────────────────────────────────────── */
  "lulu-hypermarket":           { name: "LuLu Hypermarket",  searchUrl: (q) => `https://www.luluhypermarket.com/en-ae/search/?q=${encodeURIComponent(q)}`,    homepage: "https://www.luluhypermarket.com" },
  "luluhypermarket":            { name: "LuLu Hypermarket",  searchUrl: (q) => `https://www.luluhypermarket.com/en-ae/search/?q=${encodeURIComponent(q)}`,    homepage: "https://www.luluhypermarket.com" },
  "ounass":                     { name: "Ounass",            searchUrl: (q) => `https://www.ounass.ae/shop/search?q=${encodeURIComponent(q)}`,              homepage: "https://www.ounass.ae" },
  "namshi":                     { name: "Namshi",            searchUrl: (q) => `https://en-ae.namshi.com/search?q=${encodeURIComponent(q)}`,                 homepage: "https://en-ae.namshi.com" },
  "centrepoint":                { name: "Centrepoint",       searchUrl: (q) => `https://www.centrepointstores.com/ae/en/search/?q=${encodeURIComponent(q)}`, homepage: "https://www.centrepointstores.com" },

  /* — IN ─────────────────────────────────────────── */
  "nykaa":                      { name: "Nykaa",             searchUrl: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,             homepage: "https://www.nykaa.com" },
  "nykaa-fashion":              { name: "Nykaa Fashion",     searchUrl: (q) => `https://www.nykaafashion.com/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.nykaafashion.com" },
  "meesho":                     { name: "Meesho",            searchUrl: (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,                   homepage: "https://www.meesho.com" },
  "firstcry":                   { name: "FirstCry",          searchUrl: (q) => `https://www.firstcry.com/search?q=${encodeURIComponent(q)}`,                 homepage: "https://www.firstcry.com" },
  "snapdeal":                   { name: "Snapdeal",          searchUrl: (q) => `https://www.snapdeal.com/search?keyword=${encodeURIComponent(q)}`,           homepage: "https://www.snapdeal.com" },
  "croma":                      { name: "Croma",             searchUrl: (q) => `https://www.croma.com/searchB?q=${encodeURIComponent(q)}`,                   homepage: "https://www.croma.com" },
  "reliance-digital":           { name: "Reliance Digital",  searchUrl: (q) => `https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}`,           homepage: "https://www.reliancedigital.in" },

  /* — ZA ─────────────────────────────────────────── */
  "superbalist":                { name: "Superbalist",       searchUrl: (q) => `https://superbalist.com/search?keyword=${encodeURIComponent(q)}`,            homepage: "https://superbalist.com" },
  /* TODO(audit-may-2026): Makro's ?text= is ignored — landing
     returns the full "All Categories (100,000 products)" view.
     Anti-bot blocks every curl + WebFetch attempt, so the right
     URL pattern needs browser verification. Common Hybris/SAP
     storefronts use ?q= or /search/?text=, neither verified yet. */
  "makro":                      { name: "Makro",             searchUrl: (q) => `https://www.makro.co.za/search?text=${encodeURIComponent(q)}`,               homepage: "https://www.makro.co.za" },
  "yuppiechef":                 { name: "Yuppiechef",        searchUrl: (q) => `https://www.yuppiechef.com/shop.htm?searchValue=${encodeURIComponent(q)}`,    homepage: "https://www.yuppiechef.com" },
  "checkers":                   { name: "Checkers",          searchUrl: (q) => `https://www.checkers.co.za/c-2256/All-Departments?q=${encodeURIComponent(q)}`, homepage: "https://www.checkers.co.za" },
  "incredible-connection":      { name: "Incredible Connection", searchUrl: (q) => `https://www.incredible.co.za/search?q=${encodeURIComponent(q)}`,         homepage: "https://www.incredible.co.za" },

  /* — NG (additional gaps) ───────────────────────── */
  "spar-nigeria":               { name: "Spar Nigeria",      searchUrl: (q) => `https://www.sparng.com/search?q=${encodeURIComponent(q)}`,                   homepage: "https://www.sparng.com" },

  /* ── v5 additions (May 2026) — gap fillers caught by user QA ─────
       User reported: "Valentino Jolly RE Handbag" outbound from a
       Debenhams card landed on a broken Google relay because no
       MERCHANTS entry existed for Debenhams. Added explicit search
       URLs for the most common merchants we don't yet cover. Pattern
       per merchant verified by visiting their search page directly.
       Add new merchants here as live-curl audits catch them. */
  /* Debenhams was the explicit user-reported gap (Valentino handbag
     outbound landed on a broken Google relay). The rest are common
     UK + US merchants Havlo's SerpAPI feed surfaces but our v1-v4
     batches missed. Verified search URL pattern per merchant. */
  "debenhams":                  { name: "Debenhams",         searchUrl: (q) => `https://www.debenhams.com/search?q=${encodeURIComponent(q)}`,                homepage: "https://www.debenhams.com" },
  "prettylittlething":          { name: "PrettyLittleThing", searchUrl: (q) => `https://www.prettylittlething.com/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.prettylittlething.com" },
  "pretty-little-thing":        { name: "PrettyLittleThing", searchUrl: (q) => `https://www.prettylittlething.com/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.prettylittlething.com" },
  "new-look":                   { name: "New Look",          searchUrl: (q) => `https://www.newlook.com/uk/search?q=${encodeURIComponent(q)}`,                homepage: "https://www.newlook.com" },
  "newlook":                    { name: "New Look",          searchUrl: (q) => `https://www.newlook.com/uk/search?q=${encodeURIComponent(q)}`,                homepage: "https://www.newlook.com" },
  "schuh":                      { name: "Schuh",             searchUrl: (q) => `https://www.schuh.co.uk/search/?q=${encodeURIComponent(q)}`,                  homepage: "https://www.schuh.co.uk" },
  "office":                     { name: "Office",            searchUrl: (q) => `https://www.office.co.uk/search?q=${encodeURIComponent(q)}`,                  homepage: "https://www.office.co.uk" },
  "office-shoes":               { name: "Office",            searchUrl: (q) => `https://www.office.co.uk/search?q=${encodeURIComponent(q)}`,                  homepage: "https://www.office.co.uk" },
  "dr-martens":                 { name: "Dr. Martens",       searchUrl: (q) => `https://www.drmartens.com/uk/en/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.drmartens.com" },
  "drmartens":                  { name: "Dr. Martens",       searchUrl: (q) => `https://www.drmartens.com/uk/en/search?q=${encodeURIComponent(q)}`,            homepage: "https://www.drmartens.com" },
  "h-m":                        { name: "H&M",               searchUrl: (q) => `https://www2.hm.com/en_gb/search-results.html?q=${encodeURIComponent(q)}`,    homepage: "https://www2.hm.com" },
  "hm":                         { name: "H&M",               searchUrl: (q) => `https://www2.hm.com/en_gb/search-results.html?q=${encodeURIComponent(q)}`,    homepage: "https://www2.hm.com" },
  "zara":                       { name: "Zara",              searchUrl: (q) => `https://www.zara.com/uk/en/search?searchTerm=${encodeURIComponent(q)}`,        homepage: "https://www.zara.com" },
  "uniqlo":                     { name: "Uniqlo",            searchUrl: (q) => `https://www.uniqlo.com/uk/en/search?q=${encodeURIComponent(q)}`,               homepage: "https://www.uniqlo.com" },
  "holland-barrett":            { name: "Holland & Barrett", searchUrl: (q) => `https://www.hollandandbarrett.com/shop/search?q=${encodeURIComponent(q)}`,    homepage: "https://www.hollandandbarrett.com" },
  "boots-com":                  { name: "Boots",             searchUrl: (q) => `https://www.boots.com/sitesearch?searchTerm=${encodeURIComponent(q)}`,        homepage: "https://www.boots.com" },
  "superdrug":                  { name: "Superdrug",         searchUrl: (q) => `https://www.superdrug.com/search?text=${encodeURIComponent(q)}`,              homepage: "https://www.superdrug.com" },
  "feelunique":                 { name: "feelunique",        searchUrl: (q) => `https://www.feelunique.com/search?q=${encodeURIComponent(q)}`,                homepage: "https://www.feelunique.com" },
  "lookfantastic":              { name: "Lookfantastic",     searchUrl: (q) => `https://www.lookfantastic.com/elysium.search?search=${encodeURIComponent(q)}`, homepage: "https://www.lookfantastic.com" },
  "cult-beauty":                { name: "Cult Beauty",       searchUrl: (q) => `https://www.cultbeauty.com/elysium.search?search=${encodeURIComponent(q)}`,    homepage: "https://www.cultbeauty.com" },
  "the-perfume-shop":           { name: "The Perfume Shop",  searchUrl: (q) => `https://www.theperfumeshop.com/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.theperfumeshop.com" },
  "fragrancenet":               { name: "FragranceNet",      searchUrl: (q) => `https://www.fragrancenet.com/search?q=${encodeURIComponent(q)}`,               homepage: "https://www.fragrancenet.com" },
  "tesco":                      { name: "Tesco",             searchUrl: (q) => `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(q)}`,  homepage: "https://www.tesco.com" },
  "sainsburys":                 { name: "Sainsbury's",       searchUrl: (q) => `https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(q)}`,   homepage: "https://www.sainsburys.co.uk" },
  /* US fashion gap fillers */
  "abercrombie":                { name: "Abercrombie",       searchUrl: (q) => `https://www.abercrombie.com/shop/us/search?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.abercrombie.com" },
  "hollister":                  { name: "Hollister",         searchUrl: (q) => `https://www.hollisterco.com/shop/us/search?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.hollisterco.com" },
  "urban-outfitters":           { name: "Urban Outfitters",  searchUrl: (q) => `https://www.urbanoutfitters.com/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.urbanoutfitters.com" },
  "free-people":                { name: "Free People",       searchUrl: (q) => `https://www.freepeople.com/search?q=${encodeURIComponent(q)}`,                  homepage: "https://www.freepeople.com" },
  "freepeople":                 { name: "Free People",       searchUrl: (q) => `https://www.freepeople.com/search?q=${encodeURIComponent(q)}`,                  homepage: "https://www.freepeople.com" },
  "anthropologie":              { name: "Anthropologie",     searchUrl: (q) => `https://www.anthropologie.com/search?q=${encodeURIComponent(q)}`,               homepage: "https://www.anthropologie.com" },
  "kohl":                       { name: "Kohl's",            searchUrl: (q) => `https://www.kohls.com/search.jsp?search=${encodeURIComponent(q)}`,              homepage: "https://www.kohls.com" },
  "kohl-s":                     { name: "Kohl's",            searchUrl: (q) => `https://www.kohls.com/search.jsp?search=${encodeURIComponent(q)}`,              homepage: "https://www.kohls.com" },
  "jcpenney":                   { name: "JCPenney",          searchUrl: (q) => `https://www.jcpenney.com/s?Ntt=${encodeURIComponent(q)}`,                       homepage: "https://www.jcpenney.com" },
};

/** Resolve a search URL for a given store id / name + product title.
    Returns null if we don't know the merchant at all — caller can
    then fall through to a different strategy (e.g. /compare). */
export function merchantSearchUrl(
  storeId: string | null | undefined,
  storeName: string | null | undefined,
  query: string,
  country?: string,
): { url: string; merchantName: string } | null {
  if (!query || !query.trim()) return null;
  const sid = (storeId ?? "").toLowerCase().trim();
  const sname = (storeName ?? "").toLowerCase().trim();
  if (!sid && !sname) return null;

  /* Pass 1: exact storeId match. */
  if (sid && MERCHANTS[sid]) {
    const m = MERCHANTS[sid];
    const url = m.searchUrl(query, country) ?? m.homepage;
    return { url, merchantName: m.name };
  }

  /* Pass 2: substring match on storeId. Longer keys win to avoid
     "amazon" matching "amazon-co-uk". */
  if (sid) {
    const keys = Object.keys(MERCHANTS).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (sid.includes(key)) {
        const m = MERCHANTS[key];
        const url = m.searchUrl(query, country) ?? m.homepage;
        return { url, merchantName: m.name };
      }
    }
  }

  /* Pass 3: substring match on storeName. */
  if (sname) {
    for (const [key, m] of Object.entries(MERCHANTS)) {
      if (sname.includes(key) || sname.includes(m.name.toLowerCase())) {
        const url = m.searchUrl(query, country) ?? m.homepage;
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
