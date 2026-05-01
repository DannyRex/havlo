/* SEO helpers — JSON-LD builders + hreflang map.

   Single source of truth for structured data so Organization /
   WebSite / BreadcrumbList tags don't drift between pages.
   ────────────────────────────────────────────────────────────────── */

import { COUNTRIES } from "./country";

export const SITE_URL  = "https://havlo.io";
export const SITE_NAME = "Havlo";

/* ── Hreflang ─────────────────────────────────────────────────────
   Build x-default + per-country language alternates for any path
   under /[country]/. Returns the shape Next.js expects in
   metadata.alternates.languages. */
export function buildHreflangAlternates(pathBelowCountry: string = ""): Record<string, string> {
  const path = pathBelowCountry.replace(/^\/+/, "");
  const alternates: Record<string, string> = {};

  for (const c of COUNTRIES) {
    /* Use language-region tag (en-NG, en-US, en-GB, en-AE, de-DE, en-IN, en-ZA)
       so Google can route the right variant to the right audience. */
    const lang = c.code === "de" ? "de-DE" : `en-${c.code.toUpperCase()}`;
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
  url:          SITE_URL,
  logo:         `${SITE_URL}/icon`,
  description:  "Independent price-comparison and product-discovery platform serving shoppers in Nigeria and globally.",
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
  description: "Find similar products for less — paste any link or search anything.",
  publisher:   { "@id": `${SITE_URL}#organization` },
  potentialAction: {
    "@type":  "SearchAction",
    target: {
      "@type":     "EntryPoint",
      urlTemplate: `${SITE_URL}/compare?q={search_term_string}`,
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
        brand:       d.storeName,
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
