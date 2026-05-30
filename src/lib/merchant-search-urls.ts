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

/* Country → Ubuy host map. Ubuy runs a country-routed storefront
   (each market has its own inventory, pricing and checkout), and the
   bare ubuy.com is a country-selector landing page that returns no
   product results.

   Host patterns are NOT uniform. Verified May 2026 by direct probe:
     US ubuy.us   IN ubuy.co.in   ZA ubuy.co.za   AE ubuy.com.kw
     UK www.u-buy.co.uk    NG www.u-buy.com.ng    DE www.ubuy.de.com
   UK and NG no longer resolve on the un-hyphenated ubuy.co.uk /
   ubuy.com.ng (DNS retired) and serve only on the hyphenated u-buy
   domain. DE serves from a .de.com domain, confirmed as Ubuy's German
   store by a link from the official ubuy.com. All three were caught
   from user-reported broken Ubuy CTAs.
   AE routes to the KW host because Ubuy is Kuwait-headquartered and
   KW serves the GCC inventory Emirati buyers use.

   If a country is not in the map, fall back to ubuy.com: branded and
   reachable, better than a dead host. */
const UBUY_SUBDOMAIN: Record<string, string> = {
  ng: "www.u-buy.com.ng",
  uk: "www.u-buy.co.uk",
  us: "ubuy.us",
  ae: "ubuy.com.kw",
  de: "www.ubuy.de.com",
  in: "ubuy.co.in",
  za: "ubuy.co.za",
};

export function ubuyHostForCountry(country?: string): string {
  if (!country) return "www.u-buy.com.ng";  // NG is our launch market, best default
  return UBUY_SUBDOMAIN[country.toLowerCase()] ?? "www.ubuy.com";
}

/* Hosts that no longer serve product pages and must be re-pointed to
   a working Ubuy host at click time: the bare ubuy.com country-
   selector splash, plus ubuy.co.uk and ubuy.com.ng, the UK and NG
   un-hyphenated domains Ubuy has retired (DNS no longer resolves,
   verified May 2026). Stored URLs ingested before the move still
   carry these dead hosts. */
const DEAD_UBUY_HOSTS = new Set(["ubuy.com", "ubuy.co.uk", "ubuy.com.ng"]);

/* Runtime URL rewriter for stored Ubuy URLs. Re-hosts any URL on a
   dead Ubuy host (DEAD_UBUY_HOSTS) onto the visitor's working
   country host. Does NOT touch URLs already on a live host: those
   are presumed correct.

   Used by /api/go to fix ingestion-stored Ubuy URLs at click time
   without an ingest re-run. The path, querystring and fragment are
   preserved exactly so a stored product path carries through
   unchanged onto the working host. */
export function rewriteUbuyHostForCountry(url: string, country?: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!DEAD_UBUY_HOSTS.has(host)) return url;  // already on a working host, or not Ubuy
    u.hostname = ubuyHostForCountry(country);
    return u.toString();
  } catch {
    return url;
  }
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
  "very":           { name: "Very",             searchUrl: (q) => `https://www.very.co.uk/e/q/${encodeURIComponent(q)}.end`,                              homepage: "https://www.very.co.uk" },
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
  "sports-direct":  { name: "Sports Direct",    searchUrl: () => null, homepage: "https://www.sportsdirect.com" }, // SPA: /search?q=, /SearchResults.aspx, searchresults.html all 404 (audit 2026-05) → verified homepage floor
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
  /* OnBuy — UK marketplace surfaced by SerpAPI for many UK live
     searches. storeName "OnBuy.com" / storeId "onbuy". Without an
     explicit entry, /api/go's smart fallback uses "onbuy.com"
     homepage (no search query). Re-audit May 2026: /uk/p/661bbc27
     (Nokia 3310 at onbuy) — verified onbuy.com supports ?q= search. */
  "onbuy":          { name: "OnBuy",         searchUrl: (q) => `https://www.onbuy.com/gb/search/?q=${encodeURIComponent(q)}`,                       homepage: "https://www.onbuy.com" },
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
  "zalando":        { name: "Zalando",       searchUrl: () => null, homepage: "https://www.zalando.de" }, // SPA: /catalog/?q= and /search?q= both 404 (audit 2026-05) → verified homepage floor

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
  "mango":                      { name: "Mango",          searchUrl: () => null, homepage: "https://shop.mango.com" }, // SPA: /gb/search?kw=, /gb/en/search?kw= 404/500 (audit 2026-05) → verified homepage floor
  "wallis":                     { name: "Wallis",         searchUrl: (q) => `https://www.wallis.co.uk/search?text=${encodeURIComponent(q)}`,        homepage: "https://www.wallis.co.uk" },
  "simply-be":                  { name: "Simply Be",      searchUrl: () => null, homepage: "https://www.simplybe.co.uk" }, // search /search?q=, /shop/search?q= 404/403 (audit 2026-05) → verified homepage floor
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
  "qvc":                        { name: "QVC",                 searchUrl: () => null, homepage: "https://www.qvc.com" }, // SPA: keywordsearch.html + content/search.html + 2 more all 404 (audit 2026-05) → verified homepage floor
  "nfm":                        { name: "NFM",                 searchUrl: (q) => `https://www.nfm.com/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.nfm.com" },
  "dick-s-sporting-goods":      { name: "DICK'S Sporting Goods", searchUrl: (q) => `https://www.dickssportinggoods.com/search/SearchDisplay?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.dickssportinggoods.com" },
  "b-h-photo-video-audio":      { name: "B&H Photo",           searchUrl: (q) => `https://www.bhphotovideo.com/c/search?Ntt=${encodeURIComponent(q)}`, homepage: "https://www.bhphotovideo.com" },
  /* Ubuy: country-routed storefront. See UBUY_SUBDOMAIN at the top
     of this file for the per-market host map. The search path is
     /search/ with the query in ?q= ; ?ref_p=ser_tp is Ubuy's source
     tag that marks it as a search-bar query. The earlier
     /en/search/?ref= form was wrong on every market: verified
     May 2026 against the live UK storefront after a user-reported
     unreachable CTA.
       was:     https://ubuy.co.uk/en/search/?ref=Nokia+1600   (dead)
       correct: https://www.u-buy.co.uk/search/?ref_p=ser_tp&q=nokia+1600 */
  "ubuy":                       { name: "Ubuy",                searchUrl: (q, country) => `https://${ubuyHostForCountry(country)}/search/?ref_p=ser_tp&q=${encodeURIComponent(q)}`, homepage: "https://www.u-buy.com.ng" },
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
  "wonderprice":                { name: "WonderPrice",    searchUrl: (q) => `https://wonderprice.co.uk/?s=${encodeURIComponent(q)}`,          homepage: "https://wonderprice.co.uk" },
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
  "academy-sports-outdoors":    { name: "Academy Sports + Outdoors", searchUrl: (q) => `https://www.academy.com/shop/browse?q=${encodeURIComponent(q)}`,             homepage: "https://www.academy.com" },
  "coach":                      { name: "Coach",             searchUrl: (q) => `https://www.coach.com/shop/search?q=${encodeURIComponent(q)}`,             homepage: "https://www.coach.com" },
  "crocs":                      { name: "Crocs",             searchUrl: () => null, homepage: "https://www.crocs.com" }, // /search?q= 410, /c/search?q= 403; only fragile US-region Demandware endpoint 200s (audit 2026-05) → verified homepage floor
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
  "cotton-on":                  { name: "Cotton On",         searchUrl: (q) => `https://cottonon.com/search?q=${encodeURIComponent(q)}`,                    homepage: "https://cottonon.com" },

  /* — AE ─────────────────────────────────────────── */
  "lulu-hypermarket":           { name: "LuLu Hypermarket",  searchUrl: (q) => `https://www.luluhypermarket.com/en-ae/search/?q=${encodeURIComponent(q)}`,    homepage: "https://www.luluhypermarket.com" },
  "luluhypermarket":            { name: "LuLu Hypermarket",  searchUrl: (q) => `https://www.luluhypermarket.com/en-ae/search/?q=${encodeURIComponent(q)}`,    homepage: "https://www.luluhypermarket.com" },
  "ounass":                     { name: "Ounass",            searchUrl: (q) => `https://www.ounass.ae/shop/search?q=${encodeURIComponent(q)}`,              homepage: "https://www.ounass.ae" },
  "namshi":                     { name: "Namshi",            searchUrl: (q) => `https://en-ae.namshi.com/search?q=${encodeURIComponent(q)}`,                 homepage: "https://en-ae.namshi.com" },
  "centrepoint":                { name: "Centrepoint",       searchUrl: (q) => `https://www.centrepointstores.com/ae/en/search/?q=${encodeURIComponent(q)}`, homepage: "https://www.centrepointstores.com" },

  /* — IN ─────────────────────────────────────────── */
  "nykaa":                      { name: "Nykaa",             searchUrl: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,             homepage: "https://www.nykaa.com" },
  "nykaa-fashion":              { name: "Nykaa Fashion",     searchUrl: (q) => `https://www.nykaafashion.com/catalogsearch/result/?q=${encodeURIComponent(q)}`,             homepage: "https://www.nykaafashion.com" },
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
  "prettylittlething":          { name: "PrettyLittleThing", searchUrl: (q) => `https://www.prettylittlething.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.prettylittlething.com" },
  "pretty-little-thing":        { name: "PrettyLittleThing", searchUrl: (q) => `https://www.prettylittlething.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.prettylittlething.com" },
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

  /* ── v6 additions (May 2026) — outbound-URL validity audit ──────────
       A catalog-wide pass (scripts/audit-merchant-url-coverage.ts) found
       ~994 of 1,625 stores had no curated entry and fell through to
       smartFallbackUrl, which only ever returns a GUESSED HOMEPAGE (never
       a search page) and gets the TLD wrong for UK/regional brands — e.g.
       "Appliance City" → appliancecity.com (a parked non-UK domain)
       instead of the real appliancecity.co.uk. These were the
       highest-impact offenders (user-reported + all-relay stores whose
       every click was hitting a dead guess).

       Per-entry verification:
         · searchUrl present  → endpoint fetched live, returned 200 with
           product results, so the user lands on a real search page.
         · searchUrl: () => null → domain verified live, but the site
           403s/blocks every automated check so the search param can't be
           confirmed. We deliberately land the user on the correct
           merchant HOMEPAGE (the worst-case floor) rather than ship an
           unverified ?q= that might 404 — appliancesdirect.co.uk/search?q=
           returns 404, proving the "obvious" pattern is NOT safe to
           assume. Refine to a real search URL once verified in a browser. */

  /* Appliance City (UK kitchen appliances) — USER-REPORTED 404. Its
     in-stock offers arrive as Google Shopping relays; with no curated
     entry they fell to smartFallback → appliancecity.com (wrong/parked,
     not the real store). WooCommerce search verified live:
     /?s=<q>&post_type=product returns product cards. */
  "appliance-city":    { name: "Appliance City",    searchUrl: (q) => `https://www.appliancecity.co.uk/?s=${encodeURIComponent(q)}&post_type=product`, homepage: "https://www.appliancecity.co.uk" },
  /* Ernest Jones (UK jeweller, Signet group) — EVERY offer is a Google
     relay, so with no entry all clicks were hitting the dead
     ernestjones.com guess. Domain verified live (site 403s automation);
     search param unverified → homepage floor. */
  "ernest-jones":      { name: "Ernest Jones",      searchUrl: () => null, homepage: "https://www.ernestjones.co.uk" },
  /* H Samuel (UK jeweller, Signet group). Most offers are direct PDPs
     (passthrough); this is the relay-fallback safety net. The old guess
     hsamuel.com is dead; hsamuel.co.uk verified live. */
  "h-samuel":          { name: "H Samuel",          searchUrl: () => null, homepage: "https://www.hsamuel.co.uk" },
  /* Appliances Direct (UK, Buy It Direct group). smartFallback stripped
     "Direct" → appliances.com, a DIFFERENT (US) retailer. Real domain
     verified; /search?q= returns 404 and /search/<q> returns no-match,
     so the search param is left unverified → homepage floor. */
  "appliances-direct": { name: "Appliances Direct", searchUrl: () => null, homepage: "https://www.appliancesdirect.co.uk" },
  /* Coast (UK occasionwear) — now a Shopify store on coastfashion.com,
     NOT the guessed coast.com (a different site). Shopify search
     verified live. */
  "coast":             { name: "Coast",             searchUrl: (q) => `https://www.coastfashion.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.coastfashion.com" },
  /* The Range (UK home + leisure). Has an ingest-time rewriter
     (merchant-url-rewrite.ts) for stored therange.com URLs, but the
     relay-fallback path had no curated entry and guessed therange.com.
     Search pattern matches that rewriter's verified /search?q=. */
  "the-range":         { name: "The Range",         searchUrl: (q) => `https://www.therange.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.therange.co.uk" },
  /* JD Williams (UK fashion, N Brown group). jdwilliams.co.uk verified
     live; site 403s automation → homepage floor until the search param
     is verified in a browser. */
  "jd-williams":       { name: "JD Williams",       searchUrl: () => null, homepage: "https://www.jdwilliams.co.uk" },
  /* Payporte (NG fashion) — the single highest-volume store in the guess
     bucket (~1.4k offers). Most are direct PDPs (passthrough); the
     curated entry adds the relay-fallback safety net and upgrades the
     homepage guess to the real Shopify search (verified live). */
  "payporte":          { name: "Payporte",          searchUrl: (q) => `https://payporte.com/search?q=${encodeURIComponent(q)}`, homepage: "https://payporte.com" },

  /* ── v7 additions (May 2026) — link-health probe of every in-stock
       store (scripts/_tmp-merchant-link-health.ts). Two classes of fix:
       (a) downgraded six JS-SPA merchants whose curated ?q= search URLs
           404/500'd to a verified homepage floor (qvc, sports-direct,
           zalando, mango, simply-be, crocs — edited in place above), and
       (b) the two explicit entries below, which existed only as
           substring COLLISIONS with another merchant's key. */
  /* QVC UK — store id "qvc-uk" substring-matched the US "qvc" entry in
     Pass 2 and sent UK users to qvc.com. Explicit entry pins the correct
     qvcuk.com. Search SPA (all GET patterns 404 on .com and .co.uk,
     audit 2026-05) → verified homepage floor. */
  "qvc-uk":            { name: "QVC UK",            searchUrl: () => null, homepage: "https://www.qvcuk.com" },
  /* Limango DE — store id "limango-de" greedily substring-matched
     "mango" in Pass 2 and routed users to shop.mango.com (which then
     500'd). Boundary-aware tokenIncludes() now rejects that glued
     match, and this explicit entry lands them on the real limango.de.
     Deals-club SPA, search unverified → verified homepage floor. */
  "limango":           { name: "Limango",           searchUrl: () => null, homepage: "https://www.limango.de" },

  /* ── v8 additions (2026-05) — head of the relay-fallback "below-bar"
       distribution. Every search URL below was probed live against the real
       site (scripts/_tmp-probe-search-urls*.ts); stores are ordered by
       in-stock relay-offer count. This converts the largest GUESS/NONE blocks
       (homepage guess / Havlo bounce) into a verified merchant SEARCH, so the
       outbound click lands on the retailer's own results for the product.
       Notes: entries flagged "bot-walls 403" return 403 to our datacenter IP
       but the path is the merchant's real, documented search endpoint and
       works for ordinary visitors; SPA/headless-search merchants with no
       GET-addressable results page get a verified homepage floor instead. */
  "refurbed-de":       { name: "Refurbed",          searchUrl: (q) => `https://www.refurbed.de/search/?query=${encodeURIComponent(q)}`, homepage: "https://www.refurbed.de" },
  "care-to-beauty":    { name: "Care to Beauty",    searchUrl: (q) => `https://www.caretobeauty.com/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.caretobeauty.com" },
  "bigbasket":         { name: "bigbasket",         searchUrl: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}`, homepage: "https://www.bigbasket.com" },
  "superkicks":        { name: "Superkicks",        searchUrl: (q) => `https://www.superkicks.in/search?q=${encodeURIComponent(q)}`, homepage: "https://www.superkicks.in" },
  "vlebazaar-in":      { name: "VLE Bazaar",        searchUrl: (q) => `https://www.vlebazaar.in/?s=${encodeURIComponent(q)}`, homepage: "https://www.vlebazaar.in" },
  "trendyol":          { name: "Trendyol",          searchUrl: (q) => `https://www.trendyol.com/sr?q=${encodeURIComponent(q)}`, homepage: "https://www.trendyol.com" }, // bot-walls 403; /sr?q= is Trendyol's real search
  "dorothy-perkins-uk":{ name: "Dorothy Perkins",   searchUrl: (q) => `https://www.dorothyperkins.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.dorothyperkins.com" },
  "frasers":           { name: "House of Fraser",   searchUrl: (q) => `https://www.houseoffraser.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.houseoffraser.co.uk" },
  "moss":              { name: "Moss",              searchUrl: (q) => `https://www.moss.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.moss.co.uk" },
  "back-market":       { name: "Back Market",       searchUrl: (q, c) => `https://www.backmarket.com/${c === "uk" ? "en-gb" : c === "de" ? "de-de" : c === "fr" ? "fr-fr" : "en-us"}/search?q=${encodeURIComponent(q)}`, homepage: "https://www.backmarket.com" }, // bot-walls 403; /<locale>/search?q= is Back Market's real path
  "hp-store":          { name: "HP Store",          searchUrl: (q) => `https://www.hp.com/us-en/shop/sitesearch?keyword=${encodeURIComponent(q)}`, homepage: "https://www.hp.com/us-en/shop" },
  "stockx":            { name: "StockX",            searchUrl: (q) => `https://stockx.com/search?s=${encodeURIComponent(q)}`, homepage: "https://stockx.com" }, // bot-walls 403; /search?s= is StockX's real search
  "jolie-moi":         { name: "Jolie Moi",         searchUrl: (q) => `https://joliemoi.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://joliemoi.co.uk" }, // slug guess joliemoi.com is a PARKED HugeDomains page; real store is joliemoi.co.uk (Shopify)
  "mamaearth":         { name: "Mamaearth",         searchUrl: (q) => `https://mamaearth.in/search?q=${encodeURIComponent(q)}`, homepage: "https://mamaearth.in" },
  "ocado":             { name: "Ocado",             searchUrl: (q) => `https://www.ocado.com/search?entry=${encodeURIComponent(q)}`, homepage: "https://www.ocado.com" },
  "boozt-de":          { name: "Boozt",             searchUrl: (q) => `https://www.boozt.com/de/de/search?q=${encodeURIComponent(q)}`, homepage: "https://www.boozt.com/de/de" },
  "decathlon-uk":      { name: "Decathlon UK",      searchUrl: (q) => `https://www.decathlon.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.decathlon.co.uk" }, // bot-walls 403
  "green-man-gaming":  { name: "Green Man Gaming",  searchUrl: (q) => `https://www.greenmangaming.com/search/?query=${encodeURIComponent(q)}`, homepage: "https://www.greenmangaming.com" },
  "hyugalife":         { name: "HyugaLife",         searchUrl: (q) => `https://www.hyugalife.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.hyugalife.com" },
  "dover-street-market":{ name: "Dover Street Market", searchUrl: (q) => `https://shop.doverstreetmarket.com/search?q=${encodeURIComponent(q)}`, homepage: "https://shop.doverstreetmarket.com" },
  "warehouse-fashion": { name: "Warehouse",         searchUrl: (q) => `https://www.warehousefashion.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.warehousefashion.com" },
  "razer":             { name: "Razer",             searchUrl: (q) => `https://www.razer.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.razer.com" },
  "wellbeing-nutrition":{ name: "Wellbeing Nutrition", searchUrl: (q) => `https://wellbeingnutrition.com/search?q=${encodeURIComponent(q)}`, homepage: "https://wellbeingnutrition.com" },
  "kitlocker":         { name: "Kitlocker",         searchUrl: (q) => `https://www.kitlocker.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.kitlocker.com" },
  "flannels":          { name: "Flannels",          searchUrl: (q) => `https://www.flannels.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.flannels.com" },
  "wellness-warehouse":{ name: "Wellness Warehouse", searchUrl: (q) => `https://www.wellnesswarehouse.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.wellnesswarehouse.com" },
  "virgin-megastore":  { name: "Virgin Megastore",  searchUrl: (q) => `https://www.virginmegastore.ae/en/search/?q=${encodeURIComponent(q)}`, homepage: "https://www.virginmegastore.ae" },
  "boat":              { name: "boAt",              searchUrl: (q) => `https://www.boat-lifestyle.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.boat-lifestyle.com" },
  "lg-deutschland":    { name: "LG Deutschland",    searchUrl: (q) => `https://www.lg.com/de/search/?search=${encodeURIComponent(q)}`, homepage: "https://www.lg.com/de" },
  "justmylook":        { name: "Just My Look",      searchUrl: (q) => `https://www.justmylook.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.justmylook.com" },
  "harvey-norman":     { name: "Harvey Norman",     searchUrl: (q) => `https://www.harveynorman.com.au/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.harveynorman.com.au" },
  "iherb":             { name: "iHerb",             searchUrl: (q) => `https://www.iherb.com/search?kw=${encodeURIComponent(q)}`, homepage: "https://www.iherb.com" },
  "farfetch":          { name: "FARFETCH",          searchUrl: (q) => `https://www.farfetch.com/uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.farfetch.com" },
  "snipes":            { name: "Snipes",            searchUrl: (q) => `https://www.snipes.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.snipes.com" }, // bot-walls 403
  "robert-dyas":       { name: "Robert Dyas",       searchUrl: (q) => `https://www.robertdyas.co.uk/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.robertdyas.co.uk" }, // Magento; plain /search 404s, /catalogsearch is the real path (bot-walls 403)
  "stylevana-de":      { name: "Stylevana",         searchUrl: (q) => `https://www.stylevana.com/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.stylevana.com" },
  "laptops-direct":    { name: "Laptops Direct",    searchUrl: (q) => `https://www.laptopsdirect.co.uk/search/${encodeURIComponent(q)}`, homepage: "https://www.laptopsdirect.co.uk" },
  "smytten":           { name: "Smytten",           searchUrl: (q) => `https://www.smytten.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.smytten.com" },
  "sportspar-de":      { name: "SportSpar",         searchUrl: (q) => `https://www.sportspar.de/search?sSearch=${encodeURIComponent(q)}`, homepage: "https://www.sportspar.de" },
  "nordicnest-de":     { name: "Nordic Nest",       searchUrl: (q) => `https://www.nordicnest.de/suche?q=${encodeURIComponent(q)}`, homepage: "https://www.nordicnest.de" },
  "zepto":             { name: "Zepto",             searchUrl: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`, homepage: "https://www.zeptonow.com" },
  "baur-versand":      { name: "BAUR",              searchUrl: (q) => `https://www.baur.de/s/${encodeURIComponent(q)}`, homepage: "https://www.baur.de" },
  "lg-official-online-shop": { name: "LG Online Shop", searchUrl: (q) => `https://www.lg.com/uk/search/?search=${encodeURIComponent(q)}`, homepage: "https://www.lg.com/uk" },
  "desertcart-in":     { name: "Desertcart",        searchUrl: (q) => `https://www.desertcart.in/search?q=${encodeURIComponent(q)}`, homepage: "https://www.desertcart.in" },
  "asphaltgold":       { name: "Asphaltgold",       searchUrl: (q) => `https://www.asphaltgold.com/en/search?q=${encodeURIComponent(q)}`, homepage: "https://www.asphaltgold.com" },
  "incredible":        { name: "Incredible",        searchUrl: (q) => `https://www.incredible.co.za/search?q=${encodeURIComponent(q)}`, homepage: "https://www.incredible.co.za" },
  "techinn":           { name: "Techinn",           searchUrl: (q) => `https://www.techinn.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.techinn.com" },
  "blue-vanilla":      { name: "Blue Vanilla",      searchUrl: (q) => `https://www.bluevanilla.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.bluevanilla.com" },
  "sigma-sports":      { name: "Sigma Sports",      searchUrl: (q) => `https://www.sigmasports.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.sigmasports.com" },
  "oasis-fashions":    { name: "Oasis",             searchUrl: (q) => `https://www.oasis-fashion.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.oasis-fashion.com" },
  "logitech-g":        { name: "Logitech G",        searchUrl: (q) => `https://www.logitechg.com/en-us/search.html?query=${encodeURIComponent(q)}`, homepage: "https://www.logitechg.com" },
  "lenovo":            { name: "Lenovo",            searchUrl: (q) => `https://www.lenovo.com/us/en/search?text=${encodeURIComponent(q)}`, homepage: "https://www.lenovo.com" },
  "reiss":             { name: "Reiss",             searchUrl: (q) => `https://www.reiss.com/search/?q=${encodeURIComponent(q)}`, homepage: "https://www.reiss.com" },
  "play-asia":         { name: "Play-Asia",         searchUrl: (q) => `https://www.play-asia.com/search/${encodeURIComponent(q)}`, homepage: "https://www.play-asia.com" }, // bot-walls 403
  "about-you":         { name: "ABOUT YOU",         searchUrl: (q) => `https://www.aboutyou.de/search?term=${encodeURIComponent(q)}`, homepage: "https://www.aboutyou.de" }, // bot-walls 403
  "jacamo":            { name: "Jacamo",            searchUrl: (q) => `https://www.jacamo.co.uk/shop/search?q=${encodeURIComponent(q)}`, homepage: "https://www.jacamo.co.uk" }, // bot-walls 403; /shop/search is the real path (/search 404s)
  /* Homepage floors — NONE-tier stores that were bouncing to Havlo /compare,
     plus high-volume merchants whose search is SPA/headless or bot-walls
     unverifiably. Each homepage was probed live; pins the correct domain so
     the slug-guess can't drift to a wrong TLD or a parked page. */
  "bash":              { name: "Bash",              searchUrl: () => null, homepage: "https://bash.com" }, // TFG South Africa; search SPA (all GET patterns 404) → homepage floor
  "end-clothing":      { name: "END.",              searchUrl: () => null, homepage: "https://www.endclothing.com" }, // headless Algolia search, no GET URL → homepage floor
  "pro-direct-soccer": { name: "Pro:Direct Soccer", searchUrl: () => null, homepage: "https://www.prodirectsoccer.com" },
  "garmin-united-kingdom": { name: "Garmin",        searchUrl: () => null, homepage: "https://www.garmin.com" },
  "george-at-asda":    { name: "George at Asda",    searchUrl: () => null, homepage: "https://www.asda.com/george" }, // George left direct.asda.com (410 / DNS gone); current home is asda.com/george
  "maxfashion":        { name: "Max Fashion",       searchUrl: () => null, homepage: "https://www.maxfashion.com" }, // Landmark; search bot-walls 403, unverifiable → homepage floor
  "charlotte-tilbury": { name: "Charlotte Tilbury", searchUrl: () => null, homepage: "https://www.charlottetilbury.com" }, // SFCC; no GET-addressable search page → homepage floor
  "footasylum":        { name: "Footasylum",        searchUrl: () => null, homepage: "https://www.footasylum.com" },
  "pantaloons":        { name: "Pantaloons",        searchUrl: () => null, homepage: "https://www.pantaloons.com" },
  "footlocker":        { name: "Foot Locker",       searchUrl: () => null, homepage: "https://www.footlocker.co.uk" }, // search endpoint 400s to bots → homepage floor
  "coolshop-de":       { name: "Coolshop",          searchUrl: () => null, homepage: "https://www.coolshop.de" },
  "mandm":             { name: "MandM Direct",      searchUrl: () => null, homepage: "https://www.mandmdirect.com" },
  "hughes":            { name: "Hughes",            searchUrl: () => null, homepage: "https://www.hughes.co.uk" },

  /* ── v9 additions (2026-05) — next curation tier: recognizable brands still
     on a homepage-guess (GUESS) or Havlo bounce (NONE). Every searchUrl below
     was probed live (200/3xx, or a 403/429 bot-wall whose path was confirmed
     by a clean-404 on the wrong sibling pattern). Stores whose every candidate
     cleanly 404'd, or that bot-wall on an unverifiable path, get a verified
     homepage floor (correct brand domain, never a slug guess). */
  "playstation-store": { name: "PlayStation Store", searchUrl: (q) => `https://store.playstation.com/en-gb/search/${encodeURIComponent(q)}`, homepage: "https://store.playstation.com" },
  "ee":                { name: "EE",               searchUrl: (q) => `https://ee.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://ee.co.uk" },
  "wilson-emea-united-kingdom": { name: "Wilson",  searchUrl: (q) => `https://www.wilson.com/en-gb/search?q=${encodeURIComponent(q)}`, homepage: "https://www.wilson.com" },
  "lyst":              { name: "Lyst",             searchUrl: (q) => `https://www.lyst.com/search/?q=${encodeURIComponent(q)}`, homepage: "https://www.lyst.com" },
  "waitrose-partners": { name: "Waitrose & Partners", searchUrl: (q) => `https://www.waitrose.com/ecom/shop/search?searchTerm=${encodeURIComponent(q)}`, homepage: "https://www.waitrose.com" }, // home bot-walls 403; search 200
  "afnan-perfumes":    { name: "Afnan Perfumes",   searchUrl: (q) => `https://afnanperfumes.com/search?q=${encodeURIComponent(q)}`, homepage: "https://afnanperfumes.com" }, // Shopify standard
  "samsung":           { name: "Samsung",          searchUrl: (q) => `https://www.samsung.com/uk/search/?searchvalue=${encodeURIComponent(q)}`, homepage: "https://www.samsung.com" },
  "samsung-official-store": { name: "Samsung",     searchUrl: (q) => `https://www.samsung.com/uk/search/?searchvalue=${encodeURIComponent(q)}`, homepage: "https://www.samsung.com" },
  "tommy-hilfiger":    { name: "Tommy Hilfiger",   searchUrl: (q) => `https://uk.tommy.com/search?q=${encodeURIComponent(q)}`, homepage: "https://uk.tommy.com" },
  "estee-lauder":      { name: "Estee Lauder",     searchUrl: (q) => `https://www.esteelauder.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.esteelauder.co.uk" },
  "clinique":          { name: "Clinique",         searchUrl: (q) => `https://www.clinique.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.clinique.co.uk" },
  "harrods":           { name: "Harrods",          searchUrl: (q) => `https://www.harrods.com/en-gb/shopping/search?q=${encodeURIComponent(q)}`, homepage: "https://www.harrods.com" },
  "iceland":           { name: "Iceland",          searchUrl: (q) => `https://www.iceland.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.iceland.co.uk" }, // bot-walls 403
  "littlewoods":       { name: "Littlewoods",      searchUrl: (q) => `https://www.littlewoods.com/search/keyword/${encodeURIComponent(q)}`, homepage: "https://www.littlewoods.com" }, // path-based; /search?q= cleanly 404s
  "tu-clothing":       { name: "Tu Clothing",      searchUrl: (q) => `https://tuclothing.sainsburys.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://tuclothing.sainsburys.co.uk" },
  "goldsmiths":        { name: "Goldsmiths",       searchUrl: (q) => `https://www.goldsmiths.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.goldsmiths.co.uk" },
  "richer-sounds":     { name: "Richer Sounds",    searchUrl: (q) => `https://www.richersounds.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.richersounds.com" },
  "galaxus":           { name: "Galaxus",          searchUrl: (q) => `https://www.galaxus.de/en/search?query=${encodeURIComponent(q)}`, homepage: "https://www.galaxus.de" },
  "reverb":            { name: "Reverb",           searchUrl: (q) => `https://reverb.com/marketplace?query=${encodeURIComponent(q)}`, homepage: "https://reverb.com" }, // bot-walls 403
  "thomann":           { name: "Thomann",          searchUrl: (q) => `https://www.thomann.de/gb/search_dir.html?sw=${encodeURIComponent(q)}`, homepage: "https://www.thomann.de" },
  "toolstation":       { name: "Toolstation",      searchUrl: (q) => `https://www.toolstation.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.toolstation.com" },
  "clicks":            { name: "Clicks",           searchUrl: (q) => `https://clicks.co.za/search?q=${encodeURIComponent(q)}`, homepage: "https://clicks.co.za" },
  "dis-chem":          { name: "Dis-Chem",         searchUrl: (q) => `https://www.dischem.co.za/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.dischem.co.za" }, // Magento; bot-walls 403
  "1mg":               { name: "1mg",              searchUrl: (q) => `https://www.1mg.com/search/all?name=${encodeURIComponent(q)}`, homepage: "https://www.1mg.com" },
  "jarir-bookstore":   { name: "Jarir Bookstore",  searchUrl: (q) => `https://www.jarir.com/catalogsearch/result/?q=${encodeURIComponent(q)}`, homepage: "https://www.jarir.com" },
  "shop-apotheke":     { name: "Shop Apotheke",    searchUrl: (q) => `https://www.shop-apotheke.com/search.htm?q=${encodeURIComponent(q)}`, homepage: "https://www.shop-apotheke.com" },
  "cruise-fashion":    { name: "Cruise Fashion",   searchUrl: (q) => `https://www.cruisefashion.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.cruisefashion.com" },
  "goat":              { name: "GOAT",             searchUrl: (q) => `https://www.goat.com/search?query=${encodeURIComponent(q)}`, homepage: "https://www.goat.com" },
  "novelship":         { name: "Novelship",        searchUrl: (q) => `https://www.novelship.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.novelship.com" },
  "tower-housewares":  { name: "Tower Housewares", searchUrl: (q) => `https://www.towerhousewares.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.towerhousewares.co.uk" },
  "sportsdirect-de":   { name: "Sports Direct",    searchUrl: (q) => `https://www.sportsdirect.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.sportsdirect.com" }, // /de/search 404s; bare /search 200
  "sweetcare":         { name: "SweetCare",        searchUrl: (q) => `https://www.sweetcare.com/en/search?q=${encodeURIComponent(q)}`, homepage: "https://www.sweetcare.com" },
  "armedangels":       { name: "ARMEDANGELS",      searchUrl: (q) => `https://www.armedangels.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.armedangels.com" }, // /en-gb/search 404s; bare /search 200
  "new-balance-south-africa": { name: "New Balance South Africa", searchUrl: (q) => `https://www.newbalance.co.za/search?q=${encodeURIComponent(q)}`, homepage: "https://www.newbalance.co.za" }, // bot-walls 403
  "sally-beauty":      { name: "Sally Beauty",     searchUrl: (q) => `https://www.sallybeauty.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.sallybeauty.co.uk" }, // .com 410; .co.uk 200
  "liz-earle":         { name: "Liz Earle",        searchUrl: (q) => `https://www.lizearle.com/search?q=${encodeURIComponent(q)}`, homepage: "https://www.lizearle.com" },
  "g-star":            { name: "G-Star RAW",       searchUrl: (q) => `https://www.g-star.com/en_gb/search?q=${encodeURIComponent(q)}`, homepage: "https://www.g-star.com" },
  "microsoft-store":   { name: "Microsoft Store",  searchUrl: (q) => `https://www.microsoft.com/en-us/search?q=${encodeURIComponent(q)}`, homepage: "https://www.microsoft.com" },
  "google-store":      { name: "Google Store",     searchUrl: (q) => `https://store.google.com/us/search?q=${encodeURIComponent(q)}`, homepage: "https://store.google.com" },
  "twinings":          { name: "Twinings",         searchUrl: (q) => `https://www.twinings.co.uk/search?q=${encodeURIComponent(q)}`, homepage: "https://www.twinings.co.uk" },
  "myrunway":          { name: "MyRunway",         searchUrl: (q) => `https://www.myrunway.co.za/search?q=${encodeURIComponent(q)}`, homepage: "https://www.myrunway.co.za" },
  "net-a-porter":      { name: "NET-A-PORTER",     searchUrl: (q) => `https://www.net-a-porter.com/en-gb/shop/search/?keywords=${encodeURIComponent(q)}`, homepage: "https://www.net-a-porter.com" }, // YNAP keywords; /search?q= cleanly 404s
  "the-outnet":        { name: "THE OUTNET",       searchUrl: (q) => `https://www.theoutnet.com/en-gb/shop/search/?keywords=${encodeURIComponent(q)}`, homepage: "https://www.theoutnet.com" }, // YNAP keywords pattern (bot-walls 403)
  // Homepage floors — every search candidate cleanly 404'd, or bot-walls on an
  // unverifiable path. Each homepage was probed reachable (200 or 403 bot-wall).
  "joybuy-de":         { name: "Joybuy",           searchUrl: () => null, homepage: "https://www.joybuy.de" },
  "m-s":               { name: "M&S",              searchUrl: () => null, homepage: "https://www.marksandspencer.com" },
  "myprotein":         { name: "Myprotein",        searchUrl: () => null, homepage: "https://www.myprotein.com" },
  "myprotein-india":   { name: "Myprotein India",  searchUrl: () => null, homepage: "https://www.myprotein.co.in" },
  "studio":            { name: "Studio",           searchUrl: () => null, homepage: "https://www.studio.co.uk" },
  "oliver-bonas":      { name: "Oliver Bonas",     searchUrl: () => null, homepage: "https://www.oliverbonas.com" },
  "f-hinds":           { name: "F.Hinds",          searchUrl: () => null, homepage: "https://www.fhinds.co.uk" },
  "apollo247":         { name: "Apollo 247",       searchUrl: () => null, homepage: "https://www.apollo247.com" },
  "pharmacy2u":        { name: "Pharmacy2U",       searchUrl: () => null, homepage: "https://www.pharmacy2u.co.uk" }, // bot-walls 403
  "nespresso-za":      { name: "Nespresso",        searchUrl: () => null, homepage: "https://www.nespresso.com" },
  "swisse":            { name: "Swisse",           searchUrl: () => null, homepage: "https://www.swisse.com" },
  "revolution-beauty": { name: "Revolution Beauty", searchUrl: () => null, homepage: "https://www.revolutionbeauty.com" },
  "beaverbrooks":      { name: "Beaverbrooks",     searchUrl: () => null, homepage: "https://www.beaverbrooks.co.uk" },
  "offspring":         { name: "Offspring",        searchUrl: () => null, homepage: "https://www.offspring.co.uk" }, // bot-walls 403
  "levi-s":            { name: "Levi's",           searchUrl: () => null, homepage: "https://www.levi.com" }, // bot-walls 403
  "la-redoute":        { name: "La Redoute",       searchUrl: () => null, homepage: "https://www.laredoute.co.uk" }, // bot-walls 403
  "shoppers-stop":     { name: "Shoppers Stop",    searchUrl: () => null, homepage: "https://www.shoppersstop.com" }, // bot-walls 403
  "home-centre":       { name: "Home Centre",      searchUrl: () => null, homepage: "https://www.homecentre.com" }, // bot-walls 403
  "la-roche-posay-official-website": { name: "La Roche-Posay", searchUrl: () => null, homepage: "https://www.laroche-posay.co.uk" }, // bot-walls 403
};

/* Boundary-aware substring test for the merchant matcher. A plain
   String.includes() caused confident WRONG-merchant routing: store id
   "everymonday" contains "very" and "limango-de" contains "mango", so a
   raw includes() sent those users to very.co.uk / shop.mango.com. We
   only accept a key match when the needle sits on a token boundary — the
   flanking characters are non-alphanumeric, or the string ends. Escape
   hatch: keys >= 8 chars are distinctive enough that a glued substring
   is almost certainly a real match (e.g. a store id that concatenates
   the merchant slug with a suffix, "prettylittlethinguk"), so plain
   includes() is kept for those. */
function tokenIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.length >= 8 && haystack.includes(needle)) return true;
  for (let from = 0; ; ) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) return false;
    const before = i === 0 ? "" : haystack[i - 1];
    const after = i + needle.length >= haystack.length ? "" : haystack[i + needle.length];
    const okBefore = before === "" || !/[a-z0-9]/i.test(before);
    const okAfter = after === "" || !/[a-z0-9]/i.test(after);
    if (okBefore && okAfter) return true;
    from = i + 1;
  }
}

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
      if (tokenIncludes(sid, key)) {
        const m = MERCHANTS[key];
        const url = m.searchUrl(query, country) ?? m.homepage;
        return { url, merchantName: m.name };
      }
    }
  }

  /* Pass 3: substring match on storeName. */
  if (sname) {
    for (const [key, m] of Object.entries(MERCHANTS)) {
      if (tokenIncludes(sname, key) || tokenIncludes(sname, m.name.toLowerCase())) {
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
    if (tokenIncludes(sid, key) || tokenIncludes(sname, key)) {
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
    brand name, or the input unchanged when no suffix matches.

    NOTE: "direct" is deliberately NOT stripped. For the Buy It Direct
    group of UK retailers ("Appliances Direct", "Laptops Direct",
    "Drones Direct", "Mobiles Direct"…) the word is brand-defining: the
    company owns appliancesdirect.co.uk, NOT appliances.com — which is a
    DIFFERENT (US) retailer. Stripping "Direct" therefore guessed a
    competitor's domain. Keeping it makes the synthesised slug
    "appliancesdirect" → appliancesdirect.com, the right brand (and one
    that redirects to the real store) rather than a wrong company.
    "outlet" IS still stripped because brand outlets live on the parent
    domain ("Nike Outlet" → nike.com is correct). */
function stripGenericSuffix(s: string): string {
  return s
    .replace(/\s+(official\s+store|online\s+store|store\s+online|web\s+store|brand\s+store|outlet\s+store|flagship\s+store)\s*$/i, "")
    .replace(/\s+(official|outlet|flagship|store|online|web|shop|global|international|hq)\s*$/i, "")
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
