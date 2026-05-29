/* SEO helpers — JSON-LD builders + hreflang map.

   Single source of truth for structured data so Organization /
   WebSite / BreadcrumbList tags don't drift between pages.
   ────────────────────────────────────────────────────────────────── */

import { ACTIVE_COUNTRIES } from "./country";

export const SITE_URL  = "https://havlo.io";
export const SITE_NAME = "Havlo";

/* ── Hreflang ─────────────────────────────────────────────────────
   Build x-default + per-country language alternates for any path
   under /[country]/. Returns the shape Next.js expects in
   metadata.alternates.languages. */
export function buildHreflangAlternates(pathBelowCountry: string = ""): Record<string, string> {
  const path = pathBelowCountry.replace(/^\/+/, "");
  const alternates: Record<string, string> = {};

  /* URL slug → ISO 3166-1 alpha-2 country code for hreflang.
     'uk' is OUR routing slug but the valid ISO code is 'GB'. Google
     silently ignores 'en-UK' as malformed, so it has to be remapped
     to 'en-GB' for hreflang to actually work. Other countries already
     use their ISO code as the slug. */
  const HREFLANG_REGION: Record<string, string> = {
    uk: "GB",
  };

  /* Iterate active markets only — emitting hreflang alternates for
     a deferred-launch country (e.g. /de/) when the middleware redirects
     /de/ to /uk/ tells Google "this URL is the German variant" while
     simultaneously redirecting it, which surfaces as Duplicate Content
     or "Crawled - currently not indexed" in Search Console. Drop the
     alternative until DE actually launches. */
  for (const c of ACTIVE_COUNTRIES) {
    /* Use language-region tag (en-NG, en-US, en-GB, en-AE, en-IN, en-ZA)
       so Google can route the right variant to the right audience. */
    const region = HREFLANG_REGION[c.code] ?? c.code.toUpperCase();
    const lang = c.code === "de" ? "de-DE" : `en-${region}`;
    alternates[lang] = `${SITE_URL}/${c.code}${path ? `/${path}` : ""}`;
  }

  /* x-default → fall back to NG (Havlo's primary market) */
  alternates["x-default"] = `${SITE_URL}/ng${path ? `/${path}` : ""}`;

  return alternates;
}

/* ── Organization JSON-LD ────────────────────────────────────────
   Identifies Havlo as the entity behind the site. Helps Google
   build the knowledge panel + brand signals. */
export const organizationJsonLd = {
  "@context":   "https://schema.org",
  "@type":      "Organization",
  "@id":        `${SITE_URL}#organization`,
  name:         SITE_NAME,
  legalName:    "Havlo",
  url:          SITE_URL,
  /* Concrete PNG (not the SVG icon route). Google's Knowledge Graph
     parser handles SVG poorly and the Rich Results validator warned
     "Logo URL did not resolve to a valid image" pointing at /icon.
     The PNG is the same icon shipped via /icon.png, served as
     image/png with explicit dimensions. */
  logo: {
    "@type":  "ImageObject",
    url:      `${SITE_URL}/icon.png`,
    width:    512,
    height:   512,
  },
  description:  "Independent price-comparison and product-discovery platform serving shoppers in Nigeria, UK, US, India, UAE, and South Africa.",
  sameAs: [
    /* Verified social accounts. Google reads these for entity
       verification + sitelinks; helps unlock the knowledge-panel
       social row in branded search results. Add new accounts as
       they're claimed (X, TikTok, LinkedIn, etc.). */
    "https://instagram.com/havlo.io",
  ],
  contactPoint: {
    "@type":     "ContactPoint",
    email:       "hello@havlo.io",
    contactType: "customer support",
    url:         `${SITE_URL}/contact`,
    availableLanguage: ["en"],
  },
};

/* ── WebSite JSON-LD with SearchAction ───────────────────────────
   Unlocks the sitelinks search box in Google results — a search
   field directly under havlo.io's main result that routes to
   /compare?q=<term>. Major CTR boost. */
export const websiteJsonLd = {
  "@context":  "https://schema.org",
  "@type":     "WebSite",
  "@id":       `${SITE_URL}#website`,
  url:         SITE_URL,
  name:        SITE_NAME,
  description: "Find similar products for less. Paste any link or search anything.",
  publisher:   { "@id": `${SITE_URL}#organization` },
  potentialAction: {
    "@type":  "SearchAction",
    /* Target a route that ACTUALLY performs a search server-side.
       Previously pointed at /compare?q= but the un-prefixed /compare
       route is the global landing screen and doesn't run the query
       until the user submits manually. /ng/deals?search= matches
       the homepage textarea form's actual behaviour: visitor types,
       form submits, /deals renders matching results. NG is the
       primary market so the sitelinks search box defaults there;
       a visitor whose locale resolves elsewhere is routed by middleware
       to their country page from the landing surface. */
    target: {
      "@type":     "EntryPoint",
      urlTemplate: `${SITE_URL}/ng/deals?search={search_term_string}&origin=all`,
    },
    "query-input": "required name=search_term_string",
  },
};

/* ── BreadcrumbList builder ──────────────────────────────────────
   Used by /deals + /compare + future deep pages. */
export function buildBreadcrumbList(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type":   "ListItem",
      position:  i + 1,
      name:      it.name,
      item:      it.url,
    })),
  };
}

/* ── ItemList JSON-LD for product feeds ──────────────────────────
   When given a list of trending deals, returns an ItemList of
   Product entries. Helps Google surface the page as a product
   listing in rich results. */
export interface SeoDeal {
  title:           string;
  url:             string;
  imageUrl?:       string;
  storeName:       string;
  salePrice:       number;
  originalPrice:   number;
  currency:        string;
  discountPercent: number;
  /** Real product brand if known. Falls back to storeName ONLY when
      omitted by caller — but callers should always pass this when
      products.brand is populated (most are after the May 29 2026
      signature pass). */
  brand?:          string | null;
}

export function buildItemListJsonLd(deals: SeoDeal[], listName: string = "Trending deals on Havlo") {
  return {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    name:       listName,
    numberOfItems: deals.length,
    itemListElement: deals.slice(0, 24).map((d, i) => ({
      "@type":   "ListItem",
      position:  i + 1,
      item: {
        "@type":     "Product",
        name:        d.title,
        url:         d.url,
        image:       d.imageUrl,
        /* Use the product's actual brand when known. Storing the
           store name as the brand was a launch-day mis-modeling
           that Rich Results occasionally flagged ("Product brand
           does not match domain content"). Falls back to omitting
           the field rather than misrepresenting it. */
        brand:       d.brand
          ? { "@type": "Brand", name: d.brand }
          : undefined,
        offers: {
          "@type":          "Offer",
          price:            d.salePrice,
          priceCurrency:    d.currency,
          availability:     "https://schema.org/InStock",
          seller:           { "@type": "Organization", name: d.storeName },
        },
      },
    })),
  };
}
