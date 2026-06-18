/* SEO helpers — JSON-LD builders + hreflang map.

   Single source of truth for structured data so Organization /
   WebSite / BreadcrumbList tags don't drift between pages.
   ────────────────────────────────────────────────────────────────── */

import { ACTIVE_COUNTRIES } from "./country";
import { displayStoreName } from "./store-display";

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

  /* x-default → the bare brand homepage `/` for the homepage itself (now a
     real indexable page at the root), so the whole homepage cluster (/, /ng,
     /uk, …) agrees on `/` as the default. Deeper paths keep NG (primary
     market) as their x-default since there is no root-level variant of them. */
  alternates["x-default"] = path ? `${SITE_URL}/ng/${path}` : `${SITE_URL}/`;

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
  slogan:       "Shop smarter.",
  /* Markets + topics reinforce Havlo as a multi-market shopping-comparison
     ENTITY. This is the disambiguation lever for the bare-term "havlo"
     SERP, which is currently dominated by an unrelated music artist named
     Havlo: the more concrete, cross-referenced brand signal Google has, the
     sooner it can tell the two apart. The bigger half of this lever is
     OFF-site — see the sameAs note below. */
  areaServed:   ["Nigeria", "United Kingdom", "United States", "India", "United Arab Emirates", "South Africa"],
  knowsAbout:   ["Price comparison", "Online shopping deals", "Product price tracking", "Cross-border shopping"],
  sameAs: [
    /* Verified social accounts. Google cross-references these to build +
       disambiguate the entity and to unlock the knowledge-panel social row
       in branded search. ONLY Instagram is live today — Instagram alone
       will NOT out-signal the music artist. Claim X, LinkedIn (company),
       Facebook, TikTok and YouTube as "Havlo", link havlo.io from each
       profile, then add the URLs here. That cross-link is what moves it. */
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

/* ── Commerce identifiers (Product JSON-LD) ───────────────────────
   GTIN validation for schema.org. Retailer feeds carry plenty of
   junk in the gtin column — internal SKUs zero-padded to 8/14 digits
   (e.g. "00000523") sit right next to real barcodes. Google's Rich
   Results validator rejects a GTIN that fails its mod-10 check digit,
   and emitting an invalid one is worse than emitting none, so we:
   strip to digits, require a valid GTIN length (8/12/13/14), verify
   the check digit, and only then return it for the generic `gtin`
   property (which subsumes gtin8/12/13/14). Leading zeros are
   significant for GTIN identity and preserved. */
export function canonicalGtin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(d.length)) return null;
  /* Mod-10 check digit, anchored at the rightmost data digit so it
     validates zero-padded forms too: a UPC-12 padded to GTIN-14 stays
     valid because the leading zeros contribute nothing to the weighted
     sum regardless of their position. */
  let sum = 0;
  for (let i = 0; i < d.length - 1; i++) {
    const digit = d.charCodeAt(d.length - 2 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== d.charCodeAt(d.length - 1) - 48) return null;
  return d;
}

/* MPN is a free-form manufacturer part number — there's no check
   digit to verify, so just guard against empty / absurd values:
   trim, require at least one alphanumeric, cap the length. Returns
   null when unusable so the JSON-LD omits the field rather than
   carrying noise. */
export function cleanMpn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.length === 0 || s.length > 70) return null;
  if (!/[a-z0-9]/i.test(s)) return null;
  return s;
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
          seller:           { "@type": "Organization", name: displayStoreName(d.storeName) },
        },
      },
    })),
  };
}
