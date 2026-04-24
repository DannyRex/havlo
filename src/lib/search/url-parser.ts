/**
 * Parse e-commerce URLs from supported stores.
 * Extracts store ID and searchable product terms from the URL path/params.
 */

interface ParsedUrl {
  storeId: string;
  storeName: string;
  /** Best-effort product search terms extracted from the URL slug */
  searchTerms: string;
  /** The original URL for matching against scraped data */
  originalUrl: string;
}

const URL_PATTERNS: {
  re: RegExp;
  storeId: string;
  storeName: string;
  extractTerms: (match: RegExpMatchArray, url: URL) => string;
}[] = [
  // Jumia: /product-name-123456.html or /catalog/productofferspage/.../product-name.html
  {
    re: /jumia\.com\.ng/i,
    storeId: "jumia",
    storeName: "Jumia",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      // Remove .html, product IDs, and clean slug
      return slugToTerms(last.replace(/\.html$/i, "").replace(/-\d{5,}$/, ""));
    },
  },
  // Konga: /product/product-name-123456
  {
    re: /konga\.com/i,
    storeId: "konga",
    storeName: "Konga",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const slug = parts[parts.length - 1] ?? "";
      return slugToTerms(slug.replace(/-\d{5,}$/, ""));
    },
  },
  // Amazon: /dp/ASIN or /product-name/dp/ASIN
  {
    re: /amazon\.(com|co\.uk|de|in|com\.au)/i,
    storeId: "amazon",
    storeName: "Amazon",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const dpIdx = parts.indexOf("dp");
      if (dpIdx > 0) {
        // Slug before /dp/ is the product name
        return slugToTerms(parts[dpIdx - 1]);
      }
      // Try last meaningful segment
      return slugToTerms(parts[0] ?? "");
    },
  },
  // AliExpress: /item/123456.html or /item/product-name_123456.html
  {
    re: /aliexpress\.com/i,
    storeId: "aliexpress",
    storeName: "AliExpress",
    extractTerms: (_m, url) => {
      const q = url.searchParams.get("SearchText");
      if (q) return q;
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      return slugToTerms(last.replace(/\.html$/i, "").replace(/_?\d{8,}/, ""));
    },
  },
  // Jiji: /product/slug-abc123.html
  {
    re: /jiji\.ng/i,
    storeId: "jiji",
    storeName: "Jiji",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      return slugToTerms(last.replace(/\.html$/i, "").replace(/-[a-z0-9]{6,}$/i, ""));
    },
  },
  // Slot: /product/slug
  {
    re: /slot\.ng/i,
    storeId: "slot",
    storeName: "Slot",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      return slugToTerms(parts[parts.length - 1] ?? "");
    },
  },
  // 3C Hub
  {
    re: /3chub\.com/i,
    storeId: "threechub",
    storeName: "3C Hub",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      return slugToTerms(parts[parts.length - 1] ?? "");
    },
  },
  // ASOS
  {
    re: /asos\.com/i,
    storeId: "asos",
    storeName: "ASOS",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const slug = parts.find((p) => p.includes("-") && !p.startsWith("prd")) ?? parts[parts.length - 1] ?? "";
      return slugToTerms(slug.replace(/prd\/\d+/i, ""));
    },
  },
  // Shein
  {
    re: /shein\.com/i,
    storeId: "shein",
    storeName: "Shein",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      return slugToTerms(last.replace(/-p-\d+.*$/i, "").replace(/\.html$/i, ""));
    },
  },
  // Temu
  {
    re: /temu\.com/i,
    storeId: "temu",
    storeName: "Temu",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      return slugToTerms(last.replace(/\.html$/i, "").replace(/-g-\d+.*$/i, ""));
    },
  },
  // DHgate
  {
    re: /dhgate\.com/i,
    storeId: "dhgate",
    storeName: "DHgate",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const slug = parts.find((p) => p.includes("-")) ?? parts[parts.length - 1] ?? "";
      return slugToTerms(slug.replace(/\d{6,}\.html$/i, ""));
    },
  },
  // Spar Nigeria
  {
    re: /spar\.com\.ng/i,
    storeId: "spar",
    storeName: "Spar",
    extractTerms: (_m, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      return slugToTerms(parts[parts.length - 1] ?? "");
    },
  },
];

/** Convert a URL slug like "samsung-galaxy-a06-128gb" into "samsung galaxy a06 128gb" */
function slugToTerms(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/[^a-zA-Z0-9\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Check if a string looks like a URL */
export function isUrl(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) || /^(www\.|[a-z]+\.(com|ng|co))/i.test(trimmed);
}

/** Parse a store URL into structured data. Returns null for unsupported URLs. */
export function parseStoreUrl(rawUrl: string): ParsedUrl | null {
  let urlStr = rawUrl.trim();
  if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`;

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }

  for (const pattern of URL_PATTERNS) {
    const match = url.hostname.match(pattern.re);
    if (match) {
      const searchTerms = pattern.extractTerms(match, url);
      if (!searchTerms) return null;
      return {
        storeId: pattern.storeId,
        storeName: pattern.storeName,
        searchTerms,
        originalUrl: urlStr,
      };
    }
  }
  return null;
}
